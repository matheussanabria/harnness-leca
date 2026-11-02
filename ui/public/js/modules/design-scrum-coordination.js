// @ts-check
// Coordination ledger lanes (read-only). Advisory view: it never moves stories or touches Scrum lanes.
import { esc } from "../shared/dom.js";

const LABELS = {
  claimed: ["fa-hand", "Claimed"],
  in_progress: ["fa-spinner", "In progress"],
  review: ["fa-magnifying-glass", "Review"],
  blocked: ["fa-ban", "Blocked"],
  ready: ["fa-flag", "Ready"],
  planned: ["fa-calendar", "Planned"],
  done: ["fa-circle-check", "Done"],
};

/** @param {any} card */
function cardHtml(card) {
  const lease = card.leaseExpiresAt
    ? `<span class="coord-chip ${card.leaseExpired ? "is-expired" : ""}" title="Lease expires ${esc(card.leaseExpiresAt)}"><i class="fa-regular fa-clock"></i> ${card.leaseExpired ? "lease expired" : "lease active"}</span>`
    : "";
  const worktree = card.worktree ? `<span class="coord-chip"><i class="fa-solid fa-code-branch"></i> ${esc(card.worktree)}</span>` : "";
  return `<article class="coord-card">
    <div class="coord-card-id">${esc(card.id)}</div>
    <div class="coord-card-title">${esc(card.title)}</div>
    <div class="coord-card-meta"><span class="coord-chip"><i class="fa-solid fa-user"></i> ${esc(card.owner || "unassigned")}</span>${lease}${worktree}</div>
  </article>`;
}

/** @param {any} lane */
function laneHtml(lane) {
  const [icon, label] = /** @type {string[]} */ (LABELS[/** @type {keyof typeof LABELS} */ (lane.id)] || ["fa-circle", lane.id]);
  const body = lane.id === "done"
    ? `<p class="coord-empty">${lane.count} completed (cards hidden)</p>`
    : lane.cards.map(cardHtml).join("") || `<p class="coord-empty">No stories</p>`;
  return `<section class="coord-lane" aria-label="${esc(label)}">
    <header class="coord-lane-head"><i class="fa-solid ${icon}"></i> ${esc(label)} <span class="coord-count">${lane.count}</span></header>
    <div class="coord-lane-body">${body}</div>
  </section>`;
}

/** @param {{available:boolean, view:any}|null} payload */
export function renderCoordinationLanes(payload) {
  if (!payload) return `<p class="coord-empty">Loading coordination ledger...</p>`;
  if (!payload.available) return `<p class="coord-empty">This project has no coordination ledger yet.</p>`;
  const { view } = payload;
  return `<div class="coord-board">
    <p class="coord-note"><i class="fa-solid fa-circle-info"></i> Read-only view of the coordination ledger (revision ${esc(view.revision)}). It is advisory and does not change Scrum lanes.</p>
    <div class="coord-lanes">${view.lanes.map(laneHtml).join("")}</div>
  </div>`;
}

/** @param {string} slug */
export async function fetchCoordinationLanes(slug) {
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/coordination/lanes`);
    if (!response.ok) return { available: false, view: null };
    return await response.json();
  } catch {
    return { available: false, view: null };
  }
}
