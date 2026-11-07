// @ts-check
// Escaped HTML renderers for the catalog page (FontAwesome icons only).

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Area filter chips with counts. */
export function renderAreaChips(areas, counts, current) {
  const chip = (id, icon, label) =>
    `<button type="button" class="k-area${current === id ? " is-on" : ""}" data-area="${esc(id)}">` +
    `<i class="fa-solid ${esc(icon)}" aria-hidden="true"></i> ${esc(label)} <span class="n">${counts[id] || 0}</span></button>`;
  return chip("all", "fa-layer-group", "Todas") + areas.filter((a) => counts[a.id]).map((a) => chip(a.id, a.icon, a.label)).join("");
}

/** How the area was chosen, shown as a tag on each card. */
const ORIGIN = {
  frontmatter: `<span class="k-tag k-tag--manual" title="Área definida no frontmatter do arquivo (campo area)">frontmatter</span>`,
  manual: `<span class="k-tag k-tag--manual" title="Área escolhida por você">manual</span>`,
  suggested: `<span class="k-tag" title="Sugerida pelo nome e descrição">sugerida</span>`,
};

function renderCard(item, areas, canManage) {
  const icon = item.kind === "agent" ? "fa-user-gear" : "fa-wand-magic-sparkles";
  const kind = item.kind === "agent" ? "Agente" : "Skill";
  const options = areas
    .map((a) => `<option value="${esc(a.id)}"${a.id === item.area ? " selected" : ""}>${esc(a.label)}</option>`)
    .join("");
  const fixed = item.areaSource === "frontmatter";
  const select = canManage
    ? `<select class="k-select" data-kind="${esc(item.kind)}" data-name="${esc(item.name)}" aria-label="Área de ${esc(item.name)}"${fixed ? ' disabled title="Definida no frontmatter do arquivo (campo area)"' : ""}>${options}</select>`
    : "";
  const origin = ORIGIN[item.areaSource] || ORIGIN.suggested;
  const also = item.alsoIn && item.alsoIn.length ? `<span class="k-tag" title="Também em: ${esc(item.alsoIn.join(", "))}">+${item.alsoIn.length}</span>` : "";
  return (
    `<article class="k-card"><h3><button type="button" class="k-open" data-open="${esc(item.kind)}:${esc(item.source)}:${esc(item.ref)}" title="Abrir arquivos"><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(item.name)}</button></h3>` +
    `<p>${esc(item.description || "Sem descrição.")}</p>` +
    `<div class="k-meta"><span class="k-tag">${kind}</span><span class="k-tag">${esc(item.sourceLabel)}</span>${also}${linkTag(item)}${origin}${select}</div></article>`
  );
}

/** Groups already filtered; one section per area. */
/** Link tags of a skill: number of Scrum lanes, or a warning when a project skill has none. */
export function linkTag(item) {
  if (item.orphan) return `<span class="k-tag k-warn" title="Skill de projeto sem vínculo com nenhuma raia do Scrum"><i class="fa-solid fa-link-slash" aria-hidden="true"></i> sem vínculo</span>`;
  const n = item.lanes ? item.lanes.length : 0;
  return n ? `<span class="k-tag" title="${esc(item.lanes.map((l) => `${l.project}: ${l.laneName}`).join(", "))}"><i class="fa-solid fa-link" aria-hidden="true"></i> ${n} ${n === 1 ? "raia" : "raias"}</span>` : "";
}

export function renderGroups(groups, areas, canManage) {
  if (!groups.length) return `<p class="c-empty">Nada encontrado.</p>`;
  return groups
    .map(
      (g) =>
        `<section class="k-group"><h2><i class="fa-solid ${esc(g.area.icon)}" aria-hidden="true"></i> ${esc(g.area.label)} <span class="n">${g.items.length}</span></h2>` +
        `<div class="k-grid">${g.items.map((it) => renderCard(it, areas, canManage)).join("")}</div></section>`
    )
    .join("");
}
