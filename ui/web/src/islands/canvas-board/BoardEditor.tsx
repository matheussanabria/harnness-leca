// Editor screen: load states, header (title, save status, export) and the lazy Excalidraw canvas.
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { Suspense, useRef, useState } from "react";
import type { BoardApi } from "../../features/board/api";
import { type ExportKind, exportBoard } from "./exportActions";
import { LazyCanvas } from "./lazyCanvas";
import { ConflictBanner, SaveStatus } from "./SaveStatus";
import { useBoardLoad } from "./useBoardLoad";
import { useBoardSave } from "./useBoardSave";
import { useShellTheme } from "./useShellTheme";

const LIST_HREF = "#/canvas-board";

function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="board-notice" role="status">
      <i className={icon} aria-hidden="true" /> {children}
    </p>
  );
}

export function BoardEditor({ api, id }: { api: BoardApi; id: string }) {
  const { state, reload } = useBoardLoad(api, id);
  if (state.status === "loading") return <Notice icon="fa-solid fa-spinner fa-spin">Loading board</Notice>;
  if (state.status === "error") {
    return (
      <div className="board-notice" role="alert">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {state.message}
        <button type="button" className="board-btn" onClick={reload}>
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Try again
        </button>
        <a className="board-btn" href={LIST_HREF}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to boards
        </a>
      </div>
    );
  }
  return <OpenBoard api={api} loaded={state} reload={reload} />;
}

function OpenBoard({
  api,
  loaded,
  reload,
}: {
  api: BoardApi;
  loaded: Extract<ReturnType<typeof useBoardLoad>["state"], { status: "ready" }>;
  reload: () => void;
}) {
  const { board, scene, files, missing } = loaded;
  const theme = useShellTheme();
  const save = useBoardSave(api, board, scene.files);
  const excalidraw = useRef<ExcalidrawImperativeAPI | null>(null);
  const [title, setTitle] = useState(board.title);
  const [savedTitle, setSavedTitle] = useState(board.title);
  const [note, setNote] = useState(missing.length ? `${missing.length} image(s) could not be loaded.` : "");

  async function commitTitle() {
    const next = title.trim();
    if (!next || next === savedTitle) return setTitle(savedTitle);
    try {
      await save.rename(next);
      setSavedTitle(next);
      setTitle(next);
    } catch (error) {
      setTitle(savedTitle);
      setNote(error instanceof Error ? error.message : "Could not rename the board.");
    }
  }

  async function runExport(kind: ExportKind) {
    if (!excalidraw.current) return;
    try {
      await exportBoard(excalidraw.current, kind, title, theme);
    } catch (error) {
      setNote(error instanceof Error ? `Export failed: ${error.message}` : "Export failed.");
    }
  }

  return (
    <section className="board-editor" aria-label={`Board ${savedTitle}`}>
      <header className="board-editor__bar">
        <a className="board-btn" href={LIST_HREF} onClick={() => void save.flush()}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Boards
        </a>
        <input
          className="board-editor__title"
          aria-label="Board title"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <SaveStatus state={save.saveState} detail={save.errorMessage} />
        <button type="button" className="board-btn" onClick={() => void runExport("png")}>
          <i className="fa-solid fa-file-image" aria-hidden="true" /> PNG
        </button>
        <button type="button" className="board-btn" onClick={() => void runExport("svg")}>
          <i className="fa-solid fa-file-code" aria-hidden="true" /> SVG
        </button>
      </header>
      {save.saveState === "conflict" && <ConflictBanner onReload={reload} />}
      {(save.warning || note) && (
        <p className="board-warning" role="status">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> {save.warning || note}
        </p>
      )}
      <div className="board-editor__canvas">
        <Suspense fallback={<Notice icon="fa-solid fa-spinner fa-spin">Loading editor</Notice>}>
          <LazyCanvas
            scene={scene}
            files={files}
            theme={theme}
            onApi={(instance) => {
              excalidraw.current = instance;
            }}
            onChange={save.onSceneChange}
          />
        </Suspense>
      </div>
    </section>
  );
}
