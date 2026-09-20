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
from datetime import date, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

MIN_DATE = '2022-09'   # heatmap / trend cutoff (drops 1901 garbage dates)

# 首页「久别重逢」（见 build_song_payload 的说明）
RETURN_GAP_YEARS = 2      # 「久别」：相邻两次演唱之间至少隔几个自然年
RETURN_WINDOW_DAYS = 180  # 「最近」：复唱日距档案末日不超过几天
RETURN_LIMIT = 5          # 首页只示意几首
RECENT_DAYS = 6           # 首页「最近演出」展示的天数（与「久别重逢」共用一栏，见 layout）


def _add_years(d, n):
    """d 的 n 年后；2/29 在非闰年退化到 2/28。用于「间隔 ≥ n 整年」判定。"""
    try:
        return d.replace(year=d.year + n)
    except ValueError:
        return d.replace(year=d.year + n, day=28)


def _span_months(a, b):
    """a → b 的整月数（b 的日小于 a 的日则借位），用于「X 年 Y 个月」文案。"""
    months = (b.year - a.year) * 12 + (b.month - a.month)
    if b.day < a.day:
        months -= 1
    return max(months, 0)


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

    # --- recent performance days (for the home view) ---
    by_day = {}
    for name, ds in dates_map.items():
        for d in ds:
            by_day.setdefault(d, [])
            if name not in by_day[d]:
                by_day[d].append(name)
    recent = [{'date': d, 'songs': by_day[d]}
              for d in sorted(by_day, reverse=True)[:RECENT_DAYS]]

    # --- 久别重逢：隔了 ≥2 年没唱、最近又重新登台的曲目 ---
    # 口径（用户 2026-09-21 定义）：interval ≥ 2 年 且 复唱发生在「最近」。
    #  · 「2 年」按自然年算（_add_years），不按 730 天 —— 闰年会差一天，且口径说的是「年」；
    #  · 「最近」的锚点是**档案自身的最后一次演唱日**（all_dates 的 max），不是 now() ——
    #    builder.py 要求产物确定，同一份 data 必须构建出同一份 payload；
    #  · 从每首歌的日期序列**从后往前**找「最近一次复唱」，不能只看最后两首：
    #    复唱之后又唱过的歌（如「After 17」2026-06 复唱、其后还有场次）只看末尾会漏掉；
    #  · 找不到 2 年断档的歌（占了绝大多数）直接跳过，不进 payload。
    by_name = {s['name']: s for s in out_songs}
    return_list = []
    if all_dates:
        cutoff = (date.fromisoformat(max(all_dates))
                  - timedelta(days=RETURN_WINDOW_DAYS)).isoformat()
        for name, ds in dates_map.items():
            for i in range(len(ds) - 1, 0, -1):
                prev, back = date.fromisoformat(ds[i - 1]), date.fromisoformat(ds[i])
                if back >= _add_years(prev, RETURN_GAP_YEARS):
                    if ds[i] >= cutoff:
                        s = by_name.get(name, {})
                        months = _span_months(prev, back)
                        return_list.append({
                            'name': name,
                            'artist': s.get('artist', ''),
                            'count': s.get('count', 0),
                            'prev': ds[i - 1],
                            'back': ds[i],
                            'years': months // 12,
                            'months': months % 12,
                        })
                    break
        # 复唱日倒序；同日并列时把断档更久的排前面（「更久别」更值得看）
        return_list.sort(key=lambda r: (r['back'], r['years'] * 12 + r['months']),
                         reverse=True)

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
        'returns': {'gapYears': RETURN_GAP_YEARS,
                    'windowDays': RETURN_WINDOW_DAYS,
                    'list': return_list[:RETURN_LIMIT]},
    }
