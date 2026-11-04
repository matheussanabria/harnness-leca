// Save indicator and conflict banner for the open board.
import type { SaveState } from "../../features/board/autosave.ts";

const LABELS: Record<SaveState, { icon: string; text: string }> = {
  idle: { icon: "fa-regular fa-circle-check", text: "Up to date" },
  dirty: { icon: "fa-solid fa-pen", text: "Unsaved changes" },
  saving: { icon: "fa-solid fa-spinner fa-spin", text: "Saving" },
  saved: { icon: "fa-solid fa-circle-check", text: "Saved" },
  error: { icon: "fa-solid fa-triangle-exclamation", text: "Save failed, will retry on next change" },
  conflict: { icon: "fa-solid fa-code-merge", text: "Conflict" },
};

export function SaveStatus({ state, detail }: { state: SaveState; detail: string }) {
  const label = LABELS[state];
  return (
    <output className={`board-status board-status--${state}`} title={detail || undefined}>
      <i className={label.icon} aria-hidden="true" /> {label.text}
    </output>
  );
}

export function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div className="board-banner" role="alert">
      <span>
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> This board was changed somewhere else.
        Your latest edits were not saved. Reload to get the newer version.
      </span>
      <button type="button" className="board-btn" onClick={onReload}>
        <i className="fa-solid fa-rotate" aria-hidden="true" /> Reload board
      </button>
    </div>
  );
}
