// Short, readable messages for diagram problems (EP-21.03). Shown to people and fed back to a model asked to repair the
// diagram, so each one says where (source line) and what (token and fragment), in one line. Pure: no Mermaid import.
import { SUPPORTED_LABELS } from "./detect.ts";
import { toSourceLine } from "./lineMap.ts";
import type { Detection } from "./types.ts";
import { MAX_SOURCE_BYTES, SUPPORTED_TYPES } from "./types.ts";

const MAX_EXPECTED = 4;
const MAX_FRAGMENT = 60;

const typeList = () => SUPPORTED_TYPES.map((type) => SUPPORTED_LABELS[type]).join(", ");

export const emptyMessage = () => "O diagrama está vazio.";

export function tooLargeMessage(bytes: number): string {
  return `O diagrama passa do limite de ${MAX_SOURCE_BYTES / 1024} KB (tem ${Math.ceil(bytes / 1024)} KB).`;
}

/** Message for a header that is not a supported diagram (see detect.ts). */
export function detectionMessage(detection: Exclude<Detection, { kind: "supported" }>): string {
  if (detection.kind === "refused" && detection.reason === "mindmap") {
    return "Mapa mental em Mermaid não é aceito aqui: use o mapa mental do Canvas.";
  }
  if (detection.kind === "refused") {
    return `O tipo "${detection.header}" não é aceito neste editor. Use: ${typeList()}.`;
  }
  return `Tipo de diagrama não reconhecido. Comece o texto com: ${typeList()}.`;
}

interface ParseFacts {
  reportedLine?: number;
  fragment: string;
  token: string;
  expected: string[];
}

/** Reads the facts out of a Mermaid parse error: `Parse error on line N:` + context + caret + `Expecting ..., got 'X'`. */
function readParseError(error: unknown): ParseFacts | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const head = /^Parse error on line (\d+):/.exec(message);
  const hash = (error as { hash?: { line?: unknown; token?: unknown } } | null)?.hash;
  if (!head && !hash) return null;
  const lines = message.split("\n");
  const reportedLine = head ? Number(head[1]) : typeof hash?.line === "number" ? hash.line + 1 : undefined;
  const fragment = (lines[1] ?? "").replace(/^\.\.\./, "").trim();
  const tail = /(?:Expecting (.+?), )?got '([^']*)'/.exec(message);
  const expected = (tail?.[1] ?? "")
    .split(/,\s*/)
    .map((token) => token.replace(/^'|'$/g, ""))
    .filter(Boolean);
  const token = tail?.[2] ?? (typeof hash?.token === "string" ? hash.token : "");
  return { reportedLine, fragment, token, expected };
}

/**
 * Message and source line for a parse failure. Anything that is not a syntax error (the library failed to load,
 * for example) becomes a generic message with no line, so the editor never shows a raw stack.
 */
export function describeParseError(error: unknown, source: string): { line?: number; message: string } {
  const name = (error as { name?: unknown } | null)?.name;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (name === "UnknownDiagramError" || raw.startsWith("No diagram type detected")) {
    return { message: detectionMessage({ kind: "unknown" }) };
  }
  const facts = readParseError(error);
  if (!facts)
    return {
      message: `Não foi possível validar o diagrama agora: ${raw.split("\n")[0]?.slice(0, 120) || "erro desconhecido"}.`,
    };

  const line = facts.reportedLine === undefined ? undefined : toSourceLine(source, facts.reportedLine);
  const where = line === undefined ? "" : `Linha ${line}: `;
  const found = /^(NEWLINE|EOF)$/.test(facts.token)
    ? "fim da linha inesperado"
    : `trecho inesperado${facts.token ? ` (${facts.token})` : ""}`;
  const near = facts.fragment
    ? ` perto de "${facts.fragment.length > MAX_FRAGMENT ? `...${facts.fragment.slice(-MAX_FRAGMENT)}` : facts.fragment}"`
    : "";
  const shown = facts.expected.slice(0, MAX_EXPECTED);
  const more = facts.expected.length - shown.length;
  const expected = shown.length ? ` Esperado: ${shown.join(", ")}${more > 0 ? ` (+${more})` : ""}.` : "";
  return { ...(line === undefined ? {} : { line }), message: `${where}${found}${near}.${expected}` };
}
