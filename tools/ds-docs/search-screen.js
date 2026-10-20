// @ts-check
"use strict";
/**
 * Tela "Pesquisar paciente" do fluxo do paciente (modular): formulário de busca, abas
 * (esperados / em atraso) e tabelas. O clique no paciente leva à Visão geral.
 * Reaproveita o cabeçalho da Visão geral já gerada, então herda logo e ícones corrigidos.
 */
const T = require("./screen-transform");

const SEARCH_ID = "pesquisar-paciente";

const M = (n, q, p) => ({ n, q, p: !!p });
const PATIENTS = [
  { nome: "Carmen Vargas Teixeira", idade: 25, nasc: "06/12/1998", mae: "Marta Teixeira", esp: true, days: 10, meds: [M("Enalapril 10 mg, comprimido, oral", "30 comp."), M("Omeprazol 20mg, capsula, oral", "60 cap."), M("Lanceta universal para uso em lancetador universal", "30 un.", true), M("Tira p/ medir glicose sanguínea", "50 un.", true)] },
  { nome: "Eduardo Oliveira Soares", idade: 56, nasc: "14/03/1970", mae: "Rosa Soares", esp: true, days: 8, meds: [M("Lorazepam 2mg, comprimido", "30 comp.")] },
  { nome: "Fabiana Brum Farias", idade: 21, nasc: "22/08/2005", mae: "Lúcia Farias", esp: true, days: 6, meds: [M("Acido Folico 5 mg comprimido", "30 comp.")] },
  { nome: "Gilson de Medeiros Vaz", idade: 56, nasc: "02/11/1970", mae: "Helena Vaz", esp: true, days: 7, meds: [M("Losartana potassica 50mg, oral", "30 comp.")] },
  { nome: "Jose Rocha Vargas", idade: 68, nasc: "30/01/1958", mae: "Ana Vargas", esp: true, days: 5, meds: [M("Captopril 25mg, comprimido, oral", "30 comp."), M("Omeprazol 20mg, capsula, oral", "60 cap.")] },
  { nome: "Lucas Martins Gonçalves", idade: 32, nasc: "19/05/1994", mae: "Teresa Gonçalves", esp: true, days: 5, meds: [M("Acido acetilsalicilico 100mg, comprimido", "30 comp."), M("Paracetamol 500mg, oral", "30 comp.")] },
  { nome: "Luciana Garcia Flores", idade: 21, nasc: "07/07/2005", mae: "Sandra Flores", esp: true, days: 9, meds: [M("Espironolactona 25mg, comprimido, oral", "30 comp.")] },
  { nome: "Maria de Medeiros da Silva", idade: 38, nasc: "25/09/1988", mae: "Joana Silva", esp: true, days: null, meds: [M("Vitamina A 50.000 UI/mL + Vitamina D 10.000 UI/mL", "2 frascos")] },
  { nome: "Nelson Garcia Flores", idade: 42, nasc: "11/02/1984", mae: "Célia Flores", esp: true, days: 10, meds: [M("Diazepam 10mg, oral", "30 comp.")] },
  { nome: "Roberto de Pereira de Souza", idade: 73, nasc: "03/04/1953", mae: "Alzira Souza", esp: false, days: 9, meds: [M("Azitromicina 500mg, oral", "30 comp."), M("Paracetamol 500mg, oral", "30 comp.")] },
].map((p, i) => {
  const d = String(100000000 + (i + 3) * 7341927).slice(0, 9);
  const dv = String((i * 7) % 100).padStart(2, "0");
  return {
    ...p,
    cpf: i === 0 ? "274.295.555-00" : `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${dv}`,
    cns: i === 0 ? "704501335240910" : String(700000000000000 + (i + 1) * 98765432101),
    tel: `(51) 9${8100 + i * 97}-${2000 + i * 531}`,
    prev: p.days != null ? `${String(22 - p.days).padStart(2, "0")}/09/2026` : "",
  };
});

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const th = (label, sorted) => `<th scope="col"${sorted ? ' aria-sort="ascending"' : ""}><span class="ds-th__inner">${label}<button type="button" class="ds-th__sort" aria-label="Ordenar por ${label}"><i class="fa-solid ${sorted ? "fa-sort-up" : "fa-sort"}" aria-hidden="true"></i></button></span></th>`;

function medsCell(p) {
  const item = (m) => `<li>${esc(m.n)}<span class="dis-meds__qty">${esc(m.q)}</span>${m.p ? '<i class="fa-solid fa-suitcase-medical ds-prog" role="img" aria-label="Programa de saúde"></i>' : ""}</li>`;
  const extra = p.meds.length - 3;
  const more = extra > 0
    ? `<div class="dis-meds__more"><span data-more-count>+${extra}</span><button type="button" class="ds-linkbtn" data-expand-meds aria-expanded="false"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i> <span>Ver mais</span></button></div>`
    : "";
  return `<ul class="dis-meds">${p.meds.map((m, i) => (i < 3 ? item(m) : item(m).replace("<li>", '<li data-extra hidden>'))).join("")}</ul>${more}`;
}

function row(p, late) {
  const hay = [p.nome, p.cpf, p.cns, p.mae, p.nasc].join(" ");
  const first = `<td><button type="button" class="ds-medlink" data-action="goto:visao-geral">${esc(p.nome)}</button></td>`;
  const doc = `<td><div>${p.cpf}<span class="ds-td--sub">${p.cns}</span></div></td><td><div>${p.idade} anos<span class="ds-td--sub">${p.nasc}</span></div></td>`;
  const tail = late
    ? `<td>${p.tel}</td><td>${medsCell(p)}</td><td><div>${p.prev}<span class="dis-late${p.days >= 10 ? " dis-late--high" : ""}">${p.days} dias de atraso</span></div></td>`
    : `<td>${medsCell(p)}</td>`;
  return `<tr data-search="${esc(hay)}" data-nasc="${p.nasc}">${first}${doc}${tail}</tr>`;
}

function table(list, late, caption) {
  const heads = [th("Paciente", true), th("CPF / CNS"), th("Idade e nascimento")];
  if (late) heads.push(th("Telefone"));
  heads.push(th(late ? "Medicamentos em atraso" : "Medicamentos a retirar"));
  if (late) heads.push(th("Retirada prevista"));
  const empty = late ? "Nenhum paciente com retirada em atraso encontrado para esta pesquisa." : "Nenhum paciente esperado encontrado para esta pesquisa.";
  return `<table class="ds-table" data-component="dis.data-table"><caption class="ds-sr-only">${caption}</caption>
<thead><tr>${heads.join("")}</tr></thead>
<tbody>${list.map((p) => row(p, late)).join("\n")}</tbody></table>
<p class="dis-empty" data-empty hidden>${empty}</p>`;
}

const tabBtn = (id, label, count, active, danger) =>
  `<div class="dis-tab${active ? " dis-tab--active" : ""}" data-tab-wrap="${id}"><button type="button" class="btn btn--tertiary" data-tab="${id}" aria-selected="${active}">${label} <span class="ds-count${danger ? " dis-count--danger" : ""}">${count}</span></button></div>`;

/** Gera o HTML da tela a partir do HTML da Visão geral (de onde vem o cabeçalho). */
function buildSearchScreen(visaoGeralHtml) {
  const m = /<header class="ds-header"[\s\S]*?<\/header>/.exec(visaoGeralHtml);
  if (!m) throw new Error("cabeçalho do DS não encontrado na Visão geral");
  const header = m[0].replace(/ data-pid="[^"]*"/g, "").replace(/ aria-current="page"/g, "")
    .replace(/(<a class="ds-header__link")/, '$1 aria-current="page"')
    .replace(/data-action="goto:[a-z-]+"/, `data-action="goto:${SEARCH_ID}"`);
  const esp = PATIENTS.filter((p) => p.esp);
  const atr = PATIENTS.filter((p) => p.days != null);
  const html = `<div class="ds dis dis-shell" data-component="dis.app-shell">
${header}
<div class="dis-shell__body">
<main class="dis-shell__content">
<h2 class="dis-page-title">Pesquisar paciente</h2>
<form class="dis-psearch" data-psearch>
<div class="ds-field"><label class="ds-label" for="pf-q">Nome / CNS / CPF</label><input class="ds-input" id="pf-q" type="text" autocomplete="off"></div>
<div class="ds-field"><label class="ds-label" for="pf-dob">Data de nascimento</label><input class="ds-input" id="pf-dob" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10"></div>
<div class="ds-field"><label class="ds-label" for="pf-mae">Nome da mãe</label><input class="ds-input" id="pf-mae" type="text" autocomplete="off"></div>
<button type="submit" class="btn btn--primary"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Buscar</button>
</form>
<nav class="dis-tabs" aria-label="Listas de pacientes">
${tabBtn("esp", "Pacientes esperados para 22/09/2026", esp.length, true, false)}
${tabBtn("atr", "Pacientes com retiradas em atraso", atr.length, false, true)}
</nav>
<div class="dis-tabpanel" data-panel="esp">${table(esp, false, "Pacientes esperados")}</div>
<div class="dis-tabpanel" data-panel="atr" hidden>${table(atr, true, "Pacientes com retiradas em atraso")}</div>
</main>
</div>
</div>
`;
  return T.injectPids(html).html;
}

/** Script do cabeçalho (head.html): abas, "Ver mais" dos medicamentos e filtro da busca. */
const SEARCH_HEAD_SCRIPT = `<script>
/* Pesquisar paciente: abas, "Ver mais" e filtro (sem estado externo). */
(function () {
  var norm = function (t) { return (t || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim(); };
  var applyFilter = function () {
    var q = norm((document.getElementById("pf-q") || {}).value), qd = q.replace(/\\D/g, "");
    var dob = ((document.getElementById("pf-dob") || {}).value || "").trim(), mae = norm((document.getElementById("pf-mae") || {}).value);
    document.querySelectorAll(".dis-tabpanel").forEach(function (panel) {
      var shown = 0;
      panel.querySelectorAll("tbody tr").forEach(function (tr) {
        var hay = norm(tr.getAttribute("data-search")), ok = true;
        if (q && hay.indexOf(q) < 0 && !(qd && hay.replace(/\\D/g, "").indexOf(qd) >= 0)) ok = false;
        if (dob.length === 10 && tr.getAttribute("data-nasc") !== dob) ok = false;
        if (mae && hay.indexOf(mae) < 0) ok = false;
        tr.hidden = !ok; if (ok) shown += 1;
      });
      var empty = panel.querySelector("[data-empty]"); if (empty) empty.hidden = shown > 0;
    });
  };
  document.addEventListener("submit", function (e) { if (e.target.closest && e.target.closest("[data-psearch]")) { e.preventDefault(); applyFilter(); } });
  document.addEventListener("click", function (e) {
    var tab = e.target.closest && e.target.closest("[data-tab]");
    if (tab) {
      document.querySelectorAll("[data-tab-wrap]").forEach(function (w) { w.classList.toggle("dis-tab--active", w.getAttribute("data-tab-wrap") === tab.getAttribute("data-tab")); });
      document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab"); });
      return;
    }
    var more = e.target.closest && e.target.closest("[data-expand-meds]");
    if (more) {
      var open = more.getAttribute("aria-expanded") !== "true", cell = more.closest("td");
      more.setAttribute("aria-expanded", String(open));
      cell.querySelectorAll("li[data-extra]").forEach(function (li) { li.hidden = !open; });
      var count = cell.querySelector("[data-more-count]"); if (count) count.hidden = open;
      more.querySelector("span").textContent = open ? "Ver menos" : "Ver mais";
    }
  });
})();
</script>
`;

const SEARCH_CSS = `
/* Pesquisar paciente */
.dis-psearch { display: grid; grid-template-columns: minmax(0, 1.6fr) 176px minmax(0, 1.3fr) auto; gap: 16px; align-items: end; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--neutral-light); }
.dis-psearch .ds-field { display: flex; flex-direction: column; gap: 8px; }
.dis-psearch .ds-label { font-weight: 700; font-size: 16px; color: var(--primary-dark, #0b2a5c); }
.dis-psearch .ds-input { box-sizing: border-box; width: 100%; min-height: 40px; padding: 0 12px; font: inherit; font-size: 16px; border: 1px solid var(--neutral-base, #8a94a6); border-radius: 0; }
.dis-tabs { display: flex; border-bottom: 1px solid var(--neutral-light); }
.dis-tab { flex: 1; margin-bottom: -1px; border-bottom: 2px solid transparent; }
.dis-tab--active { border-bottom-color: var(--primary-interactive-area); }
.dis-tab .btn { width: 100%; min-height: 48px; justify-content: center; gap: 8px; color: var(--neutral-body); }
.dis-tab--active .btn { color: var(--primary-interactive-area); font-weight: 700; }
.dis-tab .ds-count.dis-count--danger { background: var(--danger-base); }
.dis-tabpanel { margin-top: 16px; }
.dis-tabpanel[hidden], .dis-tabpanel tr[hidden], .dis-meds li[hidden] { display: none; }
.dis-meds { margin: 0; padding-left: 16px; list-style: disc; font-size: 14px; line-height: 20px; }
.dis-meds__qty { margin: 0 6px 0 8px; font-size: 12px; color: var(--neutral-dark); }
.dis-meds__more { display: flex; align-items: center; gap: 8px; margin-top: 2px; padding-left: 16px; font-size: 12px; font-weight: 700; color: var(--primary-interactive); }
.dis-late { display: block; font-size: 12px; color: var(--neutral-dark); }
.dis-late--high { font-weight: 700; color: var(--danger-base); }
.dis-empty { margin: 0; padding: 24px 16px; font-size: 14px; color: var(--neutral-dark); border-bottom: 1px solid var(--neutral-light); }
@container dis-shell (max-width: 720px) {
  .dis-psearch { grid-template-columns: 1fr; }
  .dis-psearch .btn { width: 100%; }
  .dis-tabs { flex-direction: column; }
}
`;

module.exports = { SEARCH_ID, PATIENTS, buildSearchScreen, SEARCH_HEAD_SCRIPT, SEARCH_CSS };
