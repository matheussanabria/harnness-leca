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

  function showScreen(screenId) {
    document.querySelectorAll('.proto-screen-panel').forEach(function(el) {
      el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick').indexOf("'" + screenId + "'") !== -1) btn.classList.add('active');
    });
    var active = document.getElementById('screen-' + screenId);
    if (active) active.style.display = 'block';
  }
  window.showScreen = showScreen; // the tab buttons call it from an inline onclick

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