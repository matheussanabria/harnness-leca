// @ts-check
// Pure view model for the catalog page: filtering and grouping by area.

/**
 * @param {Array<any>} items
 * @param {{ kind?: string, area?: string, text?: string }} filter
 */
export function filterItems(items, filter) {
  const text = String(filter.text || "").trim().toLowerCase();
  return items.filter((it) => {
    if (filter.kind && filter.kind !== "all" && it.kind !== filter.kind) return false;
    if (filter.area && filter.area !== "all" && it.area !== filter.area) return false;
    if (text && !`${it.name} ${it.description}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

/**
 * Groups items by area, in the area order given; empty areas are dropped.
 * @param {Array<any>} items
 * @param {Array<{ id: string, label: string, icon: string }>} areas
 */
export function groupByArea(items, areas) {
  return areas
    .map((area) => ({ area, items: items.filter((it) => it.area === area.id) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Counts per area under the current kind/text filter (the area filter itself is ignored).
 * @param {Array<any>} items
 * @param {{ kind?: string, text?: string }} filter
 */
export function areaCounts(items, filter) {
  const counts = { all: 0 };
  for (const it of filterItems(items, { kind: filter.kind, text: filter.text })) {
    counts.all += 1;
    counts[it.area] = (counts[it.area] || 0) + 1;
  }
  return counts;
}
