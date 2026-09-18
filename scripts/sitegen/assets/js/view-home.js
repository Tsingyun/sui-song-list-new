/* ═══════ 视图：首页 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  function render(params, container) {
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
    var streakHtml = '';
    if (streaks.length) {
      streakHtml = '<div class="streak-line">本月连续点歌 ' +
        streaks.slice(0, 4).map(function (s) {
          return '<b>' + esc(s.n) + '</b><span class="fire" title="连续 ' + s.len + ' 场点歌">' +
            '🔥'.repeat(s.fires) + '</span>';
        }).join(' · ') + '</div>';
    }

    container.innerHTML =
      '<section class="masthead">' +
      '<div class="masthead-kicker">SONG ARCHIVE · 演唱档案</div>' +
      '<h1>岁己SUI <span class="thin">歌单档案</span></h1>' +
      '<div class="masthead-sub"><span>完整收录每一次演唱、每一首歌。</span>' +
      '<span class="mono">' + esc(span) + '</span></div>' +
      '</section>' +

      '<div class="figures">' + figures.map(function (f) {
        return '<div class="fig' + (f.go ? ' clickable' : '') + '"' + (f.go ? ' data-go="' + f.go + '"' : '') + '>' +
          '<div class="fig-num">' + D.fmtInt(f.n) + '</div>' +
          '<div class="fig-label">' + f.label + '</div></div>';
      }).join('') + '</div>' +

      '<div class="home-tools">' +
      '<button type="button" class="btn" id="homeRandom">🎲 盲盒抽歌</button>' +
      '<button type="button" class="btn" id="homeExport">导出歌单</button>' +
      '<button type="button" class="btn" id="homeContribute">我要补充</button>' +
      '<a class="btn btn-ghost" href="https://stats.suijisui.uk" target="_blank" rel="noopener">点歌统计完整版 ↗</a>' +
      '</div>' +

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
      '<div class="king"><span class="crown">👑</span><b>' + esc(R.king.n) + '</b>' +
      '<span class="num" style="color:var(--accent);font-weight:600;">' + R.king.c + '</span><span style="font-size:var(--fs-sm);color:var(--ink-3);">次点歌 · 点歌之王</span></div>' +
      streakHtml +
      '<div class="streak-line">累计 <b class="num">' + D.fmtInt(R.meta.total) + '</b> 次点歌 · ' +
      '<b class="num">' + R.meta.audiences + '</b> 位观众 · <b class="num">' + R.meta.songs + '</b> 首歌被点到</div>' +
      '</div></section>' +
      '</div>';

    container.querySelectorAll('.fig.clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        C.go('songs', { quick: el.dataset.go });
      });
    });
    container.querySelector('#homeRandom').addEventListener('click', function () { C.openBlindbox(); });
    container.querySelector('#homeContribute').addEventListener('click', function () { C.openContribute(); });
    container.querySelector('#homeExport').addEventListener('click', function () { C.go('songs', { export: '1' }); });
  }

  function songHref(s) { return C.buildHash('song', {}, encodeURIComponent(s.name)); }

  C.registerView('home', { render: render });
})();
