// @ts-check
/**
 * Regras puras da seleção múltipla do Ateliê (preview e camadas): Ctrl alterna um elemento, Shift seleciona o intervalo,
 * e só dá para agrupar irmãos. Sem DOM nem rede; trabalha sobre a árvore enviada pela ponte (`HARNESS_PROTO_TREE`).
 */

const idOf = (node) => (node ? node.pid || node.nodeId || "" : "");

/** Nós em ordem de documento, cada um com o pai e a lista de ancestrais. */
export function flatten(tree, parent = "", ancestors = [], out = []) {
  for (const node of tree || []) {
    const pid = idOf(node);
    out.push({ pid, parent, ancestors, node });
    if (node.children && node.children.length) flatten(node.children, pid, [...ancestors, pid], out);
  }
  return out;
}

/** Tira da lista quem já está dentro de outro selecionado (mantém só o elemento de cima). */
function topmost(entries) {
  const set = new Set(entries.map((e) => e.pid));
  return entries.filter((e) => !e.ancestors.some((a) => set.has(a)));
}

/**
 * Aplica um clique com teclas modificadoras à seleção.
 * @param {{ pids: string[], anchor: string }} state  `anchor` = último elemento clicado (começo do intervalo do Shift)
 * @param {{ pid: string, ctrl?: boolean, shift?: boolean }} click
 * @param {any[]} tree
 * @returns {{ pids: string[], anchor: string }}
 */
export function applyClick(state, click, tree) {
  const { pid } = click;
  if (!pid) return state;
  const flat = flatten(tree);
  const order = new Map(flat.map((e, i) => [e.pid, i]));
  const sorted = (list) => [...new Set(list)].filter((p) => order.has(p)).sort((a, b) => order.get(a) - order.get(b));
  const base = state.pids.length ? state.pids : (state.anchor ? [state.anchor] : []);

  if (click.shift && state.anchor && order.has(state.anchor) && order.has(pid)) {
    const [from, to] = [order.get(state.anchor), order.get(pid)].sort((a, b) => a - b);
    const range = topmost(flat.slice(from, to + 1)).map((e) => e.pid);
    return { pids: sorted(range), anchor: state.anchor };
  }
  if (click.ctrl || click.shift) {
    const next = base.includes(pid) ? base.filter((p) => p !== pid) : [...base, pid];
    return { pids: sorted(next), anchor: pid };
  }
  return { pids: [], anchor: pid };
}

/**
 * Dá para agrupar? Precisa de 2 ou mais elementos do mesmo pai, sem um dentro do outro.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canGroup(tree, pids) {
  const list = [...new Set(pids || [])];
  if (list.length < 2) return { ok: false, reason: "Selecione 2 ou mais elementos." };
  const byPid = new Map(flatten(tree).map((e) => [e.pid, e]));
  const entries = list.map((p) => byPid.get(p));
  if (entries.some((e) => !e)) return { ok: false, reason: "Elemento não encontrado na estrutura." };
  if (entries.some((e) => e.ancestors.some((a) => list.includes(a)))) return { ok: false, reason: "Um dos elementos está dentro de outro selecionado." };
  if (new Set(entries.map((e) => e.parent)).size > 1) return { ok: false, reason: "Só dá para agrupar elementos do mesmo bloco (mesmo pai)." };
  return { ok: true };
}

/** O elemento selecionado é um grupo criado pelo Ateliê? */
export function isGroupNode(node) {
  return Boolean(node && node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, "data-group"));
}

/** Atalho de agrupar: Ctrl/Cmd+G agrupa, Ctrl/Cmd+Shift+G desagrupa. */
export function groupShortcut(e) {
  if (!e || e.altKey || !(e.ctrlKey || e.metaKey)) return null;
  if (String(e.key || "").toLowerCase() !== "g") return null;
  return e.shiftKey ? "ungroup" : "group";
}

/** Texto da barra de seleção. */
export function selectionLabel(count, groupable) {
  if (count < 2) return "";
  return groupable.ok ? `${count} selecionados` : `${count} selecionados · ${groupable.reason}`;
}
