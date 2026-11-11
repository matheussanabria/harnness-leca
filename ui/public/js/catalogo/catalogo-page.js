// @ts-check
// Controller of /catalogo: loads GET /api/catalog, filters, routes and manages history.
import { filterItems, groupByArea, areaCounts } from "./catalogo-model.js";
import { openBrowser, closeBrowser, wireBrowser } from "./catalogo-browser.js";
import { renderAreaChips, renderGroups, esc } from "./catalogo-view.js";
import {
  parseRoute,
  pushRoute,
  replaceRoute,
  navigateBack,
  initRouter,
} from "./catalogo-router.js";

const filter = { kind: "skill", area: "all", text: "" };
let data = { areas: [], items: [], canManage: false };

const $ = (id) => document.getElementById(id);

function paint() {
  const counts = areaCounts(data.items, filter);
  $("kAreas").innerHTML = renderAreaChips(data.areas, counts, filter.area);
  const groups = groupByArea(filterItems(data.items, filter), data.areas);
  $("kList").innerHTML = renderGroups(groups, data.areas, data.canManage);
  for (const btn of document.querySelectorAll(".k-tab")) {
    btn.classList.toggle("is-on", btn.getAttribute("data-kind") === filter.kind);
  }
  const count = (kind) => data.items.filter((i) => i.kind === kind).length;
  if ($("kCountSkill")) $("kCountSkill").textContent = count("skill");
  if ($("kCountAgent")) $("kCountAgent").textContent = count("agent");
  if ($("kCountWorkflow")) $("kCountWorkflow").textContent = count("workflow");
}

function applyRoute(route, shouldPush = false) {
  if (route.view === "detail" && route.id) {
    const target = data.items.find((i) => i.kind === route.kind && (i.name === route.id || i.ref === route.id));
    if (target) {
      filter.kind = route.kind;
      if (shouldPush) pushRoute(route);
      else if (route.legacy) replaceRoute(route);
      paint();
      openBrowser(target, data.canManage);
      return;
    }
  }

  filter.kind = route.kind || "skill";
  closeBrowser();
  if (shouldPush) pushRoute(route);
  else if (route.legacy) replaceRoute(route);
  paint();
}

async function load() {
  try {
    const res = await fetch("/api/catalog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    const currentRoute = parseRoute(window.location.pathname, window.location.search);
    applyRoute(currentRoute, false);
  } catch (err) {
    $("kList").innerHTML = `<p class="c-empty">Não foi possível carregar o catálogo: ${esc(err.message)}</p>`;
  }
}

async function saveArea(kind, name, area) {
  const res = await fetch("/api/catalog/area", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, name, area }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  data = await res.json();
}

export function startCatalogoPage() {
  $("kSearch").addEventListener("input", (e) => {
    filter.text = e.target.value;
    paint();
  });

  document.querySelector(".k-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-kind]");
    if (!btn) return;
    const nextKind = btn.getAttribute("data-kind");
    filter.area = "all";
    applyRoute({ view: "list", kind: nextKind }, true);
  });

  $("kAreas").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-area]");
    if (!btn) return;
    filter.area = btn.getAttribute("data-area");
    paint();
  });

  wireBrowser(() => navigateBack({ view: "list", kind: filter.kind }));
  initRouter((route) => applyRoute(route, false));

  $("kList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;
    const [kind, source, ref] = btn.getAttribute("data-open").split(":");
    const item = data.items.find((i) => i.kind === kind && i.source === source && i.ref === ref);
    if (item) applyRoute({ view: "detail", kind: item.kind, id: item.name }, true);
  });

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav-kind]");
    if (!nav) return;
    const targetKind = nav.getAttribute("data-nav-kind");
    const targetName = nav.getAttribute("data-nav-name");
    applyRoute({ view: "detail", kind: targetKind, id: targetName }, true);
  });

  $("kList").addEventListener("change", async (e) => {
    const sel = e.target.closest(".k-select");
    if (!sel) return;
    try {
      await saveArea(sel.dataset.kind, sel.dataset.name, sel.value);
    } catch (err) {
      $("kList").insertAdjacentHTML("afterbegin", `<p class="c-empty">Falha ao salvar: ${esc(err.message)}</p>`);
      return;
    }
    paint();
  });

  load();
}
