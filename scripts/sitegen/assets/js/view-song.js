/* ═══════ 视图：歌曲详情 ═══════
   歌曲是本站核心实体。详情页给每首歌一个可分享的 URL：
   #/song/<encodeURIComponent(歌名)> */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  function render(params, container, parsed) {
    var name = decodeURIComponent(parsed.parts[1] || '');
    var song = D.findSong(name);
    if (!song) {
      container.innerHTML = '<div class="empty"><p>没有找到《' + esc(name) + '》</p>' +
        '<p class="mono"><a href="' + C.buildHash('songs') + '">← 返回全部歌曲</a></p></div>';
      return;
    }

    var dates = D.dates()[song.name] || [];
    var ranks = D.rankMap();
    var rank = ranks[song.name];
    var tier = D.tierOf(song.count);

    /* 年度时间轴：月份 -> 演唱次数 */
    var byMonth = {};
    dates.forEach(function (d) {
      var y = d.slice(0, 4), m = parseInt(d.slice(5, 7), 10) - 1;
      (byMonth[y] = byMonth[y] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[m]++;
    });
    var maxMonth = 1;
    Object.keys(byMonth).forEach(function (y) {
      byMonth[y].forEach(function (c) { if (c > maxMonth) maxMonth = c; });
    });
    var years = Object.keys(byMonth).sort();
    var timeline = years.map(function (y) {
      var months = byMonth[y].map(function (c, m) {
        var h = c === 0 ? 3 : Math.max(6, Math.round(c / maxMonth * 40));
        return '<div class="month" title="' + y + '-' + String(m + 1).padStart(2, '0') + (c ? ' · ' + c + ' 次' : '') + '">' +
          '<div class="dot' + (c ? '' : ' zero') + '" style="height:' + h + 'px;"></div>' +
          '<div class="m-label">' + (m + 1) + '</div></div>';
      }).join('');
      var total = byMonth[y].reduce(function (a, b) { return a + b; }, 0);
      return '<div class="timeline-year"><span class="yr">' + y +
        '<span style="display:block;font-size:.65rem;color:var(--ink-3);font-weight:400;">' + total + '次</span></span>' +
        '<div class="timeline-strip">' + months + '</div></div>';
    }).join('');

    var dateList = dates.length
      ? '<div class="date-list">' + dates.map(function (d, i) {
          var cls = 'num';
          if (i === 0) cls += ' first';
          if (i === dates.length - 1) cls += ' last';
          return '<span class="' + cls + '">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '<p style="font-size:var(--fs-md);color:var(--ink-3);">暂无逐日演唱记录（仅有次数统计）</p>';

    var clips = (song.bili || []).map(function (c, i) {
      return '<button type="button" class="clip-item" data-clip="' + i + '">' +
        '<span class="num">' + esc(c.dt || '?') + '</span>' +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-2);">' + esc(c.t) + '</span>' +
        '<span class="dur">' + (c.d ? D.fmtDur(c.d) : '') + '</span>' +
        '<span class="go">▶ 播放</span></button>';
    }).join('');

    /* 相关：同原唱（前6，排除自身） */
    var related = D.songs().filter(function (s) {
      return s.artist && s.artist === song.artist && s.name !== song.name;
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);

    /* 按热度相邻导航 */
    var byRank = D.songs().slice().sort(function (a, b) {
      return (ranks[a.name] || 9999) - (ranks[b.name] || 9999);
    });
    var myIdx = -1;
    byRank.forEach(function (s, i) { if (s.name === song.name && myIdx === -1) myIdx = i; });
    var prev = myIdx > 0 ? byRank[myIdx - 1] : null;
    var next = myIdx > -1 && myIdx < byRank.length - 1 ? byRank[myIdx + 1] : null;

    container.innerHTML =
      '<div class="song-hero">' +
      '<div class="crumbs"><a href="' + C.buildHash('songs') + '">SONGS</a> / #' + (rank || '—') + '</div>' +
      '<h1>' + esc(song.name) + '</h1>' +
      (song.t ? '<div class="tr-name">' + esc(song.t) + '</div>' : '') +
      '<div class="meta-line">' +
      '<span class="artist">' + esc(song.artist || '未知原唱') + '</span>' +
      '<span class="lang-tag" data-lang="' + esc(song.lang) + '">' + esc(song.lang) + '</span>' +
      '<span class="mono" style="font-size:var(--fs-sm);color:var(--ink-3);">' + D.tierName(song.count) + ' · 演唱热度 #' + (rank || '—') + '</span>' +
      '</div>' +
      '<div class="actions">' +
      (clips ? '<button type="button" class="btn btn-primary" id="heroPlay">▶ 播放最新录播</button>' :
        '<button type="button" class="btn" id="heroSearch">↗ 在B站搜索歌切</button>') +
      '<button type="button" class="btn btn-ghost" id="heroCopy">复制歌曲信息</button>' +
      '</div></div>' +

      '<div class="song-detail-grid">' +
      '<section>' +
      '<div class="song-figures">' +
      fig(song.count, '演唱次数', tier === 'frequent' ? 'var(--accent)' : null) +
      fig(dates.length || song.count, '有记录场次') +
      fig(years.length, '跨越年数') +
      '</div>' +

      '<div class="sec-head" style="margin-bottom:var(--space-3);"><div class="sec-kicker">TIMELINE</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">演出时间轴</h2></div>' +
      '<div class="timeline">' + (timeline || '<p style="color:var(--ink-3);font-size:var(--fs-md);">暂无数据</p>') + '</div>' +

      '<div class="sec-head" style="margin-bottom:var(--space-3);"><div class="sec-kicker">HISTORY</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">历史演出 <span class="sec-sub">' + dates.length + ' 场</span></h2></div>' +
      dateList +

      (related.length ? '<div class="sec-head" style="margin:var(--space-6) 0 var(--space-3);"><div class="sec-kicker">RELATED</div>' +
        '<h2 class="sec-title" style="font-size:1.2rem;">同原唱歌曲</h2></div>' +
        '<div class="rowlist">' + related.map(function (s) {
          return '<a class="rowrow" style="grid-template-columns:1fr 4rem 5.5rem;" href="' +
            C.buildHash('song', {}, encodeURIComponent(s.name)) + '">' +
            '<span class="row-name"><span class="nm">' + esc(s.name) + '</span></span>' +
            '<span class="row-count" data-tier="' + D.tierOf(s.count) + '">' + s.count + '</span>' +
            '<span class="row-last num">' + esc(s.last || '—') + '</span></a>';
        }).join('') + '</div>' : '') +
      '</section>' +

      '<aside class="detail-side">' +
      (song.tags && song.tags.length
        ? '<div><h3 style="font-size:var(--fs-base);margin-bottom:.5rem;">分类标签</h3><div class="tags-wrap">' +
          song.tags.map(function (t) {
            return '<a class="tag-tag" style="cursor:pointer" href="' + C.buildHash('songs', { tag: t }) + '">' + esc(t) + '</a>';
          }).join('') + '</div></div>' : '') +

      (clips
        ? '<div><h3 style="font-size:var(--fs-base);margin-bottom:.5rem;">录播片段 <span class="mono" style="color:var(--ink-3);font-size:var(--fs-sm);">' + (song.bili || []).length + '</span></h3>' +
          '<div class="clip-list">' + clips + '</div></div>'
        : '') +

      '<div><h3 style="font-size:var(--fs-base);margin-bottom:.5rem;">外部链接</h3><div class="link-list">' +
      '<a target="_blank" rel="noopener" href="https://music.163.com/#/search/m/?s=' + encodeURIComponent(song.name + ' ' + (song.artist || '')) + '">♪ 网易云搜索<span class="mono">NETEASE</span></a>' +
      '<a target="_blank" rel="noopener" href="https://search.bilibili.com/all?keyword=' + encodeURIComponent('岁己SUI ' + song.name + ' 歌切') + '">▶ B站搜索歌切<span class="mono">BILIBILI</span></a>' +
      '</div></div>' +

      '<div style="display:flex;gap:.5rem;">' +
      (prev ? '<a class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;" href="' + songUrl(prev) + '">← ' + esc(prev.name) + '</a>' : '') +
      (next ? '<a class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;" href="' + songUrl(next) + '">' + esc(next.name) + ' →</a>' : '') +
      '</div>' +
      '</aside></div>';

    function heroClip() {
      return (song.bili || []).length ? song.bili.length - 1 : 0;  // 最新片段
    }
    var heroPlay = container.querySelector('#heroPlay');
    if (heroPlay) heroPlay.addEventListener('click', function () { C.openPlayer(song, heroClip()); });
    var heroSearch = container.querySelector('#heroSearch');
    if (heroSearch) heroSearch.addEventListener('click', function () {
      C.openExternal('https://search.bilibili.com/all?keyword=' +
        encodeURIComponent('岁己SUI ' + song.name + ' 歌切'));
    });
    container.querySelector('#heroCopy').addEventListener('click', function () {
      C.copy(C.songCopyText(song), '已复制歌曲信息');
    });
    container.querySelectorAll('.clip-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        C.openPlayer(song, parseInt(btn.dataset.clip, 10));
      });
    });
  }

  function fig(n, label, color) {
    return '<div class="fig"><div class="fig-num"' + (color ? ' style="color:' + color + '"' : '') + '>' +
      (n || 0) + '</div><div class="fig-label">' + label + '</div></div>';
  }

  function songUrl(s) { return C.buildHash('song', {}, encodeURIComponent(s.name)); }

  C.registerView('song', {
    render: render,
    title: function (p, parsed) { return decodeURIComponent(parsed.parts[1] || ''); }
  });
})();
