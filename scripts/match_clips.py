"""
Match scraped B站歌切 clips into data/song_bilibili_map.json.

默认无 cookie 即可抓取（普通浏览器可访问）。仅当设置了 BILI_COOKIE 时才带登录态。

整体是**幂等**的：同一批 clips 反复运行，结果一致（第二次 added/enriched/remapped 均为 0）。
一次运行依次做四件事：
  1. 新增   —— 新 BV 按标题解析歌名后落入对应歌的 clip 列表
  2. 补全   —— 已存在的 BV 只补齐「缺失」的 duration/date/占位标题，不覆盖已有有效值
  3. 键归位 —— 与歌单歌名不一致的陈旧键改写为 song_data 规范名（站点按 norm_tilde 精确
               查找，大小写/标点/空白不同的键在页面上完全取不到 clip），并合并重复记录
  4. 排序   —— 每首歌的 clip 列表按日期降序（无日期的「外部歌切」排最后）

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

# 仓库根目录（scripts/ 的上一级），跟随脚本位置，不写死本机绝对路径
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYLIST = "https://space.bilibili.com/9669499/lists/6453496?type=season"


# 非标准标题的歌切（第三方搬运/合集，标题不带「【岁己SUI】歌名【日期歌切】」格式）。
# 必须逐条人工核对后才能加入——不从任意标题里启发式猜歌名，避免误配。
TITLE_OVERRIDES = {
    # 标题「四川虚拟主播唱《最佳损友》 一开口大家都笑了」，无日期；最佳损友此前无任何歌切
    'BV1an336mEs8': ('最佳损友', None),
}


def name_from_title(title, bvid=None):
    """从歌切标题提取歌名与日期。兼容多种格式：
      - 【岁己SUI】歌名【20260830歌切】
      - 【岁己SUI】歌名【20260830歌切·活动名】
      - 【岁己SUI】歌名「20260830歌切」        （「」包裹）
      - 【岁己SUI】歌名【20260830】            （旧格式无"歌切"字样）
      - 【岁己SUI】歌名                        （无日期）
      - 【岁己】歌名【20260830歌切】            （前缀省略 SUI 的变体）
    非标准标题见 TITLE_OVERRIDES。
    """
    m = re.match(r'【岁己(?:SUI)?】\s*(.*)', title)
    if not m:
        if bvid and bvid in TITLE_OVERRIDES:
            return TITLE_OVERRIDES[bvid]
        return None, None
    body = m.group(1).strip()
    # 提取 8 位日期（可能在 【】 或 「」 中）
    dm = re.search(r'[【「](\d{8})', body)
    date = dm.group(1) if dm else None
    # 去掉清唱专场前缀：人头麦清唱~歌名 （如「人头麦清唱~水星记」）
    m2 = re.match(r'^人头麦清唱[~～]\s*(.+)$', body)
    if m2:
        body = m2.group(1).strip()
    # 去除【...】注解括号（活动名/歌切/日期）
    body = re.sub(r'【[^】]*】', '', body)
    # 仅当「...」内含日期(8位)或"歌切"时才去除，避免误删歌名内的「」(如 Dear Mr「F」)
    body = re.sub(r'「[^」]*(?:\d{8}|歌切)[^」]*」', '', body)
    # 兜底：去掉残留的单个【】
    body = body.replace('【', '').replace('】', '')
    body = body.strip()
    return (body or None), date


def _norm_tilde(s):
    """全角〜(U+301C)/～(U+FF5E) -> 半角~(U+007E)，避免写法不同漏配。"""
    return s.replace('\u301c', '~').replace('\uff5e', '~')


def _norm(s):
    """歌名归一化：波浪号统一 + 忽略大小写 + 折叠空白 + 去首尾标点括号引号。

    例：あの夏が飽和する。vs あの夏が飽和する、Mela！vs Mela!、
        Dear Mr「F」vs Dear Mr 「F」、Forever  Young vs Forever Young
    """
    s = _norm_tilde(s).lower()
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.strip('。、！？.!?…~～「」『』“”‘’()（）[]【】/\\ ')
    return s


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
        from scrape_bilibili_playlist import scrape  # 仅在需要抓取时才依赖 playwright
        cookie = os.environ.get('BILI_COOKIE', '')
        vids = await scrape(PLAYLIST, cookie, max_pages)
        if save_clips:
            with open(save_clips, 'w', encoding='utf-8') as f:
                json.dump(vids, f, ensure_ascii=False, indent=2)
            print(f'saved clips to {save_clips}')

    with open(os.path.join(BASE, 'data', 'song_data.json'), encoding='utf-8') as f:
        data = json.load(f)
    names = {s['name'] for s in data['songs']}

    # 归一化：波浪号 + 大小写（见模块级 _norm；lower() 可避免
    # 歌切 "Tune The Rainbow" 与歌单 "tune the rainbow" 漏配）
    norm_name_map = {_norm(n): n for n in names}

    with open(os.path.join(BASE, 'data', 'song_bilibili_map.json'), encoding='utf-8') as f:
        m = json.load(f)
    matches = m.setdefault('matches', {})

    # 已入库的 BV -> 歌名。标题可能被上传者改动或截断（如
    # 「I Really Want to Stay At Your H」），只要 BV 认得出来就沿用库内归属，
    # 不依赖标题解析重猜——否则会误判成「不在歌单」而漏掉这条更新。
    bvid_index = {e['bvid']: s for s, lst in matches.items() for e in lst}

    added = 0
    enriched = []
    skipped = []
    for v in vids:
        nm, datestr = name_from_title(v['title'], v['bvid'])
        known_song = bvid_index.get(v['bvid'])
        if known_song is not None and known_song in names:
            # store_name 用歌单原名，保证与 build_site.py 按 song['name'] 查找时 key 完全一致
            store_name = known_song
        elif not nm:
            skipped.append(v['title'])
            continue
        elif _norm(nm) in norm_name_map:
            store_name = norm_name_map[_norm(nm)]
        else:
            skipped.append('NOT_IN_DB: ' + v['title'])
            continue
        date = f"{datestr[:4]}-{datestr[4:6]}-{datestr[6:]}" if datestr else None
        entry = {
            'bvid': v['bvid'],
            'title': v['title'],
            'duration': dur_to_sec(v.get('duration', '')),
            'date': date,
        }
        lst = matches.setdefault(store_name, [])
        existing = next((e for e in lst if e['bvid'] == v['bvid']), None)
        if existing is None:
            lst.append(entry)
            added += 1
            continue
        # 已存在同一 BV：只补全「缺失」的元数据，绝不覆盖已有有效值（幂等）。
        # 站点歌切列表会展示 日期/标题/时长，所以残缺记录是用户可见的。
        filled = []
        if not existing.get('duration') and entry['duration']:
            existing['duration'] = entry['duration']
            filled.append('duration')
        if not existing.get('date') and entry['date']:
            existing['date'] = entry['date']
            filled.append('date')
        # 标题：仅当库内是占位式标题（不含「【岁己」前缀）而抓取到官方标题时才升级
        if '【岁己' not in (existing.get('title') or '') and '【岁己' in entry['title']:
            existing['title'] = entry['title']
            filled.append('title')
        if filled:
            enriched.append((store_name, v['bvid'], filled))

    # --- 键归位：把与歌单歌名不一致的陈旧键改写为 song_data 的规范名 ---
    # 站点按 norm_tilde 精确查找（sitegen/datalayer.py 的 bili_map），大小写/标点/空白
    # 不同的键在页面上完全取不到 clip（历史遗留如「Letting go」vs「Letting Go」）。
    # 归位只动键名、不动 clip 内容；多条键并到同一首歌时按 bvid 去重合并。
    remapped = []
    for k in list(matches):
        if k in names:
            continue
        target = norm_name_map.get(_norm(k))
        if target is None:
            # 老键可能带译名后缀（如「メルト（Melt）」→「メルト」）
            base = re.sub(r'[（(][^）)]*[）)]', '', k).strip()
            target = norm_name_map.get(_norm(base)) if base and base != k else None
        if target is None:
            continue
        merged = matches.setdefault(target, [])
        seen = {e['bvid'] for e in merged}
        kept = [e for e in matches[k] if e['bvid'] not in seen]
        dropped = len(matches[k]) - len(kept)
        merged.extend(kept)
        remapped.append((k, target, len(kept), dropped))
        del matches[k]

    # --- 统一排序：每首歌的 clip 列表按日期降序 ---
    # 站点「▶ 播放最新录播」取列表第 0 条、歌切列表也按此顺序展示，所以新追加的
    # 歌切必须排到前面；无日期的「外部歌切」排最后，组内保持稳定。
    for lst in matches.values():
        lst.sort(key=lambda e: e.get('date') or '', reverse=True)

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
    print(f'enriched {len(enriched)} existing clips (filled missing metadata)')
    for song, bv, filled in enriched:
        print(f'  ~ {song} {bv} 补: {"/".join(filled)}')
    print(f'remapped {len(remapped)} legacy keys onto canonical song names')
    for old_k, new_k, moved, dropped in remapped:
        extra = f'（合并时按 BV 去重 {dropped} 条）' if dropped else ''
        print(f'  > {old_k!r} -> {new_k!r}  迁移 {moved} 条{extra}')
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
