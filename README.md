# 岁己SUI 歌单档案

> **SUI_SONG_DATABASE V2.0** — 为虚拟主播 [岁己SUI](https://space.bilibili.com/37441530) 打造的 Vaporwave 风格歌单网站

收录 **1,217** 首歌曲、**3,319** 次演唱记录，支持在线播放 B站录播片段。

**[>>> 在线预览 <<<](https://tsingyun.github.io/sui-song-list-new/)**

> Fork 自 [PQL87/sui-song-list](https://github.com/PQL87/sui-song-list) 的数据，重新设计并构建。

---

## Features

```
# sui-song-list-new

架构:
+ 单文件 HTML 架构
  - 所有 CSS / JS / 数据内嵌，零外部依赖
  - 可直接用浏览器打开，也可通过 GitHub Pages 部署
  - 文件体积约 534 KB（含 1217 首歌曲完整数据）

数据:
+ 多源数据整合
  - 基础歌单数据来自 suijisui.space（PQL87/sui-song-list）
  - B站视频数据来自 3 个投稿合集（2146 个视频）
  - 手动校正语言分类和原唱归属

歌单显示:
+ 四视角浏览
  - 全部歌曲 — 完整歌单，支持搜索 / 排序 / 筛选
  - 常唱金曲 — 按演唱频率分组（5+ 次 / 2–4 次 / 仅 1 次）
  - 语言分类 — 中文 / 日语 / 英文 / 韩语 分组浏览
  - 原唱分类 — 按原唱歌手聚合，显示代表作和演唱次数

+ 搜索与排序
  - 歌名 / 原唱模糊搜索（实时过滤）
  - 多维排序：演唱次数 / 歌曲名称 / 首次日期 / 最近日期
  - 快捷筛选：常唱 (5+) / 偶尔 (2–4) / 仅唱一次 / 很久没唱

+ 语言筛选
  - 中文 / 日语 / 英文 / 韩语 分类过滤

在线播放:
+ Bilibili iframe 播放器
  - 点击播放按钮直接嵌入 B站高清播放器
  - 多版本歌曲支持切换不同录播片段（下拉选择器）
  - 固定底部播放面板，可展开/收起
  - 支持跳转 B站原视频链接

盲盒抽歌:
+ 赛博老虎机动画
  - 40 首歌曲滚动抽奖 + 光效爆发 + 彩纸
  - 稀有度分级：常唱 / 偶尔 / 稀有
  - 抽中后一键播放或跳转 B站搜索

视觉设计:
+ Vaporwave / Outrun 风格
  - Orbitron（标题）+ Share Tech Mono（数据）+ Noto Sans SC（中文）字体组合
  - 霓虹光效：品红 / 青色 / 橙色三色系统
  - CRT 扫描线叠加
  - 透视网格背景
  - 响应式网格布局
  - 常唱歌曲高亮边框（Top 10 星标）
```

---

## 数据统计

| 指标 | 数量 |
|------|------|
| 歌曲总数 | 1,217 |
| 演唱总次数 | 3,319 |
| 常唱 (5+次) | 230 首 |
| 偶尔 (2–4次) | 451 首 |
| 仅唱一次 | 536 首 |
| B站视频匹配 | 941 首 (77%) |
| 多版本歌曲 | 490 首 |
| 收录时间跨度 | 2022.09 — 2026.06 |

---

## 项目结构

```
sui-song-list-new/
├── README.md
├── LICENSE
├── .gitignore
├── requirements.txt
├── scripts/                        构建流程脚本
│   ├── fetch_bilibili.py              Phase 1: B站合集视频数据抓取
│   │                                  - 3个合集，支持断点续传
│   │                                  - 自动处理 -352 限流（60s冷却）
│   │                                  - 增量保存 fetch_progress.json
│   │
│   ├── match_songs.py                 Phase 2: 歌曲-视频标题匹配
│   │                                  - NFKC Unicode 归一化
│   │                                  - 多策略匹配（精确/译名/基础名/包含）
│   │                                  - 70% 长度比阈值防止误匹配
│   │                                  - 合并已有 BVID 数据
│   │
│   ├── rebuild_final.py               Phase 3: 数据修正
│   │                                  - 语言分类手动校正
│   │                                  - 原唱归属修正（网易云API查询）
│   │                                  - 生成 Excel 歌单（可选）
│   │
│   └── build_site.py                  Phase 4: 生成最终网站
│                                      - 合并 song_data + bilibili_map
│                                      - 内嵌所有 CSS/JS/数据到单 HTML
│                                      - 输出到 docs/index.html
│
├── data/                           数据文件
│   ├── sui_song_list_complete.json    原始数据（来自 suijisui.space）
│   ├── song_data.json                 歌曲数据库（1217首，含修正）
│   └── song_bilibili_map.json         歌曲-视频匹配（941首/2662片段）
│
└── docs/                           GitHub Pages 部署
    └── index.html                     最终网站（单文件，~534KB）
```

---

## 构建流程

### 环境要求

Python 3.8+。核心脚本 (`build_site.py`, `match_songs.py`) 仅使用标准库，无需额外依赖。

可选依赖：
- `requests` — `fetch_bilibili.py` 需要（B站 API 请求）
- `openpyxl` — `rebuild_final.py` 需要（生成 Excel 文件）

### 快速开始

```bash
# 直接生成网站（使用已有数据文件）
python -X utf8 scripts/build_site.py

# 输出: docs/index.html
```

### 完整流水线

```bash
# Phase 1: 从B站合集抓取视频数据
# 需处理 API 限流（-352 错误），支持断点续传
# 预计运行时间：约 1 小时（2146 个视频，3 个合集）
python -X utf8 scripts/fetch_bilibili.py

# Phase 2: 歌曲与B站视频匹配
# 标题归一化 + 多策略匹配，匹配率约 77%
python -X utf8 scripts/match_songs.py

# Phase 3: 数据修正（语言分类/原唱归属等手动校正）
# 生成 song_data.json 和可选的 Excel 文件
python -X utf8 scripts/rebuild_final.py

# Phase 4: 生成最终网站
python -X utf8 scripts/build_site.py
```

> **注意：** Windows 系统需加 `-X utf8` 参数以确保 Unicode 正确处理。

---

## 技术细节

### 歌曲匹配算法

歌曲名与 B站视频标题的匹配是整个项目的核心挑战。视频标题格式多样：

```
【岁己SUI】流沙 2023.3.25直播歌切
入秋的第一场雨真让人矫情【20230518歌切】
君の知らない物語（纯享）
```

匹配流程：

1. **标题提取** — 去除 `【...】` 前缀/后缀、日期+歌切模式、纯享/live标记
2. **NFKC 归一化** — 全角→半角、Unicode 标准化
3. **多策略匹配**（按优先级）：
   - 精确匹配（归一化后完全一致）
   - 基础名匹配（去除括号注释后匹配）
   - 译名匹配（如日语歌的中文翻译名）
   - 包含匹配（需 ≥70% 长度比，防止短名误匹配）
   - BVID 直连（源数据已有的 BV号直接使用）

### Bilibili API 限流处理

B站 API 存在 `-352` 限流机制：

- 页间延迟：3 秒
- 合集间延迟：30 秒
- 触发限流后：60 秒冷却 + 3 次重试
- 支持断点续传：通过 `fetch_progress.json` 记录每个合集的进度

### 单文件架构

整个网站是一个 ~534KB 的 HTML 文件，包含：
- 所有 CSS 样式（约 15KB）
- 所有 JavaScript 逻辑（约 20KB）
- 1217 首歌曲的完整数据（JSON 内嵌）
- 941 首歌曲的 B站视频匹配数据

零外部依赖，可直接用浏览器打开。

---

## 后续计划

- [ ] 添加网站截图到 README
- [ ] 移动端适配优化
- [ ] 网易云音乐链接（部分歌曲）
- [ ] 歌曲分类标签（流行/摇滚/动画 等）
- [ ] 数据自动更新脚本（定期抓取最新歌切）
- [ ] 暗色/亮色主题切换
- [ ] 歌单导出功能（CSV / JSON）

---

## 数据来源

- 歌曲基础数据：[suijisui.space](https://www.suijisui.space)（[GitHub: PQL87/sui-song-list](https://github.com/PQL87/sui-song-list)）
- B站录播视频：[岁己SUI](https://space.bilibili.com/37441530) 的 B站投稿合集
  - 歌切合集（2024.6至今）— mid: 37441530, season_id: 3194603
  - 歌切合集（2022.12-2024.6）— mid: 37441530, season_id: 1004362
  - 歌切（用户9669499）— mid: 9669499, season_id: 6453496

---

## 相关项目

- [PQL87/sui-song-list](https://github.com/PQL87/sui-song-list) — 本项目的基础数据来源
- [雨纪Ameki的歌单](https://www.ameki.online/) — PQL87 项目的 Fork 来源
- [vup-song-list](https://github.com/Akegarasu/vup-song-list) — vup/vtb 歌单网站通用框架

---

## 致谢

- [岁己SUI](https://space.bilibili.com/37441530) — B站虚拟主播，小岁小岁我们喜欢你
- [PQL87/sui-song-list](https://github.com/PQL87/sui-song-list) 及其[贡献者们](https://github.com/PQL87/sui-song-list#project-contributors) — 提供歌曲基础数据

---

## License

[MIT License](LICENSE)

> 本项目源码遵循 MIT 开源协议。本项目内非源码资源（数据等）不可商用，如需商业用途请联系原作者获取许可。
