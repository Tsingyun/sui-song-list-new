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

  /* ─────────── 页面级岁己装饰 ───────────
     统一在路由层挂载，视图自己不用管：只要注册了视图，就自动获得
     标题区那枚大光环水印（data-page 决定每页的位置/朝向变体）。
     符号本身定义在 css/sui.css 的「岁己符号系统」里。 */
  function decoratePage(container, page) {
    container.insertAdjacentHTML('afterbegin',
      '<span class="sui-watermark" data-page="' + C.esc(page) + '" aria-hidden="true"></span>');
  }

  /* ─────────── 输入框「反自动填充」加固（v3.7.13） ───────────
     背景：Edge / Chrome 会按 id·name·placeholder 猜字段语义，在搜索框聚焦时弹出
     「之前输入过什么」——用户的搜索历史就这样摊在屏幕上，观感很差，且浏览器
     故意不提供真正意义的关闭开关。所以只能叠几层弱手段（见 AGENTS.md §21）：
       ① autocomplete="off"    —— Chromium 对「表单历史」类字段会遵守它
       ② 随机 name              —— 历史按 name 归档；本站输入框原本没有 name、也没有
                                  <form>，全部靠 id 取值，改名零副作用
       ③ autocorrect/autocapitalize/spellcheck 关掉 —— 顺带免掉拼写红波浪与首字母大写
       ④ data-lpignore / data-1p-ignore / data-bwignore / data-form-type=other
                               —— 让 LastPass / 1Password / Bitwarden / Dashlane 跳过
     同 id 在本次会话内保持同一个随机 name（避免每次重渲都换 key 让插件反复识别）。
     这里只加属性、不动输入逻辑：readonly 门控那类强手段会干扰移动端键盘与光标，
     本站在移动端体验优先，故不采用。 */
  var _nafNames = {};
  function _nafName(key) {
    if (!_nafNames[key]) {
      _nafNames[key] = 'naf-' + Math.random().toString(36).slice(2, 10);
    }
    return _nafNames[key];
  }
  C.hardenAutofill = function (root) {
    var scope = root || document;
    var sel = 'input[type="search"], input[type="text"], input[type="date"]';
    Array.prototype.forEach.call(scope.querySelectorAll(sel), function (el) {
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('data-1p-ignore', 'true');
      el.setAttribute('data-bwignore', 'true');
      el.setAttribute('data-form-type', 'other');
      el.setAttribute('name', _nafName(el.id || el.type));
    });
  };

  /* 路由切换钩子：给视图一个「清理自己挂在 body 上的临时浮层」的机会。
     弹层类（#modalRoot 里的）由 closeAllModals 统一收；但视图自己的浮层
     （如点歌页的彩蛋遮罩）不属于弹层体系，不清理就会盖在新页面上 ——
     它只能靠点击自身关闭，于是「换页后点标签」看起来就像没反应。 */
  var routeHooks = [];
  C.onRoute = function (fn) { routeHooks.push(fn); };

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
    for (var h = 0; h < routeHooks.length; h++) {
      try { routeHooks[h](); } catch (e) { /* 钩子失败不该拦住换页 */ }
    }
    if (currentRoute && currentRoute.name !== 'song') {
      /* v3.7.11：记住最近一次非详情路由，歌曲详情「返回」按钮用它回上级 */
      C.lastBrowseRoute = currentRoute;
    }
    fn(parsed.params, container, parsed);
    decoratePage(container, view.page || name);
    C.hardenAutofill(container);   /* v3.7.13：浏览器自动填充/输入历史治理 */
    currentRoute = { name: name, params: parsed.params };
    /* v3.7.11：页面切换淡入（CSS 侧在 reduced-motion 下自动关闭） */
    container.classList.remove('view-in');
    void container.offsetWidth;   /* 强制 reflow，保证连续切换也能重放动画 */
    container.classList.add('view-in');

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
