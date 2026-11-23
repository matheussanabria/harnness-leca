// What each export produces (EP-21.04, CP-08 and CP-09). Pure: the PNG rasterizer is injected (it needs a browser).
// SVG and PNG always come from the last VALID render, so with a syntax error the person is told which version was
// exported; `.mmd` and Markdown use the text as typed, because the text is the source of truth.
import { diagramFileName } from "./exportName.ts";
import { toMarkdownBlock, toMmd } from "./exportText.ts";
import { standaloneSvg } from "./svg.ts";
import type { RenderResult } from "./types.ts";

export type ExportKind = "svg" | "png" | "mmd" | "markdown";

export interface ExportInput {
  title: string;
  source: string;
  /** Last valid render, or null when the diagram never rendered. */
  render: RenderResult | null;
  /** True when the current text has a syntax error (so `render` is older than the text). */
  hasError: boolean;
}

export type ExportOutput =
  | { ok: true; fileName: string; blob: Blob; notice: string }
  | { ok: true; clipboard: string; notice: string }
  | { ok: false; message: string };

export const STALE_NOTICE = "Exportada a última versão válida: o texto atual tem erro de sintaxe.";

export async function buildExport(
  kind: ExportKind,
  input: ExportInput,
  rasterize: (svg: string) => Promise<Blob>,
): Promise<ExportOutput> {
  const notice = input.hasError && (kind === "svg" || kind === "png") ? STALE_NOTICE : "";
  if (kind === "markdown") return { ok: true, clipboard: toMarkdownBlock(input.source), notice: "" };
  if (kind === "mmd") {
    const blob = new Blob([toMmd(input.source)], { type: "text/plain;charset=utf-8" });
    return { ok: true, fileName: diagramFileName(input.title, "mmd"), blob, notice: "" };
  }
  if (!input.render) return { ok: false, message: "Nada para exportar: o diagrama ainda não foi desenhado." };
  if (kind === "svg") {
    const blob = new Blob([standaloneSvg(input.render.svg)], { type: "image/svg+xml;charset=utf-8" });
    return { ok: true, fileName: diagramFileName(input.title, "svg"), blob, notice };
  }
  return { ok: true, fileName: diagramFileName(input.title, "png"), blob: await rasterize(input.render.svg), notice };
}
