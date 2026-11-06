// @ts-check
// Markup of the lanes and cards. Pure: state in, string out. Every dynamic value is escaped; icons are FontAwesome only.
import { esc } from "../../shared/dom.js";
import { boardLanes, groupByLane, laneTargets, viewStories } from "./scrum-board-model.js";

const ICON_RE = /^[a-z0-9-]{1,40}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** @param {string} laneId @param {any} scrum */
const laneName = (scrum, laneId) => (scrum.lanes || []).find((lane) => lane.id === laneId)?.name || laneId;

/** @param {any} scrum @param {any} story @param {boolean} selected @param {boolean} busy */
function cardHtml(scrum, story, selected, busy) {
  const { backward, forward } = laneTargets(scrum, story);
  const blocked = Boolean(story.impediment?.active);
  const draft = story.maturity && story.maturity !== "ready";
  const moveBtn = (/** @type {string | null} */ to, /** @type {string} */ icon, /** @type {string} */ label) => to
    ? `<button type="button" class="sb-move" data-move="${esc(story.id)}" data-to="${esc(to)}" title="${esc(`${label}: ${laneName(scrum, to)}`)}" aria-label="${esc(`${label}: ${laneName(scrum, to)}`)}"${busy ? " disabled" : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`
    : `<button type="button" class="sb-move" disabled aria-hidden="true" tabindex="-1"><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
  return `<article class="sb-card${blocked ? " is-blocked" : ""}${selected ? " is-selected" : ""}" draggable="true" tabindex="0" role="button" data-story="${esc(story.id)}" aria-label="${esc(`${story.key || story.id}: ${story.title}`)}" aria-pressed="${selected}">
    <div class="sb-card-top"><span class="sb-key">${esc(story.key || story.id)}</span>${story.points != null ? `<span class="sb-points">${esc(String(story.points))} pts</span>` : ""}</div>
    <div class="sb-title">${esc(story.title)}</div>
    <div class="sb-meta">
      ${blocked ? `<span class="sb-chip is-danger"><i class="fa-solid fa-ban" aria-hidden="true"></i> impedida</span>` : ""}
      ${draft ? `<span class="sb-chip"><i class="fa-solid fa-seedling" aria-hidden="true"></i> ${esc(story.maturity)}</span>` : ""}
      <span class="sb-moves">${moveBtn(backward, "fa-arrow-left", "Voltar para")}${moveBtn(forward, "fa-arrow-right", "Avancar para")}</span>
    </div>
  </article>`;
}

/**
 * @param {{ scrum: any, viewId: string, selectedId: string | null, busy: boolean }} input
 */
export function boardHtml({ scrum, viewId, selectedId, busy }) {
  const groups = groupByLane(boardLanes(scrum), viewStories(scrum, viewId));
  const lanes = groups.map(({ lane, stories, points }) => {
    const icon = ICON_RE.test(String(lane.icon)) ? lane.icon : "circle";
    const color = COLOR_RE.test(String(lane.color)) ? lane.color : "#64748b";
    const cards = stories.map((story) => cardHtml(scrum, story, story.id === selectedId, busy)).join("")
      || `<p class="sb-empty">Nenhuma historia</p>`;
    return `<section class="sb-lane" data-lane="${esc(lane.id)}" style="--lane-color:${color}" aria-label="${esc(lane.name)}">
      <header class="sb-lane-head"><i class="fa-solid fa-${icon}" aria-hidden="true"></i><span class="sb-lane-name">${esc(lane.name)}</span><span class="sb-count">${stories.length}</span><span class="sb-lane-points">${points} pts</span></header>
      <div class="sb-lane-body">${cards}</div>
    </section>`;
  }).join("");
  return `<div class="sb-lanes">${lanes}</div>`;
}
