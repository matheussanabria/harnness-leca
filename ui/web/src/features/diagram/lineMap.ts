// Maps a line number reported by Mermaid back to the line of the text the user typed (EP-21.03).
//
// Mermaid counts lines AFTER its own cleanup, so an error on line 6 of a source with a 3-line front matter is reported
// as "line 3". Measured on mermaid 11.17.2 (tests/diagram-errors.test.js and the real-browser test): the cleanup drops
// the front matter, directive and `%%` comment lines together with the blank lines right before them, and the blank
// lines at the start; a `%%` comment at the end of a code line also swallows the line break after it, so the next line
// joins that one. Blank lines elsewhere count.
import { stripFrontMatter } from "./detect.ts";

/**
 * One entry per cleaned line (element k is cleaned line k+1): the source lines (1-based) that make it up.
 * Normally one; a code line ending in a `%%` comment is joined with the line after it.
 */
export function cleanedLineGroups(source: string): number[][] {
  const all = source.split(/\r?\n/);
  const frontMatterLines = all.length - stripFrontMatter(source).split(/\r?\n/).length;
  const groups: number[][] = [];
  let pendingBlanks: number[][] = [];
  let joinNext = false;
  for (let index = frontMatterLines; index < all.length; index += 1) {
    const line = all[index] ?? "";
    const number = index + 1;
    const trimmed = line.trim();
    if (trimmed === "") {
      pendingBlanks.push([number]);
      continue;
    }
    if (trimmed.startsWith("%%")) {
      pendingBlanks = []; // the comment takes the blank lines before it with it
      continue;
    }
    if (joinNext && groups.length > 0) {
      pendingBlanks = [];
      groups[groups.length - 1]?.push(number);
    } else {
      if (groups.length > 0) groups.push(...pendingBlanks); // leading blanks (nothing kept yet) are dropped
      pendingBlanks = [];
      groups.push([number]);
    }
    joinNext = /\S\s*%%(?!\{)/.test(line);
  }
  if (groups.length > 0) groups.push(...pendingBlanks);
  return groups;
}

/**
 * Source line for a Mermaid-reported line. For a joined line (trailing `%%` comment) it is the line that carries the
 * comment, which is the closest the cleanup model can say; the quoted fragment in the message covers the rest.
 * Falls back to the reported number when the model has no answer.
 */
export function toSourceLine(source: string, reported: number): number {
  const group = cleanedLineGroups(source)[reported - 1];
  return group?.[0] ?? reported;
}
