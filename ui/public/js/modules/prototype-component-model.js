// @ts-check
/**
 * Regras do painel "Componente": lê e altera as propriedades de um componente do DS direto no DOM do
 * trecho de HTML dele (campo de texto, campo de data, tabela e abas). O painel serializa o resultado
 * e grava com a operação `setHtml`; aqui não há rede nem tela.
 */

/** Componentes que têm editor de propriedades. */
export const EDITABLE = new Set(["dis.text-field", "dis.date-field", "dis.data-table", "dis.tabs"]);

export const COLUMN_TYPES = [
  ["text", "Texto"],
  ["link", "Link"],
  ["badge", "Selo"],
  ["number", "Número (à direita)"],
  ["action", "Botão"],
  ["custom", "Personalizado"],
];

const LABEL = ".ds-label, .ds-field__label, .ds-info__label";
const REQ = '<span class="ds-req" aria-hidden="true">*</span>';

/**
 * @param {string} html
 * @param {Document} [doc]
 * @returns {Element}
 */
export function parseFragment(html, doc = document) {
  const tpl = doc.createElement("template");
  tpl.innerHTML = html.trim();
  const el = tpl.content.firstElementChild;
  if (!el) throw new Error("HTML do componente vazio.");
  return el;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Texto da célula com um espaço entre os blocos (CPF e CNS em linhas separadas não colam). */
function cellText(cell) {
  const copy = /** @type {Element} */ (cell.cloneNode(true));
  copy.querySelectorAll("*").forEach((el) => { el.before(el.ownerDocument.createTextNode(" ")); el.after(el.ownerDocument.createTextNode(" ")); });
  return clean(copy.textContent);
}

/** Primeiro nó de texto não vazio do elemento (o rótulo "de verdade", fora de ícones e do asterisco). */
function ownTextNode(el) {
  for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && clean(n.textContent)) return n;
  for (const n of Array.from(el.children)) {
    if (n.classList.contains("ds-req") || /^(i|svg|button|input)$/i.test(n.tagName)) continue;
    const inner = ownTextNode(n);
    if (inner) return inner;
  }
  return null;
}

function setOwnText(el, value) {
  const node = ownTextNode(el);
  if (node) { node.textContent = value; return; }
  el.insertBefore(el.ownerDocument.createTextNode(value), el.firstChild);
}

/* ------------------------------------------------------------------ campos (texto e data) */

/** @param {Element} root */
const fieldInput = (root) => /** @type {HTMLInputElement | null} */ (root.querySelector("input, textarea, select"));

/** @param {Element} root */
export function readFieldProps(root) {
  const label = root.querySelector(LABEL);
  const input = fieldInput(root);
  const status = root.classList.contains("ds-field--danger") ? "danger" : root.classList.contains("ds-field--success") ? "success" : "";
  const width = /** @type {HTMLElement | null} */ (input)?.style?.width || "";
  return {
    label: label ? clean(ownTextNode(label)?.textContent) : "",
    required: Boolean(label?.querySelector(".ds-req")),
    placeholder: input?.getAttribute("placeholder") || "",
    value: input?.getAttribute("value") || "",
    width: /^(\d+(\.\d+)?)px$/.test(width) ? width.replace("px", "") : "",
    disabled: Boolean(input?.hasAttribute("disabled")),
    status,
    hasStatus: root.classList.contains("ds-field"),
  };
}

/**
 * @param {Element} root
 * @param {Partial<{ label: string, required: boolean, placeholder: string, value: string, width: string, disabled: boolean, status: string }>} patch
 */
export function applyFieldProps(root, patch) {
  const label = root.querySelector(LABEL);
  const input = fieldInput(root);
  if (patch.label !== undefined && label) {
    setOwnText(label, patch.label);
    if (input?.hasAttribute("aria-label")) input.setAttribute("aria-label", patch.label);
  }
  if (patch.required !== undefined) {
    const req = label?.querySelector(".ds-req");
    if (patch.required && label && !req) label.insertAdjacentHTML("beforeend", REQ);
    if (!patch.required) req?.remove();
    if (input) {
      if (patch.required) input.setAttribute("aria-required", "true");
      else input.removeAttribute("aria-required");
    }
  }
  if (input) {
    if (patch.placeholder !== undefined) setOrRemove(input, "placeholder", patch.placeholder);
    if (patch.value !== undefined) setOrRemove(input, "value", patch.value);
    if (patch.width !== undefined) {
      const w = String(patch.width).trim();
      if (w && /^\d+(\.\d+)?$/.test(w)) /** @type {HTMLElement} */ (input).style.width = `${w}px`;
      else /** @type {HTMLElement} */ (input).style.removeProperty("width");
      if (!input.getAttribute("style")) input.removeAttribute("style");
    }
    if (patch.disabled !== undefined) {
      if (patch.disabled) input.setAttribute("disabled", "");
      else input.removeAttribute("disabled");
    }
  }
  if (patch.status !== undefined && root.classList.contains("ds-field")) {
    root.classList.remove("ds-field--success", "ds-field--danger");
    if (patch.status) root.classList.add(`ds-field--${patch.status}`);
  }
}

function setOrRemove(el, name, value) {
  if (value === "" || value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/* ------------------------------------------------------------------ tabela */

/** @param {Element} root */
const tableOf = (root) => /** @type {HTMLTableElement} */ (root.tagName === "TABLE" ? root : root.querySelector("table"));
const headRow = (t) => /** @type {HTMLTableRowElement | null} */ (t.tHead?.rows[0] || t.querySelector("thead tr"));
const isCheck = (cell) => Boolean(cell?.classList.contains("ds-td--check"));

/** Linhas do corpo que têm uma célula por coluna (linhas de detalhe com colspan ficam de fora). */
function bodyRows(t, ncols) {
  return Array.from(t.querySelectorAll("tbody tr")).filter((r) => /** @type {HTMLTableRowElement} */ (r).cells.length === ncols);
}

/** Posição real (na linha) de cada coluna de dados, pulando a coluna de checkbox. */
function dataIndexes(t) {
  const head = headRow(t);
  if (!head) return [];
  return Array.from(head.cells).map((c, i) => (isCheck(c) ? -1 : i)).filter((i) => i >= 0);
}

/** @param {Element} cell */
export function cellType(cell) {
  if (!cell) return "text";
  const style = /** @type {HTMLElement} */ (cell).style;
  if (cell.querySelector("ul, ol, table, label, input, select")) return "custom";
  if (cell.querySelector(".ds-badge")) return "badge";
  if (cell.querySelector(".ds-medlink")) return "link";
  if (cell.querySelector(".btn")) return "action";
  if (style?.textAlign === "right") return "number";
  return "text";
}

/** @param {Element} root */
export function readTableSpec(root) {
  const t = tableOf(root);
  const head = headRow(t);
  const idx = dataIndexes(t);
  const ncols = head ? head.cells.length : 0;
  const rows = bodyRows(t, ncols);
  const columns = idx.map((i, n) => {
    const th = /** @type {HTMLElement} */ (head.cells[i]);
    const first = rows[0]?.cells[i];
    return {
      n,
      label: clean(ownTextNode(th)?.textContent),
      sortable: Boolean(th.querySelector(".ds-th__sort")),
      width: /^(\d+(\.\d+)?)px$/.test(th.style.width) ? th.style.width.replace("px", "") : "",
      type: cellType(/** @type {Element} */ (first)),
    };
  });
  return {
    caption: clean(t.caption?.textContent),
    compact: t.classList.contains("ds-table--compact"),
    selectable: Boolean(head && isCheck(head.cells[0])),
    rowCount: rows.length,
    columns,
  };
}

/** Converte "coluna n de dados" na posição real da célula. */
const realIndex = (t, n) => dataIndexes(t)[n];

export function setCaption(root, text) {
  const t = tableOf(root);
  let cap = t.caption;
  if (!cap) {
    cap = t.createCaption();
    cap.className = "ds-sr-only";
  }
  cap.textContent = text;
}

export function setCompact(root, on) {
  tableOf(root).classList.toggle("ds-table--compact", Boolean(on));
}

const CHECK_BOX = (label) => `<label class="ds-check" data-component="dis.checkbox"><input type="checkbox" aria-label="${label}"><span class="ds-check__box"><i class="fa-solid fa-check" aria-hidden="true"></i></span></label>`;

/** Liga ou desliga a coluna de checkbox (com "selecionar todos" no cabeçalho). */
export function setSelectable(root, on) {
  const t = tableOf(root);
  const head = headRow(t);
  if (!head) return;
  const has = isCheck(head.cells[0]);
  if (Boolean(on) === has) return;
  const ncols = head.cells.length;
  const rows = bodyRows(t, ncols);
  if (!on) {
    head.cells[0].remove();
    rows.forEach((r) => /** @type {HTMLTableRowElement} */ (r).cells[0].remove());
    return;
  }
  const doc = t.ownerDocument;
  const mk = (tag, label) => {
    const c = doc.createElement(tag);
    c.className = "ds-td--check";
    if (tag === "th") c.setAttribute("scope", "col");
    c.innerHTML = CHECK_BOX(label);
    return c;
  };
  head.insertBefore(mk("th", "Selecionar todos"), head.firstChild);
  rows.forEach((r) => r.insertBefore(mk("td", "Selecionar"), r.firstChild));
}

function sortButton(label) {
  return `<button type="button" class="ds-th__sort" aria-label="Ordenar por ${esc(label)}"><i class="fa-solid fa-sort" aria-hidden="true"></i></button>`;
}

/**
 * @param {Element} root
 * @param {number} n coluna de dados (0 = primeira, sem contar o checkbox)
 * @param {Partial<{ label: string, sortable: boolean, width: string, type: string }>} patch
 */
export function updateColumn(root, n, patch) {
  const t = tableOf(root);
  const head = headRow(t);
  const i = realIndex(t, n);
  if (!head || i === undefined) return;
  const th = /** @type {HTMLElement} */ (head.cells[i]);
  if (patch.label !== undefined) {
    const inner = th.querySelector(".ds-th__inner") || th;
    setOwnText(inner, patch.label);
    th.querySelector(".ds-th__sort")?.setAttribute("aria-label", `Ordenar por ${patch.label}`);
  }
  if (patch.sortable !== undefined) {
    const has = th.querySelector(".ds-th__sort");
    if (patch.sortable && !has) {
      let inner = th.querySelector(".ds-th__inner");
      if (!inner) {
        inner = t.ownerDocument.createElement("span");
        inner.className = "ds-th__inner";
        while (th.firstChild) inner.appendChild(th.firstChild);
        th.appendChild(inner);
      }
      inner.insertAdjacentHTML("beforeend", sortButton(clean(ownTextNode(inner)?.textContent)));
    }
    if (!patch.sortable) {
      has?.remove();
      th.removeAttribute("aria-sort");
    }
  }
  if (patch.width !== undefined) {
    const w = String(patch.width).trim();
    if (/^\d+(\.\d+)?$/.test(w)) th.style.width = `${w}px`;
    else th.style.removeProperty("width");
    if (!th.getAttribute("style")) th.removeAttribute("style");
  }
  if (patch.type !== undefined && patch.type !== "custom") setColumnType(t, head, i, patch.type);
}

/** Refaz o conteúdo das células da coluna a partir do texto atual de cada uma. */
function setColumnType(t, head, i, type) {
  const ncols = head.cells.length;
  const right = type === "number";
  const th = /** @type {HTMLElement} */ (head.cells[i]);
  if (right) th.style.textAlign = "right";
  else th.style.removeProperty("text-align");
  if (!th.getAttribute("style")) th.removeAttribute("style");
  for (const row of bodyRows(t, ncols)) {
    const td = /** @type {HTMLElement} */ (/** @type {HTMLTableRowElement} */ (row).cells[i]);
    const text = esc(cellText(td));
    td.removeAttribute("style");
    if (type === "link") td.innerHTML = `<button type="button" class="ds-medlink" data-component="dis.expand-link">${text}</button>`;
    else if (type === "badge") td.innerHTML = `<span class="ds-badge ds-badge--neutral" data-component="dis.status-badge">${text}</span>`;
    else if (type === "action") td.innerHTML = `<button type="button" class="btn btn--secondary" data-component="dis.button">${text}</button>`;
    else td.textContent = cellText(td);
    if (right) td.style.textAlign = "right";
  }
}

export function addColumn(root, label = "Nova coluna") {
  const t = tableOf(root);
  const head = headRow(t);
  if (!head) return;
  const rows = bodyRows(t, head.cells.length);
  const doc = t.ownerDocument;
  const th = doc.createElement("th");
  th.setAttribute("scope", "col");
  th.innerHTML = `<span class="ds-th__inner">${esc(label)}</span>`;
  head.appendChild(th);
  rows.forEach((r) => r.appendChild(doc.createElement("td")));
}

export function removeColumn(root, n) {
  const t = tableOf(root);
  const head = headRow(t);
  const i = realIndex(t, n);
  if (!head || i === undefined || dataIndexes(t).length <= 1) return;
  const rows = bodyRows(t, head.cells.length);
  head.cells[i].remove();
  rows.forEach((r) => /** @type {HTMLTableRowElement} */ (r).cells[i].remove());
}

/** @param {-1 | 1} dir */
export function moveColumn(root, n, dir) {
  const t = tableOf(root);
  const head = headRow(t);
  const idx = dataIndexes(t);
  const from = idx[n];
  const to = idx[n + dir];
  if (!head || from === undefined || to === undefined) return;
  const rows = [head, ...bodyRows(t, head.cells.length)];
  for (const r of rows) {
    const a = /** @type {HTMLTableRowElement} */ (r).cells[from];
    const b = /** @type {HTMLTableRowElement} */ (r).cells[to];
    if (dir < 0) r.insertBefore(a, b);
    else r.insertBefore(b, a);
  }
}

/* ------------------------------------------------------------------ abas */

/** @param {Element} root */
export function readTabs(root) {
  return Array.from(root.querySelectorAll(".dis-tab")).map((tab, n) => {
    const btn = tab.querySelector("button") || tab;
    const count = btn.querySelector(".ds-count");
    return { n, label: clean(ownTextNode(btn)?.textContent), count: count ? clean(count.textContent) : null, active: tab.classList.contains("dis-tab--active") };
  });
}

/** @param {Partial<{ label: string, count: string }>} patch */
export function updateTab(root, n, patch) {
  const tab = root.querySelectorAll(".dis-tab")[n];
  if (!tab) return;
  const btn = tab.querySelector("button") || tab;
  if (patch.label !== undefined) {
    const node = ownTextNode(btn);
    // O texto fica antes do contador; preserva o espaço que separa os dois.
    if (node) node.textContent = `${patch.label} `;
    else btn.insertBefore(btn.ownerDocument.createTextNode(`${patch.label} `), btn.firstChild);
  }
  if (patch.count !== undefined) {
    const count = btn.querySelector(".ds-count");
    if (count) count.textContent = patch.count;
  }
}
