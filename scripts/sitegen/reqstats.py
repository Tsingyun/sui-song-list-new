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
月度冠军 👑       every audience tied at the month's top count
"""
from collections import Counter, defaultdict


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
                            'jaccard': round(inter / len(aud_songs[a] | aud_songs[b]), 3)})
    similar.sort(key=lambda x: (-x['jaccard'], -x['overlap']))
    similar = similar[:30]

    # champions per month (ties all crowned)
    champs = {}
    for month, counter in monthly.items():
        if not counter:
            continue
        top = max(counter.values())
        champs[month] = sorted(a for a, c in counter.items() if c == top)

    dates = sorted(e['date'] for e in raw)
    streaks = compute_streaks(raw)

    # song board: integer shares all collapse to 0 (counts < 1% each),
    # so the same floor+remainder rule runs at 0.1% granularity there.
    king = total.most_common(1)[0] if total else ('', 0)

    return {
        'meta': {
            'total': len(raw),
            'audiences': len(total),
            'songs': len(song_total),
            'start': dates[0] if dates else '',
            'end': dates[-1] if dates else '',
            'liveDays': len(live_dates),
        },
        'boards': {
            'total': _board(total, with_level=True),
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
    }
