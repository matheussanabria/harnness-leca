// Connects the board island to the Studio chat (EP-19.09) through window events, never shared modules:
//   island -> chat  `harness:canvas-state`  a short summary of the drawing, published (debounced) on every change
//   chat -> island  `harness:canvas-apply`  the <board> blocks (Mermaid) of the model's answer
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef } from "react";
import { boardStatePayload, normalizeBoardBlock } from "../../features/board/chatBridge";
import type { SceneElement } from "../../features/board/types";
import { applyMermaid } from "./applyMermaid";

export const CANVAS_STATE_EVENT = "harness:canvas-state";
export const CANVAS_APPLY_EVENT = "harness:canvas-apply";
const PUBLISH_DELAY_MS = 200;

interface Options {
  boardId: string;
  title: string;
  getApi: () => ExcalidrawImperativeAPI | null;
  /** Shows a short message under the board header (success or the reason a block was refused). */
  onNote: (message: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "invalid diagram";
}

export function useBoardChatBridge({ boardId, title, getApi, onNote }: Options) {
  const elements = useRef<readonly SceneElement[]>([]);
  const titleRef = useRef(title);
  titleRef.current = title;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef(onNote);
  noteRef.current = onNote;
  const apiRef = useRef(getApi);
  apiRef.current = getApi;

  /** Call from the Excalidraw `onChange`: remembers the elements and publishes the summary after a short pause. */
  const publish = useCallback(
    (next: readonly SceneElement[]) => {
      elements.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const detail = { ...boardStatePayload(boardId, titleRef.current, elements.current), kind: "board" };
        window.dispatchEvent(new CustomEvent(CANVAS_STATE_EVENT, { detail }));
      }, PUBLISH_DELAY_MS);
    },
    [boardId],
  );

  useEffect(() => {
    // The board is gone (unmount or another board): tell the chat there is nothing to describe any more.
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.dispatchEvent(new CustomEvent(CANVAS_STATE_EVENT, { detail: null }));
    };
  }, []);

  useEffect(() => {
    let queue: Promise<void> = Promise.resolve();
    const onApply = (event: Event) => {
      const detail = (event as CustomEvent).detail as { boardId?: unknown; kind?: unknown; blocks?: unknown } | null;
      if (detail?.kind !== "board" || detail.boardId !== boardId || !Array.isArray(detail.blocks)) return;
      for (const block of detail.blocks) {
        const checked = normalizeBoardBlock(block);
        // Blocks run one after the other, so "replace" followed by "append" keeps the order of the answer.
        queue = queue.then(async () => {
          const api = apiRef.current();
          if (!api) return;
          if (!checked.ok) return noteRef.current(`Chat: bloco ignorado (${checked.reason}).`);
          try {
            const count = await applyMermaid(api, checked.mode, checked.source);
            noteRef.current(`Chat: diagrama aplicado (${count} elementos). Ctrl+Z desfaz.`);
          } catch (error) {
            noteRef.current(`Chat: não consegui desenhar o diagrama (${messageOf(error)}).`);
          }
        });
      }
    };
    window.addEventListener(CANVAS_APPLY_EVENT, onApply);
    return () => window.removeEventListener(CANVAS_APPLY_EVENT, onApply);
  }, [boardId]);

  return { publish };
}
