// @ts-check
// Peças compartilhadas pelo sandbox de protótipos: estilos, ponte do harness e cabeçalhos de segurança.

/**
 * Carrega estilos auxiliares e de tokens para o sandbox.
 * @param {string} projectDir
 * @param {string} protoDir
 * @param {object} deps
 * @returns {{ tokensCss: string, themeCss: string, componentsCss: string, protoCss: string, headHtml: string }}
 */
function loadSandboxAssets(projectDir, protoDir, deps) {
  let tokensCss = "";
  let themeCss = "";
  let componentsCss = "";
  let protoCss = "";
  let headHtml = "";

  const dsDir = deps.path.join(projectDir, "design", "ds");
  const tokensFile = deps.path.join(dsDir, "tokens.css");
  const themeFile = deps.path.join(dsDir, "theme.css");

  if (deps.fs.existsSync(tokensFile)) {
    try { tokensCss = deps.fs.readFileSync(tokensFile, "utf8"); } catch {}
  }
  if (deps.fs.existsSync(themeFile)) {
    try { themeCss = deps.fs.readFileSync(themeFile, "utf8"); } catch {}
  }

  const componentsFile = deps.path.join(dsDir, "components.css");
  if (deps.fs.existsSync(componentsFile)) {
    try { componentsCss = deps.fs.readFileSync(componentsFile, "utf8"); } catch {}
  }

  const protoCssFile = deps.path.join(protoDir, "styles", "proto.css");
  if (deps.fs.existsSync(protoCssFile)) {
    try { protoCss = deps.fs.readFileSync(protoCssFile, "utf8"); } catch {}
  }

  const headFile = deps.path.join(protoDir, "head.html");
  if (deps.fs.existsSync(headFile)) {
    try { headHtml = deps.fs.readFileSync(headFile, "utf8"); } catch {}
  }

  return { tokensCss, themeCss, componentsCss, protoCss, headHtml };
}

/** Scripts da ponte, na ordem de execução: medidas/prévia, ponte principal, arrastar para reordenar e seleção múltipla. */
const BRIDGE_FILES = ["prototype-bridge-props.js", "prototype-bridge.js", "prototype-bridge-drag.js", "prototype-bridge-multi.js"];

/**
 * Lê os scripts da ponte de comunicação do harness e os junta em um único bloco.
 * @param {object} deps
 * @returns {string}
 */
function loadBridgeScript(deps) {
  const dir = deps.path.resolve(__dirname, "..", "..", "public", "js", "modules");
  return BRIDGE_FILES.map((name) => {
    const file = deps.path.join(dir, name);
    if (!deps.fs.existsSync(file)) return "";
    try { return deps.fs.readFileSync(file, "utf8"); } catch { return ""; }
  }).filter(Boolean).join("\n;\n");
}

/**
 * Cabeçalhos de segurança do sandbox. Scripts só de 'self' (vendor local) e cdnjs; nonce para inline.
 * @param {string} nonce
 */
function buildSandboxHeaders(nonce) {
  const csp = [
    "default-src 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob:",
    `script-src 'self' https://cdnjs.cloudflare.com 'nonce-${nonce}' 'unsafe-eval'`,
    "connect-src 'none'",
    "frame-src 'none'",
  ].join("; ");
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };
}

module.exports = { loadSandboxAssets, loadBridgeScript, buildSandboxHeaders, BRIDGE_FILES };
