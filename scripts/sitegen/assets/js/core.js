/* ═══════ 核心：hash 路由 + 视图注册 + DOM 工具 ═══════ */
(function () {
  'use strict';

  var C = {};
  var views = {};         // name -> {render(params, container)}
  var currentRoute = null;

  /* ---------- DOM 助手 ---------- */
  C.esc = function (s) { return window.SUIDomain.esc(s); };

  C.h = function (html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  C.$ = function (sel, root) { return (root || document).querySelector(sel); };
  C.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  C.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /* ---------- 路由 ---------- */
  function parseHash() {
    var hash = location.hash || '#/';
    if (hash.charAt(0) === '#') hash = hash.slice(1);
    if (hash.charAt(0) !== '/') hash = '/' + hash;
    var qIdx = hash.indexOf('?');
    var path = qIdx === -1 ? hash : hash.slice(0, qIdx);
    var query = qIdx === -1 ? '' : hash.slice(qIdx + 1);
    var parts = path.split('/').filter(Boolean);   // ['songs'] or ['song', '名']
    var params = {};
    query.split('&').forEach(function (kv) {
      if (!kv) return;
      var eq = kv.indexOf('=');
      var k = eq === -1 ? kv : kv.slice(0, eq);
      var v = eq === -1 ? '' : kv.slice(eq + 1);
      try { params[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { params[k] = v; }
    });
    return { parts: parts, params: params };
  }

  function routeName(parsed) {
    var p = parsed.parts;
    if (!p.length) return 'home';
    if (p[0] === 'song') return 'song';
    if (views[p[0]]) return p[0];
    return 'home';
  }

  /* 旧站锚点兼容：#lang-日语 -> #/languages?_anchor=日语 */
  function compatHash(hash) {
    var m = hash.match(/^#lang-(.+)$/);
    if (m) {
      var lang;
      try { lang = decodeURIComponent(m[1]); } catch (e) { lang = m[1]; }
      return '#/languages?_anchor=' + encodeURIComponent(lang);
    }
    return null;
  }

  C.buildHash = function (name, params, sub) {
    var path = name === 'home' ? '/' : '/' + name + (sub ? '/' + sub : '');
    var qs = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '' || v === 'all') return;
      if (k === 'page' && String(v) === '1') return;
      qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return '#' + path + (qs.length ? '?' + qs.join('&') : '');
  };

  /* 导航：push（默认，写入历史） */
  C.go = function (name, params, sub) {
    location.hash = C.buildHash(name, params, sub);
  };

  /* 导航：replace（不写历史，用于搜索输入等高频状态；保持滚动位置） */
  var _skipScroll = false;
  C.replace = function (name, params, sub) {
    var url = C.buildHash(name, params, sub);
    history.replaceState(null, '', url);
    _skipScroll = true;
    renderCurrent();
  };

  function renderCurrent() {
    var parsed = parseHash();
    var name = routeName(parsed);
    var container = document.getElementById('view');
    var view = views[name];
    if (!view) return;

    var fn = view.render;
    document.querySelectorAll('#siteNav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === name ||
        (name === 'song' && a.dataset.nav === 'songs'));
    });

    container.innerHTML = '';
    C.tip.hide();
    if (C.closeAllModals) C.closeAllModals();
    fn(parsed.params, container, parsed);
    currentRoute = { name: name, params: parsed.params };

    // 页面标题
    var t = '岁己SUI · 歌单档案';
    if (view.title) {
      var vt = typeof view.title === 'function' ? view.title(parsed.params, parsed) : view.title;
      if (vt) t = vt + ' · 岁己SUI 歌单档案';
    }
    document.title = t;

    var skip = _skipScroll;
    _skipScroll = false;
    if (!skip) window.scrollTo(0, 0);

    // 语言视图锚点（#/languages?_anchor=日语）
    if (parsed.params._anchor) {
      var anchor = document.getElementById('lang-' + parsed.params._anchor) ||
        document.getElementById(parsed.params._anchor);
      if (anchor) anchor.scrollIntoView({ block: 'start' });
    }
  }

  window.addEventListener('hashchange', function () {
    var compat = compatHash(location.hash);
    if (compat) { location.replace(compat); return; }
    renderCurrent();
  });

  C.registerView = function (name, view) { views[name] = view; };

  /* 语言视图锚点滚动（#/languages#lang-日语） */
  C.scrollToAnchor = function (id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  C.currentRoute = function () { return currentRoute; };

  /* ---------- Toast / Tooltip ---------- */
  C.toast = function (text) {
    var root = document.getElementById('toastRoot');
    var el = C.h('<div class="toast">' + C.esc(text) + '</div>');
    root.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 1600);
    setTimeout(function () { el.remove(); }, 2000);
  };

  var tipEl = null, tipHide = null;
  C.tip = {
    show: function (html, x, y) {
      tipEl = tipEl || document.getElementById('globalTip');
      tipEl.innerHTML = html;
      tipEl.hidden = false;
      tipEl.style.left = '0px'; tipEl.style.top = '0px';
      var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      var left = Math.min(Math.max(8, x), window.innerWidth - w - 8);
      var top = y + 12;
      if (top + h > window.innerHeight - 8) top = y - h - 10;
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
    },
    hide: function () {
      if (tipHide) clearTimeout(tipHide);
      tipHide = setTimeout(function () { if (tipEl) tipEl.hidden = true; }, 120);
    },
    keep: function () { if (tipHide) clearTimeout(tipHide); }
  };
  document.addEventListener('mousemove', function (e) {
    if (tipEl && !tipEl.hidden) {
      var overTip = e.target.closest && e.target.closest('#globalTip');
      if (!overTip) return;
    }
  });

  /* 复制 */
  C.copy = function (text, okMsg) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        C.toast(ok ? (okMsg || '已复制') : '复制失败，请手动选择');
      } catch (err) { C.toast('复制失败'); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { C.toast(okMsg || '已复制'); }, fallback);
      } else fallback();
    } catch (err) { fallback(); }
  };

  /* 歌曲复制文案（与旧系统一致） */
  C.songCopyText = function (song) {
    var ds = window.SUIDomain.dates()[song.name] || [];
    var last = ds.length ? ds[ds.length - 1] : (song.last || '—');
    var total = ds.length ? '｜共演唱' + ds.length + '次' : '';
    return '🎵 ' + song.name + '｜最近演唱：' + last + total;
  };

  window.SUICore = C;
})();
