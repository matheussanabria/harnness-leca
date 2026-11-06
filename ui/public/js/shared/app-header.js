// Standard app header: one brand + one nav for every screen.
// Page-specific items stay in the HTML as slots inside <header data-app-header>:
//   [data-slot="left"]  after the brand (project select, page badge)
//   [data-slot="right"] after the nav (screen-only actions)
// The header only needs data-current="<nav id>" to mark the active screen.

export const NAV_ITEMS = [
  { id: "home", href: "/", icon: "fa-house", label: "Início", title: "Projetos e conversas" },
  { id: "overview", href: "/overview", icon: "fa-chart-simple", label: "Visão geral", title: "Resumo de todos os projetos e ações do sistema" },
  { id: "diario", href: "/diario", icon: "fa-book", label: "Diário", title: "Diário de atividade: o que foi pedido e feito, dia a dia" },
  { id: "consumo", href: "/consumo", icon: "fa-gauge-high", label: "Consumo", title: "Cotas, 9Router por combo e OpenCode" },
  { id: "catalogo", href: "/catalogo", icon: "fa-layer-group", label: "Catálogo", title: "Skills e agentes por área" },
  { id: "deploy", href: "/deploy", icon: "fa-rocket", label: "Deploy", title: "Deploys rápidos (Easypanel / Hostinger VPS)" },
  { id: "office", href: "/escritorio", icon: "fa-building", label: "Escritório", title: "Escritório virtual dos agentes" },
];

export function renderBrand() {
  return '<a class="app-brand" href="/"><img class="app-brand-logo" src="/img/harness-logo.png" alt="" width="32" height="32"> <span>Harness</span></a>';
}

export function renderNav(current) {
  const links = NAV_ITEMS.map((item) => {
    const active = item.id === current;
    const cls = active ? "app-nav-item is-current" : "app-nav-item";
    const aria = active ? ' aria-current="page"' : "";
    return `<a class="${cls}" href="${item.href}" title="${item.title}"${aria}><i class="fa-solid ${item.icon}" aria-hidden="true"></i> <span>${item.label}</span></a>`;
  });
  return `<nav class="app-nav" aria-label="Navegação principal">${links.join("")}</nav>`;
}

export function renderMenuToggle() {
  return '<button type="button" class="app-menu-toggle" aria-label="Abrir menu" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>';
}

// Mobile only (CSS hides the toggle on wide screens): opens or closes the nav and the right slot.
function wireMenuToggle(header) {
  const btn = header.querySelector(".app-menu-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const open = header.classList.toggle("menu-open");
    btn.setAttribute("aria-expanded", String(open));
    btn.firstElementChild.className = open ? "fa-solid fa-xmark" : "fa-solid fa-bars";
  });
}

// Wraps the existing slot children so brand and nav stay in a fixed order.
export function mountAppHeader(header) {
  if (!header || header.dataset.appHeaderReady) return;
  const current = header.dataset.current || "";
  const left = header.querySelector('[data-slot="left"]');
  const right = header.querySelector('[data-slot="right"]');
  header.classList.add("app-header");
  header.insertAdjacentHTML("afterbegin", renderBrand());
  const brand = header.querySelector(".app-brand");
  const nav = document.createElement("div");
  nav.innerHTML = renderNav(current);
  const navEl = nav.firstElementChild;
  if (left) brand.after(left);
  (left || brand).after(navEl);
  if (right) navEl.after(right);
  const holder = document.createElement("div");
  holder.innerHTML = renderMenuToggle();
  (left || brand).after(holder.firstElementChild);
  wireMenuToggle(header);
  header.dataset.appHeaderReady = "1";
}

if (typeof document !== "undefined") {
  const run = () => mountAppHeader(document.querySelector("header[data-app-header]"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}
