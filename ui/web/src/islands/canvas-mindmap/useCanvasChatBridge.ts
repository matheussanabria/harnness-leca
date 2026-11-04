// React glue between the mind-map editor and the legacy chat. Window events are the only contract.
import { useEffect, useRef } from "react";
import {
  applyBlocks,
  CANVAS_APPLY_EVENT,
  CANVAS_STATE_EVENT,
  type CanvasApplyBlock,
  canvasStatePayload,
} from "../../features/mindmap/chatBridge.ts";
import type { MindDoc } from "../../features/mindmap/types.ts";

const DEBOUNCE_MS = 200;

interface CanvasChatBridgeOptions {
  boardId: string;
  title: string;
  doc: MindDoc;
  selectedId: string;
  applyExternal(next: MindDoc, focusId: string | null): void;
}

/** Defensive reader: a malformed block invalidates the whole event instead of applying half of it. */
function readBlock(value: unknown): CanvasApplyBlock | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const mode = raw.mode;
  const parent = raw.parent;
  if (mode !== "append" && mode !== "new") return null;
  if (parent !== "selected" && parent !== "root") return null;
  if (typeof raw.body !== "string") return null;
  return { mode, parent, body: raw.body };
}

function readBlocks(detail: unknown, boardId: string): CanvasApplyBlock[] | null {
  if (typeof detail !== "object" || detail === null) return null;
  const raw = detail as Record<string, unknown>;
  if (raw.boardId !== boardId || !Array.isArray(raw.blocks)) return null;
  const blocks: CanvasApplyBlock[] = [];
  for (const value of raw.blocks) {
    const block = readBlock(value);
    if (!block) return null;
    blocks.push(block);
  }
  return blocks;
}

/** Publishes the island state (debounced) and applies chat blocks addressed to this board. */
export function useCanvasChatBridge({ boardId, title, doc, selectedId, applyExternal }: CanvasChatBridgeOptions): void {
  // The apply listener is registered once and always works from the latest values.
  const latest = useRef({ boardId, title, doc, selectedId, applyExternal });
  latest.current = { boardId, title, doc, selectedId, applyExternal };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(CANVAS_STATE_EVENT, { detail: canvasStatePayload(doc, selectedId, boardId, title) }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [doc, selectedId, boardId, title]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      window.dispatchEvent(new CustomEvent(CANVAS_STATE_EVENT, { detail: null }));
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onApply = (event: Event) => {
      const current = latest.current;
      const blocks = readBlocks((event as CustomEvent<unknown>).detail, current.boardId);
      if (!blocks) return;
      const result = applyBlocks(current.doc, current.selectedId, blocks, () => crypto.randomUUID(), current.title);
      if (result.doc === current.doc) return;
      current.applyExternal(result.doc, result.focusId);
    };
    window.addEventListener(CANVAS_APPLY_EVENT, onApply);
    return () => window.removeEventListener(CANVAS_APPLY_EVENT, onApply);
  }, []);
}
