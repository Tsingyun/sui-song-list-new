/* ═══════ 视图：关于 / 更新日志 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore;
  var esc = C.esc;

  var CHANGELOG = [
    ['v3.6', '岁己符号系统上线：把「岁己」拆成一套可复用的图形符号（光环+四芒星 / 银喉长尾山雀 / 饼干 / 樱花 / 辣椒），统一收在 css/sui.css 一处维护，再按语义铺满全站 —— 每个页面标题区的大光环水印（逐页尺寸与倾角微差，由路由层统一注入，新增页面自动获得）、每个数据区块尾部的岁己注脚、所有空状态与清单空行的小鸟、返回顶部按钮上的栖枝小鸟（悬停振翅）、页脚新增角色署名条'],
    ['v3.6', '关于页新增「角色档案」：藏青档案照（半身立绘衬藏青渐变，金线细框）+ 官方设定表（种族 银喉长尾山雀 / 出道 2022.09.04 / 生日 2.05 / 粉丝名 饼干岁 / 口味 / 代表色 #87EAFF·#DA5D77 / 形象设计）与应援口号'],
    ['v3.5.1', '首页「点歌速览」行高稳定化：多个人名换行时不再把卡片撑高——轮播所有页共享同一锁定高度（取各页最大高度，字体就绪与窗口尺寸变化后自动重测），切换页面时页面总高全程恒定；同时单个「名字 + 附注」不再被拦腰拆行，人名保持完整可读'],
    ['v3.5', '左上角品牌位（小鸟 Logo + 「岁己SUI 歌单档案」）整块可点击，新标签页直达岁己的 B站个人空间（带 noopener noreferrer，悬停有轻微反馈）'],
    ['v3.5', '首页立绘随机轮换：每次打开或刷新从候选立绘清单（全身 / 短发 / Q 版）随机抽一张，同一会话内不与上一张重复；占位盒固定比例，切换不跳动，加载淡入，图片失效时自动退回默认立绘并保留光环与铭文'],
    ['v3.4', '点歌统计完整并入：原独立统计站的全部内容（最近 15 天 / 月·季·年·总榜 / 热门歌曲与常被一起点 / 观众喜好与新朋旧友 / 跨月冠军 / 成就殿堂 / 时间区间筛选 / 观众与歌曲详情 / CSV·JSON·Excel·PNG 导出 / 搜索彩蛋）迁入本站「点歌统计」页，并使用本站视觉体系重写；全站已不再指向外部统计站'],
    ['v3.4', '恢复自定义小鸟鼠标光标（仅在鼠标设备上启用，热区对齐翅膀，不影响触屏与性能）'],
    ['v3.3', '岁己视觉识别升级：首页主视觉换为 2023 形象双马尾全身立绘（透明背景人物立于舞台线，光环浮动，身后大光环水印，竖排金印铭文），歌曲详情页短发立绘从右上探出（印章叠盖），页脚小鸟吉祥物入驻，洞察图表配色统一至岁己身份色（瞳色绯红 / 贝雷藏青）'],
    ['v3.2', '岁己视觉识别系统：配色提取自立绘（瞳色绯红 / 贝雷藏青 / 光环金 / 发丝冰蓝 / 樱花粉），光环符号融入版式，藏青页脚与场刊照片式首页主视觉，歌曲详情页岁己印鉴，点歌之王 Q 版立绘；首页点歌速览改为 3 秒轮播（点歌之王 / 最近点歌 / 常点歌曲 / 本月连续，悬停暂停、圆点可切换）'],
    ['v3.1', '站点 LOGO 与顶栏品牌位更换为岁己的小鸟']
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
      '<h2 class="sec-title">关于本站 <span class="sec-sub">SUI SONG ARCHIVE v3.6</span></h2></div>' +

      /* ── 角色档案：本站唯一的「岁己本人出场」板块，设定均取自官方资料 ── */
      '<section class="sui-profile">' +
      '<div class="sui-profile-grid">' +
      '<figure class="sui-profile-photo">' +
      '<img src="assets/sui-portrait.webp" alt="岁己SUI 半身立绘" width="480" height="720" loading="lazy" decoding="async">' +
      '<figcaption>SUI · VirtuaReal 第十七期生</figcaption>' +
      '</figure>' +
      '<div class="sui-profile-body">' +
      '<div class="sec-kicker">CHARACTER FILE</div>' +
      '<p class="sui-profile-intro">原本是一只想要早起叫醒人类的小鸟，' +
      '结果因为自己也起不来，索性变成了人类。</p>' +
      '<dl class="sui-profile-table">' +
      '<div><dt>种族</dt><dd><i class="sui-bird" aria-hidden="true"></i>银喉长尾山雀</dd></div>' +
      '<div><dt>出道</dt><dd>2022 年 9 月 4 日</dd></div>' +
      '<div><dt>生日</dt><dd>2 月 5 日 · 水瓶座</dd></div>' +
      '<div><dt>粉丝名</dt><dd><i class="sui-cookie" aria-hidden="true"></i>饼干岁</dd></div>' +
      '<div><dt>偏好</dt><dd><i class="sui-chili" aria-hidden="true"></i>超辣火锅与辣椒，三餐无辣不欢</dd></div>' +
      '<div><dt>代表色</dt><dd class="sui-profile-colors">' +
      '<span class="sui-swatch" style="background:#87EAFF"></span><span class="mono">#87EAFF</span>' +
      '<span class="sui-swatch" style="background:#DA5D77"></span><span class="mono">#DA5D77</span></dd></div>' +
      '<div><dt>形象设计</dt><dd>Yukizawa 雪泽</dd></div>' +
      '</dl>' +
      '<p class="sui-profile-quote">「可以邀请你跟我一起飞行吗？人类不会飞的话，我悄悄载你！」</p>' +
      '<p class="sui-profile-from">以上设定摘自岁己公开资料；本页其余内容均为本站对演唱数据的整理。</p>' +
      '</div></div></section>' +

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
      '<li>点歌数据：直播间点歌记录（原 sui-song-stats 项目，2026-09 已完整并入本站「点歌统计」）</li>' +
      '<li>角色设定（仅「角色档案」板块）：岁己SUI 应援站与公开资料</li>' +
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
      '<a href="#/requests">点歌统计<span class="mono">REQUESTS</span></a>' +
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
