/* ═══════ 视图：首页 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* ── 首屏立绘随机轮换 ──────────────────────────────────────────────
     候选清单由构建器注入（window.SUI.heroArt，见 scripts/sitegen/builder.py 的
     HERO_ART），增删立绘只改那一份清单即可。纯前端随机，静态托管可用。
     用 sessionStorage 记住上一张，尽量不与上一张重复。 */
  var HERO_ART_FALLBACK = 'assets/sui-fullbody.webp'; // 清单缺失时（如旧产物）的最后兜底
  var HERO_ART_KEY = 'suiHeroArtIdx';

  function heroArtList() {
    var list = (window.SUI && window.SUI.heroArt) || [];
    return list.length ? list : [HERO_ART_FALLBACK];
  }

  function pickHeroArt() {
    var list = heroArtList();
    if (list.length === 1) return { src: list[0], idx: 0 };
    var last = -1;
    try { last = parseInt(sessionStorage.getItem(HERO_ART_KEY), 10); } catch (e) { last = -1; }
    if (isNaN(last)) last = -1;
    // 从「除上一张以外」的候选里随机抽，候选只有 1 个时才会重复
    var pool = [];
    for (var i = 0; i < list.length; i++) { if (i !== last) pool.push(i); }
    var idx = pool[Math.floor(Math.random() * pool.length)];
    try { sessionStorage.setItem(HERO_ART_KEY, String(idx)); } catch (e) { /* 隐私模式忽略 */ }
    return { src: list[idx], idx: idx };
  }

  /* 加载失败兜底：先退回清单第一张，再失败则隐藏图片（保留光环与铭文） */
  function bindHeroArt(img) {
    if (!img) return;
    img.classList.add('hero-art');
    var fallback = heroArtList()[0];
    var tried = false;
    var show = function () { img.classList.add('is-ready'); };
    img.addEventListener('load', show);
    img.addEventListener('error', function () {
      if (!tried && img.getAttribute('src') !== fallback) {
        tried = true;
        img.setAttribute('src', fallback);
        return;
      }
      img.style.display = 'none';
      img.classList.add('is-ready');
    });
    // 命中缓存时 load 可能早于绑定，直接补一次
    if (img.complete && img.naturalWidth) show();
  }

  /* ── 盲盒歌曲池 ──────────────────────────────────────────────────
     滚动带里循环经过的「池子」：从全部歌曲里随机抽一批。
     与盲盒「从所有歌里随机取一首」同构 —— 池子每次渲染重抽，
     所以刷新首页会看到不同的歌在流。滚动是纯 CSS 的（见 components.css
     的 marquee），这里只负责给出内容，不持有任何定时器。 */
  var POOL_SIZE = 24;

  function pickPool() {
    var all = D.songs();
    if (all.length <= POOL_SIZE) return all.slice();
    var pool = [], seen = {}, i;
    while (pool.length < POOL_SIZE) {
      i = Math.floor(Math.random() * all.length);
      if (!seen[i]) { seen[i] = 1; pool.push(all[i]); }
    }
    return pool;
  }

  /* 池子行：整块是装饰性滚动内容（外层已 aria-hidden），
     不放链接 —— 否则 48 个 Tab 停靠点会把键盘操作拖垮 */
  function poolRows(list) {
    return list.map(function (s) {
      return '<span class="marquee-row">' +
        '<span class="mq-name">' + esc(s.name) + '</span>' +
        '<span class="mq-meta">' + s.count + ' 次</span></span>';
    }).join('');
  }

  /* ── 久别重逢 ────────────────────────────────────────────────────
     隔了 2 年以上没唱、最近又重新登台的曲目。判定全在构建期
     （datalayer.py 的 return_list），前端只渲染 —— 口径不要在这里重算。
     每行两段：上一行是「歌名 · 原唱 + 累计次数」，下一行是一条时间轴
     （上次演唱 —— 断档时长 ——▸ 复唱日），断档时长就是这一栏想说的事。 */
  function retDate(d) { return esc(String(d || '').replace(/-/g, '.')); }

  function gapText(r) {
    return r.years + ' 年' + (r.months ? ' ' + r.months + ' 个月' : '');
  }

  function returnsBlock() {
    var R = (window.SUI.songs && window.SUI.songs.returns) || {};
    var list = R.list || [];
    if (!list.length) return '';   // 数据里没有「复唱」就不留空板块

    return '<section class="sec-returns">' +
      '<div class="sec-head"><div class="sec-kicker">REUNION</div>' +
      '<h2 class="sec-title">久别重逢 <span class="sec-sub">LONG-LOST RETURNS</span></h2></div>' +
      '<div class="ret-list">' + list.map(function (r, i) {
        return '<article class="ret-row">' +
          '<span class="ret-idx">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
          '<a class="ret-name" href="' + songHref({ name: r.name }) + '">' +
          '<span class="nm">' + esc(r.name) + '</span>' +
          (r.artist ? '<span class="tr">' + esc(r.artist) + '</span>' : '') +
          '</a>' +
          '<span class="ret-count">' + r.count + ' 次</span>' +
          '<div class="ret-track">' +
          '<span class="ret-date">' + retDate(r.prev) + '</span>' +
          '<span class="ret-bar"><i class="ret-gap">' + esc(gapText(r)) + '</i></span>' +
          '<span class="ret-arrow" aria-hidden="true">▸</span>' +
          '<span class="ret-date ret-back">' + retDate(r.back) + '</span>' +
          '</div></article>';
      }).join('') + '</div>' +
      '<p class="ret-note">距上次演唱 ' + (R.gapYears || 2) + ' 年以上，最近又重新登台 · 按复唱日期取最近 ' +
      list.length + ' 首</p>' +
      '</section>';
  }

  function render(params, container) {
    var S = D.stats();
    var span = S.first.slice(0, 7).replace('-', '.') + ' — ' + S.last.slice(0, 7).replace('-', '.');

    var figures = [
      { n: S.total, label: '歌曲总数', go: null },
      { n: S.performances, label: '演唱次数', go: null },
      { n: S.frequent, label: '常唱 (5+)', go: 'frequent' },
      { n: S.occasional, label: '偶尔 (2-4)', go: 'occasional' },
      { n: S.once, label: '仅唱一次', go: 'once' }
    ];

    var recent = window.SUI.songs.recent.map(function (day) {
      return '<div class="recent-day">' +
        '<div class="recent-date"><span class="num">' + esc(day.date) + '</span></div>' +
        '<div class="recent-songs">' + day.songs.map(function (n) {
          return '<a href="' + C.buildHash('song', {}, encodeURIComponent(n)) + '">' + esc(n) + '</a>';
        }).join('') + '</div></div>';
    }).join('');

    var top10 = D.songs().slice().sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name, 'zh');
    }).slice(0, 10);

    var pool = pickPool();
    var heroArt = pickHeroArt();

    container.innerHTML =
      '<section class="masthead"><span class="hero-watermark" aria-hidden="true"></span>' +
      /* 星屑：散在版心空白处的四芒星，与天使环同源（岁己头顶的铜环与星） */
      '<i class="sui-spark sui-star sui-spark-a" aria-hidden="true"></i>' +
      '<i class="sui-spark sui-star sui-spark-b sui-spark--d1" aria-hidden="true"></i>' +
      '<i class="sui-spark sui-star sui-spark-c sui-spark--d2" aria-hidden="true"></i>' +
      '<div class="masthead-inner">' +
      '<div class="masthead-main">' +
      '<div class="masthead-kicker">SUI SONG ARCHIVE · 岁己演唱档案</div>' +
      '<h1>岁己SUI <span class="thin">歌单档案</span></h1>' +
      '<div class="masthead-sub"><span>完整收录每一次演唱、每一首歌。</span>' +
      '<span class="mono">' + esc(span) + '</span></div>' +
      /* 角色铭牌：官方设定（种族 / 出道日 / 生日），回答"主视觉里的她是谁" */
      '<div class="masthead-facts">' +
      '<span><i class="sui-bird" aria-hidden="true"></i>银喉长尾山雀</span>' +
      '<span>出道 2022.09.04</span>' +
      '<span>生日 2.05</span>' +
      '<a class="masthead-facts-link" href="' + C.buildHash('about') + '">角色档案 →</a>' +
      '</div>' +
      '</div>' +
      '<figure class="hero-figure">' +
      '<span class="hero-halo" aria-hidden="true"></span>' +
      '<img src="' + esc(heroArt.src) + '" alt="岁己SUI" loading="eager" decoding="async">' +
      '<figcaption><b>SUI</b><span>SINCE 2022.09</span></figcaption>' +
      '</figure>' +
      '</div></section>' +

      '<div class="figures">' + figures.map(function (f) {
        return '<div class="fig' + (f.go ? ' clickable' : '') + '"' + (f.go ? ' data-go="' + f.go + '"' : '') + '>' +
          '<div class="fig-num">' + D.fmtInt(f.n) + '</div>' +
          '<div class="fig-label">' + f.label + '</div></div>';
      }).join('') + '</div>' +

      '<div class="home-grid">' +
      /* 左栏是「最近演出 + 久别重逢」两段（.home-col 让末段吸到栏底，
         与右栏的盲盒底边对齐 —— 见 views.css 的 .home-col 注释）；
         右栏保持单一 section，不套 .home-col，否则它也会被吸到底部 */
      '<div class="home-col">' +
      '<section><div class="sec-head"><div class="sec-kicker">LATEST</div>' +
      '<h2 class="sec-title">最近演出 <span class="sec-sub">RECENT STAGES</span></h2></div>' +
      recent +
      '</section>' +
      returnsBlock() +
      '</div>' +

      '<section class="home-side"><div class="sec-head"><div class="sec-kicker">MOST SUNG</div>' +
      '<h2 class="sec-title">常唱金曲 <a class="sec-link" href="' + C.buildHash('frequent') + '">全部 →</a></h2></div>' +
      '<div class="rowlist">' + top10.map(function (s, i) {
        return '<div class="rowrow compact is-top10"><span class="row-idx">' + (i + 1) + '</span>' +
          '<a class="row-name" href="' + songHref(s) + '"><span class="nm">' + esc(s.name) + '</span></a>' +
          '<span class="row-count" data-tier="frequent">' + s.count + '</span>' +
          '<span class="row-last num">' + esc(s.last || '—') + '</span></div>';
      }).join('') + '</div>' +

      /* 盲盒抽歌：池子在上方纵向自然滚动，下方一个抽取按钮。
         滚动内容为装饰（aria-hidden），信息由下方 hint 承载，避免读屏念一长串随机歌名 */
      '<div class="blindbox">' +
      '<div class="sec-head" style="margin-bottom:.8rem;"><div class="sec-kicker">BLIND BOX</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">盲盒抽歌 <a class="sec-link" href="' + C.buildHash('songs') + '">全部歌曲 →</a></h2></div>' +
      '<div class="marquee marquee--y blindbox-pool" aria-hidden="true">' +
      '<div class="marquee-track">' +
      '<div class="marquee-group">' + poolRows(pool) + '</div>' +
      '<div class="marquee-group">' + poolRows(pool) + '</div>' +
      '</div></div>' +
      '<div class="blindbox-foot">' +
      '<button type="button" class="btn btn-primary btn-sm" id="homeBlindbox">🎁 抽一首</button>' +
      '<span class="blindbox-hint">共 ' + D.fmtInt(S.total) + ' 首收录曲目 · 随机抽一首</span>' +
      '</div></div>' +
      '</section>' +
      '</div>';

    container.querySelectorAll('.fig.clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        C.go('songs', { quick: el.dataset.go });
      });
    });
    bindHeroArt(container.querySelector('.hero-figure img'));

    /* 抽歌：复用顶栏那个盲盒（同一套滚轮动画与结果面板），
       首页只提供入口，不重复实现一份抽奖逻辑 */
    var draw = container.querySelector('#homeBlindbox');
    if (draw) draw.addEventListener('click', function () {
      if (C.openBlindbox) C.openBlindbox();
    });
  }

  function songHref(s) { return C.buildHash('song', {}, encodeURIComponent(s.name)); }

  C.registerView('home', { render: render });
})();
