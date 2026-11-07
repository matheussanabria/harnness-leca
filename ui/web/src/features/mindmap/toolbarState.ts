// Pure enabled-state for the mind-map action bar. The UI mirrors exactly what the commands accept.
import type { History } from "./history.ts";
import type { MindDoc } from "./types.ts";

export interface ToolbarState {
  addChild: boolean;
  addSibling: boolean;
  outdent: boolean;
  rename: boolean;
  toggleCollapse: boolean;
  remove: boolean;
  undo: boolean;
  redo: boolean;
  resetOffsets: boolean;
  resetSizes: boolean;
  /** True when a node is selected, so an agent context pack can be built. */
  copyContext: boolean;
}

/** True when at least one node carries a manual drag offset. */
export function hasOffsets(doc: MindDoc): boolean {
  return Object.values(doc.nodes).some((node) => (node.dx ?? 0) !== 0 || (node.dy ?? 0) !== 0);
}

/** True when at least one node has a manual size. */
export function hasSizes(doc: MindDoc): boolean {
  return Object.values(doc.nodes).some((node) => node.w !== undefined || node.h !== undefined);
}

/** `selectedId` may be null or stale; everything that edits a node is disabled in that case. */
export function toolbarState(
  doc: MindDoc,
  selectedId: string | null,
  history: Pick<History<MindDoc>, "past" | "future">,
): ToolbarState {
  const node = selectedId ? doc.nodes[selectedId] : undefined;
  const selected = node !== undefined;
  const isRoot = selected && node.id === doc.rootId;
  const structural = selected && !isRoot;
  return {
    addChild: selected,
    addSibling: structural,
    outdent: structural,
    rename: selected,
    toggleCollapse: selected && node.children.length > 0,
    remove: structural,
    undo: history.past.length > 0,
    redo: history.future.length > 0,
    resetOffsets: hasOffsets(doc),
    resetSizes: hasSizes(doc),
    copyContext: selected,
  };
}
