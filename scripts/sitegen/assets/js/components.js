/* ═══════ 组件：播放器 / 弹层框架 / 盲盒 / 我要补充 / 导出 / 页脚 ═══════ */
(function () {
  'use strict';
  var C = window.SUICore, D = window.SUIDomain;
  var esc = C.esc;

  /* ═══════ 弹层框架 ═══════ */
  var modalStack = [];
  C.openModal = function (opts) {
    // opts: {kicker, title, body (Node|string), wide, onClose}
    var root = document.getElementById('modalRoot');
    var overlay = C.h(
      '<div class="overlay" role="dialog" aria-modal="true">' +
      '<div class="modal' + (opts.wide ? ' wide' : '') + '">' +
      '<div class="modal-head">' +
      (opts.kicker ? '<span class="modal-kicker">' + esc(opts.kicker) + '</span>' : '') +
      '<h3>' + esc(opts.title || '') + '</h3>' +
      '<button type="button" class="modal-x" aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="modal-body"></div>' +
      '</div></div>'
    );
    var body = overlay.querySelector('.modal-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    function close() {
      overlay.remove();
      modalStack = modalStack.filter(function (m) { return m !== api; });
      document.body.style.overflow = modalStack.length ? 'hidden' : '';
      if (opts.onClose) opts.onClose();
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.modal-x').addEventListener('click', close);
    var api = { close: close, overlay: overlay, body: body };
    modalStack.push(api);
    root.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    var focusable = body.querySelector('input, select, textarea, button');
    if (focusable) focusable.focus();
    return api;
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  });
  C.closeAllModals = function () {
    while (modalStack.length) modalStack[modalStack.length - 1].close();
  };

  /* ═══════ 浮动播放器 ═══════ */
  var player = {
    song: null, clipIdx: 0, maximized: false, savedPos: null
  };
  var els = {};

  function playerUrl(bv) {
    return 'https://player.bilibili.com/player.html?bvid=' + bv + '&autoplay=1&high_quality=1&danmaku=0';
  }

  C.openPlayer = function (song, clipIdx) {
    if (!song || !song.bili || !song.bili.length) return;
    player.song = song;
    player.clipIdx = clipIdx || 0;
    els.panel = els.panel || document.getElementById('playerPanel');
    showClip();
    els.panel.hidden = false;
    document.getElementById('backTop').classList.remove('visible');
  };

  function showClip() {
    var song = player.song;
    var clip = song.bili[player.clipIdx];
    els.panel = els.panel || document.getElementById('playerPanel');
    document.getElementById('playerSongName').textContent = song.name;
    document.getElementById('playerSongMeta').textContent =
      (song.artist || '—') + ' · ' + (clip.dt || '') + (clip.d ? ' · ' + D.fmtDur(clip.d) : '');
    var link = document.getElementById('playerBiliLink');
    link.href = 'https://www.bilibili.com/video/' + clip.bv;
    var sel = document.getElementById('playerClipSelect');
    if (song.bili.length > 1) {
      sel.style.display = '';
      sel.innerHTML = song.bili.map(function (c, i) {
        return '<option value="' + i + '"' + (i === player.clipIdx ? ' selected' : '') + '>' +
          esc((c.dt || '?') + (c.d ? ' ' + D.fmtDur(c.d) : '')) + '</option>';
      }).join('');
    } else {
      sel.style.display = 'none';
    }
    document.getElementById('playerIframe').src = playerUrl(clip.bv);
  }

  function closePlayer() {
    els.panel = els.panel || document.getElementById('playerPanel');
    els.panel.hidden = true;
    var iframe = document.getElementById('playerIframe');
    setTimeout(function () { if (els.panel.hidden) iframe.src = ''; }, 300);
    player.song = null;
    setMaximized(false);
  }

  function setMaximized(on) {
    player.maximized = on;
    els.panel = els.panel || document.getElementById('playerPanel');
    els.panel.classList.toggle('maximized', on);
    if (!on) {
      els.panel.style.left = ''; els.panel.style.top = '';
      els.panel.style.right = ''; els.panel.style.bottom = '';
    }
    var mb = document.getElementById('playerMaximize');
    mb.textContent = on ? '⤡' : '⤢';
    mb.title = on ? '还原' : '放大';
  }

  function bindPlayer() {
    els.panel = document.getElementById('playerPanel');
    document.getElementById('playerClose').addEventListener('click', closePlayer);
    document.getElementById('playerClipSelect').addEventListener('change', function () {
      player.clipIdx = parseInt(this.value, 10);
      showClip();
    });
    document.getElementById('playerMaximize').addEventListener('click', function () {
      setMaximized(!player.maximized);
    });

    /* 拖拽（桌面 + 触屏） */
    var bar = document.getElementById('playerDrag');
    var dragging = false, dx = 0, dy = 0;
    function start(e) {
      if (e.target.closest('.player-btn, .player-select, .player-link, a, button')) return;
      dragging = true;
      var rect = els.panel.getBoundingClientRect();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      dx = cx - rect.left; dy = cy - rect.top;
      els.panel.style.right = 'auto';
      els.panel.style.bottom = 'auto';
      els.panel.style.left = rect.left + 'px';
      els.panel.style.top = rect.top + 'px';
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      var nx = Math.max(8, Math.min(cx - dx, vw - els.panel.offsetWidth - 8));
      /* 下界不能是 8：顶栏永远可点（z=910），播放器若能被拖到顶栏带上就会盖住
         导航 —— 又是「点标签没反应」。这里按当前顶栏高度把上界让出来。 */
      var ny = Math.max(headHeight() + 8, Math.min(cy - dy, vh - 60));
      els.panel.style.left = nx + 'px';
      els.panel.style.top = ny + 'px';
      e.preventDefault();
    }
    function end() { dragging = false; }
    bar.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    bar.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }

  /* ═══════ 盲盒 ═══════ */
  function openBlindbox() {
    var songs = D.songs();
    var api = C.openModal({
      kicker: 'BLIND BOX',
      title: '随机一首',
      body: '<div class="rnd-slot mono" style="height:3.2rem;overflow:hidden;border:1px solid var(--line);border-radius:5px;position:relative;background:var(--paper);">' +
        '<div class="rnd-reel" style="transition:transform 2.4s cubic-bezier(.15,.8,.25,1);"></div>' +
        '<div class="rnd-hint" style="position:absolute;inset:0;display:grid;place-items:center;background:var(--paper);font-size:var(--fs-sm);color:var(--ink-3);letter-spacing:.08em;transition:opacity .25s ease;">' +
        '? ? ? &nbsp;·&nbsp; 共 ' + D.fmtInt(songs.length) + ' 首 · 点击「抽一首」开始</div>' +
        '</div>' +
        '<div class="rnd-result" aria-live="polite" style="display:none;margin-top:1.2rem;text-align:center;">' +
        '<div class="rnd-name" style="font-family:var(--serif);font-size:1.7rem;font-weight:900;"></div>' +
        '<div class="rnd-meta mono" style="font-size:var(--fs-sm);color:var(--ink-3);margin-top:.3rem;"></div>' +
        '<div class="rnd-actions" style="display:flex;gap:.5rem;justify-content:center;margin-top:1rem;"></div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:1.2rem;"><button type="button" class="btn btn-primary" id="rndDraw">抽一首</button></div>'
    });
    var reel = api.body.querySelector('.rnd-reel');
    var hint = api.body.querySelector('.rnd-hint');
    var btn = api.body.querySelector('#rndDraw');
    var result = api.body.querySelector('.rnd-result');
    var rolling = false;

    /* 滚动单元：只放无信息量的音符符号，
       抽取前与滚动过程中都不出现任何真实歌名，结果只在动画结束后揭晓 */
    var GLYPHS = ['♪', '♫', '♩', '♬'];
    function fillMask(n) {
      var html = '';
      for (var i = 0; i < n; i++) {
        html += '<div style="height:3.2rem;display:grid;place-items:center;font-size:1.35rem;color:var(--line-strong);">' +
          GLYPHS[i % GLYPHS.length] + '</div>';
      }
      reel.innerHTML = html;
    }

    function pick() {
      return songs[Math.floor(Math.random() * songs.length)];
    }

    function roll(steps, done) {
      fillMask(steps + 1);
      reel.style.transition = 'none';
      reel.style.transform = 'translateY(0)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          reel.style.transition = 'transform 2.4s cubic-bezier(.15,.8,.25,1)';
          reel.style.transform = 'translateY(-' + steps * 3.2 + 'rem)';
        });
      });
      setTimeout(done, 2500);
    }

    function showResult(picked) {
      result.style.display = '';
      result.querySelector('.rnd-name').textContent = picked.name;
      result.querySelector('.rnd-meta').textContent =
        (picked.artist || '—') + ' · ' + picked.lang + ' · ' + D.tierName(picked.count) +
        ' · 演唱 ' + picked.count + ' 次';
      var actions = result.querySelector('.rnd-actions');
      actions.innerHTML = '';
      if (picked.bili && picked.bili.length) {
        var play = C.h('<button type="button" class="btn btn-primary">▶ 播放这首歌</button>');
        play.addEventListener('click', function () { api.close(); C.openPlayer(picked, 0); });
        actions.appendChild(play);
      } else {
        var search = C.h('<button type="button" class="btn">↗ 在B站搜索</button>');
        search.addEventListener('click', function () {
          openExternal('https://search.bilibili.com/all?keyword=' +
            encodeURIComponent('岁己SUI ' + picked.name + ' 歌切'));
        });
        actions.appendChild(search);
      }
    }

    btn.addEventListener('click', function () {
      if (rolling) return;
      rolling = true;
      btn.disabled = true;
      btn.textContent = '抽取中…';
      result.style.display = 'none';
      hint.style.opacity = '0';
      var picked = pick();
      roll(24, function () {
        showResult(picked);
        btn.disabled = false;
        btn.textContent = '再抽一次';
        rolling = false;
      });
    });
  }

  /* 外链打开（弹窗拦截兜底：动态 <a> 点击） */
  function openExternal(url) {
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  C.openExternal = openExternal;

  /* ═══════ 我要补充 ═══════ */
  function detectLang(text) {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return '日语';
    if (/[\uac00-\ud7af]/.test(text)) return '韩语';
    if (/^[a-zA-Z0-9\s.,'!?&\-()]+$/.test(text.trim())) return '英文';
    if (/[\u4e00-\u9fff]/.test(text)) return '中文';
    return '其他';
  }

  async function lookupArtist(name) {
    try {
      var r = await fetch('https://musicbrainz.org/ws/2/recording/?query=' +
        encodeURIComponent(name) + '&limit=5&fmt=json', { headers: { Accept: 'application/json' } });
      if (r.ok) {
        var d = await r.json();
        if (d.recordings && d.recordings.length && d.recordings[0]['artist-credit']) {
          var n = d.recordings[0]['artist-credit'].map(function (a) { return a.name || (a.artist && a.artist.name) || ''; }).join('');
          if (n) return { artist: n, source: 'MusicBrainz' };
        }
      }
    } catch (e) { /* ignore */ }
    try {
      var r2 = await fetch('https://music.163.com/api/search/get/web?s=' +
        encodeURIComponent(name) + '&type=1&limit=3&offset=0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://music.163.com' }
      });
      if (r2.ok) {
        var d2 = await r2.json();
        if (d2.result && d2.result.songs && d2.result.songs.length) {
          var artists = (d2.result.songs[0].artists || []).map(function (a) { return a.name; }).join('/');
          if (artists) return { artist: artists, source: 'Netease Music' };
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function openContribute() {
    var body = C.h(
      '<div>' +
      '<label style="display:block;font-size:var(--fs-sm);color:var(--ink-2);margin-bottom:.3rem;">歌曲名 *</label>' +
      '<div style="display:flex;gap:.5rem;"><input id="cbSong" type="text" placeholder="歌名" style="flex:1;padding:.5rem .8rem;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface);font-size:16px;">' +
      '<button type="button" class="btn btn-sm" id="cbLookup">联网匹配</button></div>' +
      '<div id="cbExisting" style="display:none;margin-top:.5rem;font-size:var(--fs-sm);color:var(--green);background:rgba(var(--green-rgb),.07);border:1px solid rgba(var(--green-rgb),.3);border-radius:4px;padding:.4rem .7rem;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-top:1rem;">' +
      '<div><label style="display:block;font-size:var(--fs-sm);color:var(--ink-2);margin-bottom:.3rem;">演唱日期 *</label>' +
      '<input id="cbDate" type="date" style="width:100%;padding:.45rem .6rem;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface);font-size:16px;"></div>' +
      '<div><label style="display:block;font-size:var(--fs-sm);color:var(--ink-2);margin-bottom:.3rem;">语言</label>' +
      '<select id="cbLang" style="width:100%;padding:.45rem .6rem;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface);">' +
      '<option>中文</option><option>日语</option><option>英文</option><option>韩语</option><option>其他</option></select></div></div>' +
      '<div style="margin-top:1rem;"><label style="display:block;font-size:var(--fs-sm);color:var(--ink-2);margin-bottom:.3rem;">原唱 * <span class="mono" id="cbSource" style="color:var(--ink-3);font-size:var(--fs-xs);"></span></label>' +
      '<input id="cbArtist" type="text" placeholder="原唱歌手" style="width:100%;padding:.5rem .8rem;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface);font-size:16px;"></div>' +
      '<div id="cbStatus" style="display:none;margin-top:.8rem;font-size:var(--fs-sm);"></div>' +
      '<button type="button" class="btn btn-primary" id="cbSubmit" style="display:none;margin-top:1rem;width:100%;">生成 GitHub Issue</button>' +
      '<p style="font-size:var(--fs-xs);color:var(--ink-3);margin-top:.8rem;">提交后会打开 GitHub Issue 预填页面，确认后即可共创补充。维护者合并后网站自动重建。</p>' +
      '</div>'
    );
    var api = C.openModal({ kicker: 'CONTRIBUTE', title: '我要补充', body: body });
    var songInput = body.querySelector('#cbSong');
    var dateInput = body.querySelector('#cbDate');
    var artistInput = body.querySelector('#cbArtist');
    var langSel = body.querySelector('#cbLang');
    var existing = body.querySelector('#cbExisting');
    var status = body.querySelector('#cbStatus');
    var submit = body.querySelector('#cbSubmit');
    var source = body.querySelector('#cbSource');
    var now = new Date();
    dateInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    body.querySelector('#cbLookup').addEventListener('click', async function () {
      var name = songInput.value.trim();
      if (!name) { songInput.focus(); return; }
      var hit = D.findSong(name);
      if (hit) {
        existing.style.display = '';
        existing.textContent = '《' + hit.name + '》已收录 · 原唱 ' + (hit.artist || '未知') +
          ' · 演唱 ' + hit.count + ' 次 · 最近 ' + (hit.last || '?');
      } else existing.style.display = 'none';

      var btn = this;
      btn.disabled = true;
      btn.textContent = '匹配中…';
      var result = await lookupArtist(name);
      btn.disabled = false;
      btn.textContent = '联网匹配';
      if (result) {
        artistInput.value = result.artist;
        source.textContent = '· 来源 ' + result.source;
        langSel.value = detectLang(result.artist);
        submit.style.display = '';
      } else {
        source.textContent = '· 未找到，请手动填写';
        submit.style.display = '';
      }
    });
    songInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); body.querySelector('#cbLookup').click(); }
    });
    submit.addEventListener('click', function () {
      var name = songInput.value.trim();
      var date = dateInput.value;
      var artist = artistInput.value.trim();
      if (!name || !date) { show('请填写歌曲名和日期', true); return; }
      if (!artist) { show('请填写原唱歌手', true); return; }
      var bodyText = '## 歌曲信息\n\n' +
        '- **歌曲名**: ' + name + '\n' +
        '- **原唱**: ' + artist + '\n' +
        '- **演唱日期**: ' + date + '\n' +
        '- **语言**: ' + langSel.value + '\n' +
        (source.textContent && source.textContent.indexOf('来源') === 0 ?
          '- **匹配来源**: ' + source.textContent.replace('· 来源 ', '') + '\n' : '') +
        '\n---\n_由网站「我要补充」功能提交_';
      var url = 'https://github.com/Tsingyun/sui-song-list-new/issues/new?' +
        'title=' + encodeURIComponent('[补充歌曲] ' + name) +
        '&body=' + encodeURIComponent(bodyText) +
        '&labels=contribution,song-data';
      openExternal(url);
      show('已在新窗口打开 GitHub，请确认并提交 Issue');
    });
    function show(text, isErr) {
      status.style.display = '';
      status.textContent = text;
      status.style.color = isErr ? 'var(--accent-deep)' : 'var(--green)';
    }
  }

  /* ═══════ 导出（当前筛选结果） ═══════ */
  C.bindExport = function (wrap, getFiltered) {
    var btn = wrap.querySelector('.export-btn');
    var pop = C.h(
      '<div class="export-pop" hidden>' +
      '<button type="button" data-fmt="csv">CSV<span class="mono">.csv</span></button>' +
      '<button type="button" data-fmt="json">JSON<span class="mono">.json</span></button>' +
      '<button type="button" data-fmt="xlsx">Excel<span class="mono">.xlsx</span></button>' +
      '</div>'
    );
    wrap.appendChild(pop);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
    });
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) pop.hidden = true;
    });

    function exportRows() {
      return getFiltered().map(function (s, i) {
        return [i + 1, s.name, s.t || '', s.artist || '', s.lang || '', s.count,
          (s.tags || []).join('/'), s.first || '', s.last || ''];
      });
    }
    var header = ['序号', '歌曲名', '译名', '原唱', '语言', '演唱次数', '标签', '首次', '最近'];

    pop.addEventListener('click', function (e) {
      var fmt = e.target.closest('button') && e.target.closest('button').dataset.fmt;
      if (!fmt) return;
      pop.hidden = true;
      var songs = getFiltered();
      if (!songs.length) { C.toast('当前筛选结果为空'); return; }

      if (fmt === 'csv') {
        var csv = '\uFEFF' + header.join(',') + '\n' + exportRows().map(function (r) {
          return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'sui_song_list.csv');
      } else if (fmt === 'json') {
        var json = JSON.stringify({
          total: songs.length,
          exported: new Date().toISOString(),
          songs: songs.map(function (s) {
            return { name: s.name, translated: s.t || '', artist: s.artist || '', lang: s.lang || '',
              count: s.count, tags: s.tags || [], first: s.first || '', last: s.last || '' };
          })
        }, null, 2);
        download(new Blob([json], { type: 'application/json;charset=utf-8' }), 'sui_song_list.json');
      } else if (fmt === 'xlsx') {
        loadSheetJS(function () {
          var rows = exportRows().map(function (r) {
            var o = {};
            header.forEach(function (h, i) { o[h] = r[i]; });
            return o;
          });
          var ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, '歌单');
          XLSX.writeFile(wb, 'sui_song_list.xlsx');
        });
      }
      C.toast('已导出 ' + songs.length + ' 首');
    });
  };

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  var sheetjsLoading = false;
  function loadSheetJS(cb) {
    if (typeof XLSX !== 'undefined') { cb(); return; }
    if (sheetjsLoading) { setTimeout(function () { loadSheetJS(cb); }, 300); return; }
    sheetjsLoading = true;
    C.toast('正在加载 Excel 组件…');
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = function () { sheetjsLoading = false; cb(); };
    s.onerror = function () { sheetjsLoading = false; C.toast('Excel 组件加载失败，请检查网络'); };
    document.head.appendChild(s);
  }

  /* ═══════ 页脚 ═══════ */
  function renderFooter() {
    var S = D.stats();
    var R = D.requests().meta;
    var foot = document.getElementById('siteFoot');
    foot.innerHTML =
      '<div class="site-foot-inner">' +
      '<div class="foot-col"><h4>SUI SONG ARCHIVE</h4>' +
      '<p class="foot-span">' + esc(S.first.slice(0, 7).replace('-', '.')) + ' — ' + esc(S.last.slice(0, 7).replace('-', '.')) + '</p>' +
      '<p>收录歌曲 ' + D.fmtInt(S.total) + ' 首 · 演唱 ' + D.fmtInt(S.performances) + ' 次 · 点歌 ' + D.fmtInt(R.total) + ' 次</p>' +
      '<span class="foot-ver">界面版本 v3.7.7</span></div>' +
      '<div class="foot-col"><h4>数据来源</h4><ul>' +
      '<li><a href="https://www.suijisui.space" target="_blank" rel="noopener">suijisui.space</a>（PQL87/sui-song-list）</li>' +
      '<li><a href="#/requests">点歌统计（已并入本站）</a> · 源自直播间点歌记录</li>' +
      '<li>岁己SUI 的 B站 投稿合集</li></ul></div>' +
      '<div class="foot-col"><h4>参与</h4><ul>' +
      '<li><a href="#/about">更新日志与说明</a></li>' +
      '<li><a href="https://github.com/Tsingyun/sui-song-list-new" target="_blank" rel="noopener">项目源码 GitHub</a></li>' +
      '<li><a href="#" id="footContribute">我要补充歌曲</a></li></ul></div>' +
      '</div>' +
      /* 角色署名条：全站每页在页脚都遇到「岁己本人」。
         与首页铭牌分工 —— 首页回答"她是谁"（种族/出道/生日），
         这里回答"我们是谁"（粉丝名/口味/应援口号），文案均取自官方资料 */
      '<div class="foot-sign"><div class="foot-sign-inner">' +
      '<span class="sui-facts">' +
      '<span><i class="sui-cookie" aria-hidden="true"></i>粉丝名 饼干岁</span>' +
      '<span><i class="sui-chili" aria-hidden="true"></i>三餐无辣不欢</span>' +
      '<span>银喉长尾山雀 · 出道 2022.09.04</span>' +
      '</span>' +
      '<span class="foot-sign-quote">「可以邀请你跟我一起飞行吗？」</span>' +
      '</div></div>' +
      '<div class="foot-base"><div class="foot-base-inner">' +
      '<span><img class="foot-bird" src="assets/sui-bird.png" alt="" aria-hidden="true">suijisui.uk</span>' +
      '<span><span class="foot-sakura" aria-hidden="true"></span>为虚拟主播 岁己SUI 而建 · 小岁小岁我们喜欢你</span>' +
      '</div></div>';
    foot.querySelector('#footContribute').addEventListener('click', function (e) {
      e.preventDefault();
      openContribute();
    });
  }

  /* ═══════ 顶栏高度同步 ═══════
     顶栏高度不是常数（Google Fonts 异步替换会改行高、窄屏导航可能换行），
     而它下面挂着两个消费者：语言页锚点条的 sticky top（views.css 的 --head-h）
     与弹层的 max-height。这里实测写回 CSS 变量，别处一律引用变量。 */
  function headHeight() {
    var head = document.querySelector('.site-head');
    return head ? head.offsetHeight : 58;
  }
  function syncHeadHeight() {
    document.documentElement.style.setProperty('--head-h', headHeight() + 'px');
  }

  /* ═══════ 主题切换（浅色 / 深色）═══════
     初始 data-theme 由 skeleton.html 的 head 内联脚本写好（防闪烁），
     这里只负责按钮交互与记忆。存储键 sui-theme：'light' | 'dark'。
     用户主动切换过就永久记住；没切换过则跟随系统（引导脚本已处理）。 */
  function initTheme() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    function isDark() {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    function syncBtn() {
      var dark = isDark();
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    }
    syncBtn();
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('sui-theme', next); } catch (e) {}
      syncBtn();
    });
  }

  /* ═══════ 全局绑定 ═══════ */
  function bindGlobal() {
    bindPlayer();
    renderFooter();
    syncHeadHeight();
    initTheme();
    window.addEventListener('resize', C.debounce(syncHeadHeight, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeadHeight);
    document.getElementById('globalRandom').addEventListener('click', openBlindbox);
    document.getElementById('globalContribute').addEventListener('click', openContribute);
    C.openBlindbox = openBlindbox;
    C.openContribute = openContribute;

    var backTop = document.getElementById('backTop');
    window.addEventListener('scroll', function () {
      backTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.SUIComponents = { bindGlobal: bindGlobal };
})();
