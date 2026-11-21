// @ts-check
// HTML of the keyframe panel (EP-24.06): ruler, layer labels, lanes with keyframes, inspector. Pure string builders.
import { EASES, easeParts, trackLabel } from "./motion-timeline-state.js";

const esc = (/** @type {unknown} */ v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
/** @param {number} t @param {number} duration */
export const pct = (t, duration) => `${duration > 0 ? ((t / duration) * 100).toFixed(3) : 0}%`;

/** Tick every 100 ms, label every 500 ms (every second past 5 s). @param {number} duration */
export function rulerHtml(duration) {
  const step = duration > 5000 ? 500 : 100;
  const label = duration > 5000 ? 1000 : 500;
  const out = [];
  for (let t = 0; t <= duration; t += step) {
    const major = t % label === 0;
    out.push(`<i class="motion-tl__tick${major ? " is-major" : ""}" style="left:${pct(t, duration)}"></i>`);
    if (major) out.push(`<span class="motion-tl__tick-label" style="left:${pct(t, duration)}">${(t / 1000).toFixed(1)}s</span>`);
  }
  return out.join("");
}

/** @param {any} doc @param {any[]} tree @param {number} selTrack */
export function labelsHtml(doc, tree, selTrack) {
  return doc.tracks.map((/** @type {any} */ tr, /** @type {number} */ i) => {
    const sel = i === selTrack;
    return `<div class="motion-tl__label${sel ? " is-sel" : ""}" data-tl-track="${i}" tabindex="0" role="button" aria-pressed="${sel}"><i class="fa-solid fa-cube"></i> <span>${esc(trackLabel(tree, tr.target))}</span> <small>${esc(tr.target)}</small></div>`;
  }).join("");
}

/** @param {any} doc @param {any[]} tree @param {{ track: number, key: number }} sel */
export function lanesHtml(doc, tree, sel) {
  const d = doc.duration;
  return doc.tracks.map((/** @type {any} */ tr, /** @type {number} */ i) => {
    const times = tr.keys.map((/** @type {any} */ k) => k.t);
    const seg = times.length > 1 ? `<div class="motion-tl__seg" style="left:${pct(times[0], d)};width:${pct(times[times.length - 1] - times[0], d)}"></div>` : "";
    const name = esc(trackLabel(tree, tr.target));
    const keys = tr.keys.map((/** @type {any} */ k, /** @type {number} */ ki) => {
      const on = i === sel.track && ki === sel.key;
      return `<button type="button" class="motion-tl__key${on ? " is-sel" : ""}" style="left:${pct(k.t, d)}" data-tl-track="${i}" data-tl-key="${ki}" aria-label="Keyframe em ${k.t} ms de ${name}" aria-pressed="${on}"><i class="fa-solid fa-diamond"></i></button>`;
    }).join("");
    return `<div class="motion-tl__lane${i === sel.track ? " is-sel" : ""}" data-tl-track="${i}">${seg}${keys}</div>`;
  }).join("");
}

/** @param {any} doc @param {any[]} tree @param {{ track: number, key: number }} sel */
export function inspectorHtml(doc, tree, sel) {
  const tr = doc.tracks[sel.track];
  const key = tr && tr.keys[sel.key];
  const add = '<button type="button" class="btn-proto-vp" data-tl-act="add"><i class="fa-solid fa-plus"></i> Adicionar keyframe aqui</button>';
  if (!key) return `<h3><i class="fa-solid fa-sliders"></i> Keyframe</h3><div class="motion-tl__empty">Selecione um losango, ou adicione um keyframe no cursor.</div><div class="motion-tl__row">${tr ? add : ""}</div>`;
  const ease = easeParts(key.ease);
  const fields = Object.entries(key.props).map(([prop, value]) => `<label class="motion-tl__field"><span>${esc(prop)}</span><input data-tl-prop="${esc(prop)}" value="${esc(value)}" spellcheck="false"></label>`).join("");
  const options = [...EASES, "custom"].map((e) => `<option value="${e}"${e === ease.key ? " selected" : ""}>${e === "custom" ? "cubic-bezier (personalizado)" : e}</option>`).join("");
  const bez = ease.bezier.map((v, i) => `<input aria-label="${["x1", "y1", "x2", "y2"][i]}" data-tl-bez="${i}" value="${esc(v)}" inputmode="decimal">`).join("");
  const first = sel.key === 0;
  return `<h3><i class="fa-solid fa-diamond"></i> ${esc(trackLabel(tree, tr.target))} · ${key.t} ms</h3>
    ${fields}
    <label class="motion-tl__field"><span>Easing até este keyframe</span><select data-tl-ease${first ? " disabled title=\"O primeiro keyframe não tem trecho anterior\"" : ""}>${options}</select></label>
    <div class="motion-tl__bezier"${ease.key === "custom" && !first ? "" : " hidden"}>${bez}</div>
    <div class="motion-tl__row">${add}<button type="button" class="btn-proto-vp" data-tl-act="remove"${tr.keys.length <= 1 ? " disabled" : ""}><i class="fa-solid fa-trash"></i> Remover</button></div>`;
}

/** Panel shell; the controller fills the parts. */
export function panelShellHtml() {
  return `<div class="motion-tl__labels"><div class="motion-tl__hdr"><i class="fa-solid fa-layer-group"></i> Camadas</div><div data-tl="labels"></div></div>
    <div class="motion-tl__lanes" data-tl="lanes"><div class="motion-tl__ruler" data-tl="ruler" title="Clique para mover o cursor"></div><div data-tl="rows"></div><div class="motion-tl__playhead" data-tl="playhead"></div></div>
    <aside class="motion-tl__inspector" data-tl="inspector" aria-live="polite"></aside>
    <div class="motion-tl__hint"><kbd>Tab</kbd> entre faixas · <kbd>&larr;</kbd> <kbd>&rarr;</kbd> move o keyframe um quadro · <kbd>Enter</kbd> edita · <kbd>Delete</kbd> remove · <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz · <kbd>Shift</kbd> ao arrastar solta o encaixe</div>`;
}
