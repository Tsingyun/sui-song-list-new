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

    /* 岁己注脚用：首末场与跨度（dates 升序，缺逐日记录时退回统计值） */
    var firstDate = dates[0] || song.first || '';
    var lastDate = dates[dates.length - 1] || song.last || '';
    var spanDays = (firstDate && lastDate && firstDate !== lastDate)
      ? Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000) : 0;

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
      '<div class="crumbs"><button type="button" class="back-btn" id="songBack" aria-label="返回上一页">← 返回</button>' +
      '<a href="' + C.buildHash('songs') + '">SONGS</a> / #' + (rank || '—') + '</div>' +
      '<h1>' + esc(song.name) + '</h1>' +
      (song.t ? '<div class="tr-name">' + esc(song.t) + '</div>' : '') +
      '<div class="meta-line">' +
      /* 演唱者署名徽标（v3.7.9）：头像印鉴从右上角（与装饰立绘重叠、语义不明）
         移入信息行，与原唱并列 —— 立绘负责氛围装饰，印鉴负责「谁在唱」的身份署名 */
      '<span class="who-sing" title="演唱：岁己SUI">' +
      '<img class="sui-seal" src="assets/sui-avatar.webp" alt="岁己SUI" loading="lazy">' +
      '<b>岁己SUI</b><i>演唱</i></span>' +
      '<span class="artist"><small>原唱</small>' + esc(song.artist || '未知原唱') + '</span>' +
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
      /* 岁己注脚：把时间轴读成"一个跨度"，而不是一堆日期 */
      '<div class="sui-note"><i class="sui-bird" aria-hidden="true"></i><span>' +
      (dates.length
        ? '最早唱于 <b class="num">' + esc(firstDate) + '</b>，最近一次 <b class="num">' + esc(lastDate) + '</b>' +
          (spanDays > 0 ? ' —— 前后隔了 <b class="num">' + spanDays + '</b> 天。' : '。')
        : '这首还没有逐日演唱记录，只有次数统计。') +
      '</span></div>' +

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
      return 0;  // 录播列表按时间倒序，index 0 即最新片段
    }
    var heroPlay = container.querySelector('#heroPlay');
    if (heroPlay) heroPlay.addEventListener('click', function () { C.openPlayer(song, heroClip()); });
    var heroSearch = container.querySelector('#heroSearch');
    if (heroSearch) heroSearch.addEventListener('click', function () {
      C.openExternal('https://search.bilibili.com/all?keyword=' +
        encodeURIComponent('岁己SUI ' + song.name + ' 歌切'));
    });
    /* v3.7.11：返回上一页 —— 优先回到进入详情前的浏览页（保留其参数），
       直链打开时退回歌曲列表 */
    container.querySelector('#songBack').addEventListener('click', function () {
      var prev = C.lastBrowseRoute;
      if (prev && prev.name && prev.name !== 'song') C.go(prev.name, prev.params);
      else C.go('songs');
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
