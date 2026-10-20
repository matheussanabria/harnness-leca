// @ts-check
// Varredura de features em doc/sistema.
const { scanRepositoryLayers, getFeatureLayers } = require("./design-layers.service");

/**
 * Cria telas a partir dos arquivos doc/sistema/features/ (ex: consulta-paciente, nova-prescricao).
 * @param {string} repoRoot
 * @returns {any[]}
 */
function scanSistemaFeaturesScreens(repoRoot) {
  const { featuresList } = scanRepositoryLayers(repoRoot);
  if (!featuresList || featuresList.length === 0) return [];

  const screens = [];
  let idx = 1;

  for (const feat of featuresList.slice(0, 8)) {
    const data = getFeatureLayers(repoRoot, feat);
    if (!data.found) continue;

    const layers = data.layers || {};
    const fields = (layers.ui || []).map((u, fIdx) => ({
      id: `f0${fIdx + 1}`,
      n: `0${fIdx + 1}`.slice(-2),
      label: u.rotulo || u.campoId || `Item ${fIdx + 1}`,
      ui: { st: u.st || "ok", t: u.t || "Elemento visual de interface", c: u.c || `<${feat}>` },
      rule: layers.regra?.[fIdx]?.t || "Regra associada ao item",
      api: layers.api?.[fIdx]?.rotulo || `/api/${feat}`,
      data: layers.dados?.[fIdx]?.rotulo || "Modelo de dados",
    }));

    if (fields.length === 0) {
      fields.push({
        id: "f01",
        n: "01",
        label: feat,
        ui: { st: "ok", t: "Interface da funcionalidade", c: feat },
      });
    }

    const rules = (layers.regra || []).map((r, rIdx) => ({
      title: r.rotulo || `Regra ${rIdx + 1}`,
      st: r.st || "ok",
      t: r.t || "Definição de regra da funcionalidade.",
      refs: [`f0${(rIdx % fields.length) + 1}`],
      src: `doc/sistema/features/${feat}/`,
    }));

    const endpoints = (layers.api || []).map((a, aIdx) => ({
      m: "GET",
      r: a.rotulo?.startsWith("/") ? a.rotulo : `/api/${feat}/${a.rotulo || ""}`.replace(/\/+$/, ""),
      st: a.st || "ok",
      p: "Parâmetros da requisição",
      resp: a.t || "Retorno da API",
      svc: `${feat}Service`,
      refs: [`f0${(aIdx % fields.length) + 1}`],
    }));

    const entities = (layers.dados || []).map((d) => ({
      name: d.rotulo || `${feat}_entidade`,
      kind: "tabela",
      st: d.st || "ok",
      src: `backend/domain`,
      cols: [["id", "Long", "PK"], ["descricao", "String", "Dado da feature"]],
      refs: ["f01"],
    }));

    screens.push({
      id: `s${idx}`,
      short: `${idx} · ${feat}`,
      title: `Funcionalidade · ${feat}`,
      route: `sistema/${feat}`,
      comp: `${feat}Component`,
      resumo: `Módulo ${feat} com mapeamento em camadas.`,
      fields,
      rules: rules.length > 0 ? rules : [{
        title: `Regra de ${feat}`,
        st: "ok",
        t: "Regra operacional definida pelo sistema.",
        refs: ["f01"],
        src: `doc/sistema/features/${feat}/`,
      }],
      endpoints: endpoints.length > 0 ? endpoints : [{
        m: "GET",
        r: `/api/${feat}`,
        st: "ok",
        p: "Parâmetros",
        resp: "Dados",
        svc: `${feat}Service`,
        refs: ["f01"],
      }],
      entities: entities.length > 0 ? entities : [{
        name: `${feat}_registro`,
        kind: "tabela",
        st: "ok",
        src: "schema",
        cols: [["id", "Long", "PK"]],
        refs: ["f01"],
      }],
      flow: [
        { k: "start", t: "Início do fluxo" },
        { k: "act", t: "Processamento do módulo" },
        { k: "end", t: "Conclusão e retorno" },
      ],
      states: [["Padrão", "Visualização ativa"]],
      diffs: [],
      legacy: [],
    });

    idx++;
  }

  return screens;
}

module.exports = { scanSistemaFeaturesScreens };
