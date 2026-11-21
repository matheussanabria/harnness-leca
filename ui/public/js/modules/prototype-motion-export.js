// @ts-check
// Export dialog of the Atelier motion player (EP-24.05, approved prototype docs/features/motion-export/03-prototype.html).
// Options, progress by frame, download and error, over the export API. A running job survives closing the dialog.
import { ctx } from "./prototype-atelier-ctx.js";

const FPS = { webm: [24, 30, 60], mp4: [24, 30, 60], gif: [12, 15, 24, 30] };
const SCALES = { webm: [1, 0.5, 2], mp4: [1, 0.5, 2], gif: [0.5, 0.25, 1] };
const HINTS = { webm: "menor arquivo", mp4: "mais compatível", gif: "sem som, leve" };
const SECONDS_PER_FRAME = 0.155; // measured on the reference machine at 1080p (46 s for 300 frames)

/** Frame rates offered for a format, with the default first-selected. @param {string} format @param {number} docFps */
export function fpsChoices(format, docFps) {
  const list = FPS[/** @type {keyof typeof FPS} */ (format)] || FPS.webm;
  const preferred = format === "gif" ? 15 : docFps;
  return { list, selected: list.includes(preferred) ? preferred : list[Math.min(1, list.length - 1)] };
}

/** "100% · 1920×1080" options. @param {string} format @param {{ w: number, h: number }} size */
export function scaleChoices(format, size) {
  return (SCALES[/** @type {keyof typeof SCALES} */ (format)] || SCALES.webm)
    .map((s) => ({ value: s, label: `${Math.round(s * 100)}% · ${Math.round(size.w * s)}×${Math.round(size.h * s)}` }));
}

/** "300 quadros · cerca de 47 s para gerar" @param {number} durationMs @param {number} fps @param {number} scale */
export function summaryText(durationMs, fps, scale) {
  const frames = Math.max(1, Math.round((durationMs / 1000) * fps));
  return `${frames} quadros · cerca de ${Math.max(5, Math.round(frames * SECONDS_PER_FRAME * Math.max(scale, 0.25)))} s para gerar`;
}

/** "0,45 MB" @param {number} bytes */
export const sizeText = (bytes) => `${(bytes / 1e6).toFixed(2).replace(".", ",")} MB`;

const esc = (/** @type {unknown} */ v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);
const api = () => `/api/project/${encodeURIComponent(ctx.slug)}/design`;
const JSON_HEADERS = { "Content-Type": "application/json" };

/** @type {{ job: any, timer: number, formats: string[] | null, info: { duration: number, fps: number, size: { w: number, h: number } }, view: string, error: string }} */
const st = { job: null, timer: 0, formats: null, info: { duration: 0, fps: 30, size: { w: 1280, h: 720 } }, view: "form", error: "" };

const dialogEl = () => /** @type {HTMLElement | null} */ (document.getElementById("atelierMotionExport"));
const q = (/** @type {string} */ sel) => /** @type {HTMLElement | null} */ (dialogEl()?.querySelector(sel) || null);

async function loadFormats() {
  if (st.formats) return st.formats;
  try {
    const res = await fetch(`${api()}/motion/export-formats`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    st.formats = body.formats;
  } catch (err) {
    st.error = `Não foi possível verificar os formatos: ${/** @type {Error} */ (err).message}`;
    st.formats = ["gif"];
  }
  return st.formats;
}

function formHtml() {
  const formats = st.formats || ["webm", "mp4", "gif"];
  const radios = ["webm", "mp4", "gif"].map((f, i) => `<label><input type="radio" name="motionExportFormat" value="${f}" ${i === 0 ? "checked" : ""} ${formats.includes(f) ? "" : "disabled"}><span>${f.toUpperCase().replace("WEBM", "WebM")}<small>${formats.includes(f) ? HINTS[/** @type {"gif"} */ (f)] : "indisponível aqui"}</small></span></label>`).join("");
  return `<div class="proto-motion-export__field"><span id="motionExportFmtLabel">Formato</span>
      <div class="proto-motion-export__seg" role="radiogroup" aria-labelledby="motionExportFmtLabel">${radios}</div></div>
    <div class="proto-motion-export__row">
      <label class="proto-motion-export__field"><span>Quadros por segundo</span><select data-export="fps"></select></label>
      <label class="proto-motion-export__field"><span>Tamanho</span><select data-export="scale"></select></label>
    </div>
    <div class="proto-motion-export__summary" data-export="summary"></div>`;
}

const VIEWS = {
  form: () => formHtml(),
  run: () => `<div class="proto-motion-export__status" data-export="runText" aria-live="polite">Preparando...</div>
    <div class="proto-motion-export__progress" role="progressbar" aria-label="Progresso da exportação" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-export="bar"></i></div>
    <div class="proto-motion-export__summary">Pode continuar usando o Atelier; o vídeo fica pronto aqui.</div>`,
  done: () => `<div class="proto-motion-export__status is-ok"><i class="fa-solid fa-circle-check"></i> Pronto: <b>${esc(st.job?.format?.toUpperCase())}</b> (${sizeText(st.job?.bytes || 0)})</div>
    <div class="proto-motion-export__summary">O arquivo fica disponível por 24 horas.</div>`,
  error: () => `<div class="proto-motion-export__status is-err"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível exportar: ${esc(st.error)}</div>`,
};

const ACTIONS = {
  form: '<button type="button" class="btn-proto-vp" data-export-act="close">Cancelar</button><button type="button" class="btn-proto-vp is-primary" data-export-act="start"><i class="fa-solid fa-download"></i> Exportar</button>',
  run: '<button type="button" class="btn-proto-vp" data-export-act="cancel"><i class="fa-solid fa-stop"></i> Cancelar exportação</button>',
  done: () => `<button type="button" class="btn-proto-vp" data-export-act="form">Exportar outro</button><a class="btn-proto-vp is-primary" data-export-act="download" href="${api()}/motion/export/${esc(st.job?.id)}/file" download><i class="fa-solid fa-download"></i> Baixar</a>`,
  error: '<button type="button" class="btn-proto-vp" data-export-act="close">Fechar</button><button type="button" class="btn-proto-vp is-primary" data-export-act="form">Tentar de novo</button>',
};

function fillOptions() {
  const format = /** @type {HTMLInputElement | null} */ (dialogEl()?.querySelector('input[name="motionExportFormat"]:checked'))?.value || "webm";
  const fps = fpsChoices(format, st.info.fps);
  const fpsSel = /** @type {HTMLSelectElement} */ (q('[data-export="fps"]'));
  const scaleSel = /** @type {HTMLSelectElement} */ (q('[data-export="scale"]'));
  if (!fpsSel || !scaleSel) return;
  fpsSel.innerHTML = fps.list.map((v) => `<option value="${v}" ${v === fps.selected ? "selected" : ""}>${v} fps</option>`).join("");
  scaleSel.innerHTML = scaleChoices(format, st.info.size).map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  updateSummary();
}

function updateSummary() {
  const out = q('[data-export="summary"]');
  const fps = Number(/** @type {HTMLSelectElement} */ (q('[data-export="fps"]'))?.value || 30);
  const scale = Number(/** @type {HTMLSelectElement} */ (q('[data-export="scale"]'))?.value || 1);
  if (out) out.textContent = summaryText(st.info.duration, fps, scale);
}

/** @param {"form" | "run" | "done" | "error"} view */
function show(view) {
  st.view = view;
  const body = q('[data-export="body"]');
  const actions = q('[data-export="actions"]');
  if (!body || !actions) return;
  body.innerHTML = VIEWS[view]();
  const a = ACTIONS[view];
  actions.innerHTML = typeof a === "function" ? a() : a;
  if (view === "form") fillOptions();
  if (view === "run") paintProgress();
}

function paintProgress() {
  const job = st.job || {};
  const pct = job.total ? Math.round((job.frame / job.total) * 100) : 0;
  const text = q('[data-export="runText"]');
  if (text) text.textContent = job.status === "queued" ? "Na fila: outra exportação deste projeto está em andamento." : job.total ? `Quadro ${job.frame} de ${job.total}` : "Preparando...";
  const bar = q('[data-export="bar"]');
  if (bar) bar.style.width = `${pct}%`;
  q('[role="progressbar"]')?.setAttribute("aria-valuenow", String(pct));
}

async function poll() {
  if (!st.job) return;
  try {
    const res = await fetch(`${api()}/motion/export/${st.job.id}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    st.job = body.job;
  } catch (err) {
    st.job = { ...st.job, status: "error", error: /** @type {Error} */ (err).message };
  }
  if (st.job.status === "done") { stopPolling(); if (st.view === "run") show("done"); }
  else if (st.job.status === "error") { stopPolling(); st.error = st.job.error || "erro desconhecido"; show("error"); }
  else if (st.job.status === "cancelled") { stopPolling(); st.job = null; show("form"); }
  else paintProgress();
}

function stopPolling() { clearInterval(st.timer); st.timer = 0; }

async function start() {
  const format = /** @type {HTMLInputElement | null} */ (dialogEl()?.querySelector('input[name="motionExportFormat"]:checked'))?.value;
  const fps = Number(/** @type {HTMLSelectElement} */ (q('[data-export="fps"]'))?.value);
  const scale = Number(/** @type {HTMLSelectElement} */ (q('[data-export="scale"]'))?.value);
  try {
    const res = await fetch(`${api()}/prototypes/${encodeURIComponent(ctx.protoId)}/motion/${encodeURIComponent(ctx.screen)}/export`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ format, fps, scale }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    st.job = body.job;
    show("run");
    stopPolling();
    st.timer = window.setInterval(() => { void poll(); }, 1000);
  } catch (err) {
    st.error = /** @type {Error} */ (err).message;
    show("error");
  }
}

async function cancel() {
  if (!st.job) return show("form");
  await fetch(`${api()}/motion/export/${st.job.id}`, { method: "DELETE", headers: JSON_HEADERS }).catch(() => undefined);
  await poll();
}

/** Opens or closes the dialog. @param {boolean} on @param {{ duration: number, fps: number, size?: { w: number, h: number } }} [info] */
export async function toggleExportDialog(on, info) {
  const el = dialogEl();
  if (!el) return;
  if (info) st.info = { duration: info.duration, fps: info.fps, size: info.size || { w: 1280, h: 720 } };
  el.hidden = !on;
  const button = document.querySelector('[data-motion="export"]');
  button?.setAttribute("aria-expanded", String(on));
  button?.classList.toggle("active", on);
  if (!on) return /** @type {HTMLElement | null} */ (button)?.focus();
  if (st.job && ["queued", "running"].includes(st.job.status)) return show("run");
  if (st.job && st.job.status === "done") return show("done");
  await loadFormats();
  show(st.error && st.formats?.length === 1 ? "error" : "form");
  /** @type {HTMLElement | null} */ (el.querySelector('input[name="motionExportFormat"]:checked'))?.focus();
}

/** Dialog shell placed inside the motion bar. */
export function exportDialogHtml() {
  return `<section class="proto-motion-export" id="atelierMotionExport" role="dialog" aria-modal="false" aria-labelledby="atelierMotionExportTitle" hidden>
    <header><i class="fa-solid fa-file-video"></i> <span id="atelierMotionExportTitle">Exportar animação</span>
      <button type="button" class="btn-proto-vp" data-export-act="close" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="proto-motion-export__body" data-export="body"></div>
    <div class="proto-motion-export__actions" data-export="actions"></div>
  </section>`;
}

/** Event delegation for the dialog; installed once by the player. */
export function bindExportDialog() {
  document.addEventListener("click", (e) => {
    const act = /** @type {HTMLElement} */ (e.target)?.closest?.("[data-export-act]")?.getAttribute("data-export-act");
    if (act === "close") void toggleExportDialog(false);
    else if (act === "start") void start();
    else if (act === "cancel") void cancel();
    else if (act === "form") { st.job = null; st.error = ""; show("form"); }
  });
  document.addEventListener("change", (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    if (el?.getAttribute?.("name") === "motionExportFormat") fillOptions();
    else if (el?.dataset?.export === "fps" || el?.dataset?.export === "scale") updateSummary();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialogEl() && !dialogEl()?.hidden && dialogEl()?.contains(/** @type {Node} */ (e.target))) void toggleExportDialog(false);
  });
}
