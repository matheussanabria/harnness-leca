// @ts-check
// Converte uma tela de doc/sistema/features/<slug>/mapa-camadas.json (chaves em portugues)
// para o formato de tela que o Mapa em Camadas desenha (o mesmo do canvas "Mapa em camadas DIS.html").

const STATUS = {
  implementado: "ok",
  diverge: "div",
  "nao-implementado": "nao",
  "a-confirmar": "conf",
  "so-no-codigo": "cod",
  "so-no-prototipo": "proto",
  mock: "mock",
};

const TEST_STATUS = {
  automatizado: "auto",
  "teste-unitario": "unit",
  "so-requisicao": "req",
  "via-endpoint-vizinho": "req",
  "so-bdd": "bdd",
  "sem-teste": "none",
};

/** @param {any} st */
const status = (st) => STATUS[String(st)] || "conf";
/** @param {any} value */
const list = (value) => (Array.isArray(value) ? value : []);
/** @param {any} layer @param {string} fallback */
const layer = (layer, fallback = "—") => ({ t: layer?.t || fallback, st: status(layer?.st) });

/** @param {any} field */
function adaptField(field, index) {
  return {
    id: String(field.id),
    n: field.n ?? index + 1,
    label: field.rotulo || String(field.id),
    ui: { t: field.ui?.t || "—", c: field.ui?.c || "", st: status(field.ui?.st) },
    rule: layer(field.regra),
    api: layer(field.api),
    data: layer(field.dados),
  };
}

/**
 * @param {any} tela tela do mapa-camadas.json
 * @param {{ slug: string, featureTitle: string }} feature
 */
function adaptFeatureScreen(tela, feature) {
  const tests = tela.testes || {};
  return {
    id: `${feature.slug}-${tela.id}`,
    // Kept through mergeScreens, which swaps `id` for the canvas id: references written as "<slug>-<tela>" resolve by it.
    featureScreenId: `${feature.slug}-${tela.id}`,
    feature: feature.slug,
    featureTitle: feature.featureTitle,
    short: tela.titulo || tela.id,
    title: tela.titulo || tela.id,
    route: tela.rota || "",
    comp: tela.componente || "",
    resumo: tela.resumo || "",
    fields: list(tela.campos).map(adaptField),
    flow: list(tela.fluxo),
    states: list(tela.estados),
    diffs: list(tela.diferencas).map((d) => ({
      item: d.item, tipo: d.tipo, viewport: d.viewport, proto: d.prototipo, code: d.codigo, st: status(d.st),
    })),
    rules: list(tela.regras).map((r) => ({
      refs: list(r.campos), st: status(r.st), title: r.titulo, t: r.t, src: r.fonte, rn: list(r.rn).map(String),
    })),
    front: list(tela.front).map((f) => ({ refs: list(f.campos), svc: f.servico, call: f.chamada, note: f.nota })),
    endpoints: list(tela.endpoints).map((e) => ({
      refs: list(e.campos), m: e.metodo, r: e.rota, p: e.entrada, resp: e.saida, svc: e.servico, st: status(e.st),
    })),
    seqs: list(tela.sequencias).map((s) => ({ title: s.titulo, steps: list(s.passos) })),
    chains: list(tela.camadas_back).map((c) => ({ ep: c.endpoint, chain: list(c.cadeia) })),
    entities: list(tela.entidades).map((e) => ({
      name: e.nome, kind: e.tipo, st: status(e.st), refs: list(e.campos), src: e.origem, cols: list(e.colunas), note: e.nota,
    })),
    rels: list(tela.relacoes),
    map: list(tela.mapeamento).map((m) => ({ f: m.campo, req: m.request, col: m.coluna, st: status(m.st) })),
    legacy: list(tela.legado).map((l) => ({
      refs: list(l.campos), par: l.par, title: l.titulo, legado: l.legado, novo: l.novo, porque: l.porque, fonte: l.fonte,
    })),
    tests: {
      nota: tests.nota,
      groups: list(tests.grupos).map((g) => ({
        ep: g.endpoint,
        refs: list(g.campos),
        st: TEST_STATUS[g.st] || "doc",
        src: g.fonte,
        rules: list(g.regras),
        cases: list(g.cenarios).map((c) => [c.titulo, c.tipo]),
      })),
    },
  };
}

module.exports = { adaptFeatureScreen };
