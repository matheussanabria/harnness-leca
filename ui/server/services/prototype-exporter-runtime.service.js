// @ts-check
/**
 * Runtime JS embedded in the exported HTML prototype (EP-16.02).
 * Contains the navigation resolver and a[href] click handling equivalent to the ESM bridge.
 * This runs in the standalone HTML without any build step.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const EXTERNAL_PATTERN = /^(?:https?:\/\/|mailto:|tel:)/i;
const JAVASCRIPT_PATTERN = /^javascript:/i;

/**
 * Resolve a target to a screen or planned.
 * @param {unknown} target
 * @param {string[]} screenIds
 * @returns {{ kind: "screen" | "planned" | "external" | "none", screen: string }}
 */
function resolveScreenTarget(target, screenIds) {
  const raw = typeof target === "string" ? target.trim() : "";
  if (!raw) return { kind: "none", screen: "" };
  if (raw.startsWith("#") || JAVASCRIPT_PATTERN.test(raw)) return { kind: "none", screen: "" };
  if (EXTERNAL_PATTERN.test(raw)) return { kind: "external", screen: "" };

  const path = raw.split(/[?#]/)[0].trim();
  if (!path) return { kind: "none", screen: "" };

  const screen = path
    .replace(/^goto:/i, "")
    .replace(/^\.\/+/, "")
    .replace(/^screens\//i, "")
    .replace(/\.html$/i, "")
    .trim();

  if (!ID_PATTERN.test(screen)) return { kind: "none", screen: "" };

  const known = new Set(screenIds || []);
  return known.has(screen) ? { kind: "screen", screen } : { kind: "planned", screen };
}

/**
 * Generates the runtime JS code as a string for embedding in the exported HTML.
 * @param {string[]} screenIds - List of valid screen IDs in this prototype
 * @returns {string}
 */
function generateRuntimeJs(screenIds) {
  const idsJson = JSON.stringify(screenIds);
  return `
// Prototype export runtime (EP-16.02)
(function() {
  'use strict';
  var knownScreens = ${idsJson};

  var current = knownScreens[0];

  function showScreen(screenId, fromHistory) {
    if (knownScreens.indexOf(screenId) < 0) return;
    current = screenId;
    document.querySelectorAll('.proto-screen-panel').forEach(function(el) {
      el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('data-screen') === screenId) btn.classList.add('active');
    });
    var select = document.getElementById('screenSelect');
    if (select) select.value = screenId;
    var index = knownScreens.indexOf(screenId);
    var prev = document.getElementById('screenPrev');
    var next = document.getElementById('screenNext');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= knownScreens.length - 1;
    var active = document.getElementById('screen-' + screenId);
    if (active) active.style.display = 'block';
    // Back button and deep links: one history entry per screen (#screen-id); skipped when coming from history itself.
    if (!fromHistory && location.hash !== '#' + screenId) {
      try { history.pushState(null, '', '#' + screenId); } catch (e) { location.hash = screenId; }
    }
    window.scrollTo(0, 0);
  }
  window.showScreen = showScreen; // the tab buttons and the screen picker call it from inline handlers
  window.showRelativeScreen = function(step) {
    var target = knownScreens[knownScreens.indexOf(current) + step];
    if (target) showScreen(target);
  };
  function screenFromHash() {
    var id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    return knownScreens.indexOf(id) >= 0 ? id : knownScreens[0];
  }
  window.addEventListener('popstate', function() { showScreen(screenFromHash(), true); });
  window.addEventListener('hashchange', function() { showScreen(screenFromHash(), true); });
  if (location.hash) showScreen(screenFromHash(), true); else showScreen(knownScreens[0], true);

  function showPlannedWarning(screenName) {
    var nav = document.querySelector('.offline-nav-bar');
    if (nav) {
      var existing = nav.querySelector('.proto-planned-warning');
      if (existing) existing.remove();
      var warning = document.createElement('div');
      warning.className = 'proto-planned-warning';
      warning.style.cssText = 'background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:4px;font-size:11px;margin-left:12px;';
      warning.textContent = 'Tela "' + screenName + '" ainda nao existe';
      nav.appendChild(warning);
      setTimeout(function() { warning.remove(); }, 4000);
    }
  }

  var EXTERNAL_PATTERN = /^(?:https?:\\/\\/|mailto:|tel:)/i;
  var JAVASCRIPT_PATTERN = /^javascript:/i;
  var ID_PATTERN = /^[A-Za-z0-9_-]+$/;

  function resolveScreenTarget(target) {
    var raw = typeof target === 'string' ? target.trim() : '';
    if (!raw) return { kind: 'none', screen: '' };
    if (raw.startsWith('#') || JAVASCRIPT_PATTERN.test(raw)) return { kind: 'none', screen: '' };
    if (EXTERNAL_PATTERN.test(raw)) return { kind: 'external', screen: '' };
    var path = raw.split(/[?#]/)[0].trim();
    if (!path) return { kind: 'none', screen: '' };
    var screen = path
      .replace(/^goto:/i, '')
      .replace(/^\\.\\/+/, '')
      .replace(/^screens\\//i, '')
      .replace(/\\.html$/i, '')
      .trim();
    if (!ID_PATTERN.test(screen)) return { kind: 'none', screen: '' };
    var known = new Set(knownScreens);
    return known.has(screen) ? { kind: 'screen', screen: screen } : { kind: 'planned', screen: screen };
  }

  document.addEventListener('click', function(e) {
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action') || '';
      if (action.startsWith('goto:')) {
        e.preventDefault();
        var target = action.replace(/^goto:/, '').trim();
        var resolved = resolveScreenTarget(target);
        if (resolved.kind === 'screen') showScreen(resolved.screen);
        else if (resolved.kind === 'planned') showPlannedWarning(resolved.screen);
        return;
      }
    }

    // Handle raw a[href] links (EP-16.02)
    var linkEl = e.target.closest('a[href]');
    if (linkEl) {
      var href = linkEl.getAttribute('href') || '';
      if (href && !EXTERNAL_PATTERN.test(href) && !href.startsWith('#') && !href.startsWith('?') && !href.startsWith('javascript:')) {
        e.preventDefault();
        var resolved = resolveScreenTarget(href);
        if (resolved.kind === 'screen') showScreen(resolved.screen);
        else if (resolved.kind === 'planned') showPlannedWarning(resolved.screen);
        return;
      }
    }
  });
})();`;
}

module.exports = {
  generateRuntimeJs,
  resolveScreenTarget,
};