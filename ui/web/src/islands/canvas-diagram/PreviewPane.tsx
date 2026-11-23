// Preview of the diagram. With a syntax error it keeps the last valid drawing, dimmed, with a warning.
import type { PreviewState } from "../../features/diagram/preview.ts";

export function PreviewPane({ state }: { state: PreviewState | null }) {
  if (!state) {
    return (
      <p className="diagram-notice" role="status">
        <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Desenhando
      </p>
    );
  }
  const shown = state.status === "ok" ? state.render : state.lastGood;
  const stale = state.status === "error";
  return (
    <div className="diagram-preview">
      {stale && shown && (
        <p className="diagram-preview__stale" role="status">
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Mostrando a última versão válida; corrija o
          erro para atualizar.
        </p>
      )}
      {shown ? (
        <div
          className={stale ? "diagram-preview__canvas diagram-preview__canvas--dim" : "diagram-preview__canvas"}
          role="img"
          aria-label="Prévia do diagrama"
          // The SVG was sanitized by DOMPurify in features/diagram/render.ts (strict Mermaid mode plus the SVG profile).
          dangerouslySetInnerHTML={{ __html: shown.svg }}
        />
      ) : (
        <p className="diagram-notice" role="status">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Corrija o erro para ver o desenho.
        </p>
      )}
    </div>
  );
}
