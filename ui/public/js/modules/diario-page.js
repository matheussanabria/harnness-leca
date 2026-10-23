// @ts-check
// Página do Diário: filtros, ordenação e paginação persistidos na tela "diario".
import { getScreenStateClient } from "../shared/screen-state.js";
import {
  diarioStatePatch,
  filterDiarioDays,
  normalizeDiarioState,
  paginateDiarioDays,
} from "../diario-state.js";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const dateBR = (iso) => {
  const [year, month, day] = String(iso).split("-");
  return `${day}/${month}/${year}`;
};
const weekday = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "?");
const dayOf = (iso) => new Date(iso).toLocaleDateString("sv-SE");
const AGENTS = ["claude", "gemini", "opencode"];

const client = getScreenStateClient();
const params = new URLSearchParams(location.search);
let data = [];
let state = normalizeDiarioState({});
let totalPages = 1;
let searchTimer = null;

function save() {
  void client.patchScreen("diario", diarioStatePatch(state)).catch(() => {});
}

function sessionText(session) {
  return [session.titulo, ...session.prompts, ...session.edited, ...session.commands, ...session.dis].join(" ");
}

function list(items, max, format = esc) {
  if (!items.length) return "";
  const head = items.slice(0, max).map((item) => `<li>${format(item)}</li>`).join("");
  const rest = items.slice(max);
  const more = rest.length
    ? `<details><summary>+${rest.length} mais</summary><ul>${rest.map((item) => `<li>${format(item)}</li>`).join("")}</ul></details>`
    : "";
  return `<ul>${head}</ul>${more}`;
}

function renderSession(session, day) {
  const ended = dayOf(session.fim) === day ? hhmm(session.fim) : `${dateBR(dayOf(session.fim))} ${hhmm(session.fim)}`;
  const cls = AGENTS.includes(session.agente) ? ` ag-${session.agente}` : "";
  return `<div class="sess">
    <h4><span class="time">${hhmm(session.inicio)}–${ended}</span><span class="tag${cls}">${esc(session.agente)}</span>${esc(session.titulo)}
      ${session.dis.map((item) => `<span class="tag dis">${esc(item)}</span>`).join("")}</h4>
    ${session.prompts.length ? `<div class="lbl">Pedidos (${session.prompts.length})</div>${list(session.prompts, 5)}` : ""}
    ${session.edited.length ? `<div class="lbl">Arquivos alterados (${session.edited.length})</div>${list(session.edited, 8, (item) => `<code>${esc(item)}</code>`)}` : ""}
    ${session.commands.length ? `<div class="lbl">Comandos relevantes</div>${list(session.commands, 5, (item) => `<code>${esc(item)}</code>`)}` : ""}
    <div class="src">chats/${esc(session.file)} · ${session.toolCount} chamada(s) de ferramenta</div>
  </div>`;
}

function render() {
  const filtered = filterDiarioDays(data, state, sessionText);
  const lastPage = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), lastPage);
  const page = paginateDiarioDays(filtered, state);
  totalPages = page.pages;
  const sessions = page.days.reduce((sum, day) => sum + day.sessions.length, 0);
  const prompts = page.days.reduce((sum, day) => sum + day.sessions.reduce((n, session) => n + session.prompts.length, 0), 0);
  $("sub").textContent = `${$("fProject").value} · ${filtered.length} dia(s), ${sessions} sessão(ões), ${prompts} pedido(s) nesta página`;
  $("pageInfo").textContent = `Página ${state.page} de ${page.pages}`;
  $("btnPrev").disabled = state.page <= 1;
  $("btnNext").disabled = state.page >= page.pages;
  if (!page.days.length) {
    $("days").innerHTML = `<div class="empty">${data.length ? "Nada encontrado com esses filtros." : "Sem atividade registrada. Rode o sync para importar as conversas."}</div>`;
    return;
  }
  $("days").innerHTML = page.days.map((day) => {
    const agents = [...new Set(day.sessions.map((session) => session.agente))];
    const dis = [...new Set(day.sessions.flatMap((session) => session.dis))];
    const count = day.sessions.reduce((sum, session) => sum + session.prompts.length, 0);
    return `<section class="day${state.allClosed ? " closed" : ""}" data-day="${esc(day.day)}">
      <div class="day-h" role="button" tabindex="0">
        <b>${dateBR(day.day)} <span class="time">${esc(weekday(day.day))}</span></b>
        <span class="meta">${day.sessions.length} sessão(ões) · ${count} pedido(s)
          ${agents.map((agent) => `<span class="tag${AGENTS.includes(agent) ? ` ag-${agent}` : ""}">${esc(agent)}</span>`).join("")}
          ${dis.slice(0, 6).map((item) => `<span class="tag dis">${esc(item)}</span>`).join("")}${dis.length > 6 ? `<span class="tag">+${dis.length - 6}</span>` : ""}
        </span>
      </div>
      <div class="sess-wrap">${day.sessions.map((session) => renderSession(session, day.day)).join("")}</div>
    </section>`;
  }).join("");
  document.querySelectorAll(".day-h").forEach((header) => {
    const toggle = () => header.parentElement?.classList.toggle("closed");
    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (event) => {
      if (/** @type {KeyboardEvent} */ (event).key === "Enter" || /** @type {KeyboardEvent} */ (event).key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  });
}

async function loadProjects() {
  const response = await fetch("/api/overview?page=1&pageSize=50");
  const overview = await response.json();
  $("fProject").innerHTML = (overview.projects || [])
    .map((project) => `<option value="${esc(project.slug)}">${esc(project.slug)}${project.active ? " (ativo)" : ""}</option>`)
    .join("");
  const wanted = params.get("p") || state.project || overview.active || overview.projects?.[0]?.slug || "";
  if (wanted) $("fProject").value = wanted;
  state.project = $("fProject").value;
}

async function loadJournal() {
  const slug = $("fProject").value;
  if (!slug) {
    $("days").innerHTML = '<div class="empty">Nenhum projeto.</div>';
    return;
  }
  $("days").innerHTML = '<div class="empty">Carregando…</div>';
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/journal`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = (await response.json()).days || [];
  } catch (error) {
    data = [];
    $("days").innerHTML = `<div class="empty">Não foi possível carregar o diário (${esc(error.message)}).</div>`;
    return;
  }
  const agents = [...new Set(data.flatMap((day) => day.sessions.map((session) => session.agente)))].sort();
  $("fAgent").innerHTML = '<option value="">todos</option>' + agents
    .map((agent) => `<option>${esc(agent)}</option>`).join("");
  syncFields();
  render();
}

function syncFields() {
  $("fAgent").value = state.agentFilter;
  $("fFrom").value = state.dateFrom;
  $("fTo").value = state.dateTo;
  $("fText").value = state.query;
  $("fOrder").value = `${state.sortField}:${state.sortAsc ? "asc" : "desc"}`;
  $("fPageSize").value = String(state.pageSize);
  $("btnToggle").textContent = state.allClosed ? "Expandir tudo" : "Recolher tudo";
  $("btnToggle").setAttribute("aria-pressed", String(state.allClosed));
}

function readFilters() {
  const order = ($("fOrder").value || "day:desc").split(":");
  state = {
    ...state,
    agentFilter: $("fAgent").value,
    dateFrom: $("fFrom").value,
    dateTo: $("fTo").value,
    query: $("fText").value,
    sortField: order[0],
    sortAsc: order[1] === "asc",
    page: 1,
  };
  save();
  render();
}

function syncUrl() {
  const query = new URLSearchParams();
  if ($("fProject").value) query.set("p", $("fProject").value);
  history.replaceState(null, "", `${location.pathname}?${query}`);
}

async function init() {
  try {
    state = normalizeDiarioState(await client.loadScreen("diario"));
  } catch {}
  await loadProjects().catch((error) => {
    $("days").innerHTML = `<div class="empty">Não foi possível carregar os projetos (${esc(error.message)}).</div>`;
  });
  $("fProject").onchange = () => {
    state.project = $("fProject").value;
    state.page = 1;
    save();
    syncUrl();
    void loadJournal();
  };
  for (const id of ["fAgent", "fFrom", "fTo", "fOrder"]) $(id).onchange = readFilters;
  $("fText").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(readFilters, 250);
  };
  $("fPageSize").onchange = () => {
    state.pageSize = Number($("fPageSize").value) || 10;
    state.page = 1;
    save();
    render();
  };
  $("btnClear").onclick = () => {
    state = { ...state, agentFilter: "", dateFrom: "", dateTo: "", query: "", page: 1, allClosed: false };
    save();
    syncFields();
    render();
  };
  $("btnToggle").onclick = () => {
    state.allClosed = !state.allClosed;
    save();
    syncFields();
    render();
  };
  $("btnPrev").onclick = () => { state.page = Math.max(1, state.page - 1); save(); render(); };
  $("btnNext").onclick = () => { state.page = Math.min(totalPages, state.page + 1); save(); render(); };
  syncUrl();
  await loadJournal();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else void init();

export { init };
