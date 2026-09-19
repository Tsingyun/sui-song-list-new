/* ═══════ 视图：数据洞察（手写 SVG/DOM 图表，零外部依赖） ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;
  var MIN = '2022-09';

  function render(params, container) {
    var tab = params.tab || 'calendar';
    var tabs = [['calendar', '演唱日历'], ['trend', '月度趋势'], ['tags', '标签分布'], ['artists', '原唱 Top 20']];
    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">INSIGHTS</div>' +
      '<h2 class="sec-title">数据洞察 <span class="sec-sub">SINCE 2022.09</span></h2></div>' +
      '<div class="insight-tabs">' + tabs.map(function (t) {
        return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === tab ? ' class="active"' : '') + '>' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="insightBody"></div>' +
      /* 岁己注脚：跨 tab 常驻，给这一页的图表一个"人"的落点 */
      '<div class="sui-note"><i class="sui-bird" aria-hidden="true"></i>' +
      '<span><b class="num">' + (window.SUI.requests.meta.liveDays || 0) + '</b> 个演出日 · ' +
      '<b class="num">' + window.SUI.songs.stats.total + '</b> 首歌 —— ' +
      '图表里的每一格、每一段，都是一次开口。</span></div>';

    var body = container.querySelector('#insightBody');
    if (tab === 'trend') renderTrend(body);
    else if (tab === 'tags') renderTags(body);
    else if (tab === 'artists') renderArtists(body);
    else renderHeatmap(body, params.year);

    container.querySelectorAll('.insight-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        C.go('insights', { tab: btn.dataset.tab });
      });
    });
  }

  /* ---------- 演唱日历热力图 ---------- */
  function heatColor(c) {
    /* 零值格随主题（墨色通道）；有值格用绯红系，深浅两版都成立 */
    if (!c) return 'rgba(var(--ink-rgb),.07)';
    if (c <= 1) return 'rgba(174,49,50,.22)';
    if (c <= 2) return 'rgba(174,49,50,.38)';
    if (c <= 3) return 'rgba(174,49,50,.55)';
    if (c <= 4) return 'rgba(174,49,50,.72)';
    if (c <= 6) return 'rgba(148,42,42,.85)';
    if (c <= 9) return 'rgba(122,34,34,.92)';
    return 'rgba(86,24,24,.96)';
  }

  function renderHeatmap(box, year) {
    var dateSongs = {};
    Object.keys(D.dates()).forEach(function (name) {
      (D.dates()[name] || []).forEach(function (d) {
        if (d.slice(0, 7) < MIN) return;
        (dateSongs[d] = dateSongs[d] || []).push(name);
      });
    });
    var years = {};
    Object.keys(dateSongs).forEach(function (d) { years[d.slice(0, 4)] = 1; });
    var yearList = Object.keys(years).sort();
    year = year && yearList.indexOf(year) !== -1 ? year : yearList[yearList.length - 1];

    /* 当年日历网格 */
    var jan1 = new Date(+year, 0, 1);
    var dec31 = new Date(+year, 11, 31);
    var cells = [];
    var cur = new Date(jan1);
    while (cur <= dec31) {
      var ds = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      cells.push({ date: ds, count: (dateSongs[ds] || []).length, dow: cur.getDay() || 7, month: cur.getMonth() });
      cur.setDate(cur.getDate() + 1);
    }
    var week = 0;
    cells.forEach(function (c, i) {
      if (c.dow === 1 && i !== 0) week++;
      c.col = week; c.row = c.dow - 1;
    });
    var totalWeeks = week + 1;

    box.innerHTML =
      '<div class="heat-controls">' +
      yearList.map(function (y) {
        return '<button type="button" class="chip' + (y === year ? ' active' : '') + '" data-year="' + y + '">' + y + '</button>';
      }).join('') +
      '<span class="mono" style="font-size:var(--fs-xs);color:var(--ink-3);margin-left:auto;">' +
      Object.keys(dateSongs).length + ' 个演出日</span></div>' +
      '<div class="heat-wrap"><div>' +
      '<div class="heat-grid" style="grid-template-columns:repeat(' + (totalWeeks) + ',14px);">' +
      cells.map(function (c) {
        return '<div class="heat-cell" data-date="' + c.date + '" style="background:' + heatColor(c.count) + '"></div>';
      }).join('') +
      '</div>' +
      '<div class="heat-months" style="grid-template-columns:repeat(' + (totalWeeks) + ',14px);">' +
      (function () {
        var out = [];
        for (var m = 0; m < 12; m++) {
          var col = -1;
          for (var i = 0; i < cells.length; i++) {
            if (cells[i].month === m && cells[i].date.slice(8) === '01') { col = cells[i].col; break; }
          }
          out.push({ m: m, col: col });
        }
        var lastCol = -1;
        return out.map(function (o) {
          if (o.col === -1 || o.col <= lastCol) return '<span></span>';
          lastCol = o.col;
          return '<span style="grid-column:' + (o.col + 1) + ';">' + (o.m + 1) + '月</span>';
        }).join('');
      })() +
      '</div></div></div>' +
      '<div class="heat-scroll-hint">← 横向滚动查看全年 →</div>' +
      '<div class="heat-legend"><span>少</span>' +
      [0, 1, 2, 3, 4, 6, 9, 12].map(function (c) {
        return '<span class="sw" style="background:' + heatColor(c) + '"></span>';
      }).join('') + '<span>多</span>' +
      '<span style="margin-left:.8em;">悬停查看当日歌单 · 点击直达</span></div>';

    box.querySelectorAll('[data-year]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        C.replace('insights', { tab: 'calendar', year: btn.dataset.year });
      });
    });

    var wrap = box.querySelector('.heat-wrap');
    wrap.addEventListener('mouseover', function (e) {
      var cell = e.target.closest('.heat-cell');
      if (!cell) return;
      var d = cell.dataset.date;
      var songs = dateSongs[d] || [];
      var html = '<div class="tip-title">' + d + ' · ' + (songs.length ? '演唱 ' + songs.length + ' 首' : '无演唱记录') + '</div>' +
        songs.map(function (n, i) {
          return '<div class="tip-song" data-song="' + esc(n) + '">' + esc(n) +
            '<span class="num">#' + (D.rankMap()[n] || '—') + '</span></div>';
        }).join('');
      var rect = cell.getBoundingClientRect();
      C.tip.show(html, rect.left + rect.width / 2, rect.bottom + 4);
    });
    wrap.addEventListener('mouseout', function (e) {
      if (e.target.closest('.heat-cell')) C.tip.hide();
    });
    wrap.addEventListener('click', function (e) {
      var songEl = e.target.closest('.tip-song');
      if (songEl) { C.tip.hide(); location.hash = C.buildHash('song', {}, encodeURIComponent(songEl.dataset.song)); return; }
      var cell = e.target.closest('.heat-cell');
      if (!cell) return;
      var songs = dateSongs[cell.dataset.date] || [];
      if (songs.length) {
        location.hash = C.buildHash('song', {}, encodeURIComponent(songs[0]));
      }
    });
  }

  /* ---------- 月度趋势（SVG） ---------- */
  function collectMonthly() {
    var perf = {}, newest = {};
    Object.keys(D.dates()).forEach(function (name) {
      (D.dates()[name] || []).forEach(function (d) {
        var m = d.slice(0, 7);
        if (m < MIN) return;
        perf[m] = (perf[m] || 0) + 1;
      });
    });
    D.songs().forEach(function (s) {
      if (s.first && s.first.slice(0, 7) >= MIN) newest[s.first.slice(0, 7)] = (newest[s.first.slice(0, 7)] || 0) + 1;
    });
    var months = [];
    var keys = {};
    Object.keys(perf).forEach(function (k) { keys[k] = 1; });
    Object.keys(newest).forEach(function (k) { keys[k] = 1; });
    months = Object.keys(keys).sort();
    if (!months.length) return null;
    var out = [];
    var cur = new Date(+months[0].slice(0, 4), +months[0].slice(5, 7) - 1, 1);
    var end = new Date(+months[months.length - 1].slice(0, 4), +months[months.length - 1].slice(5, 7) - 1, 1);
    while (cur <= end) {
      var key = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0');
      out.push({ m: key, perf: perf[key] || 0, newest: newest[key] || 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }

  function renderTrend(box) {
    var data = collectMonthly();
    if (!data) { box.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    var W = 1000, Hh = 320, padL = 42, padB = 34, padT = 16;
    var maxY = Math.max.apply(null, data.map(function (d) { return Math.max(d.perf, d.newest); }));
    var step = (W - padL - 10) / data.length;
    function x(i) { return padL + i * step; }
    function y(v) { return padT + (1 - v / maxY) * (Hh - padT - padB); }

    var line1 = data.map(function (d, i) { return x(i) + ',' + y(d.perf); }).join(' ');
    var line2 = data.map(function (d, i) { return x(i) + ',' + y(d.newest); }).join(' ');
    var area = 'M' + x(0) + ',' + y(0) + ' L' + line1.split(' ').join(' L') + ' L' + x(data.length - 1) + ',' + y(0) + ' Z';

    var ticks = [];
    var tickStep = Math.ceil(data.length / 12);
    data.forEach(function (d, i) {
      if (i % tickStep === 0) ticks.push(
        '<text x="' + x(i) + '" y="' + (Hh - 10) + '" text-anchor="middle" font-size="10" class="chart-ink">' +
        d.m.slice(2, 4) + '.' + d.m.slice(5, 7) + '</text>');
    });
    var gridLines = [];
    for (var g = 0; g <= 4; g++) {
      var gy = padT + g * (Hh - padT - padB) / 4;
      var val = Math.round(maxY * (1 - g / 4));
      gridLines.push(
        '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - 10) + '" y2="' + gy + '" class="chart-grid" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" class="chart-ink">' + val + '</text>');
    }
    var dots1 = data.map(function (d, i) {
      return '<circle cx="' + x(i) + '" cy="' + y(d.perf) + '" r="2.4" class="chart-perf"><title>' +
        D.fmtMonth(d.m) + ' 演唱 ' + d.perf + ' 次</title></circle>';
    }).join('');
    var dots2 = data.map(function (d, i) {
      return '<circle cx="' + x(i) + '" cy="' + y(d.newest) + '" r="2" class="chart-new"><title>' +
        D.fmtMonth(d.m) + ' 新歌 ' + d.newest + ' 首</title></circle>';
    }).join('');

    box.innerHTML =
      '<p class="chart-note">每月演唱次数（朱红）与新歌数（绿）· 悬停数据点查看数值</p>' +
      '<div style="overflow-x:auto;"><svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" style="min-width:760px;font-family:var(--mono);">' +
      gridLines.join('') +
      '<path d="' + area + '" class="chart-area"/>' +
      '<polyline points="' + line1 + '" fill="none" class="chart-perf" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<polyline points="' + line2 + '" fill="none" class="chart-new" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>' +
      dots1 + dots2 + ticks.join('') +
      '</svg></div>' +
      '<div class="heat-legend"><span class="sw" style="background:var(--accent)"></span>演唱次数' +
      '<span class="sw" style="background:var(--ice);margin-left:1em;"></span>新歌数</div>';
  }

  /* ---------- 标签分布 ---------- */
  function renderTags(box) {
    var tags = window.SUI.songs.tags.slice(0, 15);
    var total = D.stats().total;
    var max = tags[0].count;
    box.innerHTML =
      '<p class="chart-note">出现最多的 15 个标签 · 条形长度相对最大值</p>' +
      '<div class="hbar-list">' + tags.map(function (t) {
        return '<div class="hbar"><span class="hlabel" title="' + esc(t.tag) + '">' + esc(t.tag) + '</span>' +
          '<div class="htrack"><div class="hfill" style="width:' + (t.count / max * 100).toFixed(1) + '%"></div></div>' +
          '<span class="hnum">' + t.count + ' 首 · ' + (t.count / total * 100).toFixed(1) + '%</span></div>';
      }).join('') + '</div>';
  }

  /* ---------- 原唱 Top 20 ---------- */
  function renderArtists(box) {
    var artists = window.SUI.songs.artists.slice(0, 20);
    var max = Math.max.apply(null, artists.map(function (a) { return a.perf; }));
    box.innerHTML =
      '<p class="chart-note">按演唱次数排名 · 朱红 = 演唱次数，灰 = 收录歌曲数</p>' +
      '<div class="hbar-list" style="gap:.85rem;">' + artists.map(function (a) {
        return '<div class="hbar"><span class="hlabel" title="' + esc(a.name) + '">' + esc(a.name) + '</span>' +
          '<div style="display:flex;flex-direction:column;gap:3px;">' +
          '<div class="htrack" style="height:9px;"><div class="hfill" style="width:' + (a.perf / max * 100).toFixed(1) + '%"></div></div>' +
          '<div class="htrack" style="height:5px;"><div class="hfill dim" style="width:' + (a.songs / max * 100).toFixed(1) + '%"></div></div></div>' +
          '<span class="hnum">' + a.perf + ' 次 / ' + a.songs + ' 首</span></div>';
      }).join('') + '</div>';
  }

  C.registerView('insights', {
    title: '数据洞察',
    render: render
  });
})();
