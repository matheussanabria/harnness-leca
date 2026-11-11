// @ts-check
// Perfis de "Quem esta olhando": cada perfil enxerga um subconjunto das 6 camadas.

export const AUDIENCES = Object.freeze([
  { id: "all", title: "Tudo", subtitle: "Todas as camadas", layers: ["ui", "rules", "api", "data", "tests", "legacy"] },
  { id: "user", title: "Usuário final", subtitle: "Quem opera a tela", layers: ["ui", "rules"] },
  { id: "product", title: "Produto e negócio", subtitle: "Quem define o processo", layers: ["ui", "rules", "legacy"] },
  { id: "dev", title: "Desenvolvimento", subtitle: "Front, API e dados", layers: ["ui", "rules", "api", "data"] },
  { id: "qa", title: "QA e testes", subtitle: "Cenários e critérios", layers: ["rules", "tests", "legacy"] },
]);

export const AUDIENCE_IDS = Object.freeze(AUDIENCES.map((a) => a.id));

/** @param {string} id */
export function getAudience(id) {
  return AUDIENCES.find((a) => a.id === id) || AUDIENCES[0];
}

/** Camadas visíveis para o perfil, preservando a ordem original. */
export function visibleLayerIds(audienceId) {
  return getAudience(audienceId).layers;
}

/** Camada ativa válida para o perfil (cai na primeira visível). */
export function resolveActiveLayer(audienceId, layerId) {
  const visible = visibleLayerIds(audienceId);
  return visible.includes(layerId) ? layerId : visible[0];
}
