// @ts-check
// Renderização de protótipos DC (.dc.html importados): template + lógica + runtime do Claude Design, tudo local.
const crypto = require("crypto");
const { VENDOR_URL, MAX_ASSET_BYTES, DC_REACT_URL, DC_REACT_DOM_URL } = require("./dc-runtime-config.service");
const { decodeAttr, encodeAttr } = require("./dc-artifact-parser.service");
const { readManifest } = require("./dc-inspection-writer.service");
const { tableSafeDcTemplate } = require("./dc-template-runtime.service");
const { loadSandboxAssets, loadBridgeScript, buildSandboxHeaders } = require("./prototype-sandbox-common.service");

/** @param {unknown} value */
function jsLiteral(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Troca o default de startScreen no data-props da lógica. O estado inicial do componente é
 * criado a partir desse valor na construção, então precisa estar certo antes do boot
 * (depois do boot, __dcSetProps não altera o state).
 * @param {string} logicAttrs
 * @param {string} target
 */
function withStartScreen(logicAttrs, target) {
  return logicAttrs.replace(/data-props="([^"]*)"/i, (full, raw) => {
    let props;
    try {
      props = JSON.parse(decodeAttr(raw));
    } catch {
      return full;
    }
    if (!props || !props.startScreen) return full;
    props.startScreen = { ...props.startScreen, default: target };
    return `data-props="${encodeAttr(JSON.stringify(props))}"`;
  });
}

/** Selects a documentation page for DC applications that keep routing in `state.page`. */
function withInitialPage(logic, target) {
  if (!target || !/\bpage\s*:\s*['"][^'"]+['"]/.test(logic)) return logic;
  const page = String(target).replace(/[^a-zA-Z0-9_-]/g, "");
  return logic
    .replace(/\bpage\s*:\s*(['"])[^'"]+\1/, `page: '${page}'`)
    .replace(/componentDidMount\(\)\s*\{[^\r\n]*localStorage\.getItem\('ds2\.page'\)[^\r\n]*\}/, "componentDidMount() {}");
}

/**
 * Troca cada referência de asset relativo pelo data URI do arquivo (img-src aceita data:).
 * @param {string} text
 * @param {{ assets?: {ref: string, file: string, mime: string}[] }} manifest
 * @param {string} dcDir
 * @param {object} deps
 * @param {string[]} warnings
 */
function inlineDcAssets(text, manifest, dcDir, deps, warnings) {
  let out = text;
  for (const asset of manifest.assets || []) {
    const file = deps.path.join(dcDir, "assets", asset.file);
    if (!deps.fs.existsSync(file)) continue;
    if (deps.fs.statSync(file).size > MAX_ASSET_BYTES) {
      warnings.push(`Asset acima de ${MAX_ASSET_BYTES} bytes não foi embutido: ${asset.ref}`);
      continue;
    }
    const uri = `data:${asset.mime};base64,${deps.fs.readFileSync(file).toString("base64")}`;
    out = out.split(`"${asset.ref}"`).join(`"${uri}"`)
      .split(`'${asset.ref}'`).join(`'${uri}'`)
      .split(`(${asset.ref})`).join(`(${uri})`);
  }
  return out;
}

/** Marca cada nó renderizado com data-pid estável: tpl do template + caminho de índices no DOM. */
const PID_SCRIPT = `(function(){function tag(){var els=document.querySelectorAll('[data-dc-tpl]');for(var i=0;i<els.length;i++){var el=els[i];if(el.hasAttribute('data-pid'))continue;var path=[],n=el;while(n&&n!==document.body&&n.nodeType===1){var p=n.parentElement;path.unshift(p?Array.prototype.indexOf.call(p.children,n):0);n=p;}el.setAttribute('data-pid','dc-'+el.getAttribute('data-dc-tpl')+'-'+path.join('.'));}}tag();new MutationObserver(function(){clearTimeout(window.__dcPidT);window.__dcPidT=setTimeout(tag,30);}).observe(document.body,{childList:true,subtree:true});})();`;

/**
 * Renderiza uma tela de protótipo DC.
 * @param {string} projectDir
 * @param {string} protoDir
 * @param {string} protoId
 * @param {any} protoManifest
 * @param {string | undefined} screenId
 * @param {object} deps
 */
function renderDcScreen(projectDir, protoDir, protoId, protoManifest, screenId, deps) {
  const dcDir = deps.path.join(protoDir, "dc");
  const manifest = readManifest(protoDir);
  if (!manifest) return { ok: false, status: 500, error: `Protótipo '${protoId}' sem manifesto DC.` };

  const screens = Array.isArray(manifest.screens) ? manifest.screens : [];
  const target = screenId || manifest.defaultScreen || screens[0] || null;
  if (screens.length && !screens.includes(target)) {
    return { ok: false, status: 404, error: `Tela '${target}' não encontrada no protótipo '${protoId}'.` };
  }

  const warnings = [];
  const read = (file) => deps.fs.readFileSync(deps.path.join(dcDir, file), "utf8");
  const template = tableSafeDcTemplate(inlineDcAssets(read("template.html"), manifest, dcDir, deps, warnings));
  const helmet = inlineDcAssets(read("helmet.html"), manifest, dcDir, deps, warnings);
  const logic = withInitialPage(read("logic.js"), target);
  const { protoCss } = loadSandboxAssets(projectDir, protoDir, deps);
  const bridgeScript = loadBridgeScript(deps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const title = protoManifest?.title || protoId;
  const logicAttrs = target ? withStartScreen(manifest.logicAttrs || "", target) : (manifest.logicAttrs || "");

  // Aponta o runtime para os arquivos vendorizados (mesma origem), sem SRI de CDN.
  const resources = {
    [DC_REACT_URL]: `${VENDOR_URL}/react.production.min.js`,
    [DC_REACT_DOM_URL]: `${VENDOR_URL}/react-dom.production.min.js`,
  };

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - ${target || "início"}</title>
  <style>x-dc { display: none !important; }</style>
  <style id="protoCustomStyle">${protoCss}</style>
  <style id="harnessBridgeStyle">
    [data-node-id], [data-pid] { transition: outline 0.15s ease-in-out; cursor: pointer; }
    [data-node-id]:hover, [data-pid]:hover { outline: 1px dashed rgba(59, 130, 246, 0.7); outline-offset: 1px; }
    .harness-highlight { outline: 2px solid #2563eb !important; outline-offset: 2px !important; }
  </style>
</head>
<body data-proto="${protoId}" data-screen="${target || ""}" data-version="${protoManifest?.version || "1.0.0"}" data-runtime="dc">
<script nonce="${nonce}">window.__resources=${jsLiteral(resources)};</script>
<x-dc>
<helmet>${helmet}</helmet>
${template}
</x-dc>
<script type="text/x-dc" ${logicAttrs}>${logic}</script>
<script nonce="${nonce}" src="${VENDOR_URL}/react.production.min.js"></script>
<script nonce="${nonce}" src="${VENDOR_URL}/react-dom.production.min.js"></script>
<script nonce="${nonce}" src="${VENDOR_URL}/support.js"></script>
<script nonce="${nonce}">${PID_SCRIPT}</script>
<script nonce="${nonce}">${bridgeScript}</script>
</body>
</html>`;

  return { ok: true, status: 200, html: fullHtml, nonce, manifest: protoManifest, warnings, headers: buildSandboxHeaders(nonce) };
}

module.exports = { renderDcScreen, withInitialPage, withStartScreen, inlineDcAssets };
