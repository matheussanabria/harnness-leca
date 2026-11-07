// Editor state: document history, selection and inline editing, driven by the pure commands.
import { useCallback, useMemo, useState } from "react";
import {
  addChild,
  addSibling,
  deleteSubtree,
  moveNode as moveNodeCommand,
  outdent,
  rename,
  reparent as reparentCommand,
  resetOffsets as resetOffsetsCommand,
  resetSizes as resetSizesCommand,
  resizeNode as resizeNodeCommand,
  toggleCollapse,
} from "./commands.ts";
import type { History } from "./history.ts";
import { createHistory, push, redo, undo } from "./history.ts";
import { visibleOrder } from "./layout.ts";
import { parentOf } from "./tree.ts";
import type { MindDoc } from "./types.ts";

const newId = (): string => crypto.randomUUID();

export function useMindEditor(initial: MindDoc) {
  const [history, setHistory] = useState<History<MindDoc>>(() => createHistory(initial));
  const [selectedId, setSelectedId] = useState(initial.rootId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const doc = history.present;

  const apply = useCallback((next: MindDoc) => setHistory((h) => push(h, next)), []);

  const reset = useCallback((next: MindDoc) => {
    setHistory(createHistory(next));
    setSelectedId(next.rootId);
    setEditingId(null);
  }, []);

  const commands = useMemo(
    () => ({
      child: () => {
        const id = newId();
        const next = addChild(doc, selectedId, id);
        if (next === doc) return;
        apply(next);
        setSelectedId(id);
        setEditingId(id);
      },
      sibling: () => {
        const id = newId();
        const next = addSibling(doc, selectedId, id);
        if (next === doc) return;
        apply(next);
        setSelectedId(id);
        setEditingId(id);
      },
      outdent: () => apply(outdent(doc, selectedId)),
      remove: () => {
        const parent = parentOf(doc, selectedId);
        const next = deleteSubtree(doc, selectedId);
        if (next === doc || parent === null) return;
        apply(next);
        setSelectedId(parent);
      },
      toggle: () => apply(toggleCollapse(doc, selectedId)),
      applyExternal: (next: MindDoc, focusId: string | null) => {
        apply(next);
        if (focusId !== null) setSelectedId(focusId);
      },
      edit: () => setEditingId(selectedId),
      editNode: (id: string) => setEditingId(id),
      toggleNode: (id: string) => apply(toggleCollapse(doc, id)),
      commitText: (id: string, text: string) => {
        apply(rename(doc, id, text));
        setEditingId(null);
      },
      cancelEdit: () => setEditingId(null),
      moveNode: (id: string, dx: number, dy: number) => apply(moveNodeCommand(doc, id, dx, dy)),
      reparentNode: (id: string, targetId: string) => {
        const next = reparentCommand(doc, id, targetId);
        if (next === doc) return;
        apply(next);
        setSelectedId(id);
      },
      resetOffsets: () => apply(resetOffsetsCommand(doc)),
      resetSizes: () => apply(resetSizesCommand(doc)),
      resizeNode: (id: string, w: number, h: number) => apply(resizeNodeCommand(doc, id, w, h)),
      undo: () => {
        const next = undo(history);
        if (next === history) return;
        setHistory(next);
        setSelectedId((current) => (next.present.nodes[current] ? current : next.present.rootId));
      },
      redo: () => {
        const next = redo(history);
        if (next === history) return;
        setHistory(next);
        setSelectedId((current) => (next.present.nodes[current] ? current : next.present.rootId));
      },
      move: (direction: "up" | "down" | "left" | "right") => {
        const order = visibleOrder(doc);
        const at = order.indexOf(selectedId);
        const node = doc.nodes[selectedId];
        if (direction === "up") setSelectedId(order[Math.max(0, at - 1)] ?? selectedId);
        if (direction === "down") setSelectedId(order[Math.min(order.length - 1, at + 1)] ?? selectedId);
        if (direction === "left") setSelectedId(parentOf(doc, selectedId) ?? selectedId);
        if (direction === "right" && node && !node.collapsed) setSelectedId(node.children[0] ?? selectedId);
      },
    }),
    [doc, selectedId, apply, history],
  );

  return {
    doc,
    selectedId,
    editingId,
    setSelectedId,
    reset,
    commands,
    history,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
