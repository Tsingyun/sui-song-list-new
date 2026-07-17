# 项目交接文档 · sui-song-list-new（UI 重设计任务）

> 本文档供将本项目移交给**外部 AI / 设计师**继续开发时使用。
> 阅读对象：具备前端能力的 AI 助手。请用中文或英文阅读均可。

---

## 0. 仓库与线上地址

- **GitHub 仓库**：https://github.com/Tsingyun/sui-song-list-new
- **线上站点（GitHub Pages）**：https://tsingyun.github.io/sui-song-list-new/
- **操作方式**：请 `git clone` 仓库到本地，**不要只截图线上页面**——因为站点是脚本生成的（见第 3 节），手动改 HTML 会被覆盖。

---

## 1. 项目一句话

B站虚拟主播「岁己SUI」的**歌单档案网站**：Vaporwave 美学、单文件 HTML，收录
**1157 首歌曲 / 3325 次演唱 / 921 个 B站歌切匹配**，时间跨度 **2022.09 – 2026.07**。

---

## 2. 你的任务

**重新设计网页 UI / 视觉风格。** 功能与数据逻辑保持不变，只改外观、布局与交互体验。
（这是一次视觉升级，不是功能重写。）

---

## 3. 关键工程约束（务必遵守，否则改动会被覆盖或破坏）

1. **【最重要】不要直接改 `docs/index.html`。**
   站点**不是手写 HTML**，而是由 `scripts/build_site.py` 从 `data/song_data.json`
   生成 `docs/index.html`。你必须改 **`build_site.py` 里的模板 / CSS / JS 片段**，
   然后运行构建脚本重新生成。手动改 `docs/index.html` 会在下次构建时被整体覆盖。
2. 所有 Python 命令必须带 `-X utf8` 参数（Windows 编码问题，否则中文乱码）：
   `python -X utf8 scripts/build_site.py`
3. 不要手改 `data/song_data.json` 里的 `stats` / `lang_counts` / `tier` 字段——
   它们是冗余字段，由 `build_site.py` 在构建时自动计算。
4. 改完数据或模板后，必须运行上面的构建命令重建 `docs/index.html`。
5. **凭证安全**：GitHub 的 push 凭证由用户在本地环境保管。
   你只需产出代码改动并给出建议的 commit message，**不要自己写 token，不要尝试自行 push**。

---

## 4. 必须保留的功能（UI 重做时一个都不能丢）

重设计时要保证以下交互完整可用：

- 歌曲**搜索**（按歌名 / 译名 / 原唱）
- **筛选**（按语言、演唱次数区间等）
- **歌切播放**：点击歌曲可跳转 / 嵌入 B站录播片段（数据来自 `data/song_bilibili_map.json`）
- **热度图**（按时间 / 次数的演唱分布可视化）
- **盲盒**（随机抽一首）
- **投稿入口**（用户提交想点的歌）
- **导出**（数据导出）
- **外链**（相关外部链接）
- **页脚时间范围**：`2022.09 – 2026.07`（如改版动到页脚请保持这个跨度）

---

## 5. 设计雷区（来自前两次失败尝试，请务必吸取教训）

本项目主理人对"生硬套用流行模板"非常不满意：

- ❌ 曾尝试「反设计 / Anti-Design」风格 → **被否决**
- ❌ 曾尝试克隆 uiprompt.site 的「Visual Neon」赛博终端风格 → **被否决**

**教训**：不要为了炫技而套用流行美学。主理人想要的是**真正贴合内容气质**的设计——
「歌单档案 + Vaporwave + B站虚拟主播」三者结合的独特感，而非通用模板。

**当前稳定版是 Vaporwave**（紫 / 粉 / 青渐变、复古网格、轻微故障感 glitch），
它作为项目的"基因参考"可以保留，但**鼓励在视觉上做出真正创新**，而不是回到旧版。

---

## 6. 协作流程（请严格遵守）

1. `clone` 仓库 → 通读仓库内的 `AGENTS.md`（完整工程手册）→ 读懂 `build_site.py` 的模板结构
2. 在本地产出设计方案（可先给 mockup / 截图 / 局部 demo）
3. **先给主理人看，经确认后再合并或 push**——不要擅自推到 `main` 分支
4. 任何大改动保持"本地预览 → 主理人确认 → 再发布"的节奏

---

## 7. 当前数据规模（供设计参考体量）

| 指标 | 数值 |
|---|---|
| 歌曲总数 | 1,157 |
| 演唱总次数 | 3,325 |
| 常唱 (5+次) | 238 首 |
| 偶尔 (2–4次) | 432 首 |
| 仅唱一次 | 487 首 |
| B站歌切匹配 | 921（约 80%） |
| 收录时间跨度 | 2022.09 – 2026.07 |
| 单文件体积 | ~704 KB |

---

## 8. 目录速览

```
sui-song-list-new/
├── AGENTS.md                    ← 完整工程手册（必读）
├── README.md                    ← 项目介绍
├── data/
│   ├── song_data.json           ← 核心数据库（1157 首）
│   └── song_bilibili_map.json   ← 歌曲-B站视频匹配（921 首）
├── scripts/
│   └── build_site.py            ← 生成器（改 UI 改这里）
└── docs/
    └── index.html               ← 最终网站（由脚本生成，勿手改）
```

---

## 9. 直接复制给新 AI 的开场白（作为第一条消息）

> 把下面这段直接复制粘贴给新 AI 即可，已自包含、不含任何凭证。

---

你好，接下来请你帮我重新设计一个网站的 UI。项目信息如下：

【项目】sui-song-list-new —— B站虚拟主播「岁己SUI」的歌单档案网站（Vaporwave 风格、单文件 HTML、部署在 GitHub Pages）。
【仓库】https://github.com/Tsingyun/sui-song-list-new
【线上站】https://tsingyun.github.io/sui-song-list-new/
请先 `git clone` 仓库（不要只看线上截图）。

【你的任务】重新设计网页的视觉与交互体验。功能与数据逻辑保持不变，只改外观。

【最重要工程约束】站点不是手写 HTML，而是由 `scripts/build_site.py` 从 `data/song_data.json` 生成 `docs/index.html`。你必须改 **build_site.py 里的模板/CSS/JS**，而不是直接改 docs/index.html——手动改会被下次构建整体覆盖。改完跑 `python -X utf8 scripts/build_site.py` 重建。

【不要碰的】`song_data.json` 里的 `stats` / `lang_counts` / `tier` 是冗余字段（构建时自动算），别手改。所有 Python 命令带 `-X utf8`。

【必须保留的功能】搜索（歌名/译名/原唱）、语言与次数筛选、B站歌切播放、热度图、盲盒、投稿入口、导出、外链、页脚时间范围（2022.09 – 2026.07）。

【设计雷区】我曾让上一个 AI 试过「反设计 Anti-Design」和克隆 uiprompt.site 的「Visual Neon」两种风格，都被我否决了。教训：不要生硬套流行模板，要做出真正贴合「歌单档案 + Vaporwave + B站虚拟主播」气质的设计。当前稳定版是 Vaporwave（紫/粉/青渐变、复古网格、轻微故障感），可作为基因参考但鼓励创新。

【协作流程】clone → 读仓库里的 `AGENTS.md` 和本 `HANDOFF.md` → 出设计方案（先给 mockup/截图给我看）→ 我确认后才合并/push。不要擅自 push 到 main，push 由我本地完成。

【当前规模】1157 首歌曲 / 3325 次演唱 / 921 歌切匹配 / 跨度 2022.09 – 2026.07 / 单文件约 704KB。
