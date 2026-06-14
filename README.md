# 岁己SUI 歌单档案

一个为虚拟主播 **岁己SUI** 打造的 Vaporwave 风格歌单网站，收录 1217 首歌曲的完整演唱记录，支持在线播放 B站录播片段。

## 在线预览

**[>>> 打开歌单网站 <<<](https://tsingyun.github.io/sui-song-list/)**

## 功能特性

- **Excel 歌单** — 整合网站与本地 Excel 数据，1217 首歌曲、多维度统计
- **常唱/语言/原唱** — 按演唱频率、语言分类、原唱歌手三个视角浏览歌单
- **搜索与排序** — 支持歌名/原唱搜索，按次数、名称、日期等多维排序
- **盲盒抽歌** — 赛博老虎机动画，随机抽取一首歌，带稀有度分级（常唱/偶尔/稀有）
- **在线播放** — 点击播放按钮直接嵌入 B站播放器，多版本歌曲支持切换不同录播片段
- **Vaporwave 视觉** — Orbitron + Share Tech Mono 字体、霓虹光效、CRT 扫描线、透视网格

## 项目结构

```
sui-song-list/
├── README.md
├── LICENSE
├── .gitignore
├── requirements.txt
├── scripts/                        构建流程脚本
│   ├── fetch_bilibili.py              从B站合集抓取视频数据
│   ├── match_songs.py                 歌曲名与B站视频标题匹配
│   ├── rebuild_final.py               数据修正（语言分类/原唱归属）
│   └── build_site.py                  生成最终单文件 HTML 网站
├── data/                           数据文件
│   ├── sui_song_list_complete.json   原始歌曲数据（来自 suijisui.space）
│   ├── song_data.json                 歌曲数据库（1217首，含修正）
│   └── song_bilibili_map.json         歌曲-视频匹配结果（941首）
└── docs/                           GitHub Pages 部署
    └── index.html                     最终网站（单文件，~534KB）
```

## 构建流程

### 环境要求

Python 3.8+。`build_site.py` 和 `match_songs.py` 仅使用标准库，无需额外依赖。

可选依赖（部分脚本需要）：
- `requests` — `fetch_bilibili.py` 抓取 B站数据
- `openpyxl` — `rebuild_final.py` 生成 Excel 文件

### 步骤

```bash
# 1. 从B站合集抓取视频数据（需处理API限流，支持断点续传）
python -X utf8 scripts/fetch_bilibili.py

# 2. 将歌曲与B站视频匹配（标题归一化 + 多策略匹配，匹配率约77%）
python -X utf8 scripts/match_songs.py

# 3. 应用数据修正（语言分类、原唱归属等手动校正）
python -X utf8 scripts/rebuild_final.py

# 4. 生成最终网站
python -X utf8 scripts/build_site.py
```

> **注意：** Windows 系统需加 `-X utf8` 参数以确保 Unicode 正确处理。

## 数据来源

- 歌曲基础数据来自 [suijisui.space](https://www.suijisui.space)（[GitHub: PQL87/sui-song-list](https://github.com/PQL87/sui-song-list)）
- B站录播视频来自岁己SUI的B站投稿合集（mid: 37441530, 9669499）
- 歌曲-视频匹配基于标题归一化后的多策略匹配（精确匹配、译名匹配、基础名匹配、包含匹配）

## 技术细节

- **单文件架构** — 所有 CSS、JS、数据均内嵌在一个 HTML 文件中，无外部依赖
- **Bilibili iframe 播放** — 使用 `player.bilibili.com` 嵌入播放器，支持高清画质
- **歌曲匹配算法** — NFKC Unicode 归一化、去除括号/标点/日期前缀后缀、70%长度比包含匹配
- **盲盒动画** — CSS transition 驱动的滚轮动画，带彩纸和光效爆发
- **Vaporwave 设计** — Orbitron 标题字体、霓虹渐变、CRT 扫描线叠加、透视网格背景

## 致谢

- [岁己SUI](https://space.bilibili.com/37441530) — B站虚拟主播，感谢带来这么多精彩的歌曲演唱
- [PQL87/sui-song-list](https://github.com/PQL87/sui-song-list) — 提供歌曲基础数据

## License

[MIT License](LICENSE)
