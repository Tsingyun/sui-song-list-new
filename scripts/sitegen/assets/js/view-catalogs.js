/* ═══════ 视图：常唱金曲 / 语言分类 / 原唱分类 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;
  var helpers = null;   // view-songs 的行渲染助手

  function H() { return helpers || (helpers = window.SUISongRows); }

  /* ─── 常唱金曲 ─── */
  function renderFrequent(params, container) {
    var n10 = D.songs().filter(function (s) { return s.count >= 10; }).length;
    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">HITS</div>' +
      '<h2 class="sec-title">常唱金曲 <span class="sec-sub">演唱 5 次以上 · ' + window.SUI.songs.stats.frequent + ' 首</span></h2></div>' +
      '<div class="toolbar"><div class="search"><input id="freqSearch" type="search" placeholder="搜索常唱金曲…" value="' + esc(params.q || '') + '"></div></div>' +
      '<div class="rowlist" id="freqRows"></div>' +
      '<div class="sui-note"><i class="sui-bird" aria-hidden="true"></i>' +
      '<span>这 ' + window.SUI.songs.stats.frequent + ' 首里，有 <b class="num">' + n10 + '</b> 首被唱了 10 次以上 —— 弹幕点到手熟，小岁也唱到嘴熟。</span></div>';

    var input = container.querySelector('#freqSearch');
    var rows = container.querySelector('#freqRows');
    function draw() {
      var kw = input.value.trim().toLowerCase();
      var list = D.songs().filter(function (s) { return s.count >= 5; });
      if (kw) list = list.filter(function (s) {
        return s.name.toLowerCase().indexOf(kw) !== -1 || (s.artist || '').toLowerCase().indexOf(kw) !== -1;
      });
      list.sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh'); });
      H().renderRows(rows, list, kw, { rank: false });
    }
    draw();
    input.addEventListener('input', C.debounce(function () {
      draw();
      history.replaceState(null, '', input.value ? C.buildHash('frequent', { q: input.value }) : C.buildHash('frequent'));
      input.focus();
    }, 250));
  }

  /* ─── 语言分类 ─── */
  function renderLanguages(params, container) {
    var langs = window.SUI.songs.langs;
    var top = langs[0] || { lang: '—', count: 0 };
    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">LANGUAGES</div>' +
      '<h2 class="sec-title">语言分类 <span class="sec-sub">BY LANGUAGE</span></h2></div>' +
      '<div class="lang-anchor" id="langNav">' +
      langs.map(function (l) {
        return '<button type="button" class="chip" data-target="' + esc(l.lang) + '">' + esc(l.lang) +
          ' <span class="num">' + l.count + '</span></button>';
      }).join('') + '</div>' +
      '<div class="sui-note" style="margin-top:1.1rem;"><i class="sui-bird" aria-hidden="true"></i>' +
      '<span>一只小鸟学会了 <b class="num">' + langs.length + '</b> 种语言的歌；' +
      '其中 <b>' + esc(top.lang) + '</b> 最多，共 <b class="num">' + top.count + '</b> 首。</span></div>' +
      langs.map(function (l) {
        var list = D.songs().filter(function (s) { return s.lang === l.lang; })
          .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh'); });
        return '<div class="catalog-block" id="lang-' + esc(l.lang) + '">' +
          '<h3>' + esc(l.lang) + '<span class="mono">' + list.length + ' 首</span></h3>' +
          '<div class="rowlist"></div></div>';
      }).join('');

    langs.forEach(function (l) {
      var block = container.querySelector('#lang-' + CSS.escape(l.lang));
      var list = D.songs().filter(function (s) { return s.lang === l.lang; })
        .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh'); });
      H().renderRows(block.querySelector('.rowlist'), list, '', { rank: false });
    });

    container.querySelectorAll('#langNav .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var el = document.getElementById('lang-' + CSS.escape(chip.dataset.target));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ─── 原唱分类 ─── */
  function renderArtists(params, container) {
    var q = (params.q || '').toLowerCase();
    var artists = window.SUI.songs.artists.filter(function (a) { return a.name !== '未知'; });
    if (q) artists = artists.filter(function (a) { return a.name.toLowerCase().indexOf(q) !== -1; });
    var shown = artists.slice(0, 120);

    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">ARTISTS</div>' +
      '<h2 class="sec-title">原唱分类 <span class="sec-sub">' + window.SUI.songs.artists.length + ' 位原唱</span></h2></div>' +
      '<div class="toolbar"><div class="search"><input id="artistSearch" type="search" placeholder="搜索原唱…" value="' + esc(params.q || '') + '"></div></div>' +
      '<div class="artist-grid">' +
      shown.map(function (a) {
        var songs = D.songs().filter(function (s) { return (s.artist || '未知') === a.name; })
          .sort(function (x, y) { return y.count - x.count; });
        var chips = songs.slice(0, 5).map(function (s) {
          return '<span>' + esc(s.name) + (s.count > 1 ? ' ×' + s.count : '') + '</span>';
        }).join('');
        var more = songs.length > 5 ? '<span>+' + (songs.length - 5) + '</span>' : '';
        return '<div class="artist-cell" data-artist="' + esc(a.name) + '" role="button" tabindex="0">' +
          '<h4>' + esc(a.name) + '<span class="num">' + a.songs + '</span></h4>' +
          '<p>' + a.songs + ' 首 · ' + a.perf + ' 次演唱</p>' +
          '<div class="songs">' + chips + more + '</div></div>';
      }).join('') +       '</div>' +
      (artists.length > shown.length
        ? '<p class="list-meta" style="margin-top:1rem;">显示前 ' + shown.length + ' 位 · 共 ' + artists.length + ' 位，请用搜索缩小范围</p>' : '') +
      '<div class="sui-note"><i class="sui-bird" aria-hidden="true"></i>' +
      '<span>共 <b class="num">' + artists.length + '</b> 位原唱、<b class="num">' +
      artists.reduce(function (n, a) { return n + a.perf; }, 0) +
      '</b> 次演唱 —— 从虚拟歌手到华语日系流行，小岁都认真唱过。</span></div>';

    var input = container.querySelector('#artistSearch');
    input.addEventListener('input', C.debounce(function () {
      history.replaceState(null, '', C.buildHash('artists', { q: input.value }));
      var scroll = window.scrollY;
      renderArtists({ q: input.value }, container);
      window.scrollTo(0, scroll);
      container.querySelector('#artistSearch').focus();
    }, 300));

    container.querySelectorAll('.artist-cell').forEach(function (cell) {
      /* v3.7.11：点击原唱不再直接跳歌曲页，改为弹出详情卡片 */
      function open() { openArtistCard(cell.dataset.artist); }
      cell.addEventListener('click', open);
      cell.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
    });
  }

  /* ─── 原唱详情卡片（v3.7.11）：统计 + 代表曲列表 + 查看全部，弹层自带关闭 ─── */
  function openArtistCard(name) {
    var a = window.SUI.songs.artists.filter(function (x) { return x.name === name; })[0];
    if (!a) return;
    var songs = D.songs().filter(function (s) { return (s.artist || '未知') === name; })
      .sort(function (x, y) { return y.count - x.count; });
    var first = null, last = null;
    songs.forEach(function (s) {
      if (s.first && (!first || s.first < first)) first = s.first;
      if (s.last && (!last || s.last > last)) last = s.last;
    });
    var list = songs.slice(0, 8).map(function (s, i) {
      return '<a class="ac-song" href="' + C.buildHash('song', {}, encodeURIComponent(s.name)) + '">' +
        '<span class="ac-rk num">' + (i + 1) + '</span>' +
        '<span class="ac-nm">' + esc(s.name) + '</span>' +
        '<span class="ac-ct"><b class="num">' + s.count + '</b> 次</span></a>';
    }).join('');
    var more = songs.length > 8
      ? '<p class="ac-more">…还有 ' + (songs.length - 8) + ' 首，点下方按钮查看全部</p>' : '';
    var body =
      '<div class="artist-card">' +
      '<div class="ac-band" aria-hidden="true"></div>' +
      '<div class="ac-stats">' +
      '<div class="ac-stat"><b class="num">' + a.songs + '</b><span>收录歌曲</span></div>' +
      '<div class="ac-stat"><b class="num">' + a.perf + '</b><span>演唱次数</span></div>' +
      '<div class="ac-stat"><b class="num">' + (first ? first.slice(0, 4) : '—') + '</b><span>首次年份</span></div>' +
      '</div>' +
      (first && last ? '<p class="ac-span mono">' + esc(first) + ' ～ ' + esc(last) + '</p>' : '') +
      '<div class="ac-list">' + list + '</div>' + more +
      '<button type="button" class="btn btn-primary ac-all">查看全部 ' + a.songs + ' 首 →</button>' +
      '</div>';
    var api = C.openModal({ kicker: 'ARTIST · 原唱', title: name, body: body });
    api.body.querySelector('.ac-all').addEventListener('click', function () {
      api.close();
      C.go('songs', { q: name });
    });
    /* 点具体歌：先关卡片再进详情，避免返回时卡片还在 */
    api.body.querySelectorAll('.ac-song').forEach(function (el) {
      el.addEventListener('click', function () { api.close(); });
    });
  }

  C.registerView('frequent', { title: '常唱金曲', render: renderFrequent });
  C.registerView('languages', { title: '语言分类', render: renderLanguages });
  C.registerView('artists', { title: '原唱分类', render: renderArtists });
})();
