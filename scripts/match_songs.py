# -*- coding: utf-8 -*-
"""Phase 2: Match songs to Bilibili videos using title normalization + existing BVID."""
import json
import re
import os
import unicodedata
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

# ── Load data ──
with open(os.path.join(DATA_DIR, 'song_data.json'), 'r', encoding='utf-8') as f:
    song_data = json.load(f)
songs = song_data['songs']  # list of {name, artist, lang, count, ...}

with open(os.path.join(DATA_DIR, 'bilibili_videos.json'), 'r', encoding='utf-8') as f:
    videos = json.load(f)

# Load source JSON for existing BVID data
with open(os.path.join(DATA_DIR, 'sui_song_list_complete.json'), 'r', encoding='utf-8') as f:
    source_songs = json.load(f)

# Build BVID lookup from source: song_name -> [bvid, ...]
bvid_lookup = {}
for s in source_songs:
    name = s.get('song_name', s.get('name', ''))
    bvid_raw = s.get('BVID', '')
    if name and bvid_raw and str(bvid_raw).strip():
        # Split on Chinese or English comma
        bvids = re.split(r'[，,]', str(bvid_raw))
        bvids = [b.strip() for b in bvids if b.strip() and re.match(r'^BV[\w]+$', b.strip())]
        if bvids:
            bvid_lookup[name] = bvids

print(f'Songs in database: {len(songs)}')
print(f'Videos from Bilibili: {len(videos)}')
print(f'Songs with existing BVID: {len(bvid_lookup)}')

# ── Title normalization ──

def normalize(s):
    """Normalize a string for fuzzy matching."""
    if not s:
        return ''
    # NFKC: full-width → half-width, normalize unicode
    s = unicodedata.normalize('NFKC', s)
    s = s.lower()
    # Remove all spaces
    s = s.replace(' ', '').replace('\u3000', '').replace('\xa0', '')
    # Remove common punctuation
    s = re.sub(r'[（）()【】\[\]《》<>「」『』""\'\"~～·．・\-–—.,，。.!！?？:：;；]', '', s)
    # Remove trailing/performance markers
    s = re.sub(r'(liveversioncover纯享版翻唱|acoustic|ver\.?)', '', s, flags=re.I)
    return s

def extract_song_name(title):
    """Extract the song name from a Bilibili video title."""
    t = title
    # Remove leading 【...】 prefix (collections 1&2: 【岁己SUI】...)
    t = re.sub(r'^【[^】]*】\s*', '', t)
    # Remove ALL remaining 【...】 brackets (collection 3: ...【20260518歌切】)
    t = re.sub(r'【[^】]*】', '', t)
    # Remove trailing: date + 直播歌切/歌切 pattern
    t = re.sub(r'\s*\d{1,4}[./]\d{1,2}(?:[./]\d{1,2})?\s*直播?歌切.*$', '', t)
    t = re.sub(r'\s*直播?歌切.*$', '', t)
    # Remove date-only suffix like "6.1", "2024.6.1"
    t = re.sub(r'\s+\d{1,4}[./]\d{1,2}(?:[./]\d{1,2})?\s*$', '', t)
    # Remove trailing whitespace
    t = t.strip()
    # Remove special edition markers in parentheses at end
    t = re.sub(r'\s*[（(](?:纯享|live|Live|LIVE|翻唱)[）)]\s*$', '', t)
    # Remove trailing date-like patterns (e.g., "1.12初次3D")
    t = re.sub(r'\s+\d{1,2}\.\d{1,2}\S*\s*$', '', t)
    # Strip trailing period (命に嫌われている vs 命に嫌われている。)
    t = t.rstrip('。.、')
    return t.strip()

# ── Build video index ──

# Pre-process: extract song names from all video titles
video_song_names = []
for v in videos:
    extracted = extract_song_name(v['title'])
    video_song_names.append({
        'bvid': v['bvid'],
        'title': v['title'],
        'extracted_name': extracted,
        'norm_name': normalize(extracted),
        'duration': v['duration'],
        'date': v['date'],
        'pubdate': v.get('pubdate', 0),
    })

print(f'\nProcessed {len(video_song_names)} video titles')

# ── Matching ──

results = {}  # song_name -> [{bvid, title, duration, date}, ...]
matched_songs = 0
unmatched_songs = []

for song in songs:
    song_name = song['name']
    norm_song = normalize(song_name)
    translated = song.get('translated', '')
    norm_trans = normalize(translated) if translated else ''
    # Also try song name without parenthetical notes
    song_base = re.sub(r'[（(][^)）]*[)）]', '', song_name).strip()
    norm_base = normalize(song_base) if song_base != song_name else ''

    matches = []
    seen_bvids = set()

    # Strategy 1: Match by normalized title extraction
    for v in video_song_names:
        vn = v['norm_name']
        if not vn:
            continue
        # Exact match on normalized name
        if vn == norm_song:
            if v['bvid'] not in seen_bvids:
                matches.append(v)
                seen_bvids.add(v['bvid'])
            continue
        # Match base name (without parenthetical notes)
        if norm_base and vn == norm_base:
            if v['bvid'] not in seen_bvids:
                matches.append(v)
                seen_bvids.add(v['bvid'])
            continue
        # Match translated name (e.g., Japanese song with Chinese translation)
        if norm_trans and vn == norm_trans:
            if v['bvid'] not in seen_bvids:
                matches.append(v)
                seen_bvids.add(v['bvid'])
            continue
        # Song name is contained in video extracted name (handles extra chars)
        if len(norm_song) >= 2 and norm_song in vn:
            # Only accept if lengths are close (avoid "光" matching "月光蟲")
            ratio = len(norm_song) / len(vn) if vn else 0
            if ratio >= 0.7:
                if v['bvid'] not in seen_bvids:
                    matches.append(v)
                    seen_bvids.add(v['bvid'])

    # Strategy 2: Use existing BVID data from source
    existing_bvids = bvid_lookup.get(song_name, [])
    video_bvid_map = {v['bvid']: v for v in videos}
    for bvid in existing_bvids:
        if bvid not in seen_bvids and bvid in video_bvid_map:
            v = video_bvid_map[bvid]
            matches.append({
                'bvid': v['bvid'],
                'title': v['title'],
                'extracted_name': extract_song_name(v['title']),
                'duration': v['duration'],
                'date': v['date'],
                'pubdate': v.get('pubdate', 0),
            })
            seen_bvids.add(bvid)

    # Strategy 3: For existing BVIDs NOT in our fetched videos, add as external links
    for bvid in existing_bvids:
        if bvid not in seen_bvids:
            matches.append({
                'bvid': bvid,
                'title': f'{song_name} (外部歌切)',
                'extracted_name': song_name,
                'duration': 0,
                'date': '',
                'pubdate': 0,
                'external': True,  # Not in our collections, may not be verifiable
            })
            seen_bvids.add(bvid)

    # Sort matches by date (newest first)
    matches.sort(key=lambda x: x.get('pubdate', 0) or 0, reverse=True)

    if matches:
        results[song_name] = [{
            'bvid': m['bvid'],
            'title': m['title'],
            'duration': m.get('duration', 0),
            'date': m.get('date', ''),
        } for m in matches]
        matched_songs += 1
    else:
        unmatched_songs.append(song_name)

# ── Stats ──
print(f'\n=== Matching Results ===')
print(f'Matched: {matched_songs}/{len(songs)} ({matched_songs*100//len(songs)}%)')
print(f'Unmatched: {len(unmatched_songs)}')

# Count total clips matched
total_clips = sum(len(v) for v in results.values())
print(f'Total clips matched: {total_clips}')

# Multi-clip songs
multi = [(name, len(clips)) for name, clips in results.items() if len(clips) > 1]
multi.sort(key=lambda x: -x[1])
print(f'\nSongs with multiple clips: {len(multi)}')
for name, count in multi[:10]:
    print(f'  {name}: {count} clips')

# Sample unmatched
if unmatched_songs:
    print(f'\nSample unmatched songs (first 30):')
    for name in unmatched_songs[:30]:
        print(f'  {name}')

# ── Save output ──
out_path = os.path.join(DATA_DIR, 'song_bilibili_map.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f'\nSaved to: {out_path}')
