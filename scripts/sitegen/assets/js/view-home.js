/* ═══════ 视图：首页 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* ── 首屏立绘轮换（v3.7.21：随机起始 → 顺序轮换 + 手动切换）──────────
     候选清单由构建器注入（window.SUI.heroArt，见 scripts/sitegen/builder.py 的
     HERO_ART），**清单顺序即切换顺序**。
       · 打开页面从「上次看过的那张的下一张」开始（首次访问随机），
         之后按 5.6s 自动往后切一张，一轮走完自动回环；
       · 悬停 / 聚焦控件时暂停，手动「上一张 / 下一张」后重新计时；
       · 尊重 prefers-reduced-motion：不自动轮换（手动仍可用）；
       · 坏图跳过并记入 broken，全部失败时显示占位图（光环与铭文保留）。 */
  var HERO_ART_FALLBACK = 'assets/sui-fullbody.webp'; // 清单缺失时（如旧产物）的最后兜底
  var HERO_ART_KEY = 'suiHeroArtIdx';
  var HERO_INTERVAL = 5600;

  var heroTimer = null;
  var heroIO = null;
  function stopHeroTimer() {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
  }
  /* 换页即停表并解绑观察器：视图重渲后由新的一次 render 重新起表，
     避免在别的页面空转、也不让旧节点上的 observer 攒着不放 */
  function teardownHero() {
    stopHeroTimer();
    if (heroIO) { heroIO.disconnect(); heroIO = null; }
  }
  C.onRoute(teardownHero);

  function heroArtList() {
    var list = (window.SUI && window.SUI.heroArt) || [];
    return list.length ? list : [HERO_ART_FALLBACK];
  }

  function rememberHeroIndex(i) {
    try { sessionStorage.setItem(HERO_ART_KEY, String(i)); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* 起始张：接着上一次的下一张，首次访问随机 —— 兼顾「每次打开都不同」与顺序感 */
  function pickHeroArt() {
    var list = heroArtList();
    var last = -1;
    try { last = parseInt(sessionStorage.getItem(HERO_ART_KEY), 10); } catch (e) { last = -1; }
    if (isNaN(last) || last < 0 || last >= list.length) {
      last = Math.floor(Math.random() * list.length);
    }
    var idx = list.length === 1 ? 0 : (last + 1) % list.length;
    return { list: list, idx: idx, src: list[idx] };
  }

  function bindHeroCarousel(container, art) {
    var fig = container.querySelector('.hero-figure');
    if (!fig) return;
    /* 控件挂在 figure 外面（.hero-stack 里）—— 舞台线与落影要贴着人物脚下，
       控件不能挤进 figure 内部；查询/悬停都以外层容器为准 */
    var host = fig.closest('.hero-stack') || fig;
    var img = fig.querySelector('img');
    var ph = fig.querySelector('.hero-art-ph');
    var prevBtn = host.querySelector('[data-hero-prev]');
    var nextBtn = host.querySelector('[data-hero-next]');
    var idxEl = host.querySelector('.hero-ctl-idx');
    var list = art.list;
    var i = art.idx;
    var broken = {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* 由 JS 接管淡入：先透明，加载完成再显示（脚本不执行时 img 保持默认可见） */
    img.classList.add('hero-art');

    function showPlaceholder(on) {
      if (ph) ph.hidden = !on;
      img.style.visibility = on ? 'hidden' : '';
    }
    function label() {
      if (idxEl) idxEl.textContent = (i + 1) + ' / ' + list.length;
    }
    function markReady() { img.classList.add('is-ready'); }

    /* 换一张：先淡出（CSS .38s），预加载成功再换上并淡入；
       坏图记入 broken 跳过，连兜底也挂掉时亮占位图。
       游标 i「受理即更新」+ gen 代次守卫：连点不会因为上一张还在加载
       而重复切到同一张，也不会让迟到的旧回调覆盖新图。 */
    var gen = 0;
    function goTo(target, animate) {
      var my = ++gen;
      var tries = 0;
      var total = list.length;

      function attempt() {
        if (tries > total) { showPlaceholder(true); return; }
        target = ((target % total) + total) % total;
        if (broken[target]) { target += 1; tries += 1; return attempt(); }

        i = target;                  // 受理即更新：后续点击从这里继续数
        label();
        rememberHeroIndex(i);

        var src = list[target];
        var pre = new Image();
        pre.onload = function () {
          if (my !== gen) return;    // 已经切到更新的目标，丢弃这次回调
          var apply = function () {
            if (my !== gen) return;
            img.src = src;
            showPlaceholder(false);
            markReady();
            /* 顺手预取下一张：轮换到它时不会出现等网络的空白 */
            try { new Image().src = list[(target + 1) % total]; } catch (e) { /* 忽略 */ }
          };
          if (animate) setTimeout(apply, 180); else apply();
        };
        pre.onerror = function () {
          broken[target] = true;
          target += 1;
          tries += 1;
          attempt();
        };
        if (animate) img.classList.remove('is-ready');
        pre.src = src;
      }
      attempt();
    }

    function startTimer() {
      stopHeroTimer();
      if (reduce || list.length < 2) return;
      /* 鼠标还停在立绘/控件上时先不重启：等 mouseleave 再起表，
         否则手动点完「下一张」立刻又被自动抽走 */
      if (host.matches && host.matches(':hover')) return;
      heroTimer = setInterval(function () {
        if (document.hidden) return;   // 后台标签页不推进，回来自动续上
        goTo(i + 1, true);
      }, HERO_INTERVAL);
    }

    function manual(delta) {
      goTo(i + delta, true);
      startTimer();                    // 手动操作后重新计时，避免刚点完就被自动切走
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { manual(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { manual(1); });
    if (list.length < 2) {
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      if (idxEl) idxEl.hidden = true;
    }

    /* 悬停 / 键盘聚焦时暂停自动轮换（正在看的那张不该被抽走） */
    host.addEventListener('mouseenter', stopHeroTimer);
    host.addEventListener('mouseleave', startTimer);
    host.addEventListener('focusin', stopHeroTimer);
    host.addEventListener('focusout', function (e) {
      if (!host.contains(e.relatedTarget)) startTimer();
    });

    /* 首次加载：失败先退回兜底图，再失败则占位 */
    var fallback = list[0] || HERO_ART_FALLBACK;
    var fellBack = false;
    img.addEventListener('load', markReady);
    img.addEventListener('error', function () {
      if (!fellBack && img.getAttribute('src') !== fallback) {
        fellBack = true;
        img.setAttribute('src', fallback);
        return;
      }
      showPlaceholder(true);
    });
    if (img.complete && img.naturalWidth) markReady();

    label();
    rememberHeroIndex(i);
    startTimer();

    /* 滚出视口就停表（省流量/省电），回到视口再续上 */
    if (window.IntersectionObserver) {
      if (heroIO) heroIO.disconnect();
      heroIO = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) startTimer();
        else stopHeroTimer();
      }, { threshold: 0 });
      heroIO.observe(host);
    }
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
      '<div class="hero-stack">' +
      '<figure class="hero-figure">' +
      '<span class="hero-halo" aria-hidden="true"></span>' +
      '<img src="' + esc(heroArt.src) + '" alt="岁己SUI" loading="eager" decoding="async">' +
      /* 加载失败占位：全部候选都挂掉时压在图片位（尺寸/比例与原图一致，不跳版） */
      '<div class="hero-art-ph" hidden><i class="sui-bird" aria-hidden="true"></i>' +
      '<span>立绘加载失败</span></div>' +
      '<figcaption><b>SUI</b><span>SINCE 2022.09</span></figcaption>' +
      '</figure>' +
      /* 手动切换：上一张 / 序号 / 下一张（与自动轮换同一份清单、同一个游标） */
      '<div class="hero-ctl">' +
      '<button type="button" class="hero-ctl-btn" data-hero-prev aria-label="上一张立绘">‹</button>' +
      '<span class="hero-ctl-idx mono" aria-live="polite">' + (heroArt.idx + 1) + ' / ' + heroArt.list.length + '</span>' +
      '<button type="button" class="hero-ctl-btn" data-hero-next aria-label="下一张立绘">›</button>' +
      '</div>' +
      '</div>' +
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
    bindHeroCarousel(container, heroArt);

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
