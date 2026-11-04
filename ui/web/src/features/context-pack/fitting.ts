// Budget arithmetic for the Markdown layout: lengths only, so the builder never measures a rendered string twice.
import { truncationMarker } from "./markdown.ts";
import type { Entry } from "./selection.ts";

/** Extra characters used by the truncation marker (newline included) for a given omitted count. */
export function truncationExtra(omitted: number): number {
  return omitted > 0 ? 1 + truncationMarker(omitted).length : 0;
}

/** Length of the board line, the path line and the blank line that precede the bullets. */
export function headerLength(board: string | null, pathLineText: string): number {
  const lines = board === null ? [pathLineText, ""] : [`# ${board}`, pathLineText, ""];
  return lines.join("\n").length;
}

/** Markdown length after each kept prefix; index 0 is the header without bullets. */
export function prefixLengths(headerLen: number, entries: readonly Entry[]): number[] {
  const lengths = [headerLen];
  let running = headerLen;
  for (const entry of entries) {
    running += 1 + 2 + entry.depth * 2 + entry.text.length;
    lengths.push(running);
  }
  return lengths;
}

/** Greedy prefix: stops at the first node that no longer fits together with the marker. */
export function greedyKept(prefix: readonly number[], total: number, budget: number): number {
  let kept = 0;
  while (kept < total) {
    const candidate = kept + 1;
    const length = (prefix[candidate] as number) + truncationExtra(total - candidate);
    if (length > budget) break;
    kept = candidate;
  }
  return kept;
}

/** True when the header plus the selected node and the marker still fit the budget. */
export function fitsSelected(headerLen: number, selectedText: string, total: number, budget: number): boolean {
  return headerLen + 1 + 2 + selectedText.length + truncationExtra(total - 1) <= budget;
}
