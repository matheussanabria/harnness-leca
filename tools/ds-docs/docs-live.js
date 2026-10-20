// @ts-check
"use strict";

/**
 * Exemplos vivos do site do DS: no modo Iniciar (ou fora do Ateliê) cada `.dx-stage__inner[data-demo]` é
 * substituído por uma renderização React real do componente (bundle `window.DS` + demos do DOCS), e volta ao HTML
 * estático editável quando o modo de execução termina.
 */

const REACT = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
const REACT_DOM = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js";

const LIVE_SCRIPT = `
(function () {
  var live = false, roots = [], saved = [], observers = [], queue = null;
  function loadLibs(done) {
    if (window.React && window.ReactDOM && window.DS) return done();
    if (queue) { queue.push(done); return; }
    queue = [done];
    function add(src, next) { var t = document.createElement("script"); t.src = src; t.onload = next; document.head.appendChild(t); }
    add("${REACT}", function () {
      add("${REACT_DOM}", function () {
        try { (0, eval)(document.getElementById("ds-bundle-src").textContent); } catch (e) { console.error("[ds]", e); }
        var waiting = queue; queue = null; waiting.forEach(function (f) { f(); });
      });
    });
  }
  function fit(inner) {
    var stage = inner.closest(".dx-stage"), wrap = inner.parentNode;
    if (!stage || wrap === stage) return;
    var scale = Math.min(1, stage.clientWidth / 1440);
    inner.style.transform = "scale(" + scale + ")";
    wrap.style.height = Math.ceil(inner.offsetHeight * scale) + "px";
  }
  function render(inner, data) {
    var code = data.demos[inner.getAttribute("data-demo")];
    if (!code) return;
    saved.push([inner, inner.innerHTML]);
    try {
      var node = new Function("React", "ReactDOM", data.prelude + "\\n" + code)(window.React, window.ReactDOM);
      var root = window.ReactDOM.createRoot(inner);
      root.render(node);
      roots.push(root);
      if (window.ResizeObserver) { var ro = new ResizeObserver(function () { fit(inner); }); ro.observe(inner); observers.push(ro); }
      setTimeout(function () { fit(inner); }, 60);
    } catch (e) { console.error("[ds]", e); inner.innerHTML = saved.pop()[1]; }
  }
  function enter() {
    if (live) return;
    live = true;
    loadLibs(function () {
      if (!live) return;
      var data = JSON.parse(document.getElementById("ds-demos").textContent);
      document.querySelectorAll(".dx-stage__inner[data-demo]").forEach(function (inner) { render(inner, data); });
    });
  }
  function leave() {
    if (!live) return;
    live = false;
    observers.forEach(function (o) { o.disconnect(); }); observers = [];
    roots.forEach(function (r) { try { r.unmount(); } catch (e) {} }); roots = [];
    saved.forEach(function (pair) { pair[0].innerHTML = pair[1]; }); saved = [];
  }
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (data && data.type === "HARNESS_PROTO_MODE") { if (data.mode === "play") enter(); else leave(); }
  });
  if (window.parent === window) document.addEventListener("DOMContentLoaded", enter);
})();
`;

const safe = (text) => text.replace(/<\/script/gi, "<\\/script");

/** Trechos de <head> com o bundle do DS, os demos e o script que os executa. */
function liveHead(docs) {
  const demos = JSON.stringify({ prelude: docs.prelude || "", demos: docs.demos || {} }).replace(/</g, "\\u003c");
  return `<script type="text/plain" id="ds-bundle-src">${safe(docs.bundleJs || "")}</script>
<script type="application/json" id="ds-demos">${demos}</script>
<script>${safe(LIVE_SCRIPT)}</script>
`;
}

/** Marca o palco de cada página com o demo que o alimenta (ids do menu = nome do demo em minúsculas). */
function markDemo(pageHtml, id, demos) {
  const key = Object.keys(demos || {}).find((name) => name.toLowerCase() === id);
  return key ? pageHtml.replace(/class="dx-stage__inner ds"/, `class="dx-stage__inner ds" data-demo="${key}"`) : pageHtml;
}

module.exports = { liveHead, markDemo };
