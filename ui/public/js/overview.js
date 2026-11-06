const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kb = n => (n / 1024).toFixed(1).replace(".", ",") + " KB";
const dateBR = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

// Estado da tela persistido no servidor (EP-14.10); a URL não carrega mais filtros.
const SIZES = [10, 25, 50];
const SORT_FIELDS = ["lastChat", "chats", "memoryBytes", "slug"];
let OV = {
  page: 1,
  pageSize: 10,
  sortField: "lastChat",
  sortAsc: false,
  query: "",
  total: 0, pages: 1, projects: [],
};
$("selSize").value = String(OV.pageSize);

function normalizeOverviewState(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const page = Math.max(1, Math.floor(Number(value.page)) || 1);
  const size = Number(value.pageSize);
  return {
    page,
    pageSize: SIZES.includes(size) ? size : 10,
    sortField: SORT_FIELDS.includes(value.sortField) ? value.sortField : "lastChat",
    sortAsc: typeof value.sortAsc === "boolean" ? value.sortAsc : false,
    query: typeof value.query === "string" ? value.query.slice(0, 200) : "",
  };
}

function overviewStatePatch() {
  return {
    page: OV.page,
    pageSize: OV.pageSize,
    sortField: OV.sortField,
    sortAsc: OV.sortAsc,
    query: OV.query,
  };
}

function persistOverviewState() {
  const patch = overviewStatePatch();
  const hook = globalThis.__HARNESS_SCREEN_STATE_PATCH__;
  if (typeof hook === "function") {
    try { hook("overview", patch); } catch {}
    return;
  }
  if (typeof window === "undefined") return;
  import("/js/shared/screen-state.js")
    .then(mod => mod.patchScreen("overview", patch))
    .catch(() => {});
}

async function hydrateOverviewState() {
  const hook = globalThis.__HARNESS_SCREEN_STATE_LOAD__;
  let raw = null;
  if (typeof hook === "function") {
    try { raw = await hook("overview"); } catch {}
  } else if (typeof window !== "undefined") {
    try {
      const mod = await import("/js/shared/screen-state.js");
      raw = await mod.loadScreen("overview");
    } catch {}
  }
  if (!raw) return;
  OV = { ...OV, ...normalizeOverviewState(raw) };
  $("selSize").value = String(OV.pageSize);
}

function sortProjects(projects) {
  const field = OV.sortField, direction = OV.sortAsc ? 1 : -1;
  return [...projects].sort((a, b) => {
    const left = a[field] == null ? "" : a[field];
    const right = b[field] == null ? "" : b[field];
    if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
    return String(left).localeCompare(String(right), "pt-BR") * direction;
  });
}

function visibleProjects() {
  let projects = OV.projects || [];
  if (OV.query) {
    const query = OV.query.toLowerCase();
    projects = projects.filter(item => String(item.slug || "").toLowerCase().includes(query));
  }
  return sortProjects(projects);
}

// Estados da lista (loading, erro, vazio) vivem em #ovState; a lista some enquanto houver estado.
function showState(kind, html) {
  const el = $("ovState");
  el.className = "ov-state " + kind;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML = html;
  $("ovList").hidden = kind !== "";
  el.hidden = !html;
}
function clearState() { $("ovState").innerHTML = ""; $("ovState").hidden = true; $("ovList").hidden = false; }

async function loadOverview() {
  if (!OV.projects.length) showState("loading", '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Carregando…');
  try {
    const r = await fetch(`/api/overview?page=${OV.page}&pageSize=${OV.pageSize}`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    OV = { ...OV, ...await r.json() };
    render();
  } catch (err) {
    showState("error", `Não foi possível carregar a visão geral (${esc(err.message)}). <button type="button" class="btn-row" data-retry>Tentar de novo</button>`);
  }
}

function goPage(p) {
  if (p < 1 || p > OV.pages || p === OV.page) return;
  OV.page = p;
  persistOverviewState();
  loadOverview();
}
function setSize(v) {
  OV.pageSize = Number(v) || 10;
  OV.page = 1;
  persistOverviewState();
  loadOverview();
}

function chips(c) {
  if (!c || !c.total) return '<span class="status-badge status-none">sem conversas</span>';
  const pend = c.nova + c.alterada;
  const parts = [];
  if (c.ok) parts.push(`<span class="status-badge status-ok">${c.ok} em dia</span>`);
  if (pend) parts.push(`<span class="status-badge ${c.alterada && !c.nova ? "status-alterada" : "status-nova"}">${pend} pendente${pend > 1 ? "s" : ""}</span>`);
  return `<span class="chips">${parts.join("")}</span>`;
}

// Um único modelo por projeto alimenta a tabela (desktop) e os cards (mobile/tablet).
function rowModel(x) {
  const pend = x.review && x.review.pendentes;
  return {
    slug: x.slug,
    active: !!x.active,
    href: "/?p=" + encodeURIComponent(x.slug),
    meta: `${x.context} contexto · ${x.scheduled} agendada${x.scheduled === 1 ? "" : "s"}${x.lastChat ? " · último chat " + dateBR(x.lastChat) : ""}`,
    chats: x.chats,
    analyzed: !!(x.extraction && x.extraction.total),
    extraction: chips(x.extraction),
    review: pend
      ? `<span class="status-badge status-alterada" title="Sugestões de memória esperando revisão">${pend} pendente${pend > 1 ? "s" : ""}</span>`
      : '<span class="status-badge status-ok">em dia</span>',
    memory: kb(x.memoryBytes || 0),
  };
}

const nameHtml = (m) => `<a class="p-link" href="${m.href}" title="Abrir projeto">${esc(m.slug)}</a>${m.active ? '<span class="status-badge badge-active">ativo</span>' : ""}`;
const actionsHtml = (m) => `<div class="acts">
  <button type="button" class="btn-row sync" data-sync="${esc(m.slug)}" aria-label="Sincronizar ${esc(m.slug)}" title="Sincronizar conversas deste projeto (Claude, Gemini e OpenCode)"><i class="fa-solid fa-rotate" aria-hidden="true"></i> <span class="btn-label">Sync</span></button>
  <a class="btn-row" href="${m.href}" aria-label="Abrir ${esc(m.slug)}">Abrir <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
</div>`;

function tableRow(m) {
  return `<tr data-slug="${esc(m.slug)}">
    <td class="p-name"><div class="p-title">${nameHtml(m)}</div><div class="sub2">${m.meta}</div></td>
    <td class="cell-num">${m.chats}${m.analyzed ? '<div class="sub2">analisadas</div>' : ""}</td>
    <td>${m.extraction}</td>
    <td class="cell-num">${m.review}</td>
    <td class="cell-num">${m.memory}</td>
    <td>${actionsHtml(m)}</td>
  </tr>`;
}

function projectCard(m) {
  return `<article class="p-card" data-slug="${esc(m.slug)}">
    <div class="p-title">${nameHtml(m)}</div>
    <div class="sub2">${m.meta}</div>
    <dl class="p-stats">
      <div><dt>Conversas</dt><dd>${m.chats}${m.analyzed ? ' <span class="sub2">analisadas</span>' : ""}</dd></div>
      <div><dt>Extração</dt><dd>${m.extraction}</dd></div>
      <div><dt>Revisões</dt><dd>${m.review}</dd></div>
      <div><dt>Memória</dt><dd>${m.memory}</dd></div>
    </dl>
    ${actionsHtml(m)}
  </article>`;
}

function render() {
  const models = visibleProjects().map(rowModel);
  $("sub").innerHTML = `${OV.total} projeto${OV.total === 1 ? "" : "s"} no harness · ${OV.active ? `ativo: <b>${esc(OV.active)}</b>` : "nenhum projeto ativo em <code>projects/.active</code>"}`;
  $("totBadge").textContent = `${OV.total} projeto${OV.total === 1 ? "" : "s"}`;
  $("pageInfo").textContent = OV.total ? `página ${OV.page} de ${OV.pages}` : "";

  if (models.length) {
    clearState();
    $("rows").innerHTML = models.map(tableRow).join("");
    $("cards").innerHTML = models.map(projectCard).join("");
  } else {
    $("rows").innerHTML = "";
    $("cards").innerHTML = "";
    showState("empty", 'Nenhum projeto ainda. Copie <code>projects/_template</code> ou importe conversas com <code>tools/import-claude-code-chats.js</code>. <button type="button" class="btn-row" data-retry>Recarregar</button>');
  }

  const from = OV.total ? (OV.page - 1) * OV.pageSize + 1 : 0;
  const to = Math.min(OV.page * OV.pageSize, OV.total);
  $("pagerInfo").textContent = OV.total ? `Mostrando ${from}–${to} de ${OV.total}` : "—";
  $("btnPrev").disabled = OV.page <= 1;
  $("btnNext").disabled = OV.page >= OV.pages;
  if (typeof applyLocks === "function") applyLocks();
}

// Ações dos dois layouts passam por um único ponto (sem onclick inline).
document.addEventListener("click", (ev) => {
  const el = ev.target && ev.target.closest ? ev.target.closest("[data-sync],[data-retry]") : null;
  if (!el) return;
  if (el.hasAttribute("data-retry")) loadOverview();
  else syncRow(el.getAttribute("data-sync"));
});

async function startOverview() {
  await hydrateOverviewState();
  await loadOverview();
}
startOverview();
