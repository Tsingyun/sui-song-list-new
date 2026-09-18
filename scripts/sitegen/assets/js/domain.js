/* ═══════ 域层：对 SUI 数据的纯函数（无 DOM 依赖） ═══════
   筛选 / 排序 / 搜索 / 日期工具。业务口径与构建期（Python）一致。 */
(function () {
  'use strict';

  var D = {};

  D.today = new Date();

  D.songs = function () { return window.SUI.songs.songs; };
  D.dates = function () { return window.SUI.songs.dates; };
  D.stats = function () { return window.SUI.songs.stats; };
  D.requests = function () { return window.SUI.requests; };

  /* ---------- 查找 ---------- */
  D.findSong = function (name) {
    var songs = D.songs();
    name = String(name);
    for (var i = 0; i < songs.length; i++) if (songs[i].name === name) return songs[i];
    // 退化：大小写 / 波浪号归一化
    var norm = name.toLowerCase().replace(/\u301c|\uff5e/g, '~');
    for (i = 0; i < songs.length; i++) {
      if (songs[i].name.toLowerCase().replace(/\u301c|\uff5e/g, '~') === norm) return songs[i];
    }
    return null;
  };

  /* 演唱次数全局排名（次数 desc，歌名 asc —— 与旧系统一致） */
  var __rankMap = null;
  D.rankMap = function () {
    if (__rankMap) return __rankMap;
    var sorted = D.songs().slice().sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name, 'zh');
    });
    __rankMap = {};
    sorted.forEach(function (s, i) { __rankMap[s.name] = i + 1; });
    return __rankMap;
  };
  D.resetRank = function () { __rankMap = null; };

  /* ---------- 筛选 / 排序 ---------- */
  D.daysSince = function (dateStr) {
    if (!dateStr) return 99999;
    var d = new Date(dateStr + 'T00:00:00');
    return Math.floor((D.today - d) / 86400000);
  };

  D.tierOf = function (count) { return count >= 5 ? 'frequent' : (count >= 2 ? 'occasional' : 'rare'); };
  D.tierName = function (count) { return count >= 5 ? '常唱' : (count >= 2 ? '偶尔' : '稀有'); };

  /* songs 视图状态 -> 过滤排序结果。state: {q,lang,tag,quick,sort} */
  D.querySongs = function (state) {
    var list = D.songs().slice();
    var q = (state.q || '').trim().toLowerCase();
    if (state.quick === 'frequent') list = list.filter(function (s) { return s.count >= 5; });
    else if (state.quick === 'occasional') list = list.filter(function (s) { return s.count >= 2 && s.count <= 4; });
    else if (state.quick === 'once') list = list.filter(function (s) { return s.count === 1; });
    else if (state.quick === 'dormant') {
      list = list
        .filter(function (s) { return D.daysSince(s.last) >= 180; })
        .sort(function (a, b) { return D.daysSince(b.last) - D.daysSince(a.last); });
    }
    if (state.lang && state.lang !== 'all') list = list.filter(function (s) { return s.lang === state.lang; });
    if (state.tag && state.tag !== 'all') {
      list = list.filter(function (s) { return s.tags && s.tags.indexOf(state.tag) !== -1; });
    }
    if (q) {
      list = list.filter(function (s) {
        return s.name.toLowerCase().indexOf(q) !== -1 ||
          (s.artist || '').toLowerCase().indexOf(q) !== -1 ||
          (s.t || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (state.quick !== 'dormant') {
      var cmpName = function (a, b) { return a.name.localeCompare(b.name, 'zh'); };
      switch (state.sort) {
        case 'count-asc': list.sort(function (a, b) { return a.count - b.count || cmpName(a, b); }); break;
        case 'name-asc': list.sort(cmpName); break;
        case 'first-asc': list.sort(function (a, b) { return (a.first || 'z').localeCompare(b.first || 'z'); }); break;
        case 'last-desc': list.sort(function (a, b) { return (b.last || '').localeCompare(a.last || ''); }); break;
        case 'last-asc': list.sort(function (a, b) { return (a.last || 'z').localeCompare(b.last || 'z'); }); break;
        default: list.sort(function (a, b) { return b.count - a.count || cmpName(a, b); });
      }
    }
    return list;
  };

  /* 搜索命中高亮（纯文本 -> HTML） */
  D.highlight = function (text, query) {
    text = String(text == null ? '' : text);
    if (!query) return D.esc(text);
    var idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return D.esc(text);
    return D.esc(text.slice(0, idx)) + '<mark>' + D.esc(text.slice(idx, idx + query.length)) + '</mark>' + D.esc(text.slice(idx + query.length));
  };

  /* ---------- 格式 ---------- */
  D.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };

  D.fmtInt = function (n) { return (n || 0).toLocaleString('en-US'); };

  D.fmtPct = function (p) {
    if (p == null) return '';
    return (Number.isInteger(p) ? String(p) : p.toFixed(1)) + '%';
  };

  D.fmtDur = function (sec) {
    if (!sec) return '';
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };

  D.fmtMonth = function (ym) { return ym ? ym.replace('-', '年') + '月' : ''; };

  D.clipDate = function (clip) { return clip.dt || '?'; };

  /* ---------- 点歌域 ---------- */
  D.levelOf = function (c) { return c >= 100 ? 5 : c >= 61 ? 4 : c >= 31 ? 3 : c >= 11 ? 2 : 1; };

  D.monthKey = function (d) {
    var t = d || D.today;
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
  };

  /* 当前月份字符串（本地时区） */
  D.thisMonth = function () { return D.monthKey(D.today); };

  window.SUIDomain = D;
})();
