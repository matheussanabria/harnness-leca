// Text exports of a diagram source (EP-21.03): the `.mmd` file and a Markdown block with a `mermaid` fence. Pure.

/** `.mmd` file text: the source with LF line breaks and exactly one final newline. */
export function toMmd(source: string): string {
  return `${source.replace(/\r\n?/g, "\n").replace(/\s+$/, "")}\n`;
}

/**
 * Markdown block: a ```mermaid fence around the source. The fence is longer than any backtick run inside the source,
 * so a diagram label that contains ``` cannot close the block early.
 */
export function toMarkdownBlock(source: string): string {
  const body = toMmd(source);
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}mermaid\n${body}${fence}\n`;
}
