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
- **数据规模**: 1,170 首歌 / 3,399 次演唱 / 905 首录播匹配 / 865 条点歌记录（2024-06 起）
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
- **可配置常量集中在 `builder.py` 顶部**：`BILI_SPACE_URL`（左上角品牌位外链 → B站空间，
  骨架里是 `__BILI_SPACE_URL__` 占位）、`HERO_ART`（首页立绘轮换候选）。改这两处即可，
  不要散落硬编码到前端源码
- **首页「盲盒抽歌」与点歌页「点歌速览」的滚动带**：原首页右下角的「点歌速览」已移除，
  改为首页「盲盒抽歌」（池子纵向滚动 + 抽取按钮），原速览以横向滚动带的形式迁到点歌页；
  配套的 `lockHeight()` 锁高逻辑随之删除（滚动展示不存在「切换时高度变化」这个问题了）。
  滚动完全由 CSS 完成（`components.css` 的 `.marquee`）：内容原样复制一份，轨道匀速位移 −50%，
  因为轨道尺寸正好是一份内容的两倍，所以是无缝的、且不需要任何 JS 定时器。
  **改之前必读两条约束**：① 一份内容的尺寸必须精确可算 —— 垂直版靠固定行高（`--mq-row`），
  水平版靠 `.marquee-group` 的 `padding-right` 把组间距也计入一份（卡片宽度用 `flex-basis`
  写死，别改成自动宽度）；② 容器尺寸必须固定（垂直版 `--mq-h`），高度不随内容变化是它
  不产生布局抖动（CLS）的唯一前提

### 业务规则（改代码前必读，规则原文见 REBUILD_NOTES.md §4）

1. **统计口径**：frequent ≥5 / occasional 2–4 / once =1；performances = Σcount
2. **点歌占比**：完整榜单**向下取整、末项补齐余数、总和严格 100%**；
   补齐只发生在完整集合的最后一项（不得在截断视图上补齐——旧版 Top10 补齐导致占比虚高，
   2026-07-22 被否决）。歌曲榜因单项占比全部 <1%，同一规则改用 0.1% 粒度
3. **🔥 连续点歌**：月内把「有点歌的日期」排成序列，同观众在连续请求日都点过 = 一段 streak
   （长度 ≥2）；**纯主播日透明**（当天无任何点歌则不中断）；不跨月；🔥 数 = 场次 − 1（至少 1）
4. **观众等级**：1–5 级阈值 11/31/61/100；**月度冠军**：月榜第一名数量，并列全冠 👑
5. **榜单排序**：count 降序、名字并列 tiebreak（stats 站用拼音，本站无新增依赖用名字序）
6. **首页立绘随机轮换**：候选清单唯一维护点是 `builder.py` 的 `HERO_ART`（放图到
   `scripts/sitegen/assets/` + 清单加文件名，构建时自动拷贝并注入 `window.SUI.heroArt`）；
   前端 `view-home.js` 用 sessionStorage 保证同会话不与上一张重复；`.hero-figure img`
   固定 `aspect-ratio: 1080/2338` + `object-fit: contain`，换不同比例的图也不会跳动；
   图片全部失效时隐藏图片并保留光环/铭文。清单第一项即加载失败兜底图，建议放全身立绘
7. **岁己符号系统（v3.6）**：全站的岁己元素**不要在视图里零散写样式**，统一走
   `scripts/sitegen/assets/css/sui.css`（唯一维护点，改一处全站生效）：
   - 行内符号：`.sui-halo`（光环，角色签名）/ `.sui-star`（四芒星）/ `.sui-bird`
     （银喉长尾山雀＝种族本体，遮罩剪影、颜色随 `color` 走）/ `.sui-cookie`（饼干＝粉丝名）/
     `.sui-sakura`（樱花）/ `.sui-chili`（辣椒＝三餐无辣不欢）；尺寸按 `em`，跟随字号缩放
   - 承载件：`.sui-watermark`（页面水印）/ `.sui-note`（区块注脚）/ `.sui-perch`（栖枝）/
     `.sui-facts`（角色署名条，纸底用 `--paper` 变体）/ `.sui-spark`（星屑）/
     `.empty::before` 与 `.list-empty::before`（空状态小鸟，**一处规则覆盖全站空态**）
   - **水印由路由层注入**：`core.js` 的 `decoratePage()` 在 `renderCurrent()` 里往 `.view`
     插首个节点，因此**新增视图自动获得水印**，视图自己不用管；每页差异只由
     `.sui-watermark[data-page="路由名"]` 变体（尺寸/位移/倾角）决定
   - **两处硬约束（都踩过，别再破）**：① 基础规则 `right` 必须 ≥ 0，负值会让绝对定位元素
     撑出 `.view`（`.view` 已建层叠上下文 + `z-index:0`，水印 `z-index:-1` 稳沉内容下）
     在窄屏产生横向滚动条 —— 这也是「忘记登记新页面」时的兜底；② `<=640` 断点必须给
     `.sui-watermark[data-page]` 加 `transform:none`，因为 `106×49` 转 3° 后包围盒宽
     108.4px，会比 `right:0` 的锚点多出 1~2px 撑宽文档（实测 frequent/artists/insights/about
     各 +1~2px，v3.6 已修）。**改水印尺寸或角度后必须复跑横向溢出检查**
   - 素材：`assets/sui-bird.png`（遮罩剪影源，同时供空状态与栖枝）、
     `assets/sui-portrait.webp`（关于页角色档案照，480×720 含 alpha，由立绘裁切）。
     新增素材要同时加进 `builder.py` 的拷贝清单
   - 关于页「角色档案」的设定全部可溯源（种族/出道 2022.09.04/生日 2.05/粉丝名 饼干岁/
     代表色 #87EAFF·#DA5D77），**改文案前先核对公开资料，不要凭印象写**
8. **层级梯子：顶栏永远可点（v3.7.1，踩过的坑）**：`.site-head` 的 `z-index` 必须高于所有
   **页面级浮层**（弹层遮罩 900 / 彩蛋 905 / 侧栏 880 + 遮罩 870 / 播放器 800），现值 **910**；
   完整梯子写在 `layout.css` 顶部 `.site-head` 的注释里，**动任何一层的 z-index 都要回去对一遍**。
   理由：遮罩铺在顶栏之上时，点在导航上的事件会被遮罩接走 —— 弹层只是被关掉、页面并不跳转，
   用户看到的就是「点了没反应」（实测：点歌页打开观众弹层后，8 个标签**全部**失效）。
   配套四条不可拆：
   - 弹层本体要因此让位：`.modal` 的 `max-height` 含 `calc(100vh - 2 * var(--head-h) - 1rem)`，
     保证居中后上缘不躲到顶栏下面（否则 ✕ 被顶栏盖住点不到）
   - 播放器拖拽下界用 `headHeight() + 8`，不能用 8 —— 否则能把播放器拖到顶栏带上压住导航
   - 视图自己的全屏浮层（如点歌页彩蛋）不属于弹层体系，`closeAllModals()` 收不到，
     必须在 `C.onRoute()` 钩子里清掉，否则换页后它盖在新页面上，同样表现为「点标签没反应」
   - `--head-h`（顶栏实测高度）由 `components.js` 的 `syncHeadHeight()` 在加载 / resize /
     字体就绪时写回；语言页锚点条 `.lang-anchor` 与弹层都引用它，**不要再写死 3.6rem 这类常数**
9. **窄屏导航必须够得到**：`.site-nav` 是横向滚动条（`overflow-x:auto`），`<=640` 已把
   `scrollbar-width` 放成 `thin` 并把 `::-webkit-scrollbar` 从 `display:none` 改回来 ——
   否则鼠标用户既看不出可滚、也滚不动，溢出到视野外的标签等于「点了没反应」
   （实测修改前 480px 起、360px 时 8 个标签有 4 个完全够不到）。**不要在窄屏把滚动条藏回去**

10. **「点歌之王」只认总榜（v3.7.2）**：点歌速览带里的「点歌之王」卡片展示**总榜前三名**，
   数据直接取 `R.boards.total.slice(0,3)`（即站点「总榜」那套：次数降序 → 名字 tiebreak），
   **不要再写第二套取法**（后端 `king` 字段是 `most_common(1)`，只够第一名，留作兜底与
   「谁是点歌大王」彩蛋用）。每行 = 名次徽标 + 昵称 + 累计次数，第一名金色名次 + 👑；
   名次徽标定宽（`.rb-rk`）才能三行左对齐。成就殿堂里的「点歌之王」是另一回事（只授第一名）

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
2. **Git push**：本机 credential manager 没存凭据（`credential.helper=manager` 会挂起），
   但 GitHub CLI 已登录（account `Tsingyun`，token scopes 含 `repo`/`workflow`，存于 keyring），
   直接拿它当 helper 即可，**不需要明文 token**：
   `git -c credential.helper= -c credential.helper='!"C:/Program Files/GitHub CLI/gh.exe" auth git-credential' push origin main`
   （前一个 `-c credential.helper=` 是清空继承来的 helper，否则 manager 先被调用会挂起；
   首次可把 `push` 换成 `push --dry-run` 验证连通）
   按用户约定：**代码改动默认直接 commit + push，不必再问**（遗留的「不要自行 push」已作废）
3. **bat 文件必须纯 ASCII**；bash 工具在本机不可用（cmd shell）
4. **本地预览**：`python -m http.server 8899` 后访问 `http://127.0.0.1:8899/docs/`；
   代理环境下 localhost 可能被拦截，注意端口冲突
5. **单文件产物**：不要手改 `docs/index.html`；改 `scripts/sitegen/assets/` 后重建
6. **hash 路由**：`#/songs?q=&lang=&tag=&quick=&sort=&page=`、`#/song/<encodeURIComponent(歌名)>`、
   `#/insights?tab=`、`#/requests?kind=&m=`；旧锚点 `#lang-日语` 自动兼容到语言视图
7. **grid 溢出**：单列自适应布局一律写 `minmax(0, 1fr)` 而不是 `1fr`
   （`1fr` 的 min=auto 会被 nowrap 内容撑破，已在移动端踩过）。
   **检测方法（别靠眼力，靠断言）**：往 grid item 里注入一段 `white-space:nowrap` 的长文本，
   断言 `grid-template-columns` 注入前后**逐字相同** —— 相同＝轨道不会被撑开。
   2026-09-19 用此法才发现 `.home-grid`/`.figures`/`.site-foot-inner` 三处漏网（见 §4 规则 11）

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
2. 统计数字：1,170 / 3,399 / 241 / 434 / 495（与 songs 数组重算值一致）
3. 录播匹配 905 首；逐日日期表 1,156 首
4. 点歌：865 条 / 87 人 / 511 首；各榜单占比总和 = 100；🔥 = 场次 − 1
5. 搜索/筛选/排序/分页正常；歌曲详情、播放器、盲盒、我要补充、导出可用
6. 移动端（≤640px）无横向溢出；控制台无错误
7. 首页立绘轮换：连刷数次应出现 ≥2 张候选且无连续重复；`.hero-figure img` 盒子尺寸
   每次相同（桌面 274×593、移动 230×498）；断网/图 404 时退回清单第一张、全失效则隐藏
8. 左上角品牌位：`a.brand` 的 href = `BILI_SPACE_URL`、`target=_blank`、
   `rel=noopener noreferrer`，点击弹出新标签页；桌面与移动端均可见可点且不溢出
9. 首页盲盒 + 点歌页速览滚动带：旧速览 DOM 无残留；池子在滚，且盲盒模块高与页面总高极差 = 0；
   从首页入口能抽出一首（歌名 + 原唱/语言/次数 + 后续动作）；速览横滚在动、轨道尺寸 = 两份
   内容尺寸、卡片张数符合当月数据（本月无连续点歌时只有 3 组，不是 bug）；
   悬停暂停 / 移开恢复 / reduced-motion 停止；360–640 全路由零溢出、无控制台报错
   （脚本 `.zcode/workspace/default/_verify_marquee.py`，24 项）
10. 岁己符号系统：8 路由水印 `data-page` 正确、9 视口 × 8 路由水印不压文字、
   页脚署名条齐全、关于页角色档案（照片 480×720 + 设定字段 + 代表色色块）、
   空状态小鸟遮罩、各页注脚数、栖枝加载、窄屏单列无报错
   （脚本 `.zcode/workspace/default/_verify_motifs.py`，42 项）
11. 横向溢出回归：`<=640` 全路由零溢出；水印兜底（未知 page 名）零溢出
   （脚本 `.zcode/workspace/default/_verify_overflow.py`，6 项）
12. 导航（标签）点击可用性：16 视口 × 8 路由，每个标签在**肉眼可见中心**必须命中自身；
   导航溢出时必须 ①可横向滚动 ②滚动条不是隐藏的 ③滚动后能点到；**弹层打开 / 彩蛋遮罩 /
   播放器拖到最顶时点导航都必须真的跳转**（而不是只把浮层关掉）、跳转后浮层被清掉、
   `body` 滚动锁解除；低视口（含 740×380 横屏）下弹层 ✕ 不被顶栏盖住且不超出视口；
   语言页锚点条紧贴顶栏下沿（`--head-h` 实测同步生效）；连点一圈 / 开关弹层 / 搜索后仍可点
   （脚本 `.zcode/workspace/default/_verify_nav.py`，22 项）
13. 点歌速览「点歌之王」卡片 = 总榜前三：卡片内恰好 3 行、名次 `01/02/03`、每行都有昵称 +
   次数 + 「次」、只有第一名戴 👑；数据三路互证（卡片 == 从 `raw` 独立重算的总榜前三 ==
   页内切「总榜」后榜单前三行，第一名 == `king` 字段）；**三行昵称左边缘必须相等**
   （定宽槽位生效的证据）、名次 < 昵称 < 次数的横向次序、卡片不高于同带最高卡、
   390px 仍是 3 行、强制宽字回退字体下仍不溢出且左对齐；速览带仍在自然滚动
   （脚本 `.zcode/workspace/default/_verify_king3.py`，22 项）

14. **grid 轨道抗撑开（放大实验，v3.7.3）**：这类缺陷复现率极低（数十轮才偶发一次），
   **不能用「多跑几次没复现」当结论**。改用**等价放大实验**：往 grid item 注入
   `white-space:nowrap` 的长文本，断言 `grid-template-columns` 注入前后**逐字相同**
   ——相同＝轨道不会被内容顶开。覆盖 3 视口（360/480/640）× 3 路由
   （`#/`、`#/requests`、`#/songs`）× 8 个 grid 容器（脚本
   `.zcode/workspace/default/_amp_grid.py`）。加固前 `.home-grid` 列宽 331→1120px、
   `.figures` 165→1145px、`.site-foot-inner` 320→1120px；加固后三者全部逐字相同
