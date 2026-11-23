// "Exportar" menu (SVG, PNG, .mmd) and "Copiar Markdown". The decisions live in features/diagram/exportPlan.ts.
import { useState } from "react";
import { buildExport, type ExportInput, type ExportKind } from "../../features/diagram/exportPlan.ts";
import { svgToPng } from "../../features/diagram/exportRaster.ts";

const ITEMS: { kind: ExportKind; icon: string; label: string }[] = [
  { kind: "svg", icon: "fa-file-code", label: "SVG" },
  { kind: "png", icon: "fa-file-image", label: "PNG" },
  { kind: "mmd", icon: "fa-file-lines", label: "Arquivo .mmd" },
];

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportMenu({
  input,
  dark,
  onNote,
}: {
  input: () => ExportInput;
  dark: boolean;
  onNote: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(kind: ExportKind) {
    setOpen(false);
    try {
      const result = await buildExport(kind, input(), (svg) =>
        svgToPng(svg, { background: dark ? "#0b1220" : "#ffffff" }),
      );
      if (!result.ok) return onNote(result.message);
      if ("clipboard" in result) {
        await navigator.clipboard.writeText(result.clipboard);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } else {
        download(result.blob, result.fileName);
      }
      onNote(result.notice);
    } catch (error) {
      onNote(error instanceof Error ? `Falha ao exportar: ${error.message}` : "Falha ao exportar.");
    }
  }

  return (
    <>
      <button type="button" className="diagram-btn" onClick={() => void run("markdown")}>
        <i className={copied ? "fa-solid fa-check" : "fa-solid fa-copy"} aria-hidden="true" />{" "}
        {copied ? "Copiado" : "Copiar Markdown"}
      </button>
      <span className="diagram-menu-wrap">
        <button
          type="button"
          className="diagram-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        >
          <i className="fa-solid fa-file-export" aria-hidden="true" /> Exportar{" "}
          <i className="fa-solid fa-caret-down" aria-hidden="true" />
        </button>
        {open && (
          <div className="diagram-menu" role="menu" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
            {ITEMS.map((item) => (
              <button key={item.kind} type="button" role="menuitem" onClick={() => void run(item.kind)}>
                <i className={`fa-solid ${item.icon}`} aria-hidden="true" /> {item.label}
              </button>
            ))}
          </div>
        )}
      </span>
    </>
  );
}
