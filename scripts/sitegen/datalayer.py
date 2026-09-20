# -*- coding: utf-8 -*-
"""Song data layer: load, enrich and aggregate the song database.

Everything the frontend needs about SONGS is produced here at build time —
the JS layer only views/filters/sorts, it never re-derives statistics.

Business rules preserved from the old system (see REBUILD_NOTES.md §4):
  * tilde normalization (U+301C / U+FF5E -> U+007E) for B站 map lookups
  * performance dates parsed from "Y/M/D，Y/M/D,..." lists, zero-padded,
    garbage years (< 2022) dropped
  * aggregate stats recomputed from the songs array (stored stats are redundant)
  * tier is a display derivation from count (>=5 / 2-4 / 1), never trusted
"""
import json
import os
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

MIN_DATE = '2022-09'   # heatmap / trend cutoff (drops 1901 garbage dates)


def norm_tilde(s):
    return s.replace('\u301c', '~').replace('\uff5e', '~')


def norm_date(d):
    """'2024-1-6' / '2024/1/6' -> '2024-01-06'; None if not a plausible date."""
    if not d:                      # 容许 None / ''（无日期的歌切，如第三方搬运）
        return None
    parts = d.replace('/', '-').split('-')
    if len(parts) != 3 or len(parts[0]) != 4 or not parts[0].isdigit():
        return None
    if not parts[1].isdigit() or not parts[2].isdigit():
        return None
    year = int(parts[0])
    if year < 2022:            # garbage filler dates (e.g. 1901-11-xx)
        return None
    return '%04d-%02d-%02d' % (year, int(parts[1]), int(parts[2]))


def load_json(name):
    with open(os.path.join(DATA_DIR, name), encoding='utf-8') as f:
        return json.load(f)


def build_song_payload():
    """Return the complete song-side payload dict for the frontend."""
    data = load_json('song_data.json')
    songs = data['songs']

    # --- merge B站 clips (tilde-normalized keys) ---
    bili_map = {}
    try:
        bili = load_json('song_bilibili_map.json')
        bili_map = {norm_tilde(k): v for k, v in bili.get('matches', {}).items()}
    except OSError:
        pass

    # --- merge performance date lists from the source-site dump ---
    date_lookup = {}
    try:
        complete = load_json('sui_song_list_complete.json')
        for entry in complete:
            name = entry.get('song_name', '')
            raw = entry.get('date_list', '')
            if not name or not raw:
                continue
            dates = []
            for piece in raw.replace('，', ',').split(','):
                piece = piece.strip()
                if not piece:
                    continue
                nd = norm_date(piece)
                if nd:
                    dates.append(nd)
            if not dates:
                continue
            dates = sorted(set(dates))
            if name in date_lookup:
                date_lookup[name] = sorted(set(date_lookup[name]) | set(dates))
            else:
                date_lookup[name] = dates
    except OSError:
        pass

    out_songs = []
    dates_map = {}
    for i, s in enumerate(songs):
        name = s['name']
        song = {
            'i': i,
            'name': name,
            't': s.get('translated', '') or '',
            'artist': s.get('artist', '') or '',
            'lang': s.get('lang', '未知'),
            'count': s.get('count', 1),
            'first': s.get('first', '') or '',
            'last': s.get('last', '') or '',
        }
        tags = s.get('tags') or []
        if tags:
            song['tags'] = tags
        clips = bili_map.get(norm_tilde(name))
        if clips:
            song['bili'] = [
                {'bv': c['bvid'],
                 't': c.get('title', ''),
                 'd': c.get('duration', 0),
                 'dt': norm_date(c.get('date') or '') or (c.get('date') or '')}
                for c in clips
            ]
        out_songs.append(song)

        # 与旧系统一致：日期表只来自 complete 文件（热力图/趋势口径不变）。
        dates = date_lookup.get(name)
        if dates:
            dates_map[name] = dates

    # --- aggregate stats (recomputed; stored stats are redundant) ---
    counts = [s['count'] for s in out_songs]
    stats = {
        'total': len(out_songs),
        'performances': sum(counts),
        'frequent': sum(1 for c in counts if c >= 5),
        'occasional': sum(1 for c in counts if 2 <= c <= 4),
        'once': sum(1 for c in counts if c == 1),
    }
    firsts = [s['first'] for s in out_songs if s['first']]
    lasts = [s['last'] for s in out_songs if s['last']]
    all_dates = [d for ds in dates_map.values() for d in ds]
    stats['first'] = min(firsts + all_dates) if (firsts or all_dates) else ''
    stats['last'] = max(lasts + all_dates) if (lasts or all_dates) else ''

    langs = Counter(s['lang'] for s in out_songs)
    tags = Counter(t for s in out_songs for t in s.get('tags', []))
    artists = {}
    for s in out_songs:
        a = artists.setdefault(s['artist'] or '未知', {'n': 0, 'perf': 0})
        a['n'] += 1
        a['perf'] += s['count']

    # --- recent performance days (latest 12, for the home view) ---
    by_day = {}
    for name, ds in dates_map.items():
        for d in ds:
            by_day.setdefault(d, [])
            if name not in by_day[d]:
                by_day[d].append(name)
    recent = [{'date': d, 'songs': by_day[d]}
              for d in sorted(by_day, reverse=True)[:12]]

    return {
        'stats': stats,
        'langs': [{'lang': k, 'count': v}
                  for k, v in langs.most_common()],
        'tags': [{'tag': k, 'count': v}
                 for k, v in tags.most_common()],
        'artists': [{'name': k, 'songs': v['n'], 'perf': v['perf']}
                    for k, v in sorted(artists.items(),
                                       key=lambda kv: (-kv[1]['n'], -kv[1]['perf']))],
        'songs': out_songs,
        'dates': dates_map,
        'recent': recent,
    }
