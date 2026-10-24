// @ts-check
// Fonte de verdade da telemetria dos agentes no Escritório (T2.3).
//
// Regra de precedência (única e exclusiva, evita contagem dupla):
//   - stream do servidor conectado  -> a projeção EP-09 é a fonte; o store local do documento e o
//     polling de /api/agents/active NÃO escrevem no estado dos agentes (um chat que aparece nos dois
//     lados é contado uma vez, só pela projeção);
//   - stream indisponível           -> volta ao store local do documento (T0.1) e ao polling.
let serverTruth = false;

/** @returns {boolean} */
export function isServerTruth() {
  return serverTruth;
}

/** @param {boolean} value */
export function setServerTruth(value) {
  serverTruth = Boolean(value);
}
