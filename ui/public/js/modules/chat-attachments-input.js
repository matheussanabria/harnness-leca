// @ts-check
// Entrada de anexos por área de transferência e por arrastar e soltar.
// Funções puras (sem DOM global) mais a delegação de eventos que liga o arrastar-e-soltar aos 3 compositores.

/** Seletor das áreas que aceitam arquivos soltos: compositor e histórico das apresentações do chat. */
export const DROP_ZONE_SELECTOR = ".chat-composer-container, .chat-history";
export const DROP_ACTIVE_CLASS = "chat-drop-active";

/** True quando a transferência (arrastar ou colar) carrega arquivos. */
export function transferHasFiles(dt) {
  if (!dt) return false;
  if (dt.types && Array.from(dt.types).includes("Files")) return true;
  return Boolean(dt.files && dt.files.length);
}

/** Arquivos de um DataTransfer; cai para `items` quando o navegador não preenche `files`. */
export function filesFromTransfer(dt) {
  if (!dt) return [];
  const direct = Array.from(dt.files || []);
  if (direct.length) return direct;
  return Array.from(dt.items || [])
    .filter((it) => it.kind === "file")
    .map((it) => it.getAsFile())
    .filter(Boolean);
}

/** Nome de um arquivo vindo da área de transferência: print colado costuma chegar como "image.png". */
export function pastedFileName(file, index, now = Date.now()) {
  if (file.name && file.name !== "image.png") return file.name;
  const ext = (String(file.type || "").split("/")[1] || "png").replace("jpeg", "jpg");
  return `colado-${now}-${index}.${ext}`;
}

/** Nome de um arquivo solto: mantém o original; sem nome, gera um. */
export function droppedFileName(file, index, now = Date.now()) {
  return file.name || pastedFileName(file, index, now);
}

/**
 * Liga arrastar e soltar nos compositores por delegação no document (os partials carregam depois do módulo).
 * @param {(files: File[]) => void} onFiles
 * @param {Document} [doc]
 * @returns {() => void} desliga os ouvintes
 */
export function bindChatDrop(onFiles, doc = document) {
  const zoneOf = (ev) => (ev.target && ev.target.closest ? ev.target.closest(DROP_ZONE_SELECTOR) : null);
  const clear = () => doc.querySelectorAll(`.${DROP_ACTIVE_CLASS}`).forEach((el) => el.classList.remove(DROP_ACTIVE_CLASS));

  const over = (ev) => {
    const zone = zoneOf(ev);
    if (!zone || !transferHasFiles(ev.dataTransfer)) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    zone.classList.add(DROP_ACTIVE_CLASS);
  };
  const leave = (ev) => {
    const zone = zoneOf(ev);
    if (zone && !zone.contains(ev.relatedTarget)) zone.classList.remove(DROP_ACTIVE_CLASS);
  };
  const drop = (ev) => {
    const zone = zoneOf(ev);
    if (!zone || !transferHasFiles(ev.dataTransfer)) return;
    ev.preventDefault();
    clear();
    const files = filesFromTransfer(ev.dataTransfer);
    if (files.length) onFiles(files);
  };

  doc.addEventListener("dragenter", over);
  doc.addEventListener("dragover", over);
  doc.addEventListener("dragleave", leave);
  doc.addEventListener("drop", drop);
  doc.addEventListener("dragend", clear);
  return () => {
    doc.removeEventListener("dragenter", over);
    doc.removeEventListener("dragover", over);
    doc.removeEventListener("dragleave", leave);
    doc.removeEventListener("drop", drop);
    doc.removeEventListener("dragend", clear);
  };
}
