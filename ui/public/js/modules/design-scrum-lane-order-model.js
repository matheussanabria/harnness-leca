// @ts-check
// Regra pura para reordenar raias visíveis sem deslocar as ocultas.

export function replaceVisibleLaneOrder(lanes, visibleIds) {
  const visible = new Set(lanes.filter((lane) => lane.visible).map((lane) => lane.id));
  let cursor = 0;
  return lanes.map((lane) => visible.has(lane.id) ? visibleIds[cursor++] : lane.id);
}
