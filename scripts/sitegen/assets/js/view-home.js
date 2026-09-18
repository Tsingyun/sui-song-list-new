/* ═══════ 视图：首页 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* 点歌速览轮播的定时器（视图重渲时先清掉，避免悬挂引用） */
  var _teaserTimer = null;
  var _teaserFade = null;

  function render(params, container) {
    if (_teaserTimer) { clearInterval(_teaserTimer); _teaserTimer = null; }
    if (_teaserFade) { clearTimeout(_teaserFade); _teaserFade = null; }

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

    container.innerHTML =
      '<section class="masthead"><span class="hero-watermark" aria-hidden="true"></span><div class="masthead-inner">' +
      '<div class="masthead-main">' +
      '<div class="masthead-kicker">SUI SONG ARCHIVE · 岁己演唱档案</div>' +
      '<h1>岁己SUI <span class="thin">歌单档案</span></h1>' +
      '<div class="masthead-sub"><span>完整收录每一次演唱、每一首歌。</span>' +
      '<span class="mono">' + esc(span) + '</span></div>' +
      '</div>' +
      '<figure class="hero-figure">' +
      '<span class="hero-halo" aria-hidden="true"></span>' +
      '<img src="assets/sui-fullbody.webp" alt="岁己SUI" loading="eager">' +
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
    draw(0);

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
