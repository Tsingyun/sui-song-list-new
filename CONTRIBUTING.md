# 共创指南 / Contributing Guide

感谢你帮助完善岁己SUI的歌单档案！无论是补充歌曲信息、修正错误，还是改进网站功能，都欢迎参与。

---

## 🎵 补充歌曲信息

### 方式一：网站表单（推荐）

在[歌单网站](https://tsingyun.github.io/sui-song-list-new/)右下角点击 **「📝 我要补充」**，填写歌名、原唱、日期后自动生成格式并复制到剪贴板，前往 GitHub Issue 粘贴提交。

### 方式二：GitHub Issue

使用 [补充歌曲 Issue 模板](https://github.com/Tsingyun/sui-song-list-new/issues/new?template=add-song.yml)，填写表单提交。

### 方式三：手动提交

在 Issue 中使用以下格式：

```json
{
  "name": "歌曲名",
  "artist": "原唱者",
  "date": "2026-06-14",
  "lang": "日语",
  "count": 1
}
```

---

## 📊 数据格式说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 歌曲名（以网易云音乐为准） | `One Last Kiss` |
| `artist` | 原唱歌手/组合 | `宇多田ヒカル` |
| `date` | 演唱日期（YYYY-MM-DD） | `2026-06-14` |
| `lang` | 语种：中文/日语/英文/韩语/其他 | `日语` |
| `count` | 演唱次数（通常为 1） | `1` |

### 注意事项

- **原唱判断**：请以网易云音乐的标注为准，不是翻唱者
- **语种判断**：日文歌手唱的歌即使歌名是英文，也应标为「日语」（如宇多田ヒカル的 `One Last Kiss`）
- **日期格式**：严格使用 `YYYY-MM-DD` 格式，如 `2026-06-14`
- **歌名准确**：请以网易云音乐、QQ音乐等正规平台上的歌名为准

---

## 🔧 开发贡献

### 环境准备

```bash
git clone https://github.com/Tsingyun/sui-song-list-new.git
cd sui-song-list-new
```

### 构建网站

```bash
# Windows
python -X utf8 scripts/build_site.py

# macOS / Linux
python3 scripts/build_site.py
```

输出文件：`docs/index.html`

### 项目结构

- `data/song_data.json` — 歌曲数据库
- `data/sui_song_list_complete.json` — 完整歌单（含日期）
- `scripts/build_site.py` — 网站生成脚本
- `docs/index.html` — 部署文件（GitHub Pages）

---

## 📮 提交规范

- Issue 标题使用清晰的描述，如「补充歌曲: One Last Kiss」
- PR 提交前请先在本地构建测试
- 数据修改需同时更新 `song_data.json` 和 `sui_song_list_complete.json`
- Commit 消息使用约定格式：`data:` / `fix:` / `feat:` / `docs:` 开头

---

感谢你的贡献！🎉
