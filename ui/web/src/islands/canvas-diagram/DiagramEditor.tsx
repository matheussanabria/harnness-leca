// Editor screen: title, save status, export, text on the left and live preview on the right (approved prototype).
import { useState } from "react";
import type { DiagramApi } from "../../features/diagram/api.ts";
import { detectType } from "../../features/diagram/detect.ts";
import type { DiagramBoard, DiagramData, DiagramTheme } from "../../features/diagram/types.ts";
import { useShellTheme } from "../canvas-board/useShellTheme";
import { ExportMenu } from "./ExportMenu";
import { PreviewPane } from "./PreviewPane";
import { ConflictBanner, SaveStatus } from "./SaveStatus";
import { SourceEditor } from "./SourceEditor";
import { useDiagramLoad } from "./useDiagramLoad";
import { useDiagramSave } from "./useDiagramSave";
import { usePreview } from "./usePreview";

function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="diagram-notice" role="status">
      <i className={icon} aria-hidden="true" /> {children}
    </p>
  );
}

export function DiagramEditor({ api, id }: { api: DiagramApi; id: string }) {
  const { state, reload } = useDiagramLoad(api, id);
  if (state.status === "loading") return <Notice icon="fa-solid fa-spinner fa-spin">Carregando diagrama</Notice>;
  if (state.status === "error") {
    return (
      <div className="diagram-notice" role="alert">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {state.message}{" "}
        <button type="button" className="diagram-btn" onClick={reload}>
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Tentar de novo
        </button>
      </div>
    );
  }
  return <OpenDiagram api={api} board={state.board} data={state.data} reload={reload} />;
}

function OpenDiagram({
  api,
  board,
  data,
  reload,
}: {
  api: DiagramApi;
  board: DiagramBoard;
  data: DiagramData;
  reload: () => void;
}) {
  const shell = useShellTheme();
  const theme: DiagramTheme = shell === "dark" ? "dark" : "default";
  const [source, setSource] = useState(data.source);
  const [title, setTitle] = useState(board.title);
  const [savedTitle, setSavedTitle] = useState(board.title);
  const [note, setNote] = useState("");
  const save = useDiagramSave(api, board.id, board.rev);
  const preview = usePreview(board.id, source, theme);

  const detected = detectType(source);
  const type = detected.kind === "supported" ? detected.type : data.diagramType;
  const error = preview.state?.status === "error" ? preview.state : null;

  function edit(next: string) {
    setSource(next);
    const found = detectType(next);
    save.touch(next, found.kind === "supported" ? found.type : data.diagramType);
  }

  async function commitTitle() {
    const next = title.trim();
    if (!next || next === savedTitle) return setTitle(savedTitle);
    try {
      await save.rename(next);
      setSavedTitle(next);
      setTitle(next);
    } catch (failure) {
      setTitle(savedTitle);
      setNote(failure instanceof Error ? failure.message : "Não foi possível renomear.");
    }
  }

  return (
    <section className="diagram-editor" aria-label={`Diagrama ${savedTitle}`}>
      <header className="diagram-editor__bar">
        <input
          className="diagram-editor__title"
          aria-label="Título do diagrama"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <span className="diagram-pill">{type}</span>
        <SaveStatus state={save.saveState} detail={save.errorMessage} />
        <ExportMenu
          dark={shell === "dark"}
          onNote={setNote}
          input={() => ({ title: savedTitle, source, render: preview.lastGood(), hasError: error !== null })}
        />
      </header>
      {save.saveState === "conflict" && <ConflictBanner onLoadSaved={reload} onKeepMine={() => void save.keepMine()} />}
      {note && (
        <p className="diagram-warning" role="status">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> {note}
        </p>
      )}
      <div className="diagram-editor__split">
        <div className="diagram-editor__source">
          <SourceEditor value={source} errorLine={error?.line} onChange={edit} />
          <div className={error ? "diagram-errbox diagram-errbox--bad" : "diagram-errbox"} role="status">
            {error ? (
              <>
                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-circle-check" aria-hidden="true" /> Sintaxe válida
              </>
            )}
          </div>
        </div>
        <PreviewPane state={preview.state} />
      </div>
    </section>
  );
}
