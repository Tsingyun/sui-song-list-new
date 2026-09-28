"""
为「未标注日期」的歌切按时间规律补上演唱日期。

匹配依据（用户规则）：歌切一般在演唱日期之后发出，通常为演唱当天或结束后 1~2 天内。
即：performance_date <= upload_date(北京时间) <= performance_date + 2 天。
upload_date 取自 B站 API 的真实发布时间（pubdate，UTC → +8h 转北京时间）。
performance_date 取自 sui_song_list_complete.json 该歌的 date_list（页面展示的「演唱日期」）。

仅处理指定歌曲（默认 ひまわりの約束）下 date 为空的歌切，幂等：
- 已有时不覆盖；
- 能唯一命中期内演唱日 → 写入 date（并补 duration，若原为 0）；
- 命中 0 个或多于 1 个 → 仅打印告警，不写入。

Usage:
  python fix_clip_dates.py --dry          # 只打印映射决策，不写盘
  python fix_clip_dates.py                # 写盘
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(BASE, 'data', 'song_bilibili_map.json')
COMPLETE_PATH = os.path.join(BASE, 'data', 'sui_song_list_complete.json')

TARGET_SONG = 'ひまわりの約束'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'


def parse_date_list(raw):
    if not raw:
        return []
    out = []
    for m in re.finditer(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', raw):
        y, mo, d = (int(x) for x in m.groups())
        try:
            out.append(datetime(y, mo, d).date())
        except ValueError:
            pass
    return out


def fetch_bvid(bvid):
    url = 'https://api.bilibili.com/x/web-interface/view?bvid=' + bvid
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://www.bilibili.com'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    if data.get('code') != 0:
        raise RuntimeError('bili api %s -> code %s %s' % (bvid, data.get('code'), data.get('message')))
    d = data['data']
    return d['pubdate'], d.get('duration', 0), d.get('title', '')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true', help='只打印决策，不写盘')
    ap.add_argument('--song', default=TARGET_SONG)
    a = ap.parse_args()

    m = json.load(open(MAP_PATH, encoding='utf-8'))
    comp = json.load(open(COMPLETE_PATH, encoding='utf-8'))

    perf_map = {}
    for c in comp:
        if c.get('song_name') == a.song:
            perf_map[a.song] = parse_date_list(c.get('date_list', ''))

    song = a.song
    perfs = perf_map.get(song, [])
    print('歌曲: %s | 演唱日期候选(%d): %s' % (song, len(perfs),
          ', '.join(d.isoformat() for d in sorted(perfs))))

    lst = m['matches'].get(song, [])
    undated = [c for c in lst if not c.get('date')]
    print('未标注日期的歌切: %d' % len(undated))
    if not undated:
        return

    changed = []
    for c in undated:
        bvid = c['bvid']
        try:
            pubdate, dur, title = fetch_bvid(bvid)
        except Exception as e:
            print('  ! %s 获取失败: %s' % (bvid, e))
            continue
        upload = (datetime.fromtimestamp(pubdate, tz=__import__('datetime').timezone.utc)
                  + timedelta(hours=8)).date()  # 北京时间
        hits = [p for p in perfs if p <= upload <= p + timedelta(days=2)]
        if len(hits) == 1:
            d = hits[0]
            print('  ✓ %s 上传=%s 命中演唱日=%s  时长=%ss' % (bvid, upload.isoformat(), d.isoformat(), dur))
            changed.append((c, d.isoformat(), dur))
        elif len(hits) == 0:
            print('  ! %s 上传=%s 未命中任何演唱日(±2天) — 跳过' % (bvid, upload.isoformat()))
        else:
            best = min(hits, key=lambda p: abs((upload - p).days))
            print('  ? %s 上传=%s 命中多个=%s 取最近=%s — 跳过(需人工确认)' %
                  (bvid, upload.isoformat(), ','.join(h.isoformat() for h in hits), best.isoformat()))

    if a.dry:
        print('\n[DRY] 不写盘。待写入 %d 条。' % len(changed))
        return

    for c, datestr, dur in changed:
        c['date'] = datestr
        if not c.get('duration') and dur:
            c['duration'] = dur
    # 统一排序：日期降序，无日期排最后（与 match_clips 规则一致）
    lst.sort(key=lambda e: e.get('date') or '', reverse=True)
    json.dump(m, open(MAP_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('\n已写入 %d 条日期到 %s' % (len(changed), MAP_PATH))


if __name__ == '__main__':
    main()
