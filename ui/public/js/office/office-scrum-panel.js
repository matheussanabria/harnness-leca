// @ts-check
// DAI HQ - Scrum panel for the board drawer: open stories, holder agent (coordination ledger), last commit. Read-only.
import { esc } from "../shared/dom.js";
import { bindPagers, pagedHtml } from "../shared/pagination.js";

const LIST_KEY = "office-scrum";

/** @param {string} laneId */
const laneLabel = (laneId) => laneId.replace(/-/g, " ");

/** @param {any} item */
function itemHtml(item) {
  const owner = item.owner
    ? `<span class="coord-chip${item.leaseExpired ? " is-expired" : ""}"><i class="fa-solid fa-user"></i> ${esc(item.owner)}${item.leaseExpired ? " (lease expired)" : ""}</span>`
    : `<span class="coord-chip"><i class="fa-regular fa-user"></i> unassigned</span>`;
  const maturity = item.maturity !== "ready" ? `<span class="coord-chip"><i class="fa-solid fa-seedling"></i> ${esc(item.maturity)}</span>` : "";
  const blocked = item.impediment ? `<span class="coord-chip is-expired"><i class="fa-solid fa-ban"></i> impediment</span>` : "";
  const commit = item.lastCommit
    ? `<div class="coord-note"><i class="fa-solid fa-code-commit"></i> ${esc(item.lastCommit.shortSha)} ${esc(item.lastCommit.subject)} (${item.commitCount})</div>`
    : `<div class="coord-note"><i class="fa-regular fa-circle"></i> no linked commits</div>`;
  return `<article class="coord-card">
    <div class="coord-card-id">${esc(item.key || item.id)} <span class="coord-chip"><i class="fa-solid fa-table-columns"></i> ${esc(laneLabel(item.laneId))}</span></div>
    <div class="coord-card-title">${esc(item.title)}</div>
    <div class="coord-card-meta">${owner}${maturity}${blocked}</div>
    ${commit}
  </article>`;
}

/** @param {any} card */
function ledgerHtml(card) {
  const lease = card.leaseExpired ? " (lease expired)" : "";
  const branch = card.worktree ? `<span class="coord-chip"><i class="fa-solid fa-code-branch"></i> ${esc(card.worktree)}</span>` : "";
  return `<article class="coord-card">
    <div class="coord-card-id">${esc(card.id)} <span class="coord-chip">${esc(card.status.replace("_", " "))}</span></div>
    <div class="coord-card-title">${esc(card.title)}</div>
    <div class="coord-card-meta"><span class="coord-chip${card.leaseExpired ? " is-expired" : ""}"><i class="fa-solid fa-user"></i> ${esc(card.owner || "unassigned")}${lease}</span>${branch}</div>
  </article>`;
}

/** @param {any} panel */
export function renderScrumPanel(panel) {
  if (!panel) return `<p class="coord-empty">Loading Scrum panel...</p>`;
  if (panel.error) return `<p class="coord-empty">${esc(panel.error)}</p>`;
  const owners = Object.entries(panel.owners || {}).map(([name, n]) => `<span class="coord-chip"><i class="fa-solid fa-user"></i> ${esc(name)} ${n}</span>`).join("");
  const notes = [
    panel.ledger ? "" : "No coordination ledger: holders unknown.",
    panel.commits ? "" : "Git history unavailable: commits not linked.",
    panel.truncated ? `Showing ${panel.shown} of ${panel.total} open stories.` : "",
  ].filter(Boolean).map((n) => `<p class="coord-note"><i class="fa-solid fa-circle-info"></i> ${esc(n)}</p>`).join("");
  const active = (panel.ledgerActive || []).length
    ? `<h4 class="coord-note"><i class="fa-solid fa-people-group"></i> Agents on the coordination ledger (${panel.ledgerActive.length})</h4>${panel.ledgerActive.map(ledgerHtml).join("")}`
    : "";
  if (!panel.items.length) return `<div class="coord-board">${notes}<p class="coord-empty">No open stories.</p>${active}</div>`;
  const page = pagedHtml(panel.items, LIST_KEY, itemHtml, { label: "Scrum stories pagination" });
  return `<div class="coord-board"><div class="coord-card-meta">${owners}</div>${notes}${page.html}${page.pager}${active}</div>`;
}

/**
 * Fetches and draws the panel into `el`; a failed request shows a message and never throws.
 * @param {HTMLElement} el
 * @param {string} slug
 */
export async function mountScrumPanel(el, slug) {
  /** @param {any} data */
  const draw = (data) => {
    el.innerHTML = renderScrumPanel(data);
    bindPagers(el, () => draw(data));
  };
  draw(null);
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/panel`);
    const data = await res.json();
    draw(res.ok ? data : { error: data.error || `HTTP ${res.status}` });
  } catch {
    draw({ error: "Scrum panel unavailable." });
  }
}
