// @ts-check
/** Regras puras do histórico do Ateliê (atalhos, rótulos e linha do tempo); sem DOM nem rede. */

/** Elemento em que Ctrl+Z deve desfazer o texto digitado, não o protótipo. */
export function isEditableTarget(el) {
  if (!el || typeof el !== "object") return false;
  const tag = String(el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(el.isContentEditable);
}

/**
 * Atalho de histórico de um evento de teclado.
 * Ctrl/Cmd+Z desfaz; Ctrl/Cmd+Shift+Z e Ctrl+Y refazem.
 * @param {{ key?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean }} e
 * @returns {"undo" | "redo" | null}
 */
export function historyShortcut(e) {
  if (!e || e.altKey || !(e.ctrlKey || e.metaKey)) return null;
  const key = String(e.key || "").toLowerCase();
  if (key === "z") return e.shiftKey ? "redo" : "undo";
  if (key === "y" && !e.shiftKey) return "redo";
  return null;
}

/** "agora", "há 5 min", "há 2 h" ou data e hora. */
export function timeAgo(ts, now = Date.now()) {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "agora";
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ICONS = {
  baseline: "fa-flag",
  edit: "fa-pen",
  structure: "fa-sitemap",
  files: "fa-file-code",
  restore: "fa-clock-rotate-left",
  component: "fa-cube",
  external: "fa-triangle-exclamation",
  group: "fa-object-group",
  checkpoint: "fa-star",
};

export const kindIcon = (kind) => ICONS[kind] || "fa-circle";

/** "tela.html" / "2 arquivos": resumo curto dos arquivos mudados. */
export function changedSummary(changed) {
  const list = Array.isArray(changed) ? changed : [];
  if (!list.length) return "";
  if (list.length === 1) return list[0].split("/").pop() || list[0];
  return `${list.length} arquivos`;
}

/**
 * Linhas da lista (mais recente primeiro). `future` marca o que ainda pode ser refeito.
 * @param {{ cursor: number, entries: Array<{ index: number, label: string, kind: string, ts: string, detail?: string, changed?: string[] }> }} data
 * @param {number} [now]
 */
export function historyRows(data, now = Date.now()) {
  const entries = (data && data.entries) || [];
  const cursor = data ? data.cursor : -1;
  return entries.map((e) => ({
    index: e.index,
    label: e.label,
    checkpoint: e.checkpoint || "",
    icon: e.checkpoint ? "fa-star" : kindIcon(e.kind),
    kind: e.kind,
    when: timeAgo(e.ts, now),
    detail: e.detail || "",
    files: changedSummary(e.changed),
    current: e.index === cursor,
    future: e.index > cursor,
  })).reverse();
}

/** Mensagem do aviso depois de desfazer/refazer. */
export function moveToast(action, label) {
  if (action === "undo") return `Desfeito: ${label}`;
  if (action === "redo") return `Refeito: ${label}`;
  return `Voltou para: ${label}`;
}
