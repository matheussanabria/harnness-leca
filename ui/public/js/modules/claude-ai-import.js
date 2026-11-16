// @ts-check
// "Importar claude.ai" dialog: point at a claude.ai data export (extracted folder or the raw zips),
// list its chats, pick some and import them into the active project.
import { esc, openDlg } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { load } from "./projects-load.js";

const PATH_KEY = "harness.claudeAiExportPath";
/** @type {{ items: any[], filter: string, hideImported: boolean, selected: Set<string>, busy: boolean }} */
const ui = { items: [], filter: "", hideImported: true, selected: new Set(), busy: false };

const remembered = () => { try { return localStorage.getItem(PATH_KEY) || ""; } catch { return ""; } };
const remember = (v) => { try { localStorage.setItem(PATH_KEY, v); } catch { /* storage blocked */ } };
const el = (id) => /** @type {any} */ (document.getElementById(id));

function visible() {
  const q = ui.filter.trim().toLowerCase();
  return ui.items.filter((it) => {
    if (ui.hideImported && it.importedIn.length) return false;
    return !q || `${it.title} ${it.project}`.toLowerCase().includes(q);
  });
}

function rowHtml(it) {
  const icon = it.kind === "design" ? "fa-pen-ruler" : "fa-comments";
  const date = String(it.updated || it.created || "").slice(0, 10);
  const done = it.importedIn.length
    ? `<span class="cai-tag" title="Já importada em ${esc(it.importedIn.join(", "))}"><i class="fa-solid fa-check"></i> ${esc(it.importedIn.join(", "))}</span>`
    : "";
  return `<label class="cai-row">
    <input type="checkbox" data-id="${esc(it.id)}" ${ui.selected.has(it.id) ? "checked" : ""}>
    <i class="fa-solid ${icon} cai-kind" title="${it.kind === "design" ? "Claude Design" : "Chat"}"></i>
    <span class="cai-title">${esc(it.title)}${it.project ? ` <span class="cai-proj">[${esc(it.project)}]</span>` : ""}</span>
    ${done}
    <span class="cai-meta">${esc(date)} · ${it.turns} turnos</span>
  </label>`;
}

function renderList() {
  const box = el("caiList");
  if (!box) return;
  const rows = visible();
  box.innerHTML = rows.length ? rows.map(rowHtml).join("") : `<p class="empty">${ui.items.length ? "Nada com esse filtro." : ""}</p>`;
  renderMeta();
}

/** Counters and the import button; cheap, so checkbox clicks do not rebuild the list. */
function renderMeta() {
  const imported = ui.items.filter((it) => it.importedIn.length).length;
  el("caiSummary").textContent = ui.items.length
    ? `${ui.items.length} conversas no export · ${imported} já importadas · ${visible().length} visíveis · ${ui.selected.size} selecionadas`
    : "";
  el("caiImport").disabled = ui.busy || !ui.selected.size;
  el("caiImport").innerHTML = `<i class="fa-solid fa-file-import"></i> Importar ${ui.selected.size || ""} para ${esc(state.P.slug)}`;
}

function status(text, kind = "info") {
  const s = el("caiStatus");
  if (s) { s.className = `cai-status ${kind}`; s.innerHTML = text; }
}

async function post(url, payload) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function listExport() {
  const exportPath = el("caiPath").value.trim();
  if (!exportPath || ui.busy) return;
  ui.busy = true;
  status(`<i class="fa-solid fa-spinner fa-spin"></i> ${/manifest-[^\\/]*\.(json|zip)"?$/i.test(exportPath) ? "Baixando os zips do manifest e lendo o export (pode levar um tempo na primeira vez)..." : "Lendo o export (zips são extraídos na primeira vez)..."}`);
  try {
    const data = await post("/api/claude-ai-import/list", { exportPath });
    remember(exportPath);
    ui.items = data.items;
    ui.selected.clear();
    status(`<i class="fa-solid fa-circle-check"></i> Export lido.`, "success");
  } catch (err) {
    ui.items = [];
    status(`<i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}`, "error");
  } finally {
    ui.busy = false;
    renderList();
  }
}

async function importSelected() {
  if (!ui.selected.size || ui.busy) return;
  ui.busy = true;
  renderList();
  status(`<i class="fa-solid fa-spinner fa-spin"></i> Importando ${ui.selected.size} conversa(s)...`);
  try {
    const data = await post(`/api/project/${encodeURIComponent(state.P.slug)}/claude-ai-import`, {
      exportPath: el("caiPath").value.trim(),
      ids: [...ui.selected],
      withTools: el("caiTools").checked,
    });
    for (const it of ui.items) if (ui.selected.has(it.id) && !it.importedIn.includes(state.P.slug)) it.importedIn.push(state.P.slug);
    ui.selected.clear();
    status(`<i class="fa-solid fa-circle-check"></i> ${esc(data.mensagem)}`, "success");
    await load(state.P.slug);
  } catch (err) {
    status(`<i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}`, "error");
  } finally {
    ui.busy = false;
    renderList();
  }
}

export function openClaudeAiImport() {
  if (!state.P || !state.P.slug) return;
  ui.items = [];
  ui.selected.clear();
  ui.filter = "";
  const html = `<div class="cai">
    <p class="cai-help">Informe o caminho do <code>manifest-*.json</code> (ou <code>manifest-*.zip</code>) do export do claude.ai:
      o servidor baixa só os zips de conversas e de Design (os links valem 24 h). Também serve a pasta com
      <code>conversations-000.zip</code> / <code>design_chats-000.zip</code> ou a pasta já extraída. Nada é importado sem você marcar.</p>
    <div class="cai-bar">
      <input id="caiPath" class="cai-input" type="text" placeholder="C:\\Users\\voce\\Downloads\\manifest-....json" value="${esc(remembered())}">
      <button type="button" class="btn-chat-action" data-act="list"><i class="fa-solid fa-folder-open"></i> Ler export</button>
    </div>
    <div id="caiStatus" class="cai-status"></div>
    <div class="cai-bar">
      <input id="caiFilter" class="cai-input" type="search" placeholder="Filtrar por título ou projeto do Design">
      <label class="cai-opt"><input id="caiHide" type="checkbox" checked> Ocultar já importadas</label>
      <button type="button" class="btn-chat-action" data-act="all"><i class="fa-regular fa-square-check"></i> Marcar visíveis</button>
      <button type="button" class="btn-chat-action" data-act="none"><i class="fa-regular fa-square"></i> Limpar</button>
    </div>
    <div id="caiSummary" class="cai-summary"></div>
    <div id="caiList" class="cai-list"></div>
    <div class="cai-bar cai-foot">
      <label class="cai-opt"><input id="caiTools" type="checkbox" checked> Incluir ferramentas e raciocínio</label>
      <button type="button" id="caiImport" class="btn-send" data-act="import" disabled><i class="fa-solid fa-file-import"></i> Importar</button>
    </div>
  </div>`;
  openDlg("Importar conversas do claude.ai", "", html);
  const dbody = el("dbody");
  dbody.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "list") listExport();
    else if (act === "import") importSelected();
    else if (act === "all") { for (const it of visible()) ui.selected.add(it.id); renderList(); }
    else if (act === "none") { ui.selected.clear(); renderList(); }
  };
  dbody.oninput = (e) => {
    const t = e.target;
    if (t.id === "caiFilter") { ui.filter = t.value; renderList(); }
    else if (t.id === "caiHide") { ui.hideImported = t.checked; renderList(); }
    else if (t.dataset && t.dataset.id) { t.checked ? ui.selected.add(t.dataset.id) : ui.selected.delete(t.dataset.id); renderMeta(); }
  };
  el("caiPath").addEventListener("keydown", (e) => { if (e.key === "Enter") listExport(); });
  el("caiHide").checked = ui.hideImported;
  if (el("caiPath").value) listExport();
}
