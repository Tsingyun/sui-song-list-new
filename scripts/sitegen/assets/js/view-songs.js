/* ═══════ 视图：歌曲浏览（全部歌曲） ═══════
   状态全部编码进 URL（#/songs?q=&lang=&tag=&quick=&sort=&page=），
   搜索输入用 replace 同步避免历史膨胀。 */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;
  var PAGE_SIZE = 50;

  var SORTS = [
    ['count-desc', '演唱次数 ↓'],
    ['count-asc', '演唱次数 ↑'],
    ['name-asc', '歌曲名 A-Z'],
    ['first-asc', '最早演唱 ↑'],
    ['last-desc', '最近演唱 ↓'],
    ['last-asc', '最久没唱 ↑']
  ];
  var QUICKS = [
    ['all', '全部'], ['frequent', '常唱 (5+)'], ['occasional', '偶尔 (2-4)'],
    ['once', '仅唱一次'], ['dormant', '很久没唱']
  ];

  function render(params, container) {
    var state = {
      q: params.q || '',
      lang: params.lang || 'all',
      tag: params.tag || 'all',
      quick: params.quick || 'all',
      sort: params.sort || 'count-desc',
      page: Math.max(1, parseInt(params.page, 10) || 1)
    };

    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">SONG INDEX</div>' +
      '<h2 class="sec-title">全部歌曲 <span class="sec-sub">COMPLETE INDEX</span></h2></div>' +

      '<div class="toolbar">' +
      '<div class="search"><input id="songSearch" type="search" placeholder="搜索歌名、译名、原唱…" value="' + esc(state.q) + '" aria-label="搜索歌曲"></div>' +
      '<select class="select" id="songSort" aria-label="排序">' +
      SORTS.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === state.sort ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') +
      '</select>' +
      '<div class="export-wrap"><button type="button" class="btn btn-ghost export-btn">导出 ▾</button></div>' +
      '</div>' +
      '<div class="toolbar">' +
      '<div class="chipbar" id="quickChips">' + QUICKS.map(function (q) {
        return '<button type="button" class="chip' + (state.quick === q[0] ? ' active' : '') + '" data-quick="' + q[0] + '">' + q[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="chipbar" id="langChips">' +
      '<button type="button" class="chip' + (state.lang === 'all' ? ' active' : '') + '" data-lang="all">全部语言</button>' +
      window.SUI.songs.langs.map(function (l) {
        return '<button type="button" class="chip' + (state.lang === l.lang ? ' active' : '') + '" data-lang="' + esc(l.lang) + '">' + esc(l.lang) + ' <span class="num">' + l.count + '</span></button>';
      }).join('') + '</div>' +
      '</div>' +
      '<div class="toolbar" style="margin-top:-.4rem;"><div class="chipbar" id="tagChips"></div></div>' +

      '<div class="rowlist" id="songRows"></div>' +
      '<div class="pager" id="songPager"></div>' +
      '<div class="list-meta" id="songMeta"></div>';

    renderTagChips(container, state);
    C.bindExport(container.querySelector('.export-wrap'), function () {
      return D.querySongs(state);
    });

    var list = D.querySongs(state);
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var pageSongs = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    renderRows(container.querySelector('#songRows'), pageSongs, state.q);
    renderPager(container.querySelector('#songPager'), list.length, totalPages, state);
    container.querySelector('#songMeta').textContent =
      '共 ' + list.length + ' 首 · 第 ' + state.page + ' / ' + totalPages + ' 页';

    /* 控件事件 */
    var searchInput = container.querySelector('#songSearch');
    searchInput.addEventListener('input', C.debounce(function () {
      state.q = searchInput.value.trim();
      state.page = 1;
      _refocus = true;
      syncState(state, container);
    }, 220));
    container.querySelector('#songSort').addEventListener('change', function () {
      state.sort = this.value; state.page = 1; syncState(state, container);
    });
    container.querySelectorAll('#quickChips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.quick = chip.dataset.quick; state.page = 1; syncState(state, container);
      });
    });
    container.querySelectorAll('#langChips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.lang = chip.dataset.lang; state.page = 1; syncState(state, container);
      });
    });

    if (params.focus === '1' || _refocus) {
      _refocus = false;
      searchInput.focus();
      var v = searchInput.value;
      searchInput.setSelectionRange(v.length, v.length);
    }
  }

  var _refocus = false;

  function syncState(state, container) {
    C.replace('songs', {
      q: state.q, lang: state.lang, tag: state.tag,
      quick: state.quick, sort: state.sort === 'count-desc' ? '' : state.sort,
      page: state.page
    });
    /* replace 会整页重渲 —— 无需手动刷新 */
  }

  function renderTagChips(container, state) {
    var box = container.querySelector('#tagChips');
    var tags = window.SUI.songs.tags;
    box.innerHTML =
      '<button type="button" class="chip' + (state.tag === 'all' ? ' active' : '') + '" data-tag="all">全部标签</button>' +
      tags.map(function (t) {
        return '<button type="button" class="chip' + (state.tag === t.tag ? ' active' : '') + '" data-tag="' + esc(t.tag) + '">' +
          esc(t.tag) + ' <span class="num">' + t.count + '</span></button>';
      }).join('');
    box.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.tag = chip.dataset.tag; state.page = 1; syncState(state, container);
      });
    });
  }

  /* 行渲染（被 常唱/语言 视图复用） */
  function renderRows(box, songs, query, opts) {
    opts = opts || {};
    if (!songs.length) {
      box.innerHTML = '<div class="list-empty">&gt; 没有找到匹配的歌曲</div>';
      return;
    }
    var ranks = D.rankMap();
    box.innerHTML = songs.map(function (s) {
      var rank = ranks[s.name];
      var isTop10 = rank <= 10 && opts.rank !== false;
      var tier = D.tierOf(s.count);
      var bili = s.bili && s.bili.length;
      var nameHtml = D.highlight(s.name, query);
      var trans = s.t ? '<span class="tr">' + D.highlight(s.t, query) + '</span>' : '';
      var tags = s.tags && s.tags.length
        ? '<span class="tags">' + s.tags.map(function (t) { return '<span class="tag-tag">' + esc(t) + '</span>'; }).join('') + '</span>'
        : '';
      return '<div class="rowrow' + (isTop10 ? ' is-top10' : '') + '" data-song="' + esc(s.name) + '">' +
        '<span class="row-idx">' + (isTop10 ? '★' : '') + (opts.rank === false ? '' : rank) + '</span>' +
        '<a class="row-name" href="' + C.buildHash('song', {}, encodeURIComponent(s.name)) + '">' +
        '<span class="nm">' + nameHtml + '</span>' + trans + tags + '</a>' +
        '<span class="row-artist">' + D.highlight(s.artist || '—', query) + '</span>' +
        '<span class="row-count" data-tier="' + tier + '">' + s.count + '</span>' +
        '<span class="row-last num" data-song-dates="' + esc(s.name) + '">' + esc(s.last || '—') + '</span>' +
        '<button type="button" class="row-play' + (bili ? '' : ' is-search') + '" data-play="' + esc(s.name) + '" aria-label="' +
        (bili ? '播放 ' : 'B站搜索 ') + esc(s.name) + '">' + (bili ? '▶' : '↗') + '</button>' +
        '</div>';
    }).join('');

    box.addEventListener('click', function (e) {
      var play = e.target.closest('[data-play]');
      if (play) {
        e.preventDefault();
        e.stopPropagation();
        var song = D.findSong(play.dataset.play);
        if (!song) return;
        if (song.bili && song.bili.length) C.openPlayer(song, 0);
        else C.openExternal('https://search.bilibili.com/all?keyword=' +
          encodeURIComponent('岁己SUI ' + song.name + ' 歌切'));
        return;
      }
    });
    bindDateTips(box);
  }

  /* 最近日期悬停 -> 完整演唱日期 tooltip */
  function bindDateTips(box) {
    box.addEventListener('mouseover', function (e) {
      var el = e.target.closest('[data-song-dates]');
      if (!el) return;
      var name = el.dataset.songDates;
      var dates = D.dates()[name] || [];
      if (!dates.length) return;
      var html = '<div class="tip-title">📅 ' + dates.length + ' 次演唱记录</div>' +
        dates.map(function (d, i) {
          var cls = 'tip-date';
          if (i === 0) cls += ' first';
          if (i === dates.length - 1) cls += ' last';
          return '<span class="' + cls + '">' + esc(d) + '</span>';
        }).join('');
      C.tip.show(html, e.clientX, e.clientY);
    });
    box.addEventListener('mouseout', function (e) {
      if (e.target.closest('[data-song-dates]')) C.tip.hide();
    });
  }

  function renderPager(box, total, totalPages, state) {
    if (totalPages <= 1) { box.innerHTML = ''; return; }
    var pages = [];
    if (totalPages <= 7) {
      for (var i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (state.page > 3) pages.push('…');
      for (i = Math.max(2, state.page - 1); i <= Math.min(totalPages - 1, state.page + 1); i++) pages.push(i);
      if (state.page < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    box.innerHTML =
      '<button type="button" data-p="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹ 上一页</button>' +
      pages.map(function (p) {
        if (p === '…') return '<span class="dots">…</span>';
        return '<button type="button" data-p="' + p + '"' + (p === state.page ? ' class="active"' : '') + '>' + p + '</button>';
      }).join('') +
      '<button type="button" data-p="' + (state.page + 1) + '"' + (state.page === totalPages ? ' disabled' : '') + '>下一页 ›</button>';
    box.querySelectorAll('button[data-p]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = parseInt(btn.dataset.p, 10);
        if (p >= 1 && p <= totalPages) { state.page = p; syncState(state, document.getElementById('view')); }
      });
    });
  }

  C.registerView('songs', {
    title: '全部歌曲',
    render: render
  });

  /* 供 常唱/语言 等视图复用的行渲染助手 */
  window.SUISongRows = { renderRows: renderRows, bindDateTips: bindDateTips, renderPager: renderPager };
})();
