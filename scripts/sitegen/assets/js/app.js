/* ═══════ 应用入口 ═══════ */
(function () {
  'use strict';
  if (!window.SUI || !window.SUI.songs) {
    document.getElementById('view').innerHTML =
      '<div class="empty"><p>数据加载失败：window.SUI 不存在。请重新构建网站。</p></div>';
    return;
  }
  window.SUIComponents.bindGlobal();
  // 首次渲染：core.js 的 hashchange 监听已在各视图注册后待命
  window.dispatchEvent(new Event('hashchange'));
})();
