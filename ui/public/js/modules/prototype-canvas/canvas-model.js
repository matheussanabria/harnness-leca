// @ts-check
/**
 * Modelo puro do canvas do Ateliê: documento, câmera (zoom/pan), itens e geometria.
 * Sem DOM e sem efeitos colaterais, para ser testável em Node.
 */

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
export const FRAME_GAP = 160;
export const ROW_GAP = 240;
export const GRID_COLUMNS = 6;
export const DEFAULT_FRAME = { w: 1280, h: 800 };

const KIND_DEFAULTS = {
  frame: { w: 1280, h: 800 },
  text: { w: 220, h: 40, text: "Texto", size: 24 },
  sticky: { w: 200, h: 200, text: "", color: "#fde68a" },
  rect: { w: 240, h: 160, fill: "#334155" },
  code: { w: 520, h: 420, name: "componente", lang: "html", code: "", tab: "code" },
};

export const ITEM_KINDS = Object.keys(KIND_DEFAULTS);

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampZoom(zoom) {
  return clamp(Number.isFinite(zoom) ? zoom : 1, MIN_ZOOM, MAX_ZOOM);
}

/** Cria um documento com um frame por tela, lado a lado. */
export function createDoc(screens = [], width = DEFAULT_FRAME.w) {
  const doc = { v: 1, view: { x: 80, y: 120, zoom: 0.5 }, items: [], seq: 0 };
  return syncScreens(doc, screens, width);
}

export function nextId(doc, kind) {
  doc.seq = (doc.seq || 0) + 1;
  return `${kind}-${doc.seq}`;
}

/** Posição do n-ésimo quadro numa grade de GRID_COLUMNS colunas (uma linha só se couber). */
export function gridSlot(index, width = DEFAULT_FRAME.w, height = DEFAULT_FRAME.h) {
  return { x: (index % GRID_COLUMNS) * (width + FRAME_GAP), y: Math.floor(index / GRID_COLUMNS) * (height + ROW_GAP) };
}

/** Garante um frame por tela; telas novas entram no próximo espaço da grade. */
export function syncScreens(doc, screens, width = DEFAULT_FRAME.w) {
  const known = new Set(doc.items.filter((i) => i.kind === "frame").map((i) => i.screen));
  for (const screen of screens) {
    if (known.has(screen.id)) continue;
    const index = doc.items.filter((i) => i.kind === "frame").length;
    const frame = newItem(doc, "frame", { ...gridSlot(index, width), w: width, title: screen.title || screen.id, screen: screen.id });
    doc.items.push(frame);
  }
  for (const item of doc.items) {
    if (item.kind !== "frame") continue;
    const screen = screens.find((s) => s.id === item.screen);
    if (screen && !item.renamed) item.title = screen.title || screen.id;
  }
  return doc;
}

export const SNIPPET_SIZE = { w: 560, h: 460, gap: 40 };

/**
 * Telas com `snippets` (boilerplates de componentes) passam a um layout em linhas: o quadro à esquerda e,
 * à direita, um bloco de código por snippet. Roda uma vez por documento; blocos já criados não se repetem.
 */
export function syncSnippets(doc, screens) {
  if (!screens.some((s) => Array.isArray(s.snippets) && s.snippets.length)) return doc;
  const frames = doc.items.filter((i) => i.kind === "frame");
  if (doc.layout !== "rows") {
    frames.forEach((frame, index) => { frame.x = 0; frame.y = index * (frame.h + ROW_GAP); });
    doc.layout = "rows";
  }
  for (const screen of screens) {
    const frame = frames.find((f) => f.screen === screen.id);
    if (!frame) continue;
    (screen.snippets || []).forEach((snippet, index) => {
      const key = `${screen.id}:${snippet.name}`;
      if (doc.items.some((i) => i.snippet === key)) return;
      const block = newItem(doc, "code", {
        x: frame.x + frame.w + SNIPPET_SIZE.gap * 2 + index * (SNIPPET_SIZE.w + SNIPPET_SIZE.gap), y: frame.y,
        w: SNIPPET_SIZE.w, h: SNIPPET_SIZE.h, name: snippet.name, lang: snippet.lang, code: snippet.code, snippet: key,
      });
      doc.items.push(block);
    });
  }
  return doc;
}

export function newItem(doc, kind, props = {}) {
  const base = KIND_DEFAULTS[kind] || KIND_DEFAULTS.rect;
  const item = { id: nextId(doc, kind), kind, x: 0, y: 0, z: doc.items.length + 1, ...base, ...props };
  return item;
}

export function screenToWorld(view, x, y) {
  return { x: (x - view.x) / view.zoom, y: (y - view.y) / view.zoom };
}

export function worldToScreen(view, x, y) {
  return { x: x * view.zoom + view.x, y: y * view.zoom + view.y };
}

/** Zoom mantendo o ponto (px, py) da tela fixo sobre o mesmo ponto do mundo. */
export function zoomAt(view, factor, px, py) {
  const zoom = clampZoom(view.zoom * factor);
  const world = screenToWorld(view, px, py);
  return { zoom, x: px - world.x * zoom, y: py - world.y * zoom };
}

export function panBy(view, dx, dy) {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

export function itemsBounds(items) {
  if (!items.length) return null;
  const x1 = Math.min(...items.map((i) => i.x));
  const y1 = Math.min(...items.map((i) => i.y));
  const x2 = Math.max(...items.map((i) => i.x + i.w));
  const y2 = Math.max(...items.map((i) => i.y + i.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Câmera que enquadra `bounds` dentro de `size` (largura/altura da área visível). */
export function fitView(bounds, size, padding = 60, maxZoom = 1) {
  if (!bounds || !size.w || !size.h) return { x: 80, y: 80, zoom: 1 };
  const zoom = clamp(Math.min((size.w - padding * 2) / bounds.w, (size.h - padding * 2) / bounds.h), MIN_ZOOM, maxZoom);
  return {
    zoom,
    x: (size.w - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (size.h - bounds.h * zoom) / 2 - bounds.y * zoom,
  };
}

export function normalizeRect(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Item mais ao topo (maior z) sob o ponto do mundo. */
export function hitTest(items, wx, wy) {
  return [...items]
    .sort((a, b) => b.z - a.z)
    .find((i) => wx >= i.x && wx <= i.x + i.w && wy >= i.y && wy <= i.y + i.h) || null;
}

export function bringToFront(doc, id) {
  const top = Math.max(0, ...doc.items.map((i) => i.z));
  const item = doc.items.find((i) => i.id === id);
  if (item && item.z !== top) item.z = top + 1;
}

export function duplicateItem(doc, id, offset = 32) {
  const source = doc.items.find((i) => i.id === id);
  if (!source) return null;
  const copy = { ...source, id: nextId(doc, source.kind), x: source.x + offset, y: source.y + offset, z: doc.items.length + 1 };
  if (copy.kind === "frame") copy.title = `${source.title || source.screen} (cópia)`;
  doc.items.push(copy);
  return copy;
}

export function removeItem(doc, id) {
  doc.items = doc.items.filter((i) => i.id !== id);
}

export function frameForScreen(doc, screenId) {
  return doc.items.find((i) => i.kind === "frame" && i.screen === screenId) || null;
}

/** Frames na ordem do fluxo (ordem das telas do protótipo; cópias vêm depois). */
export function playOrder(doc) {
  return doc.items.filter((i) => i.kind === "frame");
}

export function neighborFrame(doc, currentId, step) {
  const order = playOrder(doc);
  const index = order.findIndex((i) => i.id === currentId);
  if (index < 0) return order[0] || null;
  return order[clamp(index + step, 0, order.length - 1)];
}

/** Valida e normaliza um documento vindo de armazenamento externo. */
export function parseDoc(raw) {
  try {
    const doc = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!doc || doc.v !== 1 || !Array.isArray(doc.items)) return null;
    const view = doc.view || {};
    return {
      v: 1,
      seq: Number(doc.seq) || doc.items.length,
      layout: doc.layout === "rows" ? "rows" : undefined,
      view: { x: Number(view.x) || 0, y: Number(view.y) || 0, zoom: clampZoom(Number(view.zoom) || 1) },
      items: doc.items.filter((i) => i && ITEM_KINDS.includes(i.kind) && Number.isFinite(i.x) && Number.isFinite(i.y)),
    };
  } catch {
    return null;
  }
}

/** Monta o HTML de preview de um bloco de código (somente HTML tem preview). */
export function buildCodePreview(item) {
  if (item.lang !== "html") return "";
  return item.code || "";
}

export const CODE_LANGS = ["html", "css", "js", "ts", "json", "md"];
