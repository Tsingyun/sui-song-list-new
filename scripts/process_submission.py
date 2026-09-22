# -*- coding: utf-8 -*-
"""歌曲提交编排：加歌 → 对「早于提交日」的缓存离线做歌切匹配 → 重建（同步最近演唱）。

每次"接收到歌曲名"（点歌提交）时由 agent 调用本脚本，把原来分散的若干步串成一条流水线：

  1. add_songs   更新 song_data（count+1/last）+ sui_song_list_complete（热力图逐日记录）
  2. request_stats  有点歌人 → raw_data 追加 {date,song,audience}（幂等）；
                  自决演唱（无点歌人）→ 不入 raw_data，但日期仍进 live_dates
  3. 歌切匹配    ★只使用 data/clips/clips_<早于提交日>.json 缓存，离线运行 match_clips，
                  绝不抓取当日歌切（当日 clip 大概率尚未生成/上传）→ 用每日抓取步骤补齐
  4. build_site  重建 docs/index.html（最近演唱由 complete 在构建期派生，自动同步）

为什么"不要立即匹配当日歌切"：提交日的 B站歌切列表往往还没更新（直播刚结束、转码/上传滞后），
此时抓取会得到残缺甚至错误的当日 clip。规则是：提交当天只拿"之前一天或多天"已落库的 clips
缓存来匹配；当日那一条 clip 交给每日抓取步骤（见下方 SCRAPE_CMD）在直播归档后补上。

歌切匹配是幂等的（match_clips 新增/补全/归位/排序四步均幂等），重复运行输出恒为
added 0 … enriched 0 … remapped 0，可放心对全库重跑。

Usage:
  # TSV（与用户提交格式一致：首行列日期，后续行复用；第三列为点歌人，缺省=自决演唱）
  python -X utf8 scripts/process_submission.py --tsv-text "2026年9月20日\t太陽と向日葵\tVaserkia
听见下雨的声音\t人活着是为了02
君が生まれた日"

  # 也可从文件读
  python -X utf8 scripts/process_submission.py --tsv submit.tsv

  # 或显式传参（audiences 与 songs 顺序对齐，空串=自决演唱）
  python -X utf8 scripts/process_submission.py --date 2026-09-20 --songs "歌A,歌B" --audiences "观众1,,"
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
CLIPS_DIR = os.path.join(DATA_DIR, 'clips')
REQ_STATS = os.path.join(DATA_DIR, 'request_stats.json')
COMPLETE_FILE = os.path.join(DATA_DIR, 'sui_song_list_complete.json')

# 每日抓取命令（直播归档后在本地运行，生成 data/clips/clips_YYYY-MM-DD.json 并同步匹配）
SCRAPE_CMD = ("python -X utf8 scripts/match_clips.py "
              "--save-clips data/clips/clips_$(date +%F).json")


# ── 日期解析 ──────────────────────────────────────────────────────────────
def parse_date(s):
    """'2026年9月20日' / '2026-09-20' / '2026/9/20' -> '2026-09-20'；否则 None。"""
    if not s:
        return None
    s = s.strip()
    m = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', s)
    if m:
        return '%04d-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$', s)
    if m:
        return '%04d-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def parse_tsv(text):
    """解析提交行。首列可能是日期（中文或 ISO），不是日期则复用上一行日期。
    返回 [(date, name, audience_or_None), ...]。"""
    rows = []
    cur_date = None
    for raw in text.replace('\r\n', '\n').split('\n'):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        parts = [p.strip() for p in line.split('\t')]
        date_candidate = parse_date(parts[0])
        if date_candidate:
            cur_date = date_candidate
            rest = parts[1:]
        else:
            rest = parts  # 复用 cur_date
        if not cur_date:
            print('WARN: 跳过无日期行:', line, file=sys.stderr)
            continue
        name = rest[0] if rest else ''
        audience = rest[1] if len(rest) > 1 else ''
        if not name:
            continue
        rows.append((cur_date, name, audience or None))
    return rows


# ── 点歌数据 ──────────────────────────────────────────────────────────────
def update_request_stats(rows):
    """raw_data 仅记有点歌过程的歌；自决演唱（audience=None）不入。
    live_dates 记所有演出日（含纯主播场）。"""
    with open(REQ_STATS, encoding='utf-8') as f:
        rs = json.load(f)
    rd = rs.setdefault('raw_data', [])
    added = 0
    for d, name, aud in rows:
        if aud:
            if not any(x.get('date') == d and x.get('song') == name
                       and x.get('audience') == aud for x in rd):
                rd.append({'date': d, 'song': name, 'audience': aud})
                added += 1
    rs['raw_data'] = rd

    ld = rs.setdefault('live_dates', [])
    for d, _, _ in rows:
        if d not in ld:
            ld.append(d)
    rs['live_dates'] = sorted(ld)

    with open(REQ_STATS, 'w', encoding='utf-8') as f:
        json.dump(rs, f, ensure_ascii=False, indent=2)
    days = sorted({d for d, _, _ in rows})
    print(f'[request_stats] raw_data +{added} 条；live_dates 含 {days}')


# ── 歌切缓存选择（严格早于提交日） ────────────────────────────────────────
def select_prior_clips(submit_max, clips_dir):
    """返回 (cache_path, cache_date) 中日期严格 < submit_max 的最新一份；无则 (None, None)。"""
    best, best_d = None, None
    if not os.path.isdir(clips_dir):
        return best, best_d
    for f in glob.glob(os.path.join(clips_dir, 'clips_*.json')):
        m = re.search(r'clips_(\d{4}-\d{2}-\d{2})\.json$', f)
        if not m:
            continue
        d = m.group(1)
        if d < submit_max:  # ISO 字符串比较即日期比较
            if best_d is None or d > best_d:
                best_d, best = d, f
    return best, best_d


# ── complete 兜底（保证最近演唱同步） ─────────────────────────────────────
def ensure_complete(rows):
    """确保每首提交歌曲在 complete 里有当日逐日记录（add_songs 仅更新已存在的条目，
    全新歌曲首唱不会建条目 → 最近演唱漏显）。本步骤补齐，等价于 add_songs 的更新逻辑。"""
    with open(COMPLETE_FILE, encoding='utf-8') as f:
        comp = json.load(f)
    changed = False
    for d, name, _ in rows:
        y, m, day = d.split('-')
        date_key = '%s/%d/%d' % (y, int(m), int(day))
        entry = next((x for x in comp if x.get('song_name') == name), None)
        if entry is None:
            comp.append({'song_name': name, 'date_list': date_key})
            changed = True
        else:
            dl = entry.get('date_list', '')
            if date_key not in dl:
                entry['date_list'] = (dl + '，' + date_key) if dl else date_key
                changed = True
    if changed:
        with open(COMPLETE_FILE, 'w', encoding='utf-8') as f:
            json.dump(comp, f, ensure_ascii=False, indent=2)
        print('[complete] 已补齐 %d 首的当日逐日记录（最近演唱数据源）' % len(rows))


# ── 主流程 ────────────────────────────────────────────────────────────────
def run(rows, do_rebuild=True):
    if not rows:
        print('没有可处理的歌曲行。')
        return
    dates = sorted({r[0] for r in rows})
    submit_max = dates[-1]  # 用最晚提交日比较，避免用到任何"同日"缓存

    print('=== 提交歌曲（%d 行，日期 %s）===' % (len(rows), dates))

    # 1) add_songs：song_data + complete（每首独立调用，避免歌名含逗号歧义）
    add = os.path.join(SCRIPT_DIR, 'add_songs.py')
    for d, name, _ in rows:
        r = subprocess.run([sys.executable, '-X', 'utf8', add, '--no-rebuild',
                             '--name', name, '--date', d],
                            cwd=PROJECT_ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
            sys.exit(1)
        # 只打印关键信息行
        for ln in r.stdout.splitlines():
            if ln.strip().startswith('['):
                print(ln)

    # 2) request_stats
    update_request_stats(rows)

    # 2.5) complete 兜底：保证最近演唱同步（含全新歌曲首唱）
    ensure_complete(rows)

    # 3) 歌切匹配：只用早于提交日的缓存，离线（不抓取当日）
    cache, cache_date = select_prior_clips(submit_max, CLIPS_DIR)
    if cache:
        print('\n[歌切匹配] 使用缓存(严格早于 %s): %s (%s)，离线匹配'
              % (submit_max, os.path.basename(cache), cache_date))
        r = subprocess.run([sys.executable, '-X', 'utf8',
                            os.path.join(SCRIPT_DIR, 'match_clips.py'),
                            '--clips-file', cache],
                           cwd=PROJECT_ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print('WARN: 歌切匹配失败：', r.stderr, file=sys.stderr)
        else:
            print(r.stdout)
    else:
        print('\n[歌切匹配] 未找到严格早于 %s 的 clips 缓存，跳过（不抓取当日歌切）。'
              % submit_max)
        print('   直播归档后补匹配，请在本地运行：')
        print('   ' + SCRAPE_CMD)

    # 4) 重建（最近演唱来自 complete，已更新；bili map 已嵌入）
    if do_rebuild:
        r = subprocess.run([sys.executable, '-X', 'utf8',
                            os.path.join(SCRIPT_DIR, 'build_site.py')],
                           cwd=PROJECT_ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
            sys.exit(1)
        print(r.stdout)

    print('\n完成。提交日 %s 的歌曲已录入；最近演唱随重建同步更新。' % submit_max)


def main():
    ap = argparse.ArgumentParser(description='歌曲提交编排（加歌 + 离线歌切匹配 + 重建）')
    ap.add_argument('--tsv', help='提交文件路径（每行 日期\\t歌名\\t点歌人，点歌人缺省=自决演唱）')
    ap.add_argument('--tsv-text', help='直接传提交文本（同 --tsv 格式）')
    ap.add_argument('--date', help='统一演出日期 YYYY-MM-DD（与 --songs 配合）')
    ap.add_argument('--songs', help='歌名列表，逗号分隔')
    ap.add_argument('--audiences', help='点歌人列表，逗号分隔，与 --songs 对齐；空串=自决演唱')
    ap.add_argument('--no-rebuild', action='store_true', help='跳过重建（仅改数据+匹配，测试用）')
    args = ap.parse_args()

    rows = []
    if args.tsv or args.tsv_text:
        text = args.tsv_text
        if args.tsv:
            with open(args.tsv, encoding='utf-8') as f:
                text = f.read()
        rows = parse_tsv(text)
    elif args.date and args.songs:
        d = parse_date(args.date)
        if not d:
            print('ERROR: --date 无法解析：', args.date, file=sys.stderr)
            sys.exit(1)
        names = [x.strip() for x in args.songs.split(',') if x.strip()]
        auds = [x.strip() for x in (args.audiences or '').split(',')]
        for i, name in enumerate(names):
            aud = auds[i] if i < len(auds) else ''
            rows.append((d, name, aud or None))
    else:
        ap.print_help()
        sys.exit(1)

    run(rows, do_rebuild=not args.no_rebuild)


if __name__ == '__main__':
    main()
