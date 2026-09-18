/* ═══════ 视图：点歌统计 ═══════
   占比规则（构建期已定）：完整榜单上向下取整、末项补齐余数、总和严格 100%。
   🔥 = 连续点球场次 - 1（纯主播日透明，不跨月）。 */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  function render(params, container) {
    var R = D.requests();
    var kind = params.kind || 'month';       // month | quarter | year | total
    var period = params.m || '';             // 2025-03 / 2025-Q1 / 2025
    var q = (params.q || '').toLowerCase();

    var boardMap = { month: R.boards.monthly, quarter: R.boards.quarterly, year: R.boards.yearly };
    var periods = kind === 'total' ? null : Object.keys(boardMap[kind]).sort();
    var defaultPeriod = periods ? periods[periods.length - 1] : '';
    period = period && periods && periods.indexOf(period) !== -1 ? period : defaultPeriod;
    var board = kind === 'total' ? R.boards.total : (boardMap[kind][period] || []);
    var champs = kind === 'month' ? (R.champs[period] || []) : [];
    var streaks = kind === 'month' ? (R.streaks[period] || []) : [];
    var streakByAud = {};
    streaks.forEach(function (s) { streakByAud[s.n] = s; });

    if (q) board = board.filter(function (r) { return r.n.toLowerCase().indexOf(q) !== -1; });

    var shown = board.slice(0, 10);
    var rest = board.slice(10);

    var periodTitle = kind === 'total' ? '总点歌榜' :
      kind === 'month' ? '月度点歌榜 · ' + D.fmtMonth(period) :
      kind === 'quarter' ? '季度点歌榜 · ' + period :
      kind === 'year' ? '年度点歌榜 · ' + period : '';

    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">REQUESTS</div>' +
      '<h2 class="sec-title">点歌统计 <a class="sec-link" href="https://stats.suijisui.uk" target="_blank" rel="noopener">完整版 ↗</a></h2></div>' +

      '<div class="req-head-figs">' +
      fig(R.meta.total, '点歌总次数') +
      fig(R.meta.audiences, '点歌观众') +
      fig(R.meta.songs, '被点歌曲') +
      fig(R.meta.liveDays, '直播天数') +
      '</div>' +

      '<div class="toolbar">' +
      '<div class="search"><input id="reqSearch" type="search" placeholder="搜索观众 / 歌曲…" value="' + esc(params.q || '') + '"></div>' +
      '<div class="seg" id="reqSeg">' +
      [['month', '月榜'], ['quarter', '季榜'], ['year', '年榜'], ['total', '总榜']].map(function (s) {
        return '<button type="button" data-kind="' + s[0] + '"' + (kind === s[0] ? ' class="active"' : '') + '>' + s[1] + '</button>';
      }).join('') + '</div>' +
      (periods ? '<select class="select" id="reqPeriod">' +
        periods.slice().reverse().map(function (p) {
          var label = kind === 'month' ? D.fmtMonth(p) : p;
          return '<option value="' + p + '"' + (p === period ? ' selected' : '') + '>' + label + '</option>';
        }).join('') + '</select>' : '') +
      '</div>' +

      '<section style="margin-top:1.2rem;">' +
      '<div class="req-board-head"><h3>' + periodTitle + '</h3>' +
      (champs.length ? '<span style="font-size:var(--fs-sm);color:var(--ink-3);">👑 ' +
        champs.map(esc).join('、') + '</span>' : '') +
      '</div>' +
      '<div id="boardRows">' +
      shown.map(function (r, i) { return boardRow(r, i, champs, streakByAud[kind === 'month' ? r.n : ''], kind); }).join('') +
      '</div>' +
      (rest.length ? '<div id="boardRest" hidden>' +
        rest.map(function (r, i) { return boardRow(r, i + 10, champs, streakByAud[kind === 'month' ? r.n : ''], kind); }).join('') +
        '</div>' +
        '<button type="button" class="req-expand" id="boardExpand">展开全部（共 ' + board.length + ' 位）▼</button>' : '') +
      '</section>' +

      '<div class="req-cols" style="margin-top:2.5rem;">' +
      '<section><div class="sec-head"><div class="sec-kicker">TOP SONGS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">热门歌曲榜</h2></div>' +
      '<div id="songBoard">' +
      R.boards.song.slice(0, 10).map(function (r, i) { return songRow(r, i); }).join('') +
      '</div>' +
      (R.boards.song.length > 10
        ? '<div id="songRest" hidden>' + R.boards.song.slice(10).map(songRow).join('') + '</div>' +
          '<button type="button" class="req-expand" id="songExpand">展开全部（共 ' + R.boards.song.length + ' 首）▼</button>' : '') +
      '</section>' +

      '<section><div class="sec-head"><div class="sec-kicker">🔥 STREAKS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">本月连续点歌</h2></div>' +
      (streaks.length
        ? '<div class="fire-list">' + streaks.map(function (s) {
            return '<div class="fire-item"><span class="fire" title="连续 ' + s.len + ' 场点歌">' +
              '🔥'.repeat(s.fires) + '</span><b>' + esc(s.n) + '</b>' +
              '<span class="chain-dates">' + s.chain.join(' → ') + '</span></div>';
          }).join('') + '</div>'
        : '<div class="empty" style="padding:1.5rem;"><p class="mono">本月暂无连续点歌记录</p></div>') +
      '<div class="king" style="display:flex;align-items:baseline;gap:.6rem;padding:.9rem 1rem;border:1px solid var(--line-strong);border-radius:6px;margin-top:1.5rem;background:var(--surface);">' +
      '<span class="crown" style="font-size:1.3rem;">👑</span><b style="font-family:var(--serif);font-size:1.2rem;">' + esc(R.king.n) + '</b>' +
      '<span class="mono" style="color:var(--accent);font-weight:600;">' + R.king.c + '</span>' +
      '<span style="font-size:var(--fs-sm);color:var(--ink-3);">次点歌 · 点歌之王</span></div>' +
      '</section></div>' +

      '<section style="margin-top:2.5rem;"><div class="sec-head"><div class="sec-kicker">TREND</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">点歌趋势 <span class="sec-sub">' + esc(R.meta.start) + ' — ' + esc(R.meta.end) + '</span></h2></div>' +
      renderTrendBars(R.trends) +
      '</section>';

    /* 事件 */
    container.querySelectorAll('#reqSeg button').forEach(function (btn) {
      btn.addEventListener('click', function () { C.go('requests', { kind: btn.dataset.kind }); });
    });
    var periodSel = container.querySelector('#reqPeriod');
    if (periodSel) periodSel.addEventListener('change', function () {
      C.go('requests', { kind: kind, m: periodSel.value });
    });
    var searchInput = container.querySelector('#reqSearch');
    searchInput.addEventListener('input', C.debounce(function () {
      history.replaceState(null, '', C.buildHash('requests', { kind: kind, m: period, q: searchInput.value }));
      var scroll = window.scrollY;
      render({ kind: kind, m: period, q: searchInput.value }, container);
      window.scrollTo(0, scroll);
      container.querySelector('#reqSearch').focus();
    }, 250));

    var expandBtn = container.querySelector('#boardExpand');
    if (expandBtn) expandBtn.addEventListener('click', function () {
      var restEl = container.querySelector('#boardRest');
      var open = restEl.hidden;
      restEl.hidden = !open;
      expandBtn.textContent = open ? '收起 ▲' : '展开全部（共 ' + board.length + ' 位）▼';
    });
    var songExpand = container.querySelector('#songExpand');
    if (songExpand) songExpand.addEventListener('click', function () {
      var restEl = container.querySelector('#songRest');
      var open = restEl.hidden;
      restEl.hidden = !open;
      songExpand.textContent = open ? '收起 ▲' : '展开全部（共 ' + R.boards.song.length + ' 首）▼';
    });

    container.querySelectorAll('.req-row[data-aud]').forEach(function (row) {
      row.addEventListener('click', function () { openAudience(row.dataset.aud); });
    });
    bindStreakTips(container);
  }

  function fig(n, label) {
    return '<div class="fig"><div class="fig-num">' + D.fmtInt(n) + '</div><div class="fig-label">' + label + '</div></div>';
  }

  function boardRow(r, i, champs, streak, kind) {
    var isChamp = champs.indexOf(r.n) !== -1;
    var lvl = r.level != null ? '<span class="lvl" data-l="' + r.level + '">Lv.' + r.level + '</span>' : '';
    var fire = streak ? '<span class="fire" title="连续 ' + streak.len + ' 场点歌">🔥'.repeat(1) + '🔥'.repeat(streak.fires) + '</span>' : '';
    return '<div class="req-row" data-aud="' + esc(r.n) + '">' +
      '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="who"><span class="nm">' + esc(r.n) + '</span>' + lvl +
      (isChamp ? '<span class="crown" title="本期点歌冠军">👑</span>' : '') + fire + '</span>' +
      '<span class="cnt">' + r.c + '<small>次</small></span>' +
      '<span class="pctcol">点歌占比 ' + D.fmtPct(r.pct) + '</span>' +
      '</div>';
  }

  function songRow(r, i) {
    return '<div class="req-row" style="grid-template-columns:2.6rem minmax(0,1fr) auto 5.5rem;">' +
      '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="who"><span class="nm">' + esc(r.n) + '</span></span>' +
      '<span class="cnt">' + r.c + '<small>次</small></span>' +
      '<span class="pctcol">点歌占比 ' + D.fmtPct(r.pct) + '</span>' +
      '</div>';
  }

  function renderTrendBars(trends) {
    var months = Object.keys(trends).sort();
    var max = Math.max.apply(null, months.map(function (m) { return trends[m]; }));
    return '<div class="hbar-list" style="gap:.3rem;">' + months.map(function (m) {
      return '<div class="hbar" style="grid-template-columns:6rem 1fr 3rem;">' +
        '<span class="hlabel mono" style="font-size:var(--fs-xs);">' + m + '</span>' +
        '<div class="htrack" style="height:10px;"><div class="hfill" style="width:' + (trends[m] / max * 100).toFixed(1) + '%"></div></div>' +
        '<span class="hnum">' + trends[m] + '</span></div>';
    }).join('') + '</div>';
  }

  /* 🔥 悬停 -> 点歌链 */
  function bindStreakTips(container) {
    container.querySelectorAll('.fire[data-title], .fire').forEach(function (el) {
      /* tooltip 由 title 提供基础信息；链详情点击观众面板展示 */
    });
  }

  /* ─── 观众详情侧栏 ─── */
  function openAudience(name) {
    var R = D.requests();
    var count = 0;
    R.boards.total.forEach(function (r) { if (r.n === name) count = r.c; });
    var level = R.levels[name] || D.levelOf(count);
    var last = R.lastDates[name];
    var lastHtml = '';
    if (last) {
      var days = Math.floor((Date.now() - new Date(last + 'T00:00:00+08:00')) / 86400000);
      var ago = days === 0 ? '今天' : days === 1 ? '昨天' : days + ' 天前';
      lastHtml = '<p style="margin-top:.4rem;font-size:var(--fs-md);color:var(--ink-2);">上一次点到歌：<span class="mono">' + esc(last) + '</span>（' + ago + '）</p>';
    }
    var prefs = R.prefs[name] || [];
    var similar = (R.similar || []).filter(function (p) { return p.a1 === name || p.a2 === name; }).slice(0, 3);
    var uid = R.uids[name];
    var biliHref = uid ? 'https://space.bilibili.com/' + uid
      : 'https://search.bilibili.com/upuser?keyword=' + encodeURIComponent(name);

    var body = C.h('<div>' +
      '<p style="font-size:var(--fs-md);color:var(--ink-2);">共点歌 <b class="mono" style="font-size:1.2rem;color:var(--accent);">' + count + '</b> 次 · Lv.' + level + '</p>' +
      lastHtml +
      (prefs.length ? '<h4 style="margin:1.1rem 0 .4rem;font-size:var(--fs-base);">常点歌曲</h4>' +
        prefs.map(function (p) {
          return '<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--line);font-size:var(--fs-md);">' +
            '<span>' + esc(p.n) + '</span><span class="mono" style="color:var(--ink-3);">' + p.c + ' 次</span></div>';
        }).join('') : '') +
      (similar.length ? '<h4 style="margin:1.1rem 0 .4rem;font-size:var(--fs-base);">品味相近</h4><p style="font-size:var(--fs-md);color:var(--ink-2);">' +
        similar.map(function (p) {
          var other = p.a1 === name ? p.a2 : p.a1;
          return '<a href="#" data-aud="' + esc(other) + '" style="border-bottom:1px solid var(--line-strong);">' + esc(other) + '</a> (' + p.overlap + ' 首)';
        }).join(' · ') + '</p>' : '') +
      '<div style="display:flex;gap:.5rem;margin-top:1.3rem;">' +
      '<a class="btn btn-sm" style="flex:1;justify-content:center;" target="_blank" rel="noopener" href="' + biliHref + '">' + (uid ? 'B站主页' : 'B站搜索') + ' ↗</a>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="audCopy" style="flex:1;">复制观众名</button>' +
      '</div></div>');

    var panel = C.openModal({ kicker: 'AUDIENCE', title: name, body: body });
    body.querySelector('#audCopy').addEventListener('click', function () { C.copy(name, '已复制观众名'); });
    body.querySelectorAll('[data-aud]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        panel.close();
        openAudience(a.dataset.aud);
      });
    });
  }

  C.registerView('requests', {
    title: '点歌统计',
    render: render
  });
})();
