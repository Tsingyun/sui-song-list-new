# AGENTS.md — 岁己SUI 歌单项目工作手册

> 本文档是给 AI Agent 阅读的项目手册。包含了项目架构、数据约定、构建流程、已知坑点和操作指南。
> 新接手的 Agent 应先通读本文档，再开始工作。

---

## 1. 项目概述

这是一个为 B站虚拟主播 **岁己SUI**（UID: 37441530）打造的歌单档案网站。

- **GitHub 仓库**: https://github.com/Tsingyun/sui-song-list-new
- **线上地址**: https://tsingyun.github.io/sui-song-list-new/
- **部署方式**: GitHub Pages，从 `main` 分支的 `docs/` 目录部署
- **架构**: 单文件 HTML（约695KB），所有 CSS、JS、数据全部内嵌在 `docs/index.html` 中
- **视觉风格**: Vaporwave / 赛博朋克（Orbitron + Share Tech Mono 字体、霓虹光效、CRT 扫描线、透视网格）
- **外部依赖**: SheetJS（xlsx）CDN 用于 Excel 导出、Chart.js CDN 用于数据洞察图表
- **数据规模**: 1158首歌曲、3270次演唱记录、917首歌有B站录播匹配（截至 2026-06-17）

---

## 2. 项目结构

```
sui-song-list-new/
├── AGENTS.md                           ← 本文件（AI Agent 手册）
├── README.md                           ← 项目说明（面向人类）
├── LICENSE                             ← MIT License
├── .gitignore
├── requirements.txt                    ← 核心无依赖，可选: requests, openpyxl
├── .github/
│   └── workflows/
│       └── rebuild.yml                 ← GitHub Actions: push data/ 或 scripts/ 时自动重建网站
├── scripts/
│   ├── fetch_bilibili.py               ← Phase 1: 从B站合集抓取视频数据
│   ├── match_songs.py                  ← Phase 2: 歌曲名与B站视频标题匹配
│   ├── rebuild_final.py                ← Phase 3: 数据修正（语言分类/原唱归属）+ 生成 Excel
│   ├── build_site.py                   ← Phase 4: 生成最终单文件 HTML 网站
│   ├── match_tags.py                   ← Phase 5: 歌曲分类标签匹配（~412首人工 + ~137位艺术家 + MusicBrainz API）
│   ├── apply_tags_fast.py              ← Phase 5b: 离线快速标签匹配（不触发 API）
│   ├── add_songs.py                    ← 工具: 快速添加/更新歌曲的 CLI 脚本
│   └── scrape_bilibili_playlist.py     ← 工具: Playwright 翻页提取B站列表最后一页 BV 号
├── data/
│   ├── song_data.json                  ← 核心数据库（1158首歌曲，含 stats、lang_counts 和 tags）
│   ├── song_bilibili_map.json          ← 歌曲-视频匹配结果（916首歌）
│   ├── sui_song_list_complete.json     ← 原始数据（来自 suijisui.space，仅 rebuild_final.py 使用）
│   ├── bilibili_videos.json            ← B站视频原始数据（fetch 产出，.gitignore 排除）
│   └── fetch_progress.json             ← 抓取进度（断点续传，.gitignore 排除）
└── docs/
    ├── index.html                      ← 最终网站（~695KB，由 build_site.py 生成）
    ├── screenshot.png                  ← 网站截图（用于 README）
    └── assets/
        ├── bg-illust.webp              ← 背景插画（桌面版，151KB）
        └── bg-illust-sm.webp           ← 背景插画（移动版，62KB）
```

---

## 3. 数据文件详解

### 3.1 `data/song_data.json` — 核心数据库

这是整个项目的数据核心，所有其他脚本最终都服务于这个文件。

**顶层结构：**
```json
{
  "stats": { "total": 1158, "performances": 3270, "frequent": 233, "occasional": 430, "once": 495 },
  "lang_counts": [ { "lang": "中文", "count": 667 }, { "lang": "日语", "count": 393 }, ... ],
  "top_artists": [ ["周杰伦", 68], ["ヨルシカ", 33], ... ],
  "songs": [ ... ]
}
```

**重要：`stats` 和 `lang_counts` 是冗余的预计算值。** `build_site.py` 在运行时会从 `songs` 数组自动重新计算，所以手动编辑 JSON 时不需要手动更新这两个字段。`top_artists` 目前没有被 build_site.py 使用。

**每首歌的字段：**
```json
{
  "name": "流沙",                    // 歌曲名（必填，唯一标识）
  "translated": "",                  // 译名（可选，如日文歌的中文名）
  "artist": "陶喆",                  // 原唱歌手
  "lang": "中文",                    // 语言分类：中文 / 日语 / 英文 / 韩语
  "count": 7,                        // 演唱次数
  "tier": "frequent",               // 频率等级：frequent(5+) / occasional(2-4) / rare(1)
  "first": "2022-10-15",            // 首次演唱日期 (YYYY-MM-DD)
  "last": "2026-03-22",             // 最近演唱日期 (YYYY-MM-DD)
  "tags": ["流行", "R&B"],          // 分类标签（最多3个，由 match_tags.py / apply_tags_fast.py 生成）
  "bili": [                         // B站录播片段（由 build_site.py 从 song_bilibili_map.json 合并，不存储在 song_data.json 中）
    { "bv": "BV1xx...", "t": "标题", "d": 180, "dt": "2026-03-22" }
  ]
}
```

**注意：** `bili` 字段是在 `build_site.py` 运行时从 `song_bilibili_map.json` 动态合并进来的，不存储在 `song_data.json` 里。

### 3.2 `data/song_bilibili_map.json` — 视频匹配

```json
{
  "matches": {
    "流沙": [
      { "bvid": "BV1xx...", "title": "【岁己SUI】流沙 2026.3.22直播歌切", "duration": 180, "date": "2026-03-22" }
    ]
  }
}
```

由 `match_songs.py` 生成，`build_site.py` 读取并合并到歌曲数据中。

### 3.3 原始数据文件

- `data/sui_song_list_complete.json` — 来自 suijisui.space 的原始 JSON（GitHub 仓库 PQL87/sui-song-list 的 data 目录）
- `data/岁己数据统计.xlsx` — 本地 Excel 数据（2024年6月以后的数据更准确）

这两个文件仅在 `rebuild_final.py` 中使用，日常维护不需要操作它们。

---

## 4. 构建流程

### 4.1 完整构建（从头开始）

四个阶段按顺序执行，每个脚本只使用 Python 标准库（除 fetch 需要 requests，rebuild 需要 openpyxl）：

```bash
# Phase 1: 从B站抓取视频数据（耗时较长，有 API 限流）
python -X utf8 scripts/fetch_bilibili.py

# Phase 2: 歌曲名与视频标题匹配
python -X utf8 scripts/match_songs.py

# Phase 3: 数据修正 + 生成 Excel（可选，主要是初次构建时使用）
python -X utf8 scripts/rebuild_final.py

# Phase 4: 生成最终网站
python -X utf8 scripts/build_site.py

# Phase 5: 歌曲分类标签匹配（离线快速版，推荐）
python -X utf8 scripts/apply_tags_fast.py
python -X utf8 scripts/build_site.py  # 标签写入后需重建网站
```

**Windows 必须加 `-X utf8` 参数**，否则 cmd.exe 的 GBK 编码会导致 UnicodeEncodeError。

### 4.2 日常维护（添加新歌/修改数据）

**方式 A：本地脚本**
```bash
# 已有歌曲又唱了一次
python -X utf8 scripts/add_songs.py --name "流沙" --date "2026-06-14"

# 添加全新歌曲
python -X utf8 scripts/add_songs.py --name "新歌名" --artist "原唱" --lang "中文" --date "2026-06-14"

# 批量添加（同一天唱了多首）
python -X utf8 scripts/add_songs.py --batch "流沙,2026-06-14;One Last Kiss,2026-06-14;新歌名,原唱,中文,2026-06-14"
```

add_songs.py 会自动：更新 count、last 日期、tier → 保存 song_data.json → 调用 build_site.py 重建网站。

**方式 B：手动编辑 JSON + GitHub Actions**

1. 在 GitHub 网页上编辑 `data/song_data.json`
2. 修改已有歌曲的 `count`（+1）和 `last`（更新日期）
3. 或复制一个歌曲对象添加新歌
4. 提交后 GitHub Actions 自动运行 `build_site.py` 重新生成 `docs/index.html`

**方式 C：手动编辑 JSON + 本地重建**

1. 直接编辑 `data/song_data.json`
2. 运行 `python -X utf8 scripts/build_site.py`
3. git add + commit + push

### 4.3 build_site.py 的自动计算逻辑

`build_site.py` 在加载 `song_data.json` 后，会自动从 `songs` 数组重新计算：
- `stats.total` = songs 数组长度
- `stats.performances` = 所有 count 之和
- `stats.frequent` = count >= 5 的歌曲数
- `stats.occasional` = count 2~4 的歌曲数
- `stats.once` = count == 1 的歌曲数
- `lang_counts` = 按语言分组计数，降序排列

所以 song_data.json 中的 `stats` 和 `lang_counts` 字段即使写错也没关系，运行时会被覆盖。

---

## 5. B站 API 详解

### 5.1 合集 API

**端点:** `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list`

**参数:**
- `mid` — 用户 UID
- `season_id` — 合集 ID
- `page_num` — 页码（从1开始）
- `page_size` — 每页条数（最大30，代码中 PAGE_SIZE=30）
- `sort_reverse` — false

**无需认证**，可以直接 GET 请求。

### 5.2 三个歌切合集

| 合集 | mid | season_id | 视频数 | 说明 |
|------|-----|-----------|--------|------|
| 歌切合集1 | 37441530 | 3194603 | ~652 | 2024.6至今 |
| 歌切合集2 | 37441530 | 1004362 | ~999 | 2022.12-2024.6 |
| 歌切合集3 | 9669499 | 6453496 | ~495 | 另一个用户的搬运 |

总计约 2146 个视频。

### 5.3 限流与重试

- **限流代码 -352**: B站的反爬机制，返回 `code: -352`
- **冷却策略**: 首次等待 60s，每次翻倍（60s, 120s, 180s），最多重试3次
- **页间延迟**: 3秒 (`PAGE_DELAY`)
- **合集间延迟**: 30秒 (`COLLECTION_DELAY`)
- **断点续传**: `fetch_progress.json` 记录每个合集的 `last_page`，中断后重新运行会从断点继续

### 5.4 视频标题解析

B站视频标题格式不统一，`match_songs.py` 的 `extract_song_name()` 函数处理以下情况：
- `【岁己SUI】流沙 2026.3.22直播歌切` → `流沙`
- `【岁己SUI】One Last Kiss【20260518歌切】` → `One Last Kiss`
- `命に嫌われている。` → `命に嫌われている`（去除末尾句号）

### 5.5 播放器嵌入

使用 B站 iframe 播放器：
```
https://player.bilibili.com/player.html?bvid={BV}&autoplay=1&high_quality=1&danmaku=0
```

### 5.6 Playwright 歌切提取（新方案）

**背景**: B站合集页面已改为纯 SPA（单页应用），`fetch_bilibili.py` 的 API 方案可能因 WBI 签名失效。新方案使用 Playwright 无头浏览器直接渲染页面。

**依赖**:
```bash
pip install playwright
python -m playwright install chromium
```

**脚本**: `scripts/scrape_bilibili_playlist.py`

**用法**:
```bash
python scripts/scrape_bilibili_playlist.py "https://space.bilibili.com/9669499/lists/6453496"
```

**原理**: 翻到 playlist 最后一页 → 提取所有 BV 号和标题。新歌切始终在列表最末尾。

**优点:**
- 无需认证，跨域可用，可从 `file://` 协议嵌入
- 所有带宽消耗走B站 CDN，不消耗网站服务器流量
- 支持高清画质

### 5.6 pubdate 陷阱

B站 API 返回的 `pubdate` 是**视频上传时间**，不是直播日期。例如：3月31日 21:00 的直播，可能在4月1日才上传，pubdate 就落在4月。所以按月份统计时，应该从**视频标题中提取的日期**来判断，而不是 pubdate。

---

## 6. 歌曲匹配算法

`match_songs.py` 使用多策略匹配，按优先级：

1. **精确匹配**: 对歌曲名和视频标题都做 NFKC Unicode 归一化 → 小写 → 去空格/标点 → 精确比较
2. **基础名匹配**: 去掉歌曲名中的括号注释（如"光（日语版）" → "光"）后再匹配
3. **译名匹配**: 用 `translated` 字段匹配
4. **包含匹配**: 歌曲名包含在视频标题中，但要求长度比 >= 0.7（防止"光"匹配到"月光蟲"）
5. **BVID 交叉验证**: 原始数据中已有的 BVID 直接匹配

匹配率约 79%（916/1158）。

---

## 7. 数据修正记录

`rebuild_final.py` 中有两组手动校正字典，记录已确认的修正：

### 语言修正 (lang_overrides)
```python
'交织together': '中文',      # 名字含英文但是中文歌
'问（DJ版）': '中文',        # DJ 只是版本标签
'Alice in 冷凍庫': '日语',   # 日语歌 (Orangestar)
'8.32': '日语',              # 日语 Vocaloid 歌 (*Luna)
```

### 原唱修正 (artist_overrides)
```python
'8.32': '*Luna',
'Alice in 冷凍庫': 'Orangestar',
'懐中道标': 'やなぎなぎ',
"Don't cry Don't cry": '魏如萱',
```

### 数据合并规则
- 2024年6月（含）以后的数据以**本地 Excel** 为准
- 2024年6月以前的数据可以使用网站源数据
- 分界线: `LOCAL_CUTOFF = datetime(2024, 6, 1)`

---

## 8. 网站功能概览

`build_site.py` 生成的单文件 HTML 包含以下功能模块：

- **统计面板**: 歌曲总数、演唱次数、常唱/偶尔/仅唱一次
- **完整歌单**: 分页显示（每页50首），支持多维度排序（次数/名称/日期）
- **搜索**: 按歌名和原唱搜索，关键词高亮（`<mark>` 标签标注匹配文本）
- **快速筛选**: 全部/常唱/偶尔/稀有
- **语言分类**: 按中文/日语/英文/韩语分组浏览
- **原唱排行**: 按原唱歌手聚合
- **歌曲分类标签**: 23种音乐流派标签（流行/摇滚/抒情/Vocaloid/动画/古风等），标签筛选栏，彩色标签徽章（缩小显示于歌名右侧）
- **歌曲详情面板**: 点击歌曲展开侧边面板，列出所有演唱日期 + 关联B站录播片段 + 元信息
- **数据洞察**（Chart.js）:
  - 演唱日历热力图 — GitHub 风格，按年查看每日演唱分布，年份切换按钮
  - 月度趋势折线图 — 每月新歌数 + 演唱次数，从2022年9月出道起连续统计
  - 标签分布饼图 — 23种音乐流派占比
  - 原唱 Top 20 柱状图 — 按演唱次数排名
- **歌单导出**: CSV/JSON/XLSX 三种格式，导出当前筛选结果（SheetJS CDN）
- **盲盒抽歌**: 赛博老虎机动画，带高斯模糊揭晓效果，稀有度分级（常唱/偶尔/稀有概率不同）
- **在线播放**: 底部嵌入B站 iframe 播放器，多版本歌曲支持下拉切换
- **录播标题**: 点击可跳转B站视频页面
- **我要补充**: 协作提交表单，联网匹配原唱/语言，自动生成 GitHub Issue
- **GitHub 链接**: 页脚有项目仓库链接

---

## 9. 环境注意事项

### 9.1 Windows 编码

cmd.exe 默认使用 GBK 编码，运行含中文/emoji 的 Python 脚本时**必须加 `-X utf8`**:
```bash
python -X utf8 scripts/build_site.py
```

### 9.2 Git Push 认证

非交互终端（如 AI Agent 的 shell）中 `git push` 会报 `terminal prompts disabled`。解决方法：
```bash
git -c credential.helper=manager push origin main
```
这会调用 Windows Git Credential Manager，使用已缓存的浏览器认证凭据。

### 9.3 Surge/Clash 代理

如果使用 Surge 或 Clash 代理（198.18.0.1）：
- `webbrowser.open()` 必须用 `198.18.0.1` 而非 `localhost` 或 `127.0.0.1`（会被代理拦截）
- 浏览器弹窗拦截器会拦截 `window.open()` 和 `target=_blank`
- 替代方案：动态创建 `<a>` 元素 + `.click()`
- Logitech G Hub 的 `CS_GO_Arx_Applet.exe` 可能占用 127.0.0.1:5000，注意端口冲突

### 9.4 bat 文件与中文

`.bat` 文件即使使用 `chcp 65001` 也会闪退，因为 cmd.exe 用 GBK 先解析整个文件。**bat 文件必须纯 ASCII**。

---

## 10. Git 与部署

### 10.1 分支与目录

- 所有代码在 `main` 分支
- GitHub Pages 从 `main` 分支的 `docs/` 目录部署
- 每次修改数据后都需要重新生成 `docs/index.html` 并 push

### 10.2 GitHub Actions 自动部署

`.github/workflows/rebuild.yml` 配置：
- **触发条件**: push 到 main 分支，且修改了 `data/` 或 `scripts/` 目录下的文件
- **也支持手动触发**: workflow_dispatch
- **流程**: checkout → 安装 Python 3.11 → 运行 build_site.py → 自动提交 docs/index.html → push

所以在 GitHub 网页上直接编辑 `data/song_data.json` 并提交，Actions 会自动重建网站。

### 10.3 提交规范

提交信息示例：
```
Add 愛言葉IV (初音未来) - first performance on 2026-06-13
Fix 香水: correct artist to 瑛人 and language to 日语
Add quick-update workflow: GitHub Actions auto-rebuild + local add_songs script
Enrich README with detailed features, architecture, stats, and roadmap
```

---

## 11. 常见操作指南

### 添加一首已唱过的新歌
```bash
python -X utf8 scripts/add_songs.py --name "歌名" --artist "原唱" --lang "日语" --date "2026-06-14"
git add data/song_data.json docs/index.html
git commit -m "Add 歌名 (原唱) - first performance on 2026-06-14"
git -c credential.helper=manager push origin main
```

### 已有歌曲又唱了一次
```bash
python -X utf8 scripts/add_songs.py --name "流沙" --date "2026-06-14"
git add data/song_data.json docs/index.html
git commit -m "Update 流沙: +1 performance on 2026-06-14"
git -c credential.helper=manager push origin main
```

### 修正歌曲信息（原唱/语言）
直接用 Python 修改 `data/song_data.json` 中对应歌曲的字段，然后：
```bash
python -X utf8 scripts/build_site.py
git add data/song_data.json docs/index.html
git commit -m "Fix 歌名: correct artist/lang"
git -c credential.helper=manager push origin main
```

### 重新抓取B站视频数据
```bash
# 删除进度文件以全量重新抓取（或删除 bilibili_videos.json 重新来过）
python -X utf8 scripts/fetch_bilibili.py
python -X utf8 scripts/match_songs.py
python -X utf8 scripts/build_site.py
```

### 修改网站 UI / CSS / JS
编辑 `scripts/build_site.py` 中的 HTML 模板字符串（`html = r'''...'''`），然后重新运行 build_site.py。

**注意**: 模板在数据注入点附近从 `r'''...'''` 切换为普通 `'''...'''`。在普通字符串区域的 JS 代码中，不要使用 `\'` 转义单引号（反斜杠会被吞掉），应改用 ES6 模板字面量（反引号）。

### 更新歌曲分类标签
```bash
# 离线快速匹配（推荐，不触发 MusicBrainz API）
python -X utf8 scripts/apply_tags_fast.py
python -X utf8 scripts/build_site.py

# 联网匹配（慢，约10分钟，会调用 MusicBrainz API）
python -X utf8 scripts/match_tags.py
python -X utf8 scripts/build_site.py
```

**注意：** 新增歌曲后需重新运行 apply_tags_fast.py 为新歌匹配标签。标签数据存储在 song_data.json 的 `tags` 字段中。

### 手动编辑标签字典
标签字典定义在 `scripts/match_tags.py` 中：
- `SONG_TAGS` — ~412 首人工标注的歌曲标签
- `ARTIST_TAGS` — ~137 位艺术家的默认标签
- `LANG_DEFAULTS` — 语言兜底标签
- `GENRE_MAP` — MusicBrainz 英文标签到中文的映射

修改后运行 `apply_tags_fast.py` 重新匹配所有歌曲。

---

## 12. 已知坑点总结

1. **B站 pubdate ≠ 直播日期**: 上传时间可能跨月，按标题中的日期过滤
2. **合集 API 翻页上限**: 单页 ps 最大 999 条（但代码中用 30），total > 999 时需翻页
3. **限流 -352**: 需 60s 冷却重试、3s 页间延迟、30s 合集间延迟
4. **数据质量问题**: 原始数据中部分歌曲名为空格、date_list 为空格（需用 song_count 兜底）
5. **非标准空格**: 歌名中可能含 `\xa0`（不间断空格），normalize 时需处理
6. **Windows git push**: 非交互终端必须用 `credential.helper=manager`
7. **Windows Python**: 必须加 `-X utf8` 避免 GBK UnicodeEncodeError
8. **stats 是冗余的**: build_site.py 运行时自动计算，手动编辑 JSON 时无需更新 stats
9. **bili 字段不存储在 song_data.json**: 运行时从 song_bilibili_map.json 合并
10. **iframe 播放器不走网站流量**: 所有带宽由B站 CDN 承担
11. **build_site.py 的 Python 原始字符串**: 使用 `r'''...'''` 生成 HTML，但 Edit 工具写入时 `\n` 会被转为实际换行符。JS 单引号字符串中需要字面 `\n` 时必须写 `\\n`
12. **build_site.py 的模板切换点**: 模板在某一点从 `r'''...'''`（原始字符串）切换为 `'''...'''`（普通字符串），约在数据注入点附近。普通字符串中 `\'` 会丢失反斜杠变成 `'`，导致 JS 中 `onclick="renderHeatmap(\'2024\')"` 变成无效语法。**解决方案**: 在数据注入点之后的 JS 代码中使用 ES6 模板字面量（反引号 `` ` ``）代替单引号拼接
13. **toISOString() 时区陷阱**: `new Date(2024,0,1).toISOString()` 在 UTC+8 时区会返回 `2023-12-31T16:00:00.000Z`，取前10位就变成 `2023-12-31`（日期倒退一天）。**解决方案**: 用 `d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')` 构造本地日期字符串
14. **非标准日期格式**: `SONG_DATES` 中有约665条日期使用非标准格式（如 `2024-1-6` 而非 `2024-01-06`），`d.slice(0,7)` 会得到 `2024-1-`（无效月份键）。**解决方案**: 用 `d.split('-')` 拆分后对月和日 `padStart(2,'0')` 归一化
15. **1901年垃圾数据**: 部分歌曲有 `1901-11-xx` 的默认日期（来自空值填充）。**解决方案**: Python 构建层过滤 `int(year) >= 2022`，JS 层 `getAllDates()` 过滤 `norm < '2022-09'`
16. **HTML 结构变更破坏事件处理**: 修改 `.name` 的 HTML 结构（如加入 `.song-title` 包装层）会导致 `nameEl.childNodes[0].textContent` 提取到意外内容（包含译名）。**解决方案**: 用 `row.getAttribute('data-song')` 获取原始歌名，避免依赖 DOM 结构
17. **热力图 week 计数**: `totalWeeks = week + 2`（不是 `week + 1`），因为最后一个不完整周需要额外一列，且 `grid-column` 从1开始
18. **热力图月份标签对齐**: 不能用 `Math.floor(i/7)` 计算月份起始列，因为1月1日不一定是周一。必须用实际 cell 的 `c.col` 值，且标签 grid 使用与数据 grid 相同的 `grid-template-columns`
19. **match_tags.py 的模块级代码**: 直接 `import match_tags` 会触发模块底部的 MusicBrainz API 调用。使用 `apply_tags_fast.py` 替代，它通过 regex+exec 提取字典而不触发 API
20. **新增歌曲需匹配标签**: 添加歌曲后需运行 `apply_tags_fast.py` 再重建网站，否则新歌没有标签显示

---

## 13. 数据来源与致谢

- **歌曲基础数据**: [suijisui.space](https://www.suijisui.space)（[GitHub: PQL87/sui-song-list](https://github.com/PQL87/sui-song-list)），2022.09 - 2025.09 已停更
- **B站录播视频**: 岁己SUI 的 B站投稿合集（mid: 37441530, 9669499）
- **本地 Excel 数据**: 2024年6月以后的演唱记录（更准确）
- **歌曲-视频匹配**: 基于标题归一化的多策略匹配（精确匹配、译名匹配、基础名匹配、包含匹配、BVID 交叉验证）

---

## 14. 项目所有者信息

- **GitHub 用户名**: Tsingyun
- **仓库**: Tsingyun/sui-song-list-new
- **部署**: GitHub Pages, main 分支, docs/ 目录
- **协议**: MIT License
