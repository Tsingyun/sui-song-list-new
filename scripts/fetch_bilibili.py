# -*- coding: utf-8 -*-
"""Phase 1: Fetch all video data from 3 Bilibili collections (with retry & rate limit)."""
import requests
import json
import time
import os
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

COLLECTIONS = [
    {'mid': 37441530, 'season_id': 3194603, 'desc': '歌切合集（2024.6至今）'},
    {'mid': 37441530, 'season_id': 1004362, 'desc': '歌切合集（2022.12-2024.6）'},
    {'mid': 9669499,  'season_id': 6453496,  'desc': '歌切（用户9669499）'},
]

API_URL = 'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://space.bilibili.com/',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://space.bilibili.com',
}

VIDEO_FILE = os.path.join(DATA_DIR, 'bilibili_videos.json')
PROGRESS_FILE = os.path.join(DATA_DIR, 'fetch_progress.json')

# Load existing videos
try:
    with open(VIDEO_FILE, 'r', encoding='utf-8') as f:
        existing = json.load(f)
        all_videos = {v['bvid']: v for v in existing}
        print(f'Loaded {len(all_videos)} existing videos')
except:
    all_videos = {}

# Load fetch progress (last successful page per collection)
try:
    with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
        progress = json.load(f)
        print(f'Loaded progress: {progress}')
except:
    progress = {}

session = requests.Session()
session.headers.update(HEADERS)

PAGE_SIZE = 30  # Keep consistent with previously fetched data
PAGE_DELAY = 3  # Seconds between pages
COLLECTION_DELAY = 30  # Seconds between collections
RATE_LIMIT_COOLDOWN = 60  # Seconds to wait on -352 before retry

def fetch_page(mid, sid, page, retries=3):
    for attempt in range(retries):
        try:
            resp = session.get(API_URL, params={
                'mid': mid, 'season_id': sid,
                'page_num': page, 'page_size': PAGE_SIZE, 'sort_reverse': False,
            }, timeout=15)
            data = resp.json()
            if data.get('code') == 0:
                return data['data']
            elif data.get('code') == -352:
                wait = RATE_LIMIT_COOLDOWN * (attempt + 1)
                print(f'    Rate limited (-352), cooling down {wait}s (attempt {attempt+1}/{retries})...')
                time.sleep(wait)
            else:
                print(f'    API error: {data.get("code")} - {data.get("message")}')
                return None
        except Exception as e:
            print(f'    Request error: {e}')
            time.sleep(10)
    return None

def save_progress():
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f)

def save_videos():
    with open(VIDEO_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(all_videos.values()), f, ensure_ascii=False, indent=2)

for col in COLLECTIONS:
    mid = col['mid']
    sid = col['season_id']
    desc = col['desc']
    col_key = f'{mid}/{sid}'

    # Check if already fully fetched
    existing_count = sum(1 for v in all_videos.values() if v.get('source') == col_key)
    resume_page = progress.get(col_key, {}).get('last_page', 0) + 1

    if progress.get(col_key, {}).get('done'):
        print(f'\n=== Skipping: {desc} (already done, {existing_count} videos) ===')
        continue

    print(f'\n=== Fetching: {desc} (mid={mid}, season_id={sid}) ===')
    if resume_page > 1:
        print(f'  Resuming from page {resume_page} (already have {existing_count} videos)')

    page = resume_page
    total_fetched = (resume_page - 1) * PAGE_SIZE  # Approximate
    consecutive_rate_limits = 0

    while True:
        result = fetch_page(mid, sid, page)
        if not result:
            print(f'  Failed to get page {page}')
            # Save progress for resume
            progress[col_key] = {'last_page': page - 1, 'done': False}
            save_progress()
            save_videos()
            break

        archives = result.get('archives', [])
        meta = result.get('meta', {})
        total = meta.get('total', 0)

        new_count = 0
        for v in archives:
            bvid = v.get('bvid', '')
            if bvid and bvid not in all_videos:
                all_videos[bvid] = {
                    'bvid': bvid,
                    'title': v.get('title', ''),
                    'duration': v.get('duration', 0),
                    'pubdate': v.get('pubdate', 0),
                    'date': datetime.fromtimestamp(v.get('pubdate', 0)).strftime('%Y-%m-%d') if v.get('pubdate') else '',
                    'pic': v.get('pic', ''),
                    'source': col_key,
                }
                new_count += 1

        total_fetched += len(archives)
        print(f'  Page {page}: {len(archives)} videos ({new_count} new) [{total_fetched}/{total}]')

        if total_fetched >= total or len(archives) == 0:
            progress[col_key] = {'last_page': page, 'done': True}
            save_progress()
            break

        page += 1
        consecutive_rate_limits = 0
        time.sleep(PAGE_DELAY)

        # Save periodically every 5 pages
        if page % 5 == 0:
            save_videos()
            progress[col_key] = {'last_page': page - 1, 'done': False}
            save_progress()

    print(f'  Collection done: ~{total_fetched} fetched, total unique: {len(all_videos)}')
    save_videos()
    time.sleep(COLLECTION_DELAY)

print(f'\n=== Total unique videos: {len(all_videos)} ===')

# Save final
save_videos()
print(f'Saved to: {VIDEO_FILE}')

# Stats
by_source = {}
for v in all_videos.values():
    s = v.get('source', 'unknown')
    by_source[s] = by_source.get(s, 0) + 1
for s, c in by_source.items():
    print(f'  {s}: {c} videos')
