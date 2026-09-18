# 逆向产品分析（全新重建前置研究）

> 本文档是 2026-09 全站重建前对旧系统的逆向分析结论：旧网站"能做什么、数据从哪来、
> 规则是什么"。它同时是重建的功能验收清单——新站必须覆盖这里列出的全部用户可见能力，
> 但实现方式、视觉语言、组件架构完全从零开始，不继承旧前端。

## 1. 旧系统一句话

B站虚拟主播「岁己SUI」的**演唱档案网站**：单文件 HTML（由 `scripts/build_site.py` 从
`data/song_data.json` 等数据生成），Vaporwave 视觉，部署于 GitHub Pages（`docs/` 目录，
自定义域 suijisui.uk + tsingyun.github.io 镜像）。

## 2. 数据源与数据流

```
data/song_data.json            核心歌曲库（1170 首）：name/translated/artist/lang/count/tier/first/last/tags
data/song_bilibili_map.json    歌曲→B站录播片段匹配（932 首）：matches[name] = [{bvid,title,duration,date}]
data/sui_song_list_complete.json 源站原始数据（1247 条）：song_name + date_list（"2022/9/4，…"）+ BVID
scripts/build_site.py          构建器：合并 bilibili（波浪号归一化）→ 展开日期表 → 重算 stats → 内嵌单 HTML
.github/workflows/rebuild.yml  push data/ 或 scripts/ 时自动重建并提交 docs/index.html
scripts/add_songs.py           日常加歌 CLI（更新 count/last/tier → 追加 complete 日期 → 重建）
```

构建时自动重算（song_data.json 中的 stats/tier 是冗余字段，不可信）：
- `total` = 歌曲数；`performances` = Σcount；`frequent` = count≥5；`occasional` = 2–4；`once` = 1
- tier（展示层）由 count 现算：≥5 frequent / 2–4 occasional / 1 rare

## 3. 旧站用户可见功能清单（重建验收基线）

### 歌单浏览
1. 四视角：全部歌曲 / 常唱金曲（5+）/ 语言分类（中/日/英/韩 分组+锚点导航）/ 原唱分类（聚合卡）
2. 搜索：歌名、译名、原唱，实时过滤 + 命中高亮（`<mark>`），防抖 200ms
3. 筛选：语言 4 种；快捷筛选 全部/常唱(5+)/偶尔(2–4)/仅唱一次/很久没唱(距 last ≥180 天，按久远排序)；标签筛选（33 种流派/企划标签，含计数）
4. 排序：次数↓↑ / 歌名 / 最早演唱↑ / 最近演唱↓ / 最久没唱↑（中文 localeCompare，次数并列按歌名）
5. 分页：50 首/页，窗口式页码，页码信息条
6. 全站 Top10 行高亮（★+排名）
7. 统计卡片可点击 → 跳到对应筛选结果

### 歌曲详情
8. 行点击展开详情：完整演唱日期列表（最早/最近高亮）、分类标签、网易云搜索外链、B站搜索外链、
   关联录播片段列表（日期+时长，可点击跳转）
9. 最近演唱列悬停 → 全部演唱日期 tooltip
10. 点歌名复制：`🎵 歌名｜最近演唱：日期｜共演唱N次` + Toast 反馈

### 在线播放
11. 有匹配片段的歌显示 ▶：嵌入 `player.bilibili.com/player.html?bvid=…&autoplay=1&high_quality=1&danmaku=0`
12. 浮动可拖拽 16:9 小窗（贴边限制），多版本下拉切换（标注日期/时长/当前版本◂），放大/还原，B站原视频直链
13. 无匹配片段显示 ↗ → `search.bilibili.com/all?keyword=岁己SUI {歌名} 歌切`

### 数据洞察
14. 演唱日历热力图：GitHub 风格、按年切换、格子数字=当日演唱数、悬停显示当日歌单（可点击直达歌曲）、
    拖拽/滚轮横滚、只统计 ≥2022-09（过滤 1901 垃圾数据）
15. 月度趋势折线：每月演唱次数 + 新歌数（从 2022-09 出道连续）
16. 标签分布（Top15）与 原唱 Top20（歌曲数+演唱次数双序列）

### 工具
17. 导出：CSV（BOM）/ JSON（含时间戳）/ XLSX（SheetJS CDN）——导出**当前筛选结果**
18. 盲盒抽歌：随机 1 首，老虎机滚动动画 + 揭晓（稀有度：常唱/偶尔/稀有），播放或 B站搜索
19. 我要补充：查重 → MusicBrainz/网易云联网匹配原唱 + 歌名语言探测 → 预填 GitHub Issue
    （labels=contribution,song-data）
20. 返回顶部；页脚数据来源/GitHub 链接/时间跨度 `2022.09 — 2026.09`/版本徽章/更新日志折叠
21. 「点歌统计」外链（stats.suijisui.uk，独立站点）

## 4. 不可改变的业务规则

- **日期归一化**：`2024-1-6` → `2024-01-06`（按 `-` 拆分补零，禁止 slice）；过滤 `年份 < 2022`；
  热力图/趋势只统计 `≥ 2022-09`
- **波浪号归一化**：歌名与视频匹配键统一 `U+301C/U+FF5E → U+007E`（如 真夜中のドア〜Stay With Me）
- **统计口径**：frequent/occasional/once 阈值 5/2/1，总数 = Σcount
- **song_data.json 的 stats/tier/lang_counts 是冗余的**：构建时从 songs 重算
- **旧系统已知数据事实**：`鳥の詩` 存在两条（日语版/中文版条目，均保留）；`群青` 无 first/last 日期；
  日期列表来自 complete 文件的 1247 条（按歌名精确匹配）

### 点歌统计规则（源自姊妹仓库 Tsingyun/sui-song-stats，rules 以用户 2026-07-14 澄清为准）
- **数据**：`raw_data`（date/song/audience 三元组，2024-06 起）+ `live_dates`（含纯主播场，只能并集不能覆盖）
- **点歌占比**：完整榜单上使用**向下取整**，**最后一项补齐余数**，最终总和严格 = 100%
  （注意 stats 站 changelog 的教训：不得在"截断后的 Top10 视图"上做末项补齐——那会让末项占比虚高；
  补齐只发生在完整集合的最后一项上）
- **🔥 连续点歌**：月内，把"有观众点歌的日期"排成序列；同一观众在连续的请求日序列上都点过歌
  ⇒ 一段 streak（长度≥2 才算）；**纯主播日（当天无任何点歌）是透明的，不中断 streak**；
  只在月内判断，不跨月串联；🔥 数量 = 连续场次 − 1（至少 1 个）
- **观众等级**：Lv.1 <11 / Lv.2 11–30 / Lv.3 31–60 / Lv.4 61–100 / Lv.5 ≥100（按总点歌数）
- **月度冠军**：月榜第一名数量，并列全部 crowned（👑）
- **榜单排序**：count 降序（并列按名字序）——stats 站用拼音 tiebreak，重建版用名字序（构建器无新增依赖）
- 榜单/趋势/偏好等一律从 raw_data 现算，禁止手补（stats 站 process_features.py 的历史教训）

## 5. 部署与工程约束

- GitHub Pages 从 `main` 的 `docs/` 部署；`docs/CNAME` = suijisui.uk 必须保留
- Actions 入口固定为 `python scripts/build_site.py`（Linux，无额外 pip 依赖）——新构建器必须零第三方依赖
- 手改 docs/index.html 会被构建覆盖；所有改动进构建器
- Windows 本地构建带 `-X utf8`

## 6. 重建决策（新站怎么做）

- 保留"单文件 HTML + 零运行时框架 + Actions 自动重建"的部署形态；但源码层拆分为
  `scripts/sitegen/`（数据层 / 点歌规则层 / 组装器 + CSS/JS 资产），构建时内联
- 点歌数据（stats 仓库 `song_data_processed.json`）以 `data/request_stats.json` 引入，
  在构建期从 raw_data 派生全部榜单/占比/🔥streak——新站原生具备点歌统计能力，同时保留外链
- 视觉彻底更换：**场刊/档案簿编辑风**（暖纸底、墨色文字、衬线标题、等宽数据字、朱红单强调色、
  细线分隔、无卡片堆砌/无霓虹/无玻璃拟态/无 CRT）
- hash 路由（`#/songs?q=…`、`#/song/<名>`、`#/requests` …）：筛选状态与歌曲详情可分享、可前进后退
- 图表全部手写 SVG/DOM（去掉 Chart.js CDN）；XLSX 导出保留 SheetJS CDN（点击时惰性加载）
