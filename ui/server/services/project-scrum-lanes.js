// @ts-check
// Catálogo e validação das raias canônicas do workflow SDLC.

const LANE_DEFINITIONS = Object.freeze([
  ["backlog", "Backlog", "Demandas ainda não priorizadas.", "#64748b", "inbox"],
  ["discovery", "Discovery", "Problema e oportunidade em investigação.", "#8b5cf6", "compass"],
  ["refinamento", "Refinamento", "Escopo e critérios em detalhamento.", "#a855f7", "filter-circle-dollar"],
  ["pronto-para-dev", "Pronto para desenvolvimento", "Trabalho preparado para implementação.", "#3b82f6", "clipboard-check"],
  ["em-desenvolvimento", "Em desenvolvimento", "Implementação em andamento.", "#2563eb", "code"],
  ["em-revisao", "Em revisão", "Código ou entrega em revisão.", "#06b6d4", "magnifying-glass"],
  ["pronto-para-testes", "Pronto para testes", "Entrega aguardando validação de qualidade.", "#14b8a6", "vial-circle-check"],
  ["em-testes", "Em testes", "Cenários funcionais e regressivos em execução.", "#10b981", "flask-vial"],
  ["pronto-para-homologacao", "Pronto para homologação", "Entrega disponível para aceite.", "#84cc16", "user-check"],
  ["em-homologacao", "Em homologação", "Aceite de negócio em andamento.", "#eab308", "stamp"],
  ["pronto-para-deploy", "Pronto para deploy", "Entrega aprovada aguardando publicação.", "#f97316", "rocket"],
  ["concluido", "Concluído", "Valor entregue e encerrado.", "#22c55e", "circle-check"],
]);

const CANONICAL_LANES = Object.freeze(LANE_DEFINITIONS.map((lane, order) => Object.freeze({
  id: lane[0], name: lane[1], description: lane[2], color: lane[3], icon: lane[4],
  order, visible: true, active: true,
})));
const LANE_IDS = new Set(CANONICAL_LANES.map(({ id }) => id));

function getCanonicalLanes() {
  return CANONICAL_LANES.map((lane) => ({ ...lane }));
}

function normalizeLane(lane, canonical) {
  const name = String(lane.name ?? canonical.name).trim();
  const description = String(lane.description ?? canonical.description).trim();
  const color = String(lane.color ?? canonical.color).trim().toLowerCase();
  if (!name || name.length > 60) throw new Error(`Nome invalido para a raia '${canonical.id}'.`);
  if (description.length > 240) throw new Error(`Descricao invalida para a raia '${canonical.id}'.`);
  if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error(`Cor invalida para a raia '${canonical.id}'.`);
  if (typeof lane.visible !== "boolean" || typeof lane.active !== "boolean") {
    throw new Error(`Visibilidade e ativacao da raia '${canonical.id}' devem ser booleanas.`);
  }
  const order = Number.isInteger(lane.order) ? lane.order : canonical.order;
  return { ...canonical, name, description, color, visible: lane.visible, active: lane.active, order };
}

function hasValidOrder(lanes) {
  const orders = lanes.map(({ order }) => order);
  return orders.every((order) => Number.isInteger(order) && order >= 0 && order < CANONICAL_LANES.length)
    && new Set(orders).size === CANONICAL_LANES.length;
}

function mergeLaneConfiguration(lanes) {
  const configured = new Map((Array.isArray(lanes) ? lanes : [])
    .filter((lane) => lane && LANE_IDS.has(String(lane.id)))
    .map((lane) => [String(lane.id), lane]));
  const normalized = getCanonicalLanes().map((canonical) => {
    const lane = configured.get(canonical.id);
    if (!lane) return canonical;
    try { return normalizeLane({ ...canonical, ...lane, id: canonical.id }, canonical); }
    catch { return canonical; }
  });
  if (!hasValidOrder(normalized)) return normalized.map((lane, order) => ({ ...lane, order }));
  return normalized.sort((left, right) => left.order - right.order);
}

function validateLaneConfiguration(lanes) {
  if (!Array.isArray(lanes) || lanes.length !== CANONICAL_LANES.length) {
    throw new Error(`A configuracao deve conter exatamente ${CANONICAL_LANES.length} raias.`);
  }
  const ids = lanes.map((lane) => String(lane?.id || ""));
  if (new Set(ids).size !== CANONICAL_LANES.length || ids.some((id) => !LANE_IDS.has(id))) {
    throw new Error("IDs de raia ausentes, duplicados ou desconhecidos.");
  }
  const byId = new Map(lanes.map((lane) => [String(lane.id), lane]));
  return getCanonicalLanes().map((canonical) => normalizeLane(byId.get(canonical.id), canonical));
}

function isLaneId(value) { return LANE_IDS.has(String(value || "")); }

function reorderLaneConfiguration(lanes, laneIds) {
  if (!Array.isArray(laneIds) || laneIds.length !== CANONICAL_LANES.length) {
    throw new Error(`A ordem deve conter exatamente ${CANONICAL_LANES.length} IDs de raia.`);
  }
  const ids = laneIds.map((id) => String(id || ""));
  if (new Set(ids).size !== CANONICAL_LANES.length || ids.some((id) => !LANE_IDS.has(id))) {
    throw new Error("Ordem contem IDs de raia ausentes, duplicados ou desconhecidos.");
  }
  const byId = new Map(mergeLaneConfiguration(lanes).map((lane) => [lane.id, lane]));
  return ids.map((id, order) => ({ ...byId.get(id), order }));
}

module.exports = { CANONICAL_LANES, getCanonicalLanes, isLaneId, mergeLaneConfiguration, reorderLaneConfiguration, validateLaneConfiguration };
