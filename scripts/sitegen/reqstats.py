# -*- coding: utf-8 -*-
"""Point-song (点歌) statistics layer.

Source of truth: data/request_stats.json — `raw_data` records
{date, song, audience} plus `live_dates` and `user_uids`, imported from the
sister repo Tsingyun/sui-song-stats. Everything below is DERIVED from
raw_data at build time (the stats repo's own rule: derive, never hand-patch).

Business rules (fixed, see REBUILD_NOTES.md §4):

点歌占比 (share of requests)
    向下取整 (floor); the LAST item of the COMPLETE board receives the
    remainder so the column sums to exactly 100%. Never re-normalized on
    truncated views (top-10 etc.) — that was the inflation bug the stats
    site fixed on 2026-07-22. Boards whose integer shares would all collapse
    to 0 (the 500+ song board) use the same rule at 0.1% granularity so the
    floor step stays meaningful.

🔥 连续点歌 (per month only)
    Within a month, order the dates on which AT LEAST ONE audience requested
    a song (the "request-day sequence"). A maximal run of consecutive
    request-days where the SAME audience requested counts as one streak
    (length >= 2). Days with zero requests (host-only live days) are
    TRANSPARENT — they do not break a run. Runs never chain across months.
    Fire count = streak length - 1 (min 1).

观众等级 Lv.1-5   thresholds: 1-10 / 11-30 / 31-60 / 61-100 / 100+
月度冠军 👑       a crown appears ONLY when someone leads SIGNIFICANTLY.
                  Conditions (all of them, see month_champions()):
                    - the top spot is UNIQUE (a tie crowns nobody)
                    - the top count is >= 2 (being picked once is not a title)
                    - the lead is significant: either >= 2x the runner-up,
                      or a gap of >= 2 over it
                  So a flat month (everyone on 1 request) shows NO crown at all,
                  and a narrow lead (5 vs 4) shows none either.

The 2026-09 merge of the sister site (stats.suijisui.uk / Tsingyun/sui-song-stats)
added these derived boards, all computed from raw_data with the same rules the
stats repo used — never hand-patched:

跨月冠军 championStreaks
    Champion of month M = month_champions(), i.e. the SAME significant-lead rule
    the monthly board uses (a month with no significant leader contributes no
    crown, which naturally breaks a streak).
    A streak = a run of CALENDAR-CONTIGUOUS months (2024-12 -> 2025-01 counts)
    where the same audience kept the crown; only runs >= 2 are reported, and each
    audience keeps its single LONGEST run.

成就殿堂 achievements
    点歌之王 (top of the total board) / 百首俱乐部 (everyone >= 100 requests) /
    一周年纪念 (data span >= 1 year) / 忠实观众 (most distinct months requested).

新朋友 newcomers / 老朋友回归 returners
    newcomer  = first-ever request inside the last 90 days (relative to the last
                request date in raw_data).
    returner  = longest gap between two requests of the same audience >= 180 days.
    (Both were data-only fields on the stats site — never rendered — and are kept
    here so the merged payload is a superset of the old one.)

歌曲共现网络 network   top-30 songs (nodes) + top-50 co-occurrence pairs (edges),
    where a pair counts only when >= 2 distinct audiences requested BOTH songs.

搜索索引 searchIndex  songs / audiences / dates, for the request-page search box.
"""
from collections import Counter, defaultdict

try:  # stdlib only; optional import guard keeps the module importable anywhere
    from datetime import date as _date, datetime as _datetime
except Exception:  # pragma: no cover
    _date = _datetime = None

DAY = 86400000  # documented but unused constant kept for reference


def _days_between(a, b):
    """Whole days from ISO date a to ISO date b (b - a)."""
    da = _datetime.strptime(a, '%Y-%m-%d').date()
    db = _datetime.strptime(b, '%Y-%m-%d').date()
    return (db - da).days


CHAMPION_MIN_TOP = 2   # the top audience must have > 1 request to hold a title
CHAMPION_RATIO = 2     # ...and must lead by at least this factor (2x = "twice")
CHAMPION_GAP = 2       # ...or by at least this many requests


def month_champions(counter):
    """Monthly 👑 champions: only a SIGNIFICANT unique leader, else nobody.

    Returns a list holding 0 or 1 name. All three conditions must hold:

      1. UNIQUE leader  — if several audiences share the month's top count the
                          month has no champion at all (a flat month where
                          everyone sits on 1 request is the common case: nothing
                          distinguishes anyone, so crowning all of them is noise).
      2. top >= 2       — being requested once is not an achievement worth a crown.
      3. a SIGNIFICANT lead, satisfied by EITHER
           - ratio: top >= 2 x runner-up   (2 vs 1 -> champion, the tight case)
           - gap:   top - runner-up >= 2   (7 vs 4 -> champion; large counts where
                                            a 2x factor is out of reach)

    Deliberately NOT champions: 5 vs 4 (leads by 1, not twice), 7 vs 6, 11 vs 11
    (tied), everyone on 1. Being the only name on an otherwise empty board still
    requires >= 2 requests.

    This single definition is shared by the monthly board (payload['champs']) and
    by compute_champion_streaks(), so the two can never drift apart.
    """
    if not counter:
        return []
    top = max(counter.values())
    leaders = [a for a, c in counter.items() if c == top]
    if len(leaders) != 1:
        return []
    if top < CHAMPION_MIN_TOP:
        return []
    others = [c for c in counter.values() if c < top]
    second = max(others) if others else 0
    if not second:
        return leaders
    if top >= CHAMPION_RATIO * second or top - second >= CHAMPION_GAP:
        return leaders
    return []


def compute_champion_streaks(monthly_counter):
    """Runs of calendar-contiguous months where the same audience topped the month."""
    month_champs = defaultdict(set)
    for month, counter in monthly_counter.items():
        for aud in month_champions(counter):
            month_champs[aud].add(month)

    out = []
    for aud, months in month_champs.items():
        ms = sorted(months, key=month_index)
        best = None
        run = [ms[0]]
        for prev, cur in zip(ms, ms[1:]):
            if month_index(cur) == month_index(prev) + 1:
                run.append(cur)
            else:
                if best is None or len(run) > len(best):
                    best = run
                run = [cur]
        if best is None or len(run) > len(best):
            best = run
        if len(best) >= 2:
            out.append({'n': aud, 'months': best, 'len': len(best)})
    out.sort(key=lambda x: (-x['len'], month_index(x['months'][0])))
    return out


def compute_achievements(raw, total_board, meta, aud_months):
    """点歌之王 / 百首俱乐部 / 一周年纪念 / 忠实观众."""
    ach = []
    if total_board:
        top = total_board[0]
        ach.append({'id': 'song_king', 'name': '点歌之王', 'emoji': '👑',
                    'desc': '%s 以 %d 次点歌夺得冠军' % (top['n'], top['c']),
                    'audience': top['n'], 'count': top['c']})
    for row in total_board:
        if row['c'] >= 100:
            ach.append({'id': '100club_' + row['n'], 'name': '百首俱乐部', 'emoji': '🎯',
                        'desc': '%s 点歌 %d 次，突破百首大关！' % (row['n'], row['c']),
                        'audience': row['n'], 'count': row['c']})
    start, end = meta.get('start', ''), meta.get('end', '')
    if start and end and _days_between(start, end) >= 365:
        ach.append({'id': 'anniversary_1', 'name': '一周年纪念', 'emoji': '📅',
                    'desc': '岁己的点歌系统已经运行超过一年了！（%s 至今）' % start,
                    'count': meta.get('total', 0)})
    best_a, best_m = None, 0
    for aud, months in aud_months.items():
        if len(months) > best_m:
            best_m, best_a = len(months), aud
    if best_a:
        ach.append({'id': 'consistent', 'name': '忠实观众', 'emoji': '🌟',
                    'desc': '%s 在 %d 个不同的月份里点过歌，是最忠实的观众！' % (best_a, best_m),
                    'audience': best_a, 'count': best_m})
    return ach


def compute_newcomers(raw, last_date, window=90):
    """Audiences whose FIRST request falls in the last `window` days."""
    if not last_date:
        return []
    first_seen = {}
    counts = Counter()
    for e in raw:
        aud, d = e['audience'], e['date']
        counts[aud] += 1
        if aud not in first_seen or d < first_seen[aud]:
            first_seen[aud] = d
    out = []
    for aud, first in first_seen.items():
        gap = _days_between(first, last_date)
        if 0 <= gap <= window:
            out.append({'n': aud, 'first': first, 'count': counts[aud], 'ago': gap})
    out.sort(key=lambda x: (-x['ago'], x['n']))
    return out


def compute_returners(raw, min_gap=180):
    """Audiences with a >= min_gap-day silence between two of their requests."""
    dates = defaultdict(set)
    counts = Counter()
    for e in raw:
        dates[e['audience']].add(e['date'])
        counts[e['audience']] += 1
    out = []
    for aud, ds in dates.items():
        ds = sorted(ds)
        if len(ds) < 2:
            continue
        best = None
        for prev, cur in zip(ds, ds[1:]):
            gap = _days_between(prev, cur)
            if best is None or gap > best[0]:
                best = (gap, prev, cur)
        if best and best[0] >= min_gap:
            out.append({'n': aud, 'gap': best[0], 'from': best[1], 'to': best[2],
                        'count': counts[aud]})
    out.sort(key=lambda x: (-x['gap'], x['n']))
    return out[:12]


def compute_song_network(raw, top_nodes=30, top_edges=50):
    """Song co-occurrence graph: who gets requested by the same audiences."""
    aud_songs = defaultdict(set)
    song_cnt = Counter()
    for e in raw:
        aud_songs[e['audience']].add(e['song'])
        song_cnt[e['song']] += 1
    top = [s for s, _ in song_cnt.most_common(100)]
    cooc = {}
    for i in range(len(top)):
        for j in range(i + 1, len(top)):
            s1, s2 = top[i], top[j]
            c = sum(1 for ss in aud_songs.values() if s1 in ss and s2 in ss)
            if c >= 2:
                cooc[(min(s1, s2), max(s1, s2))] = c
    edges = sorted(cooc.items(), key=lambda kv: -kv[1])[:top_edges]
    return {
        'nodes': [{'id': s, 'c': song_cnt[s]} for s in
                  [s for s, _ in song_cnt.most_common(top_nodes)]],
        'edges': [{'a': k[0], 'b': k[1], 'w': v} for k, v in edges],
    }


def floor_shares(counts, scale=100):
    """Floor shares + remainder to the last item; sums to exactly `scale`.

    scale=100 -> integer percents; scale=1000 -> one-decimal percents.
    """
    total = sum(counts)
    if total <= 0:
        return [0] * len(counts)
    shares = [c * scale // total for c in counts]
    shares[-1] += scale - sum(shares)
    return shares


def level_of(count):
    if count >= 100:
        return 5
    if count >= 61:
        return 4
    if count >= 31:
        return 3
    if count >= 11:
        return 2
    return 1


def _board(counter, scale=100, with_level=False):
    """counter -> [{n, c, pct, level?}] sorted by count desc, then name.

    pct is expressed in percent (not fraction): scale=100 -> integers,
    scale=1000 -> one-decimal floats (floor_shares units are 1/scale percent).
    """
    items = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
    shares = floor_shares([c for _, c in items], scale)
    out = []
    for (name, count), pct in zip(items, shares):
        row = {'n': name, 'c': count, 'pct': pct / (scale / 100)}
        if with_level:
            row['level'] = level_of(count)
        out.append(row)
    return out


def month_index(ym):
    y, m = ym.split('-')
    return int(y) * 12 + int(m)


def compute_streaks(raw_data):
    """Per-month consecutive request-day streaks. See module docstring."""
    req_days = sorted(set(e['date'] for e in raw_data))
    by_month = defaultdict(list)
    for e in raw_data:
        by_month[e['date'][:7]].append(e)

    result = {}
    for month, records in by_month.items():
        req_days_m = [d for d in req_days if d[:7] == month]
        aud_days = defaultdict(lambda: defaultdict(list))
        for e in records:
            aud_days[e['audience']][e['date']].append(e['song'])
        entries = []
        n = len(req_days_m)
        for aud, day_map in aud_days.items():
            i = 0
            while i < n:
                if req_days_m[i] in day_map:
                    j = i
                    while j + 1 < n and req_days_m[j + 1] in day_map:
                        j += 1
                    chain = req_days_m[i:j + 1]
                    if len(chain) >= 2:
                        entries.append({
                            'n': aud,
                            'chain': chain,
                            'songs': [day_map[d] for d in chain],
                            'len': len(chain),
                            'fires': max(1, len(chain) - 1),
                        })
                    i = j + 1
                else:
                    i += 1
        entries.sort(key=lambda x: (x['chain'][0], x['n']))
        result[month] = entries
    return result


def build_request_payload():
    import json
    import os
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__)))), 'data')
    with open(os.path.join(data_dir, 'request_stats.json'), encoding='utf-8') as f:
        src = json.load(f)

    raw = src.get('raw_data', [])
    live_dates = sorted(set(src.get('live_dates', [])))
    uids = src.get('user_uids', {})

    total = Counter(e['audience'] for e in raw)
    song_total = Counter(e['song'] for e in raw)

    monthly = defaultdict(Counter)
    quarterly_c = defaultdict(Counter)
    yearly_c = defaultdict(Counter)
    for e in raw:
        y, m = e['date'][:4], e['date'][5:7]
        monthly[y + '-' + m][e['audience']] += 1
        quarterly_c['%s-Q%d' % (y, (int(m) - 1) // 3 + 1)][e['audience']] += 1
        yearly_c[y][e['audience']] += 1

    daily = Counter(e['date'] for e in raw)
    monthly_trend = Counter(e['date'][:7] for e in raw)

    aud_songs = defaultdict(set)
    aud_day = defaultdict(lambda: defaultdict(int))
    last_date = {}
    for e in raw:
        aud_songs[e['audience']].add(e['song'])
        aud_day[e['audience']][e['date'][:7]] += 1
        if e['audience'] not in last_date or e['date'] > last_date[e['audience']]:
            last_date[e['audience']] = e['date']

    # preferences: top 20 audiences x top 8 songs each
    prefs = {}
    for aud, _ in total.most_common(20):
        rows = sorted(Counter(
            e['song'] for e in raw if e['audience'] == aud).items(),
            key=lambda kv: (-kv[1], kv[0]))[:8]
        prefs[aud] = [{'n': s, 'c': c} for s, c in rows]

    # taste similarity (jaccard over distinct songs), top 30 pairs
    names = [a for a, _ in total.most_common()]
    similar = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            inter = len(aud_songs[a] & aud_songs[b])
            if inter < 2:
                continue
            similar.append({'a1': a, 'a2': b, 'overlap': inter,
                            'total1': len(aud_songs[a]), 'total2': len(aud_songs[b]),
                            'jaccard': round(inter / len(aud_songs[a] | aud_songs[b]), 3)})
    similar.sort(key=lambda x: (-x['jaccard'], -x['overlap']))
    similar = similar[:30]

    similar = similar[:30]

    # champions per month — only a significant unique leader earns a 👑, so a
    # month holds either exactly one champion or none (see month_champions)
    champs = {month: month_champions(counter)
              for month, counter in monthly.items() if counter}

    dates = sorted(e['date'] for e in raw)
    streaks = compute_streaks(raw)

    # song board: integer shares all collapse to 0 (counts < 1% each),
    # so the same floor+remainder rule runs at 0.1% granularity there.
    king = total.most_common(1)[0] if total else ('', 0)

    # ---- merged from the stats site (all derived, never hand-patched) ----
    meta = {
        'total': len(raw),
        'audiences': len(total),
        'songs': len(song_total),
        'start': dates[0] if dates else '',
        'end': dates[-1] if dates else '',
        'liveDays': len(live_dates),
    }
    total_board = _board(total, with_level=True)

    # compact raw records (d/s/a) so the page can filter, search and export
    # without a second data file: ~40 KB for the current 863 records.
    raw_c = [{'d': e['date'], 's': e['song'], 'a': e['audience']} for e in raw]

    achievements = compute_achievements(raw, total_board, meta, aud_day)
    champ_streaks = compute_champion_streaks(monthly)
    newcomers = compute_newcomers(raw, meta['end'])
    returners = compute_returners(raw)
    network = compute_song_network(raw)
    # 搜索索引不入 payload：前端从 raw 一次性派生即可（省 ~19KB 且不会失同步）

    return {
        'meta': meta,
        'boards': {
            'total': total_board,
            'song': _board(song_total, scale=1000),
            'monthly': {m: _board(c) for m, c in sorted(monthly.items())},
            'quarterly': {q: _board(c) for q, c in sorted(quarterly_c.items())},
            'yearly': {y: _board(c) for y, c in sorted(yearly_c.items())},
        },
        'champs': champs,
        'streaks': streaks,
        'levels': {a: level_of(c) for a, c in total.items()},
        'lastDates': last_date,
        'uids': uids,
        'prefs': prefs,
        'similar': similar,
        'trends': {m: monthly_trend[m] for m in sorted(monthly_trend)},
        'heat': [{'d': d, 'c': daily[d]} for d in sorted(daily)],
        'liveDates': live_dates,
        'king': {'n': king[0], 'c': king[1]},
        # merged from the stats site
        'raw': raw_c,
        'achievements': achievements,
        'champStreaks': champ_streaks,
        'newcomers': newcomers,
        'returners': returners,
        'network': network,
    }
