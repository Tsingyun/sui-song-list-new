/* ═══════ 视图：关于 / 更新日志 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore;
  var esc = C.esc;

  var CHANGELOG = [
    ['v3.0', '全新重制：场刊档案式视觉系统、hash 路由（歌曲详情可分享）、原生集成点歌统计（占比 / 🔥 连续点歌）、手写 SVG 图表（移除 Chart.js 依赖）、响应式重做']
  ];

  var OLD_LOG = [
    ['2026-07-21', '修复更新日志展开后页面不自动滚动；移动端体验精修（防误触复制、搜索框 16px、安全区、横屏播放器、点按反馈等）'],
    ['2026-07-21', '移动端彻底重做：多断点（768/640/360）适配，歌单卡片式，控件全宽、图表与弹窗自适应'],
    ['2026-07-21', '播放器重构为可拖拽浮动小窗 + 放大/还原 + CRT 外框'],
    ['2026-07-07', '中文译名批量补全（280 首外语歌中 82 首新增公认中文译名）'],
    ['2026-06-23', '移动端 / 平板响应式优化'],
    ['2026-06-14', '角色插画背景层、自定义光标、favicon、语言锚点白屏修复、批量合并 30 对重复歌曲、艺术家与歌名审计'],
    ['基线', '四视角浏览 / 搜索高亮 / 多维排序筛选 / 流派标签 / 歌曲详情面板 / 数据洞察图表 / 歌单导出 / 盲盒抽歌 / 在线播放 / 日期悬浮提示 / 单击复制 / 我要补充 / 统计卡片筛选 / 点歌统计跳转']
  ];

  function render(params, container) {
    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">ABOUT</div>' +
      '<h2 class="sec-title">关于本站 <span class="sec-sub">SUI SONG ARCHIVE v3.0</span></h2></div>' +

      '<div class="about-cols"><div class="about-block">' +
      '<h3>这是什么</h3>' +
      '<p>为虚拟主播<a href="https://space.bilibili.com/1954091502" target="_blank" rel="noopener">岁己SUI</a>建立的完整歌单档案：' +
      '收录每一次演唱、每一首歌的演出历史与B站录播片段，并集成了 2024 年 6 月以来的点歌互动数据。' +
      '本站为 v3.0 全新重制版 —— 数据与功能继承自历代版本，页面结构、视觉系统与交互完全重新设计。</p>' +

      '<h3>数据来源</h3>' +
      '<ul>' +
      '<li>歌曲基础数据：<a href="https://www.suijisui.space" target="_blank" rel="noopener">suijisui.space</a>（GitHub: <a href="https://github.com/PQL87/sui-song-list" target="_blank" rel="noopener">PQL87/sui-song-list</a>）</li>' +
      '<li>演唱日期：suijisui.space + 本地统计表（2024-06 起以本地表为准）</li>' +
      '<li>录播片段：岁己SUI 的 B站投稿合集（标题归一化多策略匹配）</li>' +
      '<li>点歌数据：<a href="https://stats.suijisui.uk" target="_blank" rel="noopener">sui-song-stats</a> 项目（从原始点歌记录实时派生）</li>' +
      '</ul>' +

      '<h3>数据怎么更新</h3>' +
      '<p>在 GitHub 网页上编辑 <code class="mono">data/song_data.json</code> 并提交，Actions 会自动重建网站；' +
      '本地可用 <code class="mono">python -X utf8 scripts/add_songs.py --name 歌名 --date 日期</code> 快速加歌。' +
      '网站为纯静态单文件，构建零第三方依赖。</p>' +

      '<h3>统计口径</h3>' +
      '<ul>' +
      '<li>常唱 = 演唱 ≥5 次；偶尔 = 2–4 次；仅唱一次 = 1 次</li>' +
      '<li>点歌占比：完整榜单向下取整、末项补齐余数，总和严格 100%</li>' +
      '<li>🔥 连续点歌：月内同观众在连续的「有点歌日」均点歌；纯主播日透明不中断；数量 = 连续场次 − 1</li>' +
      '<li>观众等级：Lv.1–5（1/11/31/61/100 次为界）</li>' +
      '</ul>' +

      '<h3>更新日志（新站）</h3>' +
      '<ul class="chlog">' + CHANGELOG.map(function (e) {
        return '<li><span class="cl-date">' + esc(e[0]) + '</span><span class="cl-text">' + esc(e[1]) + '</span></li>';
      }).join('') + '</ul>' +

      '<h3>更新日志（历代界面）</h3>' +
      '<ul class="chlog">' + OLD_LOG.map(function (e) {
        return '<li><span class="cl-date">' + esc(e[0]) + '</span><span class="cl-text">' + esc(e[1]) + '</span></li>';
      }).join('') + '</ul>' +
      '</div>' +

      '<div class="about-block">' +
      '<h3>链接</h3>' +
      '<div class="link-list">' +
      '<a href="https://stats.suijisui.uk" target="_blank" rel="noopener">点歌统计完整版<span class="mono">STATS</span></a>' +
      '<a href="https://space.bilibili.com/1954091502" target="_blank" rel="noopener">岁己SUI 的 B站主页<span class="mono">BILIBILI</span></a>' +
      '<a href="https://github.com/Tsingyun/sui-song-list-new" target="_blank" rel="noopener">项目源码<span class="mono">GITHUB</span></a>' +
      '<a href="https://github.com/Tsingyun/sui-song-list-new/issues/new?labels=contribution,song-data" target="_blank" rel="noopener">提交歌曲补充<span class="mono">ISSUE</span></a>' +
      '</div>' +
      '<h3>协议</h3>' +
      '<p>MIT License。本项目（含全部源码、数据及资源）完全开源，可自由使用。</p>' +
      '<h3>致谢</h3>' +
      '<p>岁己SUI 以及所有记录、整理、补充数据的粉丝们 —— 小岁小岁我们喜欢你。</p>' +
      '</div></div>';
  }

  C.registerView('about', { title: '关于', render: render });
})();
