"""
为「未标注日期」的歌切按时间规律补上演唱日期。

匹配依据（用户规则）：歌切一般在演唱日期之后发出，通常为演唱当天或结束后 1~2 天内。
即：performance_date <= upload_date(北京时间) <= performance_date + 2 天。
upload_date 取自 B站 API 的真实发布时间（pubdate，UTC → +8h 转北京时间）。
performance_date 取自 sui_song_list_complete.json 该歌的 date_list（页面展示的「演唱日期」）。

幂等：已有时不覆盖；命中 0 个 → 跳过；命中多个 → 取「最近一场」平局后写入（并打印告警）。
仅处理 date 为空的歌切，不碰任何已有日期。

Usage:
  python fix_clip_dates.py --dry                 # 只处理默认歌 ひまわりの約束，只打印不写盘
  python fix_clip_dates.py                        # 写盘（默认歌）
  python fix_clip_dates.py --all                 # 处理全部歌曲的空日期歌切（写盘）
  python fix_clip_dates.py --all --dry           # 全曲预演，不写盘
  python fix_clip_dates.py --song 歌名            # 指定单首
"""
import argparse
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(BASE, 'data', 'song_bilibili_map.json')
COMPLETE_PATH = os.path.join(BASE, 'data', 'sui_song_list_complete.json')

TARGET_SONG = 'ひまわりの約束'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

# B站 WBI 签名所需（破解风控 -412/-400/62002）
MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
    49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55,
    40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62,
    11, 36, 20, 34, 44, 52,
]
_NAV_CACHE = {}


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


def get_mixin_key():
    """取 B站 WBI 混合密钥（带缓存）。"""
    if 'mixin' in _NAV_CACHE:
        return _NAV_CACHE['mixin']
    url = 'https://api.bilibili.com/x/web-interface/nav'
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://www.bilibili.com'})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
    # 注意：未登录时 nav 返回 code=-101，但 data.wbi_img 仍带上密钥，可直接用
    wbi = d['data']['wbi_img']
    img = re.search(r'/([^/]+)\.png', wbi['img_url']).group(1)
    sub = re.search(r'/([^/]+)\.png', wbi['sub_url']).group(1)
    orig = img + sub  # 64 字符
    mixin = ''.join(orig[i] for i in MIXIN_KEY_ENC_TAB)[:32]
    _NAV_CACHE['mixin'] = mixin
    return mixin


def signed_params(bvid):
    mixin = get_mixin_key()
    params = {'bvid': bvid, 'wts': int(time.time())}
    q = urllib.parse.urlencode(sorted(params.items()))
    params['w_rid'] = hashlib.md5((q + mixin).encode()).hexdigest()
    return params


def fetch_bvid(bvid, tries=4):
    """返回 (pubdate_ts, duration, title)；失败抛异常。带 WBI 签名 + 退避重试吸收限流/风控。"""
    base = 'https://api.bilibili.com/x/web-interface/view'
    last = None
    for i in range(tries):
        try:
            p = signed_params(bvid)
            url = base + '?' + urllib.parse.urlencode(p)
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://www.bilibili.com'})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.load(r)
            if data.get('code') != 0:
                raise RuntimeError('bili api %s -> code %s %s' % (bvid, data.get('code'), data.get('message')))
            d = data['data']
            return d['pubdate'], d.get('duration', 0), d.get('title', '')
        except Exception as e:
            last = e
            if i < tries - 1:
                time.sleep(3.0)
    raise last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true', help='只打印决策，不写盘')
    ap.add_argument('--all', action='store_true', help='处理全部歌曲（而非默认单首）')
    ap.add_argument('--song', default=None, help='指定单首歌名（覆盖默认）')
    ap.add_argument('--window', type=int, default=2, help='匹配窗口：上传日 ∈ [演唱日, 演唱日+WINDOW天]（默认 2）')
    a = ap.parse_args()

    m = json.load(open(MAP_PATH, encoding='utf-8'))
    comp = json.load(open(COMPLETE_PATH, encoding='utf-8'))

    # 全曲演唱日表
    perf_all = {}
    for c in comp:
        nm = c.get('song_name')
        if nm:
            perf_all[nm] = parse_date_list(c.get('date_list', ''))

    # 决定要处理的歌曲列表
    if a.all:
        songs = list(m['matches'].keys())
    elif a.song:
        songs = [a.song]
    else:
        songs = [TARGET_SONG]

    stats = {'filled': 0, 'ambiguous_filled': 0, 'nomatch': 0, 'err': 0, 'skipped_existing': 0}
    changed_global = []  # (song, clip, datestr, dur)

    for song in songs:
        perfs = sorted(perf_all.get(song, []))
        lst = m['matches'].get(song, [])
        undated = [c for c in lst if not c.get('date')]
        if not undated:
            continue
        for c in undated:
            bvid = c['bvid']
            try:
                pubdate, dur, title = fetch_bvid(bvid)
            except Exception as e:
                print('  ! [%s] %s 获取失败: %s' % (song, bvid, e))
                stats['err'] += 1
                time.sleep(1.0)
                continue
            upload = (datetime.fromtimestamp(pubdate, tz=timezone.utc) + timedelta(hours=8)).date()
            hits = [p for p in perfs if p <= upload <= p + timedelta(days=a.window)]
            if len(hits) == 1:
                d = hits[0]
                print('  ✓ [%s] %s 上传=%s 命中=%s %ss' % (song, bvid, upload.isoformat(), d.isoformat(), dur))
                changed_global.append((song, c, d.isoformat(), dur))
                stats['filled'] += 1
            elif len(hits) == 0:
                print('  ! [%s] %s 上传=%s 未命中(±%d天) — 跳过' % (song, bvid, upload.isoformat(), a.window))
                stats['nomatch'] += 1
            else:
                best = min(hits, key=lambda p: abs((upload - p).days))
                print('  ⚠ [%s] %s 上传=%s 命中多场%s 取最近=%s — 写入' %
                      (song, bvid, upload.isoformat(), ','.join(h.isoformat() for h in hits), best.isoformat()))
                changed_global.append((song, c, best.isoformat(), dur))
                stats['ambiguous_filled'] += 1
            time.sleep(1.0)

    print('\n=== 汇总 ===', json.dumps(stats, ensure_ascii=False))

    if a.dry:
        print('[DRY] 不写盘。待写入 %d 条（唯一 %d + 歧义平局 %d）。' %
              (stats['filled'] + stats['ambiguous_filled'], stats['filled'], stats['ambiguous_filled']))
        return

    for song, c, datestr, dur in changed_global:
        c['date'] = datestr
        if not c.get('duration') and dur:
            c['duration'] = dur
    # 统一排序：日期降序，无日期排最后（与 match_clips 规则一致）
    for song, lst in m['matches'].items():
        lst.sort(key=lambda e: e.get('date') or '', reverse=True)
    json.dump(m, open(MAP_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('已写入 %d 条日期到 %s' % (stats['filled'] + stats['ambiguous_filled'], MAP_PATH))


if __name__ == '__main__':
    main()
