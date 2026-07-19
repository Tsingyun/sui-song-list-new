"""
Match scraped B站歌切 clips into data/song_bilibili_map.json.

默认无 cookie 即可抓取（普通浏览器可访问）。仅当设置了 BILI_COOKIE 时才带登录态。

Usage:
  # 无 cookie 直接抓最新并匹配：
  python match_clips.py --save-clips /tmp/bili_clips.json
  # 复用缓存的 clips（完全离线，不需要 cookie）：
  python match_clips.py --clips-file /tmp/bili_clips.json
"""
import argparse
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_bilibili_playlist import scrape

BASE = r'C:\Users\Tsing\WorkBuddy\2026-06-14-11-54-35\sui-song-list-new'
PLAYLIST = "https://space.bilibili.com/9669499/lists/6453496?type=season"


def name_from_title(title):
    m = re.match(r'【岁己SUI】(.*?)【(\d{8})歌切】', title)
    if m:
        return m.group(1).strip(), m.group(2)
    m2 = re.match(r'【岁己SUI】(.*)', title)
    if m2:
        return m2.group(1).strip(), None
    return None, None


def dur_to_sec(d):
    if not d:
        return 0
    parts = d.split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except Exception:
        return 0
    return 0


async def run(save_clips=None, clips_file=None, max_pages=3):
    if clips_file and os.path.exists(clips_file):
        with open(clips_file, encoding='utf-8') as f:
            vids = json.load(f)
        print(f'loaded {len(vids)} clips from {clips_file}')
    else:
        # cookie 可选：设置了 BILI_COOKIE 才带，否则无登录直接抓
        cookie = os.environ.get('BILI_COOKIE', '')
        vids = await scrape(PLAYLIST, cookie, max_pages)
        if save_clips:
            with open(save_clips, 'w', encoding='utf-8') as f:
                json.dump(vids, f, ensure_ascii=False, indent=2)
            print(f'saved clips to {save_clips}')

    with open(os.path.join(BASE, 'data', 'song_data.json'), encoding='utf-8') as f:
        data = json.load(f)
    names = {s['name'] for s in data['songs']}

    with open(os.path.join(BASE, 'data', 'song_bilibili_map.json'), encoding='utf-8') as f:
        m = json.load(f)
    matches = m.setdefault('matches', {})

    added = 0
    skipped = []
    for v in vids:
        nm, datestr = name_from_title(v['title'])
        if not nm:
            skipped.append(v['title'])
            continue
        if nm not in names:
            skipped.append('NOT_IN_DB: ' + v['title'])
            continue
        date = f"{datestr[:4]}-{datestr[4:6]}-{datestr[6:]}" if datestr else None
        entry = {
            'bvid': v['bvid'],
            'title': v['title'],
            'duration': dur_to_sec(v.get('duration', '')),
            'date': date,
        }
        lst = matches.setdefault(nm, [])
        if not any(e['bvid'] == v['bvid'] for e in lst):
            lst.append(entry)
            added += 1

    total = len(data['songs'])
    matched = len(matches)
    all_clips = sum(len(v) for v in matches.values())
    m['stats'] = {
        'total_songs': total,
        'matched_songs': matched,
        'unmatched_songs': total - matched,
        'total_clips': all_clips,
    }
    m['unmatched'] = [s['name'] for s in data['songs'] if s['name'] not in matches]

    with open(os.path.join(BASE, 'data', 'song_bilibili_map.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=2)

    print(f'added {added} new clips; matches now {matched} songs / {all_clips} clips')
    if skipped:
        print(f'skipped {len(skipped)} (not matched to song_data):')
        for s in skipped[:20]:
            print('  -', s)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--save-clips')
    ap.add_argument('--clips-file')
    ap.add_argument('--max-pages', type=int, default=3)
    a = ap.parse_args()
    asyncio.run(run(a.save_clips, a.clips_file, a.max_pages))
