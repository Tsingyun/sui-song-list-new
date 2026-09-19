/* ═══════ 视图：点歌统计 ═══════
   2026-09 整合：原独立站点「点歌统计」(sui-song-stats) 的全部内容已并入本页，
   包括 最近15天 / 月·季·年·总榜 / 热门歌曲 / 观众喜好 / 跨月冠军 / 成就殿堂 /
   时间区间筛选 / 观众详情 / 歌曲详情 / 导出（CSV·JSON·XLSX·PNG）/ 搜索与彩蛋。
   界面沿用主站设计体系（纸墨色板、衬线标题、等宽数据、细线分隔），不套用外站样式。

   业务规则（构建期已定，勿改）：
   - 占比：完整榜单向下取整、末项补齐余数，总和严格 100%。
   - 🔥 = 连续点球场次 - 1（纯主播日透明，不跨月）。
   - 等级 Lv.1-5：1-10 / 11-30 / 31-60 / 61-100 / 100+。 */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* 导出用的两个库与原子站一致：只在用户真正点击导出时才请求 CDN，
     避免为了一个多数访问用不到的功能拖慢首屏。 */
  var LIB_H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var LIB_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var _libPromises = {};
  function loadLib(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (_libPromises[src]) return _libPromises[src];
    _libPromises[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () {
        window[globalName] ? resolve(window[globalName]) : reject(new Error(globalName + ' 加载异常'));
      };
      s.onerror = function () { delete _libPromises[src]; reject(new Error(globalName + ' 加载失败，请检查网络后重试')); };
      document.head.appendChild(s);
    });
    return _libPromises[src];
  }

  var _celebrated = false;      // 成就彩蛋每会话只放一次
  var _confettiTimer = null;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ────────────────────────── 主渲染 ────────────────────────── */
  function render(params, container) {
    var R = D.requests();
    var kind = params.kind || 'month';       // month | quarter | year | total
    var period = params.m || '';             // 2025-03 / 2025-Q1 / 2025
    var q = (params.q || '').trim();

    var boardMap = { month: R.boards.monthly, quarter: R.boards.quarterly, year: R.boards.yearly };
    var periods = kind === 'total' ? null : Object.keys(boardMap[kind]).sort();
    var defaultPeriod = periods ? periods[periods.length - 1] : '';
    period = period && periods && periods.indexOf(period) !== -1 ? period : defaultPeriod;
    var boardAll = kind === 'total' ? R.boards.total : (boardMap[kind][period] || []);
    var board = q ? boardAll.filter(function (r) {
      return r.n.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }) : boardAll;

    var champs = kind === 'month' ? (R.champs[period] || []) : [];
    var streaks = kind === 'month' ? (R.streaks[period] || []) : [];
    var streakByAud = {};
    streaks.forEach(function (s) { streakByAud[s.n] = s; });

    var songAll = R.boards.song;
    var songBoard = q ? songAll.filter(function (r) {
      return r.n.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }) : songAll;

    var periodTitle = kind === 'total' ? '总点歌榜' :
      kind === 'month' ? '月度点歌榜 · ' + D.fmtMonth(period) :
      kind === 'quarter' ? '季度点歌榜 · ' + period :
      kind === 'year' ? '年度点歌榜 · ' + period : '';

    var ctx = { kind: kind, period: period, title: periodTitle, board: boardAll, song: songAll };

    container.innerHTML =
      '<div class="sec-head"><div class="sec-kicker">REQUESTS</div>' +
      '<h2 class="sec-title">点歌统计 <span class="sec-sub">点歌数据 · ' +
      esc(R.meta.start) + ' — ' + esc(R.meta.end) + '</span></h2></div>' +

      '<div class="req-head-figs">' +
      fig(R.meta.total, '点歌总次数') +
      fig(R.meta.audiences, '点歌观众') +
      fig(R.meta.songs, '被点歌曲') +
      fig(R.meta.liveDays, '直播天数') +
      '</div>' +

      /* 岁己注脚：用「饼干岁」（官方粉丝名）符号给这页一个身份落点 */
      '<div class="sui-note" style="margin-top:0;">' +
      '<i class="sui-cookie" aria-hidden="true"></i>' +
      '<span>这 <b class="num">' + D.fmtInt(R.meta.total) + '</b> 次点歌来自 <b class="num">' +
      R.meta.audiences + '</b> 位 <b>饼干岁</b> —— 每一次被点到，小岁都记着。</span></div>' +

      /* 点歌速览：自首页迁入，改为横向自然滚动展示 */
      briefBand(R) +

      /* 工具行：搜索 / 榜单切换 / 周期 / 时间区间 / 导出 */
      '<div class="toolbar">' +
      '<div class="search req-search-wrap">' +
      '<input id="reqSearch" type="search" placeholder="搜索观众 / 歌曲 / 日期…" value="' + esc(params.q || '') + '">' +
      '<div class="req-search-pop" id="reqSearchPop" hidden></div>' +
      '</div>' +
      '<div class="seg" id="reqSeg">' +
      [['month', '月榜'], ['quarter', '季榜'], ['year', '年榜'], ['total', '总榜']].map(function (s) {
        return '<button type="button" data-kind="' + s[0] + '"' + (kind === s[0] ? ' class="active"' : '') + '>' + s[1] + '</button>';
      }).join('') + '</div>' +
      (periods ? '<select class="select" id="reqPeriod">' +
        periods.slice().reverse().map(function (p) {
          var label = kind === 'month' ? D.fmtMonth(p) : p;
          return '<option value="' + p + '"' + (p === period ? ' selected' : '') + '>' + label + '</option>';
        }).join('') + '</select>' : '') +
      '<div class="toolbar-spacer"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="reqRange">时间区间</button>' +
      '<div class="req-export-wrap"><button type="button" class="btn btn-ghost btn-sm" id="reqExport">导出 ▾</button>' +
      '<div class="req-menu" id="reqExportMenu" hidden></div></div>' +
      '</div>' +

      /* ① 本期榜单 */
      '<section style="margin-top:1.2rem;">' +
      '<div class="req-board-head"><h3>' + periodTitle + '</h3>' +
      (champs.length ? '<span style="font-size:var(--fs-sm);color:var(--ink-3);">👑 ' +
        champs.map(esc).join('、') + '</span>' : '') + '</div>' +
      '<div id="boardRows">' +
      (board.length ? board.slice(0, 10).map(function (r, i) {
        return boardRow(r, i, champs, streakByAud[r.n], R);
      }).join('') : '<div class="empty" style="padding:1.5rem;"><p class="mono">没有找到匹配的观众</p></div>') +
      '</div>' +
      (board.length > 10 ? '<div id="boardRest" hidden>' +
        board.slice(10).map(function (r, i) { return boardRow(r, i + 10, champs, streakByAud[r.n], R); }).join('') +
        '</div><button type="button" class="req-expand" id="boardExpand">展开全部（共 ' + board.length + ' 位）▼</button>' : '') +
      '</section>' +

      /* ② 最近 15 天 */
      '<section style="margin-top:2.5rem;"><div class="sec-head"><div class="sec-kicker">RECENT 15 DAYS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">最近演出点歌 <span class="sec-sub" id="recentNote"></span></h2></div>' +
      recentBlock(R) + '</section>' +

      /* ③ 热门歌曲 + ④ 连续点歌 */
      '<div class="req-cols" style="margin-top:2.5rem;">' +
      '<section><div class="sec-head"><div class="sec-kicker">TOP SONGS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">热门歌曲榜</h2></div>' +
      '<div id="songBoard">' + songBoard.slice(0, 10).map(songRow).join('') + '</div>' +
      (songBoard.length > 10 ? '<div id="songRest" hidden>' + songBoard.slice(10).map(songRow).join('') + '</div>' +
        '<button type="button" class="req-expand" id="songExpand">展开全部（共 ' + songBoard.length + ' 首）▼</button>' : '') +
      (q && !songBoard.length ? '<div class="empty" style="padding:1.5rem;"><p class="mono">没有找到匹配的歌曲</p></div>' : '') +
      coocBlock(R) + '</section>' +

      '<section><div class="sec-head"><div class="sec-kicker">🔥 STREAKS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">本月连续点歌</h2></div>' +
      (streaks.length
        ? '<div class="fire-list">' + streaks.map(function (s) {
            return '<div class="fire-item"><span class="fire" role="button" tabindex="0" data-streak="' +
              esc(JSON.stringify(s)) + '" title="连续 ' + s.len + ' 场点歌（点击查看链）">' +
              '🔥'.repeat(s.fires) + '</span><b>' + esc(s.n) + '</b>' +
              '<span class="chain-dates">' + s.chain.join(' → ') + '</span></div>';
          }).join('') + '</div>'
        : '<div class="empty" style="padding:1.5rem;"><p class="mono">本月暂无连续点歌记录</p></div>') +
      '<div class="king-card"><span class="crown" style="font-size:1.3rem;">👑</span>' +
      '<b style="font-family:var(--serif);font-size:1.2rem;">' + esc(R.king.n) + '</b>' +
      '<span class="king-num mono">' + R.king.c + '</span>' +
      '<span style="font-size:var(--fs-sm);color:var(--ink-3);">次点歌 · 点歌之王</span>' +
      '<img class="king-chibi" src="assets/sui-chibi.webp" alt="" loading="lazy"></div>' +
      '</section></div>' +

      /* ⑤ 观众喜好 + 观众动态 */
      '<section style="margin-top:2.5rem;"><div class="sec-head"><div class="sec-kicker">PREFERENCES</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">观众喜好 <span class="sec-sub">TOP 12 观众常点歌曲</span></h2></div>' +
      prefBlock(R) + '</section>' +
      movementBlock(R) +

      /* ⑥ 跨月冠军 */
      '<section style="margin-top:2.5rem;"><div class="sec-head"><div class="sec-kicker">👑 CHAMPION STREAKS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">跨月冠军 <span class="sec-sub">连续数月蝉联月度榜首</span></h2></div>' +
      champBlock(R) + '</section>' +

      /* ⑦ 趋势 */
      '<section style="margin-top:2.5rem;"><div class="sec-head"><div class="sec-kicker">TREND</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">点歌趋势 <span class="sec-sub">每月点歌次数</span></h2></div>' +
      trendBlock(R) + '</section>' +

      /* ⑧ 成就殿堂 */
      '<section style="margin-top:2.5rem;" id="achSection"><div class="sec-head"><div class="sec-kicker">🏆 ACHIEVEMENTS</div>' +
      '<h2 class="sec-title" style="font-size:1.2rem;">成就殿堂</h2></div>' +
      achBlock(R) + '</section>';

    bindEvents(container, ctx, R);
  }

  function fig(n, label) {
    return '<div class="fig"><div class="fig-num">' + D.fmtInt(n) + '</div><div class="fig-label">' + label + '</div></div>';
  }

  /* ────────────────────────── 点歌速览（自首页迁入） ──────────────────────────
     原本挂在首页右栏，是「圆点手动切换」的轮播（配套一段锁高 JS，为的是
     切换时不改变页面总高）。迁到本页后改为横向自然滚动：四张卡片循环经过，
     不再需要手动切换，也就没有「切换时高度变化」这个问题 —— 锁高逻辑随之下线。
     滚动本身是纯 CSS 的（见 components.css 的 marquee 一节），
     卡片宽度写死（.req-brief-card），横向位移精度依赖它。 */
  function agoLabel(d) {
    var days = Math.floor((D.today - new Date(d + 'T00:00:00')) / 86400000);
    return days <= 0 ? '今天' : days === 1 ? '昨天' : days + ' 天前';
  }

  function briefCards(R) {
    var cards = [];
    cards.push({
      label: '👑 点歌之王',
      body: '<span class="rb-item"><b>' + esc(R.king.n) + '</b>' +
        '<span class="rb-num">' + R.king.c + '</span>' +
        '<span class="rb-sub">次点歌 · 累计第一</span></span>'
    });

    var recent = Object.keys(R.lastDates || {})
      .map(function (n) { return { n: n, d: R.lastDates[n] }; })
      .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; })
      .slice(0, 3);
    if (recent.length) {
      cards.push({
        label: '🕘 最近点歌',
        body: recent.map(function (r) {
          return '<span class="rb-item"><b>' + esc(r.n) + '</b>' +
            '<span class="rb-sub">' + esc(agoLabel(r.d)) + '</span></span>';
        }).join('')
      });
    }

    cards.push({
      label: '♪ 常点歌曲',
      body: R.boards.song.slice(0, 3).map(function (s) {
        return '<span class="rb-item"><b>' + esc(s.n) + '</b>' +
          '<span class="rb-num">' + s.c + '</span><span class="rb-sub">次</span></span>';
      }).join('')
    });

    var streaks = (R.streaks && R.streaks[D.thisMonth()]) || [];
    if (streaks.length) {
      cards.push({
        label: '🔥 本月连续',
        body: streaks.slice(0, 3).map(function (s) {
          return '<span class="rb-item"><b>' + esc(s.n) + '</b>' +
            '<span class="rb-fire" title="连续 ' + s.len + ' 场点歌">' +
            '🔥'.repeat(s.fires) + '</span></span>';
        }).join('')
      });
    }
    return cards;
  }

  function briefBand(R) {
    var cards = briefCards(R);
    if (!cards.length) return '';
    /* 内容复制一份（第二份对读屏隐藏）：这是无缝滚动的关键 —— 轨道尺寸正好是
       一份内容的两倍，CSS 里位移 -50% 即等于「一份」，因此不会跳变 */
    var one = cards.map(function (c) {
      return '<div class="req-brief-card">' +
        '<div class="req-brief-head">' + c.label + '</div>' +
        '<div class="req-brief-body">' + c.body + '</div></div>';
    }).join('');
    return '<div class="marquee req-brief">' +
      '<div class="marquee-track">' +
      '<div class="marquee-group">' + one + '</div>' +
      '<div class="marquee-group" aria-hidden="true">' + one + '</div>' +
      '</div></div>';
  }

  /* ────────────────────────── 各区块 ────────────────────────── */

  /* ② 最近 15 天（窗口终点 = 今天，与「X 天前」同一基准） */
  function recentBlock(R) {
    var raw = R.raw || [];
    if (!raw.length) return '<div class="empty" style="padding:1.5rem;"><p class="mono">暂无数据</p></div>';
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = new Date(today.getTime());
    start.setDate(start.getDate() - 14);            // 含今天共 15 天
    var startStr = ymd(start), endStr = ymd(today);
    var win = {};
    raw.forEach(function (r) {
      if (r.d >= startStr && r.d <= endStr) {
        if (!win[r.a]) win[r.a] = { count: 0, last: r.d };
        win[r.a].count++;
        if (r.d > win[r.a].last) win[r.a].last = r.d;
      }
    });
    var list = Object.keys(win).map(function (n) { return { n: n, count: win[n].count, last: win[n].last }; });
    var note = document.getElementById('recentNote');
    if (note) note.textContent = '最近 15 天 · 共 ' + list.length + ' 位观众点过歌';
    if (!list.length) {
      return '<div class="empty" style="padding:1.5rem;"><p class="mono">最近 15 天内没有点歌记录</p></div>';
    }
    list.sort(function (a, b) { return a.last < b.last ? 1 : (a.last > b.last ? -1 : 0); });
    var maxc = Math.max.apply(null, list.map(function (x) { return x.count; }));
    // 当月冠军 + 本月连续点歌 🔥（与月度榜同语义）
    var thisMonth = D.thisMonth();
    var monthData = R.boards.monthly[thisMonth] || [];
    var champSet = {};
    if (monthData.length) {
      var topCount = monthData[0].c;
      monthData.forEach(function (it) { if (it.c === topCount) champSet[it.n] = true; });
    }
    var streakByAud = {};
    (R.streaks[thisMonth] || []).forEach(function (s) { streakByAud[s.n] = s; });

    return '<div class="req-recent">' + list.map(function (item, i) {
      var extra = lvlBadge(R, item.n);
      if (champSet[item.n]) extra += ' <span class="crown" title="' + thisMonth + ' 当月点歌冠军">👑</span>';
      var s = streakByAud[item.n];
      if (s) {
        extra += ' <span class="fire" role="button" tabindex="0" data-streak="' + esc(JSON.stringify(s)) +
          '" title="连续 ' + s.len + ' 场点歌">🔥'.repeat(s.fires) + '</span>';
      }
      return '<div class="req-row" data-aud="' + esc(item.n) + '">' +
        '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="who"><span class="nm">' + esc(item.n) + '</span>' + extra + '</span>' +
        '<span class="cnt">' + item.count + '<small>次</small></span>' +
        '<span class="pctcol">' + esc(item.last) + '</span></div>';
    }).join('') + '</div>';
  }

  /* 歌曲共现：常被同一批观众一起点的歌 */
  function coocBlock(R) {
    var edges = (R.network && R.network.edges || []).slice(0, 8);
    if (!edges.length) return '';
    return '<div style="margin-top:1.6rem;"><div class="sec-kicker" style="margin-bottom:.5rem;">常被一起点</div>' +
      '<div class="req-cooc">' + edges.map(function (e) {
        return '<span class="req-cooc-item"><b>' + esc(e.a) + '</b><i>×</i><b>' + esc(e.b) + '</b>' +
          '<em>' + e.w + '</em></span>';
      }).join('') + '</div>' +
      '<p style="margin-top:.4rem;font-size:var(--fs-sm);color:var(--ink-3);">同一批观众共同点过的歌曲组合（数字 = 共同点过这两首歌的观众数）</p></div>';
  }

  /* ⑤ 观众喜好：Top12 观众 × 常点歌曲 */
  function prefBlock(R) {
    var tops = R.boards.total.slice(0, 12);
    var prefs = R.prefs || {};
    var html = tops.map(function (a) {
      var songs = prefs[a.n] || [];
      if (!songs.length) return '';
      return '<div class="req-pref-card">' +
        '<div class="req-pref-name" data-aud="' + esc(a.n) + '">' + esc(a.n) +
        '<span class="req-pref-count mono">' + a.c + ' 次</span></div>' +
        '<div class="req-pref-songs">' + songs.slice(0, 5).map(function (s) {
          return '<span class="req-pref-song" data-song="' + esc(s.n) + '">' + esc(s.n) +
            '<em>' + s.c + '</em></span>';
        }).join('') + '</div></div>';
    }).filter(Boolean).join('');
    return '<div class="req-pref-grid">' + html + '</div>';
  }

  /* 观众动态：新朋友 / 老朋友回归（子站数据中原有但未展示的部分） */
  function movementBlock(R) {
    var news = R.newcomers || [], backs = R.returners || [];
    if (!news.length && !backs.length) return '';
    var row = function (n, meta, cls) {
      return '<div class="req-move-row"><span class="req-move-name' + (cls ? ' ' + cls : '') + '"' +
        (n.aud || n.n ? ' data-aud="' + esc(n.n || n.aud) + '"' : '') + '>' + esc(n.n || n.aud) + '</span>' +
        '<span class="req-move-meta mono">' + meta + '</span></div>';
    };
    return '<div class="req-cols" style="margin-top:1.6rem;">' +
      '<div><div class="sec-kicker" style="margin-bottom:.5rem;">新朋友 · 近 90 天首次点歌</div>' +
      (news.length ? news.slice(0, 6).map(function (n) {
        return row(n, esc(n.first) + ' · ' + n.count + ' 次');
      }).join('') : '<p style="font-size:var(--fs-sm);color:var(--ink-3);">暂无</p>') + '</div>' +
      '<div><div class="sec-kicker" style="margin-bottom:.5rem;">老朋友回归 · 间隔 180 天以上</div>' +
      (backs.length ? backs.slice(0, 6).map(function (n) {
        return row(n, esc(n.from) + ' → ' + esc(n.to) + ' · ' + n.gap + ' 天');
      }).join('') : '<p style="font-size:var(--fs-sm);color:var(--ink-3);">暂无</p>') + '</div>' +
      '</div>';
  }

  /* ⑥ 跨月冠军 */
  function champBlock(R) {
    var rows = R.champStreaks || [];
    if (!rows.length) return '<div class="empty" style="padding:1.5rem;"><p class="mono">暂无连续夺冠记录</p></div>';
    return '<div class="req-champ-list">' + rows.map(function (s, i) {
      return '<div class="req-champ-row" data-aud="' + esc(s.n) + '">' +
        '<span class="req-champ-idx mono">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="req-champ-name">' + esc(s.n) + '</span>' +
        '<span class="req-champ-meta mono">连续 <b>' + s.len + '</b> 个月夺冠 · ' +
        esc(s.months[0]) + ' — ' + esc(s.months[s.months.length - 1]) + '</span></div>';
    }).join('') + '</div>';
  }

  /* ⑦ 趋势 */
  function trendBlock(R) {
    var months = Object.keys(R.trends).sort();
    var max = Math.max.apply(null, months.map(function (m) { return R.trends[m]; }));
    return '<div class="hbar-list" style="gap:.3rem;">' + months.map(function (m) {
      return '<div class="hbar" style="grid-template-columns:6rem 1fr auto;">' +
        '<span class="hlabel mono" style="font-size:var(--fs-xs);">' + m + '</span>' +
        '<div class="htrack" style="height:10px;"><div class="hfill" style="width:' +
        (R.trends[m] / max * 100).toFixed(1) + '%"></div></div>' +
        '<span class="hnum">' + R.trends[m] + '</span></div>';
    }).join('') + '</div>';
  }

  /* ⑧ 成就殿堂 */
  function achBlock(R) {
    var ach = R.achievements || [];
    if (!ach.length) return '<div class="empty" style="padding:1.5rem;"><p class="mono">暂无成就</p></div>';
    return '<div class="req-ach-grid">' + ach.map(function (a) {
      return '<div class="req-ach"' + (a.audience ? ' data-aud="' + esc(a.audience) + '"' : '') + '>' +
        '<div class="req-ach-emoji">' + a.emoji + '</div>' +
        '<div class="req-ach-name">' + esc(a.name) + '</div>' +
        '<div class="req-ach-desc">' + esc(a.desc) + '</div></div>';
    }).join('') + '</div>';
  }

  /* 等级徽章：与原子站一致，任何观众榜都按「总点歌次数」显示 Lv，
     而不是按当前榜单的次数（月榜里点 1 次的人也可能是 Lv.5 老观众）。 */
  function lvlBadge(R, name, fallback) {
    var n = (R.levels && R.levels[name]) || fallback || 0;
    if (!n) return '';
    return '<span class="lvl" data-l="' + n + '">Lv.' + n + '</span>';
  }

  function boardRow(r, i, champs, streak, R) {
    var isChamp = champs.indexOf(r.n) !== -1;
    var lvl = lvlBadge(R, r.n, r.level);
    var fire = streak
      ? '<span class="fire" role="button" tabindex="0" data-streak="' + esc(JSON.stringify(streak)) +
        '" title="连续 ' + streak.len + ' 场点歌（点击查看链）">' + '🔥'.repeat(streak.fires) + '</span>'
      : '';
    return '<div class="req-row" data-aud="' + esc(r.n) + '">' +
      '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="who"><span class="nm">' + esc(r.n) + '</span>' + lvl +
      (isChamp ? '<span class="crown" title="本期点歌冠军">👑</span>' : '') + fire + '</span>' +
      '<span class="cnt">' + r.c + '<small>次</small></span>' +
      '<span class="pctcol">点歌占比 ' + D.fmtPct(r.pct) + '</span>' +
      '</div>';
  }

  function songRow(r, i) {
    return '<div class="req-row" data-song="' + esc(r.n) + '">' +
      '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="who"><span class="nm">' + esc(r.n) + '</span></span>' +
      '<span class="cnt">' + r.c + '<small>次</small></span>' +
      '<span class="pctcol">点歌占比 ' + D.fmtPct(r.pct) + '</span>' +
      '</div>';
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ────────────────────────── 事件绑定 ────────────────────────── */
  function bindEvents(container, ctx, R) {
    /* 榜单类型 / 周期 */
    container.querySelectorAll('#reqSeg button').forEach(function (btn) {
      btn.addEventListener('click', function () { C.go('requests', { kind: btn.dataset.kind }); });
    });
    var periodSel = container.querySelector('#reqPeriod');
    if (periodSel) periodSel.addEventListener('change', function () {
      C.go('requests', { kind: ctx.kind, m: periodSel.value });
    });

    /* 搜索：过滤当前榜单 + 跨类型结果下拉（歌曲 / 观众 / 日期） */
    var input = container.querySelector('#reqSearch');
    var pop = container.querySelector('#reqSearchPop');
    input.addEventListener('input', C.debounce(function () {
      var v = input.value.trim();
      history.replaceState(null, '', C.buildHash('requests', { kind: ctx.kind, m: ctx.period, q: v }));
      var scroll = window.scrollY;
      render({ kind: ctx.kind, m: ctx.period, q: v }, container);   // 渲染会重绑本输入框
      window.scrollTo(0, scroll);
      var again = container.querySelector('#reqSearch');
      if (again) {
        again.focus();
        /* 只在这里跑一次搜索下拉：渲染后的 pop 是新节点，
           且不再回派 input 事件，避免「渲染 → 触发 → 再渲染」的循环。 */
        runSearch(R, v, container.querySelector('#reqSearchPop'), again);
      }
    }, 220));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { pop.hidden = true; input.blur(); }
    });
    document.addEventListener('click', function closePop(e) {
      if (!container.contains(e.target)) pop.hidden = true;
    });

    /* 展开 / 收起 */
    bindExpand(container, '#boardExpand', '#boardRest');
    bindExpand(container, '#songExpand', '#songRest');

    /* 行点击：观众 / 歌曲详情 */
    container.querySelectorAll('.req-row[data-aud]').forEach(function (row) {
      row.addEventListener('click', function () { openAudience(row.dataset.aud, ctx); });
    });
    container.querySelectorAll('.req-row[data-song], [data-song]').forEach(function (el) {
      if (el.classList.contains('req-pref-song')) return;
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openSong(el.dataset.song);
      });
    });
    /* 喜好卡片里的观众名 / 歌曲名 */
    container.querySelectorAll('.req-pref-name').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openAudience(el.dataset.aud, ctx);
      });
    });
    container.querySelectorAll('.req-pref-song').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openSong(el.dataset.song);
      });
    });
    container.querySelectorAll('.req-champ-row[data-aud]').forEach(function (el) {
      el.addEventListener('click', function () { openAudience(el.dataset.aud, ctx); });
    });
    container.querySelectorAll('.req-move-row [data-aud]').forEach(function (el) {
      el.addEventListener('click', function () { openAudience(el.dataset.aud, ctx); });
    });
    container.querySelectorAll('.req-ach[data-aud]').forEach(function (el) {
      el.addEventListener('click', function () { openAudience(el.dataset.aud, ctx); });
    });

    bindStreakTips(container);

    /* 时间区间 / 导出 */
    container.querySelector('#reqRange').addEventListener('click', function () { openRange(R); });
    var expBtn = container.querySelector('#reqExport');
    var expMenu = container.querySelector('#reqExportMenu');
    expBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      expMenu.hidden = !expMenu.hidden;
      if (!expMenu.hidden) buildExportMenu(R, ctx, expMenu);
    });
    document.addEventListener('click', function () { expMenu.hidden = true; });

    /* 成就彩蛋：首次滚动到成就区时撒一次彩纸 */
    celebrateOnView(container);
  }

  function bindExpand(container, btnSel, restSel) {
    var btn = container.querySelector(btnSel);
    var rest = container.querySelector(restSel);
    if (!btn || !rest) return;
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var open = rest.hidden;
      rest.hidden = !open;
      btn.textContent = open ? '收起 ▲' : label;
    });
  }

  /* 搜索下拉：歌曲 / 观众 / 日期（含彩蛋） */
  var _sidx = null;
  function searchIndex(R) {
    if (_sidx) return _sidx;
    var songs = {}, auds = {}, dates = {};
    (R.raw || []).forEach(function (r) { songs[r.s] = 1; auds[r.a] = 1; dates[r.d] = 1; });
    _sidx = { songs: Object.keys(songs).sort(), audiences: Object.keys(auds).sort(),
              dates: Object.keys(dates).sort() };
    return _sidx;
  }
  function runSearch(R, raw, pop, input) {
    var v = (raw || '').trim();
    if (/^谁是点歌大王[？?]?$/.test(v)) {
      pop.hidden = true;
      input.value = '';
      celebrate(R);
      return;
    }
    if (!v) { pop.hidden = true; pop.innerHTML = ''; return; }
    var lv = v.toLowerCase();
    var idx = searchIndex(R);
    var hits = [];
    (idx.songs || []).forEach(function (s) {
      if (hits.length < 20 && s.toLowerCase().indexOf(lv) >= 0) hits.push({ t: '歌曲', n: s });
    });
    (idx.audiences || []).forEach(function (a) {
      if (hits.length < 20 && a.toLowerCase().indexOf(lv) >= 0) {
        var meta = [];
        if (R.levels[a]) meta.push('Lv.' + R.levels[a]);
        if (R.lastDates[a]) meta.push(R.lastDates[a] + ' 最后一次');
        hits.push({ t: '观众', n: a, meta: meta.join(' · ') });
      }
    });
    (idx.dates || []).forEach(function (d) {
      if (hits.length < 20 && d.indexOf(v) >= 0) hits.push({ t: '日期', n: d });
    });
    if (!hits.length) {
      pop.innerHTML = '<div class="req-search-empty mono">没有找到匹配的结果</div>';
      pop.hidden = false;
      return;
    }
    pop.innerHTML = hits.map(function (r) {
      return '<div class="req-search-item" data-type="' + r.t + '" data-name="' + esc(r.n) + '">' +
        '<span class="req-search-type mono">' + r.t + '</span>' +
        '<span class="req-search-name">' + esc(r.n) + '</span>' +
        (r.meta ? '<span class="req-search-meta mono">' + esc(r.meta) + '</span>' : '') + '</div>';
    }).join('');
    pop.hidden = false;
    pop.onclick = function (e) {
      var item = e.target.closest('.req-search-item');
      if (!item) return;
      pop.hidden = true;
      if (item.dataset.type === '观众') openAudience(item.dataset.name, null);
      else if (item.dataset.type === '歌曲') openSong(item.dataset.name);
      else openDate(R, item.dataset.name);
    };
  }

  /* ────────────────────────── 详情弹层 ────────────────────────── */

  /* 观众详情：本期歌曲 / 过往歌曲 / 上次点歌 / 品味相近 / 本月连续 / B站 / 复制 */
  function openAudience(name, ctx) {
    var R = D.requests();
    var records = (R.raw || []).filter(function (r) { return r.a === name; });
    if (!records.length) { C.toast('没有找到该观众的点歌记录'); return; }

    var songs = {}, songLast = {};
    records.forEach(function (r) {
      songs[r.s] = (songs[r.s] || 0) + 1;
      if (!songLast[r.s] || r.d > songLast[r.s]) songLast[r.s] = r.d;
    });
    var songList = Object.keys(songs).map(function (s) { return { n: s, c: songs[s], d: songLast[s] }; });
    songList.sort(function (a, b) { return b.c - a.c || (a.n < b.n ? -1 : 1); });

    /* 本期歌曲：当前榜单周期（月/季/年）内点过的歌 */
    var periodSongs = [], otherSongs = songList, periodLabel = '';
    if (ctx && ctx.kind && ctx.kind !== 'total' && ctx.period) {
      var inPeriod = function (d) {
        if (ctx.kind === 'month') return d.indexOf(ctx.period) === 0;
        if (ctx.kind === 'year') return d.indexOf(ctx.period) === 0;
        if (ctx.kind === 'quarter') {
          var p = ctx.period.split('-Q');
          var qn = parseInt(p[1], 10);
          var mm = parseInt(d.substring(5, 7), 10);
          return d.indexOf(p[0]) === 0 && mm >= (qn - 1) * 3 + 1 && mm <= qn * 3;
        }
        return false;
      };
      periodLabel = ctx.kind === 'month' ? D.fmtMonth(ctx.period) : ctx.period;
      periodSongs = songList.filter(function (s) {
        return records.some(function (r) { return r.s === s.n && inPeriod(r.d); });
      });
      periodSongs.sort(function (a, b) { return a.d < b.d ? -1 : (a.d > b.d ? 1 : 0); });
      otherSongs = songList.filter(function (s) { return periodSongs.indexOf(s) === -1; });
    }

    var count = records.length;
    var level = R.levels[name] || D.levelOf(count);
    var last = R.lastDates[name];
    var lastHtml = '';
    if (last) {
      var days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(last + 'T00:00:00')) / 86400000);
      var ago = days <= 0 ? '今天' : days === 1 ? '昨天' : days + ' 天前';
      lastHtml = '<p class="req-detail-last">上一次点到歌：<span class="mono">' + esc(last) + '</span>（' + ago + '）</p>';
    }
    var similar = (R.similar || []).filter(function (p) { return p.a1 === name || p.a2 === name; }).slice(0, 3);
    var uid = R.uids[name];
    var biliHref = uid ? 'https://space.bilibili.com/' + uid
      : 'https://search.bilibili.com/upuser?keyword=' + encodeURIComponent(name);

    var songRowHtml = function (s, withCount) {
      return '<div class="req-song-row"><span class="nm">' + esc(s.n) + '</span>' +
        '<span class="mono">' + esc(s.d) + '</span>' +
        (withCount ? '<span class="cnt mono">' + s.c + ' 次</span>' : '') + '</div>';
    };
    var bodyHtml = '<div>' +
      '<p class="req-detail-count">共点歌 <b class="mono">' + count + '</b> 次 · Lv.' + level + '</p>' +
      lastHtml +
      (periodSongs.length ? '<h4 class="req-detail-h4">' + esc(periodLabel) + ' 点过的歌</h4>' +
        periodSongs.map(function (s) { return songRowHtml(s, false); }).join('') +
        (otherSongs.length ? '<h4 class="req-detail-h4">过往歌曲</h4>' +
          otherSongs.map(function (s) { return songRowHtml(s, true); }).join('') : '')
        : '<h4 class="req-detail-h4">点过的歌</h4>' +
          otherSongs.map(function (s) { return songRowHtml(s, true); }).join('')) +
      (similar.length ? '<h4 class="req-detail-h4">品味相近</h4><p class="req-detail-sim">' +
        similar.map(function (p) {
          var other = p.a1 === name ? p.a2 : p.a1;
          return '<a href="#" data-aud="' + esc(other) + '">' + esc(other) + '</a>（' + p.overlap + ' 首）';
        }).join(' · ') + '</p>' : '') +
      streakHtml(R, name) +
      '<div class="req-detail-actions">' +
      '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + biliHref + '">' +
      (uid ? 'B站主页' : 'B站搜索') + ' ↗</a>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="audCopy">复制用户信息</button>' +
      '</div></div>';

    var panel = C.openModal({ kicker: 'AUDIENCE', title: name, body: C.h(bodyHtml) });
    panel.body.querySelector('#audCopy').addEventListener('click', function () {
      var thisMonth = D.thisMonth();
      var monthCount = records.filter(function (r) { return r.d.indexOf(thisMonth) === 0; }).length;
      var text = '用户名：' + name + ' 上一次点歌：' + (last || '—') + ' 本月共点歌：' + monthCount + '次';
      C.copy(text, '已复制用户信息');
    });
    panel.body.querySelectorAll('[data-aud]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        panel.close();
        openAudience(a.dataset.aud, ctx);
      });
    });
  }

  /* 观众详情里的「本月连续点歌」可展开链 */
  function streakHtml(R, name) {
    var thisMonth = D.thisMonth();
    var list = R.streaks[thisMonth] || [];
    var hit = null;
    for (var i = 0; i < list.length; i++) { if (list[i].n === name) { hit = list[i]; break; } }
    if (!hit) return '';
    var chain = hit.chain.map(function (d, i) {
      return '<div class="req-streak-line"><span class="mono">' + esc(d) + '</span> ' +
        '<span style="color:var(--accent-deep);">' + esc((hit.songs[i] || []).join('、')) + '</span></div>';
    }).join('');
    return '<h4 class="req-detail-h4">本月连续点歌</h4>' +
      '<div class="req-streak">' +
      '<div class="req-streak-sum" role="button" tabindex="0">' +
      '🔥'.repeat(hit.fires) + ' 连续 ' + hit.len + ' 场点歌 ' +
      '<span class="mono" style="color:var(--ink-3);font-size:var(--fs-xs);">（点击展开）</span></div>' +
      '<div class="req-streak-detail" hidden>' + chain + '</div></div>';
  }

  /* 歌曲详情：谁点过这首歌 */
  function openSong(name) {
    var R = D.requests();
    var records = (R.raw || []).filter(function (r) { return r.s === name; });
    if (!records.length) { C.toast('没有找到这首歌的点歌记录'); return; }
    var info = {};
    records.forEach(function (r) {
      if (!info[r.a]) info[r.a] = { c: 0, last: '' };
      info[r.a].c++;
      if (r.d > info[r.a].last) info[r.a].last = r.d;
    });
    var list = Object.keys(info).map(function (a) { return { n: a, c: info[a].c, last: info[a].last }; });
    list.sort(function (a, b) { return b.c - a.c || (a.n < b.n ? -1 : 1); });

    var bodyHtml = '<div>' +
      '<p class="req-detail-count">共被点 <b class="mono">' + records.length + '</b> 次 · ' +
      list.length + ' 位观众点过</p>' +
      '<h4 class="req-detail-h4">点过这首歌的观众</h4>' +
      list.slice(0, 20).map(function (a, i) {
        return '<div class="req-song-row" data-aud="' + esc(a.n) + '">' +
          '<span class="nm">' + (i + 1) + '. ' + esc(a.n) + '</span>' +
          '<span class="mono">' + esc(a.last) + '</span>' +
          '<span class="cnt mono">' + a.c + ' 次</span></div>';
      }).join('') +
      '<div class="req-detail-actions">' +
      '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://search.bilibili.com/all?keyword=' +
      encodeURIComponent('岁己SUI ' + name + ' 歌切') + '">在B站搜歌切 ↗</a>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="songCopy">复制歌名</button>' +
      '</div></div>';
    var panel = C.openModal({ kicker: 'SONG', title: name, body: C.h(bodyHtml) });
    panel.body.querySelector('#songCopy').addEventListener('click', function () {
      C.copy(name, '已复制歌名');
    });
    panel.body.querySelectorAll('[data-aud]').forEach(function (a) {
      a.addEventListener('click', function () {
        panel.close();
        openAudience(a.dataset.aud, null);
      });
    });
  }

  /* 某一天的点歌记录 */
  function openDate(R, dateStr) {
    var records = (R.raw || []).filter(function (r) { return r.d === dateStr; });
    var html = '<div><p class="req-detail-count"><span class="mono">' + esc(dateStr) + '</span> · 共 ' +
      records.length + ' 次点歌</p><h4 class="req-detail-h4">当天的点歌</h4>' +
      (records.length ? records.map(function (r) {
        return '<div class="req-song-row" data-song="' + esc(r.s) + '"><span class="nm">' + esc(r.s) +
          '</span><span class="mono" data-aud="' + esc(r.a) + '">' + esc(r.a) + '</span></div>';
      }).join('') : '<p style="color:var(--ink-3);font-size:var(--fs-md);">当天没有点歌记录</p>') + '</div>';
    var panel = C.openModal({ kicker: 'DATE', title: dateStr, body: C.h(html) });
    panel.body.querySelectorAll('[data-song]').forEach(function (el) {
      el.addEventListener('click', function () { panel.close(); openSong(el.dataset.song); });
    });
    panel.body.querySelectorAll('[data-aud]').forEach(function (el) {
      el.addEventListener('click', function () { panel.close(); openAudience(el.dataset.aud, null); });
    });
  }

  /* ────────────────────────── 时间区间筛选 ────────────────────────── */
  function openRange(R) {
    var html = '<div>' +
      '<div class="req-range-row">' +
      '<label>起始<input type="date" id="rgStart"></label>' +
      '<label>结束<input type="date" id="rgEnd"></label>' +
      '<button type="button" class="btn btn-sm btn-primary" id="rgApply">应用</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="rgReset">重置</button>' +
      '</div><div id="rgResult" class="req-range-result"></div></div>';
    var panel = C.openModal({ kicker: 'TIME RANGE', title: '按时间区间统计', body: C.h(html) });
    var start = panel.body.querySelector('#rgStart');
    var end = panel.body.querySelector('#rgEnd');
    var out = panel.body.querySelector('#rgResult');
    start.value = R.meta.start;
    end.value = R.meta.end;

    function apply() {
      var ds = start.value, de = end.value;
      if (!ds || !de) { out.innerHTML = '<p class="mono">请选择起始和结束日期</p>'; return; }
      if (ds > de) { out.innerHTML = '<p class="mono">起始日期不能晚于结束日期</p>'; return; }
      var filtered = (R.raw || []).filter(function (r) { return r.d >= ds && r.d <= de; });
      if (!filtered.length) { out.innerHTML = '<p class="mono">该时间段内没有点歌记录</p>'; return; }
      var ac = {}, sc = {};
      filtered.forEach(function (r) { ac[r.a] = (ac[r.a] || 0) + 1; sc[r.s] = (sc[r.s] || 0) + 1; });
      var al = Object.keys(ac).map(function (n) { return { n: n, c: ac[n] }; })
        .sort(function (a, b) { return b.c - a.c; }).slice(0, 15);
      var sl = Object.keys(sc).map(function (n) { return { n: n, c: sc[n] }; })
        .sort(function (a, b) { return b.c - a.c; }).slice(0, 10);
      out.innerHTML =
        '<p class="mono" style="color:var(--ink-3);font-size:var(--fs-sm);">共 ' + filtered.length +
        ' 次点歌 · ' + Object.keys(ac).length + ' 位观众 · ' + Object.keys(sc).length + ' 首歌曲</p>' +
        '<h4 class="req-detail-h4">观众排行</h4>' +
        al.map(function (a, i) {
          return '<div class="req-song-row" data-aud="' + esc(a.n) + '"><span class="nm">' +
            (i + 1) + '. ' + esc(a.n) + '</span><span class="cnt mono">' + a.c + ' 次</span></div>';
        }).join('') +
        '<h4 class="req-detail-h4">热门歌曲</h4>' +
        sl.map(function (s, i) {
          return '<div class="req-song-row" data-song="' + esc(s.n) + '"><span class="nm">' +
            (i + 1) + '. ' + esc(s.n) + '</span><span class="cnt mono">' + s.c + ' 次</span></div>';
        }).join('');
      out.querySelectorAll('[data-aud]').forEach(function (el) {
        el.addEventListener('click', function () { panel.close(); openAudience(el.dataset.aud, null); });
      });
      out.querySelectorAll('[data-song]').forEach(function (el) {
        el.addEventListener('click', function () { panel.close(); openSong(el.dataset.song); });
      });
    }
    panel.body.querySelector('#rgApply').addEventListener('click', apply);
    panel.body.querySelector('#rgReset').addEventListener('click', function () {
      start.value = R.meta.start; end.value = R.meta.end; out.innerHTML = '';
    });
    apply();
  }

  /* ────────────────────────── 导出 ────────────────────────── */
  function buildExportMenu(R, ctx, menu) {
    var isSong = false;
    var data = ctx.board, title = ctx.title, field = '观众';
    menu.innerHTML =
      '<div class="req-menu-div">截图导出</div>' +
      '<button type="button" class="req-menu-item" data-act="ss10">PNG 截图 · 前 10 名</button>' +
      '<button type="button" class="req-menu-item" data-act="ss0">PNG 截图 · 完整榜单</button>' +
      '<div class="req-menu-div">数据导出</div>' +
      '<button type="button" class="req-menu-item" data-act="xlsx">Excel 表格 (.xlsx)</button>' +
      '<button type="button" class="req-menu-item" data-act="csv">CSV 文件 (.csv)</button>' +
      '<button type="button" class="req-menu-item" data-act="json">JSON 数据 (.json)</button>' +
      '<button type="button" class="req-menu-item" data-act="songcsv">热门歌曲榜 (.csv)</button>';
    menu.onclick = function (e) {
      var b = e.target.closest('.req-menu-item');
      if (!b) return;
      menu.hidden = true;
      var act = b.dataset.act;
      if (act === 'ss10' || act === 'ss0') exportPng(data, title, field, act === 'ss10' ? 10 : 0);
      else if (act === 'xlsx') exportXlsx(data, title, field);
      else if (act === 'csv') exportCsv(data, title, field);
      else if (act === 'json') exportJson(data, title);
      else if (act === 'songcsv') {
        var R2 = D.requests();
        exportCsv(R2.boards.song, '热门歌曲榜', '歌曲');
      }
    };
  }

  function rowsOf(data, field) {
    return data.map(function (r) { return [r.n, r.c]; });
  }

  function downloadBlob(blob, filename) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function exportCsv(data, title, field) {
    var csv = '\uFEFF' + field + ',次数\n' + rowsOf(data).map(function (r) {
      return '"' + r[0] + '",' + r[1];
    }).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      title.replace(/\s/g, '_') + '.csv');
    C.toast('已导出 CSV');
  }
  function exportJson(data, title) {
    var json = JSON.stringify(data.map(function (r) {
      return { name: r.n, count: r.c, pct: r.pct, level: r.level };
    }), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }),
      title.replace(/\s/g, '_') + '.json');
    C.toast('已导出 JSON');
  }
  function exportXlsx(data, title, field) {
    loadLib(LIB_XLSX, 'XLSX').then(function (XLSX) {
      var wsData = [[field, '次数']].concat(rowsOf(data));
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 24 }, { wch: 8 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, title.replace(/\s/g, '_') + '.xlsx');
      C.toast('已导出 Excel');
    }).catch(function (err) { C.toast(err.message); });
  }
  function exportPng(data, title, field, limit) {
    var rows = limit > 0 ? data.slice(0, limit) : data;
    /* 离屏排版：纸底 + 衬线标题 + 等宽数据，与主站视觉一致 */
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0;width:820px;padding:3rem 3.5rem;' +
      'background:#f6f2ea;z-index:99999;';
    box.innerHTML =
      '<div style="font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:.2em;' +
      'text-transform:uppercase;color:#8f8571;margin-bottom:.5rem;">岁己 SUI · 点歌统计</div>' +
      '<h2 style="font-family:\'Noto Serif SC\',serif;font-size:32px;font-weight:700;color:#211c15;' +
      'margin:0 0 .6rem;">' + esc(title) + '</h2>' +
      '<div style="width:4rem;height:2px;background:#ae3132;margin-bottom:1.6rem;"></div>' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid #211c15;">' +
      '<th style="padding:.5rem;text-align:left;font-family:IBM Plex Mono,monospace;font-size:11px;' +
      'letter-spacing:.15em;color:#8f8571;font-weight:500;">#</th>' +
      '<th style="padding:.5rem;text-align:left;font-family:IBM Plex Mono,monospace;font-size:11px;' +
      'letter-spacing:.15em;color:#8f8571;font-weight:500;">' + field + '</th>' +
      '<th style="padding:.5rem;text-align:right;font-family:IBM Plex Mono,monospace;font-size:11px;' +
      'letter-spacing:.15em;color:#8f8571;font-weight:500;">次数</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var gold = i === 0;
        return '<tr style="border-bottom:1px solid rgba(33,28,21,.1);' +
          (gold ? 'background:rgba(174,49,50,.06);' : '') + '">' +
          '<td style="padding:.45rem .5rem;font-family:IBM Plex Mono,monospace;font-size:13px;' +
          'color:#8f8571;">' + (i + 1) + '</td>' +
          '<td style="padding:.45rem .5rem;font-family:\'Noto Sans SC\',sans-serif;font-size:15px;' +
          'color:#211c15;' + (gold ? 'font-weight:600;' : '') + '">' + esc(r.n) +
          (gold && field === '观众' ? ' 👑' : '') + '</td>' +
          '<td style="padding:.45rem .5rem;text-align:right;font-family:IBM Plex Mono,monospace;' +
          'font-size:14px;color:#211c15;">' + r.c + ' 次</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div style="margin-top:2rem;text-align:right;font-family:IBM Plex Mono,monospace;' +
      'font-size:10px;letter-spacing:.2em;color:#8f8571;">岁己 SUI · 点歌统计 · ' +
      new Date().toISOString().slice(0, 10) + '</div>';
    document.body.appendChild(box);
    loadLib(LIB_H2C, 'html2canvas').then(function (h2c) {
      return h2c(box, { scale: 2, backgroundColor: '#f6f2ea', useCORS: true, logging: false });
    }).then(function (canvas) {
      box.remove();
      var link = document.createElement('a');
      link.download = (title + (limit > 0 ? '_Top' + limit : '_Full') + '.png').replace(/\s/g, '_');
      link.href = canvas.toDataURL('image/png');
      link.click();
      C.toast('已导出 PNG');
    }).catch(function (err) {
      box.remove();
      C.toast('截图导出失败：' + err.message);
    });
  }

  /* ────────────────────────── 🔥 徽章链提示 ────────────────────────── */
  function bindStreakTips(container) {
    container.querySelectorAll('.fire[data-streak]').forEach(function (el) {
      var show = function (e) {
        e.stopPropagation();
        var s;
        try { s = JSON.parse(el.dataset.streak); } catch (err) { return; }
        var html = '<div class="tip-title">🔥 连续 ' + s.len + ' 场点歌</div>' +
          s.chain.map(function (d, i) {
            return '<div style="margin:.1rem 0;"><span class="mono">' + esc(d) + '</span>' +
              ' <span style="color:var(--accent-deep);">' + esc((s.songs[i] || []).join('、')) + '</span></div>';
          }).join('');
        var rect = el.getBoundingClientRect();
        C.tip.show(html, rect.left, rect.bottom + 4);
      };
      el.addEventListener('click', show);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') show(e); });
    });
    /* 详情里的连续链展开 */
    container.querySelectorAll('.req-streak-sum').forEach(function (el) {
      el.addEventListener('click', function () {
        var d = el.nextElementSibling;
        d.hidden = !d.hidden;
        var hint = el.querySelector('.mono');
        if (hint) hint.textContent = d.hidden ? '（点击展开）' : '（点击收起）';
      });
    });
  }

  /* ────────────────────────── 彩蛋与彩纸 ────────────────────────── */
  function celebrateOnView(container) {
    var section = container.querySelector('#achSection');
    if (!section || _celebrated) return;
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.6 && !_celebrated) {
          _celebrated = true;
          var card = section.querySelector('.req-ach');
          if (card) confetti(card, 26);
          io.disconnect();
        }
      });
    }, { threshold: 0.6 });
    io.observe(section);
  }

  function celebrate(R) {
    if (document.querySelector('.req-celebrate-overlay')) return;   // 防重入
    var king = R.king;
    var html = '<div class="req-celebrate">' +
      '<div class="req-celebrate-kicker mono">点歌大王</div>' +
      '<div class="req-celebrate-name">' + esc(king.n) + '</div>' +
      '<div class="req-celebrate-sub mono">共计 ' + king.c + ' 次点歌 · 荣登榜首</div>' +
      '<div class="req-celebrate-hint mono">点击任意处关闭</div></div>';
    var overlay = C.h('<div class="req-celebrate-overlay">' + html + '</div>');
    document.body.appendChild(overlay);
    confetti(overlay, 60);
    overlay.addEventListener('click', function () { overlay.remove(); });
  }

  function confetti(anchorEl, count) {
    if (reducedMotion()) return;
    var colors = ['#ae3132', '#c9a76c', '#333949', '#e3b7c1', '#9db8dc'];
    var rect = anchorEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    for (var i = 0; i < count; i++) {
      (function (i) {
        setTimeout(function () {
          var p = document.createElement('i');
          p.className = 'req-confetti';
          var size = 5 + Math.random() * 7;
          p.style.cssText = 'left:' + (cx + (Math.random() - .5) * 220) + 'px;top:' +
            (cy + (Math.random() - .5) * 90) + 'px;width:' + size + 'px;height:' + (size * .6) +
            'px;background:' + colors[i % colors.length] + ';--dx:' + ((Math.random() - .5) * 320) +
            'px;--dy:' + (90 + Math.random() * 260) + 'px;--rr:' + (Math.random() * 720 - 360) + 'deg;';
          document.body.appendChild(p);
          setTimeout(function () { p.remove(); }, 2200);
        }, i * 22);
      })(i);
    }
  }

  C.registerView('requests', { title: '点歌统计', render: render });
})();
