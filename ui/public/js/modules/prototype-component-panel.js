// @ts-check
import { esc, showToast } from "../shared/dom.js";
import { applyEdit } from "./prototype-edit-api.js";
import { fetchElementTraceability } from "./prototype-element-map.js";
import {
  COLUMN_TYPES, EDITABLE, addColumn, applyFieldProps, moveColumn, parseFragment, readFieldProps, readTableSpec, readTabs,
  removeColumn, setCaption, setCompact, setSelectable, updateColumn, updateTab,
} from "./prototype-component-model.js";

/**
 * Seção "Componente" do painel do Ateliê: propriedades do componente do DS que o elemento selecionado
 * usa (ou de um filho dele). Mudanças viram um novo HTML do componente, gravado com a operação `setHtml`.
 */

const check = (act, label, on) => `<label class="pp-check"><input type="checkbox" data-cp="${act}"${on ? " checked" : ""}> ${label}</label>`;
const text = (act, label, value, extra = "") => `<label class="cp-field"><span class="cp-lbl">${label}</span><input class="cp-input" type="text" data-cp="${act}" value="${esc(value)}" autocomplete="off" ${extra}></label>`;

function fieldBody(root) {
  const p = readFieldProps(root);
  return `
    ${text("label", "Rótulo", p.label)}
    <div class="cp-row">${text("placeholder", "Placeholder", p.placeholder)}${text("width", "Largura (px)", p.width, 'inputmode="numeric"')}</div>
    ${text("value", "Valor inicial", p.value)}
    <div class="cp-row">${check("required", "Obrigatório", p.required)}${check("disabled", "Desabilitado", p.disabled)}</div>
    ${p.hasStatus ? `<label class="cp-field"><span class="cp-lbl">Estado</span><select class="cp-input" data-cp="status">${[["", "Padrão"], ["success", "Sucesso"], ["danger", "Erro"]].map(([v, l]) => `<option value="${v}"${v === p.status ? " selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}`;
}

function tableBody(root) {
  const s = readTableSpec(root);
  const cols = s.columns.map((c) => `
    <div class="cp-col" data-col="${c.n}">
      <div class="cp-col-head">
        <span class="cp-col-n">${c.n + 1}</span>
        <input class="cp-input cp-col-label" type="text" data-cp-col="label" value="${esc(c.label)}" aria-label="Título da coluna ${c.n + 1}">
        <button type="button" class="pp-icon" data-cp-act="col-up" title="Mover para a esquerda"${c.n === 0 ? " disabled" : ""}><i class="fa-solid fa-arrow-up"></i></button>
        <button type="button" class="pp-icon" data-cp-act="col-down" title="Mover para a direita"${c.n === s.columns.length - 1 ? " disabled" : ""}><i class="fa-solid fa-arrow-down"></i></button>
        <button type="button" class="pp-icon" data-cp-act="col-remove" title="Remover coluna"${s.columns.length <= 1 ? " disabled" : ""}><i class="fa-solid fa-trash-can"></i></button>
      </div>
      <div class="cp-row">
        <label class="cp-field"><span class="cp-lbl">Tipo</span><select class="cp-input" data-cp-col="type">${COLUMN_TYPES.map(([v, l]) => `<option value="${v}"${v === c.type ? " selected" : ""}${v === "custom" && c.type !== "custom" ? " disabled" : ""}>${l}</option>`).join("")}</select></label>
        <label class="cp-field cp-narrow"><span class="cp-lbl">Largura</span><input class="cp-input" type="text" data-cp-col="width" value="${esc(c.width)}" inputmode="numeric" placeholder="auto"></label>
      </div>
      ${check("col-sortable", "Ordenável", c.sortable).replace('data-cp="col-sortable"', 'data-cp-col="sortable"')}
    </div>`).join("");
  return `
    <div class="cp-row">${check("selectable", "Coluna de checkbox", s.selectable)}${check("compact", "Compacta", s.compact)}</div>
    ${text("caption", "Legenda (leitor de tela)", s.caption)}
    <div class="cp-sub">Colunas (${s.columns.length}) · ${s.rowCount} linhas</div>
    ${cols}
    <button type="button" class="btn-proto-vp cp-add" data-cp-act="col-add"><i class="fa-solid fa-plus"></i> Adicionar coluna</button>
    <div class="cp-note">Mudar o tipo refaz o conteúdo da coluna a partir do texto de cada célula.</div>`;
}

function tabsBody(root) {
  return readTabs(root).map((t) => `
    <div class="cp-col" data-tab="${t.n}">
      <div class="cp-row">
        ${text("tab-label", `Aba ${t.n + 1}`, t.label).replace('data-cp="tab-label"', 'data-cp-tab="label"')}
        ${t.count === null ? "" : text("tab-count", "Contador", t.count, 'inputmode="numeric"').replace('data-cp="tab-count"', 'data-cp-tab="count"').replace('class="cp-field"', 'class="cp-field cp-narrow"')}
      </div>
    </div>`).join("");
}

const KINDS = {
  "dis.text-field": { title: "Campo de texto", body: fieldBody },
  "dis.date-field": { title: "Campo de data", body: fieldBody },
  "dis.data-table": { title: "Tabela de dados", body: tableBody },
  "dis.tabs": { title: "Abas", body: tabsBody },
};

/**
 * @param {HTMLElement | null} host
 * @param {{ slug: string, protoId: string, getScreen: () => string, pid: string, reselect: (pid: string) => void }} ctx
 */
export async function mountComponentPanel(host, ctx) {
  if (!host) return;
  host.innerHTML = "";
  let trace;
  try {
    trace = await fetchElementTraceability({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.getScreen(), nodeId: ctx.pid });
  } catch { return; }
  const id = trace?.component?.id;
  if (!EDITABLE.has(id) || !trace.outerHtml) return;

  const kind = KINDS[id];
  // O elemento é o próprio componente (o painel de um filho dele mostra só Posição e Layout).
  let root;
  try { root = parseFragment(trace.outerHtml); } catch { return; }

  let saving = Promise.resolve();
  function commit(rerender = false) {
    const html = root.outerHTML;
    saving = saving.then(async () => {
      const res = await applyEdit({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.getScreen(), pid: ctx.pid, op: { type: "setHtml", html } });
      if (!res.ok) { showToast(`Não foi possível gravar: ${res.error}`); return; }
      ctx.reselect(ctx.pid);
    });
    if (rerender) paint();
  }

  const paint = () => {
    host.innerHTML = `<section class="pp-section cp"><h4 class="pp-title"><i class="fa-solid fa-cube"></i> ${kind.title} <code class="cp-id">${esc(id)}</code></h4>${kind.body(root)}</section>`;
  };
  paint();

  const colOf = (el) => Number(el.closest("[data-col]")?.getAttribute("data-col"));
  const tabOf = (el) => Number(el.closest("[data-tab]")?.getAttribute("data-tab"));

  host.onchange = (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    const act = el.dataset?.cp;
    const colAct = el.dataset?.cpCol;
    const tabAct = el.dataset?.cpTab;
    const isCheck = el.type === "checkbox";
    if (act) {
      if (id === "dis.data-table") {
        if (act === "selectable") setSelectable(root, el.checked);
        else if (act === "compact") setCompact(root, el.checked);
        else if (act === "caption") setCaption(root, el.value);
      } else {
        applyFieldProps(root, { [act]: isCheck ? el.checked : el.value });
      }
      commit();
    } else if (colAct) {
      const n = colOf(el);
      const value = isCheck ? el.checked : el.value;
      if (colAct === "type" && !confirmTypeChange(root, n)) { paint(); return; }
      updateColumn(root, n, { [colAct]: value });
      commit(colAct === "type");
    } else if (tabAct) {
      updateTab(root, tabOf(el), { [tabAct]: el.value });
      commit();
    }
  };

  host.onclick = (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest?.("[data-cp-act]");
    if (!btn || /** @type {HTMLButtonElement} */ (btn).disabled) return;
    const act = btn.getAttribute("data-cp-act");
    const n = colOf(btn);
    if (act === "col-add") addColumn(root);
    else if (act === "col-remove") {
      if (!confirm("Remover esta coluna e o conteúdo dela em todas as linhas?")) return;
      removeColumn(root, n);
    } else if (act === "col-up") moveColumn(root, n, -1);
    else if (act === "col-down") moveColumn(root, n, 1);
    else return;
    commit(true);
  };
}

/** Coluna "personalizada" (listas, rótulos) perde o conteúdo ao virar outro tipo: pede confirmação. */
function confirmTypeChange(root, n) {
  const spec = readTableSpec(root).columns[n];
  if (spec?.type !== "custom") return true;
  return confirm("O conteúdo desta coluna é personalizado e será substituído apenas pelo texto de cada célula. Continuar?");
}
