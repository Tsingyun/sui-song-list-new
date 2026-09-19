/* ═══════ 视图：关于 / 更新日志 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore;
  var esc = C.esc;

  var CHANGELOG = [
    ['v3.7.10', '修复介绍词「结果」被拆到两行的问题：上一版的 balance 会在一行放得下时也强行拆成两行均衡，断点落在词语中间——现改为默认单行完整展示，窄屏需折行时启用 keep-all 只在标点后断行，任何词语都不会被拆开'],
    ['v3.7.9', '六处体验修复与打磨：点歌速览卡的皇冠改挂行尾，第二三名行首不再多出空位；修复搜索框在中文输入法下被截断的问题（组合输入期间不再整页重渲，选字上屏后才刷新结果）；修复观众/歌曲详情弹窗打开即滚到底部的问题，现在总是从内容顶部展示；歌曲详情页的头像印鉴从右上角（与装饰立绘重叠）移入信息行，成为「岁己SUI 演唱」署名徽标，与原唱并排、层级分明；页脚新增友情链接「岁己SUI应援站」（suiji.site）；标题与段落启用平衡断行，介绍词等短文本不再出现末行孤字'],
    ['v3.7.8', '主题策略调整：首次打开固定使用浅色主题，不再跟随系统 / 浏览器的深色偏好；手动切换与记忆不受影响，选择过深色的老访客依然保持深色'],
    ['v3.7.7', '全站新增浅色 / 深色主题切换：顶栏新增日月圆钮（独立于窄屏会整体隐藏的动作区，手机端常驻可点），点击即切换并写入 localStorage 永久记忆；未手动选择过的访客跟随系统偏好，且页面首帧前就写好主题属性，深色用户不会先闪一下白底。深色版面是同一套场刊版式的「深夜刊」——暖黑纸底、暖白墨字、绯红整体提亮保证对比度，藏青页脚 / 档案照 / 光环金等深色版面元素原样保留；散落各文件的硬编码颜色收拢为语义通道（随墨翻转的淡染、恒深阴影、恒深遮罩、随纸翻转的蒙层），打印时无论当前主题一律回到浅色纸面；画廊白底原画改挂恒浅卡纸衬底，multiply 印刷语言在深色墙上依然成立；洞察页 SVG 图表配色改为随主题翻转（次级曲线深色下改用发丝冰蓝）'],
    ['v3.7.6', '关于页新增「画廊」：四张岁己插画以装帧方式融入版面。三张白底原画不做键控抠图（主体银发与白底同色域，抠图必伤发丝与金环细线），预处理把近白噪声软钳为纯白后，用 multiply 混合模式把白底「印」进纸色页面——白底自然消失、翅尖以出血形式收在卡缘；夏日场景插画自带完整底色，沿用角色档案照的藏青装框语言。四张统一金线细框与图注，悬停轻抬升，响应式 4 → 2 → 1 列'],
    ['v3.7.5', '成就殿堂移除「一周年纪念」成就：原由点歌数据跨度 ≥ 365 天自动派生，与任何观众 / 解锁条件 / 奖励 / 独立成就计数均无关，现已删除其派生逻辑与随之产生的 start/end 死代码；成就殿堂改为仅含点歌之王 / 百首俱乐部 / 忠实观众三项。前端通用渲染与彩蛋（进入成就区视口撒彩纸）不受影响，成就本就是构建期从 raw 数据直接算出的列表，无需要清理的关联解锁 / 发放 / 进度逻辑'],
    ['v3.7.4', '点歌统计「月度点歌榜」的 👑 冠军标识改为只在「显著领先」时显示：原先凡与榜首同次数的观众全部戴冠，一个月里人人都是 1 次时 TOP 10 会整排顶着皇冠（2026-09 单月就有 12 个）。现在须三条同时成立 —— 唯一第一（并列则无人戴冠）、榜首 ≥ 2 次（只被点 1 次不算）、且显著领先（榜首 ≥ 2×次高 或 领先次高 ≥ 2 次）。于是「2 次 vs 其余各 1 次」是冠军，而「全员 1 次」「5 vs 4」「11 vs 11」都不是，该月一个皇冠都不显示；跨月冠军与「最近 15 天」沿用同一判定（前端不再自行重算），跨月冠军由 4 条收敛为 2 条，全站冠冕总数 48 → 11'],
    ['v3.7.3', '修复窄屏下极偶发的横向滚动条：首页「最近演出」「常唱金曲」、点歌页「点歌头部统计」等区块所在的网格，列宽原先写成裸 1fr —— 它的最小宽度等于内容宽度，内容一长就会把列轨道顶开（放大实验实测列宽可从 331px 被顶到 1120px），因此在 360px 视口下偶发撑出横向滚动条。现改用 minmax(0, 1fr) 把列宽锁死，同类写法（数字图块、页脚栏、点歌头部统计）一并加固；页面外观与排版无变化'],
    ['v3.7.2', '点歌统计页「点歌速览」的「点歌之王」卡片由只显示第一名改为按名次展示前三名：每行含名次徽标、昵称、累计点歌次数（第一名保留金冠）。数据直接取自站点「总榜」（次数降序 → 昵称）的头部三人，与页内总榜切换共用同一份数据与排序，不存在第二套口径'],
    ['v3.7.1', '修复「顶栏标签点了没反应」：弹层遮罩原先铺在顶栏之上，点导航的事件被遮罩接走（弹层只是被关掉、页面并不跳转）。现在把顶栏层级提到所有页面级浮层之上，弹层打开 / 点歌页彩蛋显示 / 播放器拖到最顶时，点标签都能正常跳转；同时弹层主动给顶栏让位，保证 ✕ 依旧可点'],
    ['v3.7.1', '修复窄屏导航够不到的问题：导航在窄屏靠横向滚动，但滚动条被隐藏，鼠标用户看不出可滚也滚不动（360px 时 8 个标签有 4 个完全点不到）。现在窄屏显示细滚动条；并把语言页锚点条的吸顶位置改为按顶栏实测高度对齐（不再写死，字体加载后也不会错位）'],
    ['v3.7', '首页右下角的「点歌速览」模块移除，改为「盲盒抽歌」：上方池子纵向自然滚动展示随机抽样的 24 首（每次打开都是新的一批），下方一键抽取，复用顶栏盲盒的滚轮动画与结果面板（歌名 / 原唱 / 语言 / 演唱次数 + 播放或去 B站搜）'],
    ['v3.7', '「点歌速览」迁至「点歌统计」页，并改为横向自然滚动带：点歌之王 / 最近点歌 / 常点歌曲 / 本月连续四组卡片循环经过，替代原来的圆点手动切换 —— 滚动是纯 CSS 的（无定时器），悬停暂停、尊重「减弱动效」偏好'],
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
      '<h2 class="sec-title">关于本站 <span class="sec-sub">SUI SONG ARCHIVE v3.7.10</span></h2></div>' +

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

      /* ── 画廊：四张插画的装帧式陈列。白底原画不做键控抠图（主体银发与白底
         同色域，抠图必伤发丝与金环细线），预处理钳白后以 multiply「印刷」进
         纸色页面；场景插画自带底色，直接装框。 ── */
      '<section class="sui-gallery">' +
      '<div class="sec-kicker">GALLERY · 画廊</div>' +
      '<p class="sui-gallery-intro">四张插画以「纸上印刷」的方式融入版面：白底原画与纸面同色相融、翅尖出血到卡缘，场景插画则装框陈列。</p>' +
      '<div class="sui-gallery-grid">' +
      '<figure class="sui-gallery-item sui-gallery-item--blend">' +
      '<img src="assets/sui-gallery-ribbon.webp" alt="岁己SUI 插画：金枝光环与红缎带双马尾" width="720" height="1024" loading="lazy" decoding="async">' +
      '<figcaption>01 · 金枝与缎带</figcaption>' +
      '</figure>' +
      '<figure class="sui-gallery-item sui-gallery-item--blend">' +
      '<img src="assets/sui-gallery-smile.webp" alt="岁己SUI 插画：簪花微笑" width="720" height="1024" loading="lazy" decoding="async">' +
      '<figcaption>02 · 花与笑靥</figcaption>' +
      '</figure>' +
      '<figure class="sui-gallery-item">' +
      '<img src="assets/sui-gallery-summer.webp" alt="岁己SUI 插画：夏日泳圈戏水" width="720" height="1024" loading="lazy" decoding="async">' +
      '<figcaption>03 · 夏日泳圈</figcaption>' +
      '</figure>' +
      '<figure class="sui-gallery-item sui-gallery-item--blend">' +
      '<img src="assets/sui-gallery-heart.webp" alt="岁己SUI 插画：悄悄比心" width="720" height="1024" loading="lazy" decoding="async">' +
      '<figcaption>04 · 悄悄比心</figcaption>' +
      '</figure>' +
      '</div></section>' +

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
