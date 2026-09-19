/* ═══════ 视图：首页 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* 点歌速览轮播的定时器（视图重渲时先清掉，避免悬挂引用） */
  var _teaserTimer = null;
  var _teaserFade = null;
  var _teaserRelock = null;
  var _teaserResize = null;

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

  function render(params, container) {
    if (_teaserTimer) { clearInterval(_teaserTimer); _teaserTimer = null; }
    if (_teaserFade) { clearTimeout(_teaserFade); _teaserFade = null; }
    if (_teaserRelock) { clearTimeout(_teaserRelock); _teaserRelock = null; }
    if (_teaserResize) { window.removeEventListener('resize', _teaserResize); _teaserResize = null; }

    var S = D.stats();
    var R = D.requests();
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

    var thisMonth = D.thisMonth();
    var streaks = (R.streaks[thisMonth] || []);
    var slides = buildTeaserSlides(R, streaks);
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
      '<section><div class="sec-head"><div class="sec-kicker">LATEST</div>' +
      '<h2 class="sec-title">最近演出 <span class="sec-sub">RECENT STAGES</span></h2></div>' +
      recent +
      '</section>' +

      '<section><div class="sec-head"><div class="sec-kicker">MOST SUNG</div>' +
      '<h2 class="sec-title">常唱金曲 <a class="sec-link" href="' + C.buildHash('frequent') + '">全部 →</a></h2></div>' +
      '<div class="rowlist">' + top10.map(function (s, i) {
        return '<div class="rowrow compact is-top10"><span class="row-idx">' + (i + 1) + '</span>' +
          '<a class="row-name" href="' + songHref(s) + '"><span class="nm">' + esc(s.name) + '</span></a>' +
          '<span class="row-count" data-tier="frequent">' + s.count + '</span>' +
          '<span class="row-last num">' + esc(s.last || '—') + '</span></div>';
      }).join('') + '</div>' +

      '<div class="req-teaser" style="margin-top:2rem;">' +
      '<div class="sec-head" style="margin-bottom:.8rem;"><div class="sec-kicker">REQUESTS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">点歌速览 <a class="sec-link" href="' + C.buildHash('requests') + '">详情 →</a></h2></div>' +
      '<div class="req-rotate" id="reqRotate">' +
      '<div class="req-rotate-head"><span class="rlab" id="reqRotateLabel"></span>' +
      '<span class="req-rotate-dots" id="reqRotateDots"></span></div>' +
      '<div class="req-rotate-body" id="reqRotateBody"></div>' +
      '</div>' +
      '<div class="streak-line">累计 <b class="num">' + D.fmtInt(R.meta.total) + '</b> 次点歌 · ' +
      '<b class="num">' + R.meta.audiences + '</b> 位观众 · <b class="num">' + R.meta.songs + '</b> 首歌被点到</div>' +
      '</div></section>' +
      '</div>';

    container.querySelectorAll('.fig.clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        C.go('songs', { quick: el.dataset.go });
      });
    });
    bindHeroArt(container.querySelector('.hero-figure img'));
    initTeaser(container, slides);
  }

  /* ─── 点歌速览轮播 ─── */
  function agoLabel(d) {
    var days = Math.floor((D.today - new Date(d + 'T00:00:00')) / 86400000);
    return days <= 0 ? '今天' : days === 1 ? '昨天' : days + ' 天前';
  }

  function buildTeaserSlides(R, streaks) {
    var slides = [];
    slides.push({
      label: '👑 点歌之王',
      html: '<div class="rbody"><span class="rp"><b>' + esc(R.king.n) + '</b> ' +
        '<span class="num">' + R.king.c + '</span><span class="rsub">次点歌 · 累计第一</span></span></div>'
    });
    var recent = Object.keys(R.lastDates || {})
      .map(function (n) { return { n: n, d: R.lastDates[n] }; })
      .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; })
      .slice(0, 3);
    if (recent.length) {
      slides.push({
        label: '🕘 最近点歌',
        html: '<div class="rbody">' + recent.map(function (r) {
          return '<span class="rp"><b>' + esc(r.n) + '</b> <span class="rsub">' + esc(agoLabel(r.d)) + '</span></span>';
        }).join('') + '</div>'
      });
    }
    var songs = R.boards.song.slice(0, 3);
    slides.push({
      label: '♪ 常点歌曲',
      html: '<div class="rbody">' + songs.map(function (s) {
        return '<span class="rp"><b>' + esc(s.n) + '</b> <span class="num">' + s.c + '</span><span class="rsub">次</span></span>';
      }).join('') + '</div>'
    });
    if (streaks.length) {
      slides.push({
        label: '🔥 本月连续',
        html: '<div class="rbody">' + streaks.slice(0, 3).map(function (s) {
          return '<span class="rp"><b>' + esc(s.n) + '</b> <span class="fire" title="连续 ' + s.len + ' 场点歌">' +
            '🔥'.repeat(s.fires) + '</span></span>';
        }).join('') + '</div>'
      });
    }
    return slides;
  }

  function initTeaser(container, slides) {
    var box = container.querySelector('#reqRotateBody');
    var labelEl = container.querySelector('#reqRotateLabel');
    var dotsBox = container.querySelector('#reqRotateDots');
    if (!box || !slides.length) return;
    var idx = 0, paused = false;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function draw(i) {
      idx = ((i % slides.length) + slides.length) % slides.length;
      labelEl.textContent = slides[idx].label;
      box.innerHTML = slides[idx].html;
      dotsBox.querySelectorAll('button').forEach(function (b, j) {
        b.classList.toggle('on', j === idx);
        b.setAttribute('aria-current', j === idx ? 'true' : 'false');
      });
    }
    /* 所有页共享「最大页高」：多个人名换行时行高不再变化，
       轮播切换与页面总高都恒定，不会跳动（并在字体就绪/视口变化后重测） */
    function lockHeight() {
      if (!document.getElementById('reqRotateBody')) return;
      box.style.height = '';                 // 先解绑才能量到自然高度
      var max = 0;
      for (var i = 0; i < slides.length; i++) {
        box.innerHTML = slides[i].html;
        max = Math.max(max, box.offsetHeight);
      }
      if (max) box.style.height = max + 'px';
      draw(idx);                             // 量完还原当前页
    }
    function onResize() {
      if (!document.getElementById('reqRotateBody')) {
        window.removeEventListener('resize', onResize);
        return;
      }
      if (_teaserRelock) clearTimeout(_teaserRelock);
      _teaserRelock = setTimeout(lockHeight, 150);
    }
    function advance() {
      /* 容器已随路由重渲被移除时自杀，避免悬挂定时器 */
      if (!document.getElementById('reqRotateBody')) {
        clearInterval(_teaserTimer); _teaserTimer = null; return;
      }
      if (paused || document.hidden || slides.length < 2) return;
      box.classList.add('swap');
      _teaserFade = setTimeout(function () {
        draw(idx + 1);
        box.classList.remove('swap');
      }, 170);
    }
    dotsBox.innerHTML = slides.map(function (s) {
      return '<button type="button" aria-label="切换到' + esc(s.label) + '"></button>';
    }).join('');
    dotsBox.querySelectorAll('button').forEach(function (b, i) {
      b.addEventListener('click', function () { draw(i); });
    });
    lockHeight();

    /* 字体异步替换（Google Fonts）后字宽会变，重新量一次高度 */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        if (document.getElementById('reqRotateBody')) lockHeight();
      });
    }
    window.addEventListener('resize', onResize);
    _teaserResize = onResize;

    var card = container.querySelector('#reqRotate');
    card.addEventListener('mouseenter', function () { paused = true; });
    card.addEventListener('mouseleave', function () { paused = false; });
    if (!reduced && slides.length > 1) {
      _teaserTimer = setInterval(advance, 3000);
    }
  }

  function songHref(s) { return C.buildHash('song', {}, encodeURIComponent(s.name)); }

  C.registerView('home', { render: render });
})();
