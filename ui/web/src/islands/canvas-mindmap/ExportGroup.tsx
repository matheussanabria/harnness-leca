// Export group for the mind-map toolbar: Markdown outline, JSON, SVG and PNG downloads of the whole map.
import { downloadBlob } from "../../features/export/download.ts";
import { safeFileName } from "../../features/export/fileName.ts";
import { toOutlineMarkdown, toSvg } from "../../features/mindmap/exportMindmap.ts";
import { toData } from "../../features/mindmap/serialize.ts";
import type { MindDoc } from "../../features/mindmap/types.ts";
import { useCopyStatus } from "../../features/mindmap/useCopyStatus.ts";
import { svgToPngBlob } from "./rasterize.ts";
import { ToolbarButton } from "./ToolbarButton.tsx";

export interface ExportGroupProps {
  doc: MindDoc;
  boardTitle: string;
}

export function ExportGroup({ doc, boardTitle }: ExportGroupProps) {
  const { status, show } = useCopyStatus();
  const name = (ext: string) => safeFileName(boardTitle, ext, "mindmap");

  const run = (task: () => Promise<string>) => () => {
    task()
      .then((file) => show(`Saved ${file}`))
      .catch((error) => show(error instanceof Error ? `Export failed: ${error.message}` : "Export failed"));
  };
  const save = async (text: string, type: string, ext: string) => {
    const file = name(ext);
    downloadBlob(new Blob([text], { type }), file);
    return file;
  };

  return (
    <fieldset className="mm-agent-group" aria-label="Export">
      <ToolbarButton
        icon="fa-file-lines"
        label="Export as Markdown outline"
        onClick={run(() => save(toOutlineMarkdown(doc), "text/markdown", "md"))}
      />
      <ToolbarButton
        icon="fa-file-code"
        label="Export as JSON"
        onClick={run(() => save(JSON.stringify(toData(doc), null, 2), "application/json", "json"))}
      />
      <ToolbarButton
        icon="fa-diagram-project"
        label="Export as SVG"
        onClick={run(() => save(toSvg(doc).svg, "image/svg+xml", "svg"))}
      />
      <ToolbarButton
        icon="fa-file-image"
        label="Export as PNG"
        onClick={run(async () => {
          const { svg, width, height } = toSvg(doc);
          const file = name("png");
          downloadBlob(await svgToPngBlob(svg, width, height), file);
          return file;
        })}
      />
      {status ? (
        <span className="mm-agent-status" role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </fieldset>
  );
}
