# AGENTS.md — 岁己SUI 歌单项目工作手册

> 本文档是给 AI Agent 阅读的项目手册：项目架构、数据约定、构建流程、业务规则、已知坑点。
> 新接手的 Agent 应先通读本文档与 `REBUILD_NOTES.md`，再开始工作。

---

## 1. 项目概述

为 B站虚拟主播 **岁己SUI**（UID: 37441530）打造的演唱档案网站，**v3.0 全新重制版**。

- **GitHub 仓库**: https://github.com/Tsingyun/sui-song-list-new
- **线上地址**: https://suijisui.uk （镜像 https://tsingyun.github.io/sui-song-list-new/）
- **部署**: GitHub Pages，从 `main` 分支 `docs/` 目录
- **形态**: 单文件 HTML（~773KB），CSS/JS/数据全部内嵌，无运行时框架
- **视觉**: 「场刊 / 档案簿」编辑风 —— 暖纸底、墨色、朱红强调、衬线标题 + 等宽数据字
- **数据规模**: 1,170 首歌 / 3,397 次演唱 / 905 首录播匹配 / 863 条点歌记录（2024-06 起）
- **外部依赖**: 前端仅 Google Fonts CDN；XLSX 导出用 SheetJS CDN（点击时惰性加载）；无图表库

---

## 2. 项目结构

```
sui-song-list-new/
├── AGENTS.md / README.md / REBUILD_NOTES.md
├── .github/workflows/rebuild.yml       push data/ 或 scripts/ 时自动重建并提交 docs/index.html
├── data/
│   ├── song_data.json                  核心歌曲库（stats/tier/lang_counts 为冗余字段，构建时重算）
│   ├── song_bilibili_map.json          matches[歌名] = [{bvid,title,duration,date}]
│   ├── sui_song_list_complete.json     源站原始数据（date_list 是逐日演唱日期的唯一来源）
│   └── request_stats.json              点歌主源（raw_data/live_dates/user_uids），来自 sui-song-stats
├── scripts/
│   ├── build_site.py                   构建入口（Actions 固定调用此路径）
│   ├── import_request_stats.py         导入/更新点歌主源（只保留主源字段）
│   ├── add_songs.py                    加歌 CLI（自动更新 count/last/complete 表并重建）
│   ├── match_songs.py / fetch_bilibili.py / match_tags.py / apply_tags_fast.py
│   ├── audit_*.py / fix_*.py / rebuild_final.py   数据审计与修复工具
│   └── sitegen/                        新构建器（纯标准库，见 §4）
└── docs/                               GitHub Pages 部署目录（产物，勿手改）
    ├── index.html / CNAME / screenshot.png
```

---

## 3. 数据文件与规则

### 3.1 `data/song_data.json`

每首歌：`name / translated / artist / lang / count / tier / first / last / tags`。
- `stats`、`tier`、`lang_counts` 是冗余字段——构建时从 songs 数组重算，手改无效
- `artist` 标注**原唱**（Vocaloid 曲写成 "P主/歌姬"，P主在前）
- 已知数据事实：`鳥の詩` 存在两条（日语版/中文版条目，都保留）；`群青` 无 first/last；
  `count` 分布 1–19

### 3.2 日期数据

- 逐日日期**只来自** `sui_song_list_complete.json` 的 `date_list`（"2022/9/4，…"）
- 构建期归一化为 `YYYY-MM-DD` 并过滤年份 <2022 的垃圾数据（旧版 1901 填充）
- 热力图/趋势只统计 ≥ 2022-09
- `add_songs.py` 加歌时会同步追加 complete 表，保证热力图覆盖

### 3.3 录播匹配（bili）

- 构建期把 `song_bilibili_map.json` 按歌名合并进歌曲；键与歌名均做**波浪号归一化**
  （U+301C/U+FF5E → U+007E），否则「真夜中のドア〜Stay With Me」这类歌会丢录播
- 匹配率 905/1170；未匹配的歌播放按钮显示为「B站搜索」跳转

### 3.4 点歌数据（request_stats.json）

主源字段：`raw_data`（{date, song, audience} 三元组）、`live_dates`（含纯主播场）、
`user_uids`、`data_version`。**所有榜单/占比/🔥/等级等一律在构建期从 raw_data 派生，
禁止手补**（stats 仓库的历史教训：手补数据曾严重漂移）。更新方式：

```bash
python -X utf8 scripts/import_request_stats.py <sui-song-stats仓库>/song_data_processed.json
python -X utf8 scripts/build_site.py
```

---

## 4. 构建器（scripts/sitegen/）

```
build_site.py ──► sitegen.builder.build()
                    ├─ datalayer.build_song_payload()   歌曲域：合并bili、展开日期、聚合统计
                    ├─ reqstats.build_request_payload() 点歌域：榜单/占比/🔥/等级/冠军/趋势/热力
                    └─ 骨架 skeleton.html + 内联 CSS/JS + 注入 window.SUI
```

- **零第三方依赖**（Actions 环境无 pip install）
- 输出确定性：数据里不含时间戳，重复构建 diff 稳定
- JSON 注入时转义 `</`、U+2028/2029，防止提前闭合 script 标签
- 前端源码按序拼接：`domain.js → core.js → components.js → view-*.js → app.js`
  （domain = 纯函数域层；core = hash 路由/工具；components = 播放器/弹层/导出/页脚；
  view-* = 八个视图；app = 启动）

### 业务规则（改代码前必读，规则原文见 REBUILD_NOTES.md §4）

1. **统计口径**：frequent ≥5 / occasional 2–4 / once =1；performances = Σcount
2. **点歌占比**：完整榜单**向下取整、末项补齐余数、总和严格 100%**；
   补齐只发生在完整集合的最后一项（不得在截断视图上补齐——旧版 Top10 补齐导致占比虚高，
   2026-07-22 被否决）。歌曲榜因单项占比全部 <1%，同一规则改用 0.1% 粒度
3. **🔥 连续点歌**：月内把「有点歌的日期」排成序列，同观众在连续请求日都点过 = 一段 streak
   （长度 ≥2）；**纯主播日透明**（当天无任何点歌则不中断）；不跨月；🔥 数 = 场次 − 1（至少 1）
4. **观众等级**：1–5 级阈值 11/31/61/100；**月度冠军**：月榜第一名数量，并列全冠 👑
5. **榜单排序**：count 降序、名字并列 tiebreak（stats 站用拼音，本站无新增依赖用名字序）

---

## 5. B站 API 与录播抓取（沿用旧工具链）

- 合集端点：`https://api.bilibili.com/x/polymer/web-space/seasons_archives_list`
  （mid 37441530：season 3194603、1004362；mid 9669499：season 6453496）
- 限流 `-352`：60s 起冷却重试 3 次，页间 3s，合集间 30s，断点续传 fetch_progress.json
- `pubdate ≠ 直播日期`：按视频标题中的日期判断月份
- 播放器嵌入：`https://player.bilibili.com/player.html?bvid={BV}&autoplay=1&high_quality=1&danmaku=0`
- 标题解析/匹配策略（NFKC 归一化、精确/基础名/译名/包含 ≥70%）见 `match_songs.py`

---

## 6. 环境注意事项

1. **Windows 编码**：所有 Python 命令加 `-X utf8`（cmd.exe 默认 GBK）
2. **Git push**：非交互终端用 `git -c credential.helper=manager push origin main`；
   push 由项目主理人本地完成，Agent 不要自行 push
3. **bat 文件必须纯 ASCII**；bash 工具在本机不可用（cmd shell）
4. **本地预览**：`python -m http.server 8899` 后访问 `http://127.0.0.1:8899/docs/`；
   代理环境下 localhost 可能被拦截，注意端口冲突
5. **单文件产物**：不要手改 `docs/index.html`；改 `scripts/sitegen/assets/` 后重建
6. **hash 路由**：`#/songs?q=&lang=&tag=&quick=&sort=&page=`、`#/song/<encodeURIComponent(歌名)>`、
   `#/insights?tab=`、`#/requests?kind=&m=`；旧锚点 `#lang-日语` 自动兼容到语言视图
7. **grid 溢出**：单列自适应布局一律写 `minmax(0, 1fr)` 而不是 `1fr`
   （`1fr` 的 min=auto 会被 nowrap 内容撑破，已在移动端踩过）

---

## 7. Git 与部署

- 代码在 `main` 分支；Pages 从 `main` 的 `docs/` 部署；`docs/CNAME` = suijisui.uk
- Actions（rebuild.yml）：push 影响 `data/**` 或 `scripts/**` → 运行 build_site.py →
  自动提交 docs/index.html
- 提交信息示例：`Add 愛言葉IV - first performance on 2026-06-13`、
  `Fix 香水: correct artist to 瑛人 and language to 日语`
- 数据更新后必须重建：本地跑 build_site.py 或依赖 Actions

---

## 8. 验证清单（改动后逐项自检）

1. `python -X utf8 scripts/build_site.py` 构建无报错
2. 统计数字：1,170 / 3,397 / 241 / 434 / 495（与 songs 数组重算值一致）
3. 录播匹配 905 首；逐日日期表 1,152 首
4. 点歌：863 条 / 86 人 / 511 首；各榜单占比总和 = 100；🔥 = 场次 − 1
5. 搜索/筛选/排序/分页正常；歌曲详情、播放器、盲盒、我要补充、导出可用
6. 移动端（≤640px）无横向溢出；控制台无错误
