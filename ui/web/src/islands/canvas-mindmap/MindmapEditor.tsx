// Editor for one opened board: toolbar, save status, conflict banner and the canvas.
import { useEffect, useState } from "react";
import type { Board, MindmapApi } from "../../features/mindmap/api.ts";
import { fromData } from "../../features/mindmap/serialize.ts";
import { type SaveState, useAutosave } from "../../features/mindmap/useAutosave.ts";
import { useMindEditor } from "../../features/mindmap/useMindEditor.ts";
import { MindmapCanvas } from "./MindmapCanvas.tsx";

const STATUS: Record<SaveState, { icon: string; text: string }> = {
  saved: { icon: "fa-circle-check", text: "Saved" },
  dirty: { icon: "fa-pen", text: "Unsaved changes" },
  saving: { icon: "fa-spinner fa-spin", text: "Saving" },
  conflict: { icon: "fa-triangle-exclamation", text: "Conflict" },
  error: { icon: "fa-circle-exclamation", text: "Save failed" },
};

export function MindmapEditor({ api, board, onClose }: { api: MindmapApi; board: Board; onClose?: () => void }) {
  const parsed = fromData(board.data);
  if (!parsed.ok) {
    return (
      <p className="mm-banner mm-banner--error" role="alert">
        <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> This board is not a valid mind map:{" "}
        {parsed.error}{" "}
        {onClose ? (
          <button type="button" className="mm-btn" onClick={onClose}>
            Back to boards
          </button>
        ) : null}
      </p>
    );
  }
  return <Loaded api={api} board={board} initial={parsed.doc} onClose={onClose} />;
}

function Loaded({
  api,
  board,
  initial,
  onClose,
}: {
  api: MindmapApi;
  board: Board;
  initial: ReturnType<typeof useMindEditor>["doc"];
  onClose?: () => void;
}) {
  const editor = useMindEditor(initial);
  const { state, flush, rebase } = useAutosave(api, board.id, board.rev, editor.doc);
  const [reloadError, setReloadError] = useState<string | null>(null);

  // Best effort: persist pending edits when the island unmounts.
  useEffect(() => () => void flush(), [flush]);

  const reload = async () => {
    try {
      const fresh = await api.get(board.id);
      const next = fromData(fresh.data);
      if (!next.ok) throw new Error(next.error);
      editor.reset(next.doc);
      rebase(fresh.rev, next.doc);
      setReloadError(null);
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : "Reload failed");
    }
  };

  const status = STATUS[state];
  const { commands } = editor;
  return (
    <div className="mm-editor">
      <header className="mm-toolbar">
        {onClose ? (
          <button type="button" className="mm-btn" onClick={onClose}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Boards
          </button>
        ) : null}
        <h1 className="mm-title">{board.title}</h1>
        <button type="button" className="mm-btn" onClick={commands.undo} disabled={!editor.canUndo} aria-label="Undo">
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
        </button>
        <button type="button" className="mm-btn" onClick={commands.redo} disabled={!editor.canRedo} aria-label="Redo">
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
        </button>
        <span className={`mm-status mm-status--${state}`} role="status">
          <i className={`fa-solid ${status.icon}`} aria-hidden="true" /> {status.text}
        </span>
      </header>
      {state === "conflict" ? (
        <div className="mm-banner mm-banner--error" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> This board changed elsewhere. Your edits
          were not saved.{" "}
          <button type="button" className="mm-btn" onClick={() => void reload()}>
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Reload latest version
          </button>
          {reloadError ? <span> {reloadError}</span> : null}
        </div>
      ) : null}
      <p className="mm-hint">
        Enter: sibling, Tab: child, Shift+Tab: outdent, Delete: remove, F2: rename, Space: collapse, Ctrl+Z /
        Ctrl+Shift+Z: undo / redo.
      </p>
      <MindmapCanvas editor={editor} boardTitle={board.title} />
    </div>
  );
}
