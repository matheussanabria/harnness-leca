// @ts-check
// Dados do mapa em camadas como o Harness serviria em /design/screens, mais o HTML de cada prototipo ligado.
// As correcoes e os trechos escondidos vem da configuracao (com data e motivo); nada e fixo aqui.
const path = require("path");
const { ROOT } = require("./config");
const services = path.join(ROOT, "ui", "server", "services");
const { getProjectScreens } = require(path.join(services, "project-screens.service.js"));
const { renderPrototypeScreen } = require(path.join(services, "prototype-renderer.service.js"));
const { collectDocs } = require("./docs-data");

/**
 * Aplica as correcoes da configuracao. Devolve as que ja estavam na fonte (ajuste velho) para o `check`.
 * @param {any[]} screens @param {any[]} correcoes
 * @returns {{ absorvidas: any[], semAlvo: any[] }}
 */
function applyCorrections(screens, correcoes) {
  const absorvidas = [];
  const semAlvo = [];
  for (const c of correcoes) {
    const screen = screens.find((s) => s.id === c.tela);
    const field = screen && (screen.fields || []).find((f) => f.id === c.campo);
    if (!screen || (c.campo && !field)) { semAlvo.push(c); continue; }
    if (field && c.acrescentarAoCampo) {
      if ((field.ui && field.ui.t || "").includes(c.acrescentarAoCampo)) absorvidas.push({ ...c, parte: "campo" });
      else field.ui = { ...field.ui, t: `${(field.ui && field.ui.t) || ""} ${c.acrescentarAoCampo}`.trim() };
    }
    if (c.diferenca) {
      const exists = (screen.diffs || []).some((d) => d.item === c.diferenca.item);
      if (exists) absorvidas.push({ ...c, parte: "diferenca" });
      else {
        const at = c.depoisDe ? (screen.diffs || []).findIndex((d) => d.item === c.depoisDe) + 1 : (screen.diffs || []).length;
        screen.diffs = screen.diffs || [];
        screen.diffs.splice(at, 0, { tipo: "componente", viewport: "desktop", ...c.diferenca });
      }
    }
  }
  return { absorvidas, semAlvo };
}

/** CSS que esconde, so no mapa do pacote, o que a versao nova nao usa. O HTML do prototipo nao muda. */
function hideStyle(selectors) {
  return `<style>${selectors.join(",")}{display:none !important}</style>`;
}

/**
 * @param {{ slug: string, repo: string, projectDir: string, config: any, outDir: string }} p
 */
function collectMap({ slug, repo, projectDir, config, outDir }) {
  const screensData = getProjectScreens(slug, repo, projectDir);
  const fixes = applyCorrections(screensData.screens, config.correcoes);
  /** @type {Record<string, string>} */
  const protos = {};
  for (const sc of screensData.screens) {
    if (!sc.prototype || protos[sc.prototype.screen]) continue;
    const r = renderPrototypeScreen(projectDir, repo, sc.prototype.id, sc.prototype.screen, {}, undefined, { part: "content" });
    if (!r.ok) throw new Error(`pacote-revisao: prototipo ${sc.prototype.screen}: ${r.error}`);
    protos[sc.prototype.screen] = r.html;
  }
  for (const h of config.esconderNoPrototipo) {
    if (protos[h.tela]) protos[h.tela] = hideStyle(h.seletores) + protos[h.tela];
  }
  const docs = collectDocs({ repo, outDir, screens: screensData.screens });
  return { geradoEm: new Date().toISOString(), screensData, protos, fixes, docs };
}

module.exports = { collectMap, applyCorrections, hideStyle };
