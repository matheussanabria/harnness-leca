// Save indicator and conflict banner of the open diagram (texts of the approved prototype).
import type { SaveState } from "../../features/canvas/autosave.ts";

const LABELS: Record<SaveState, { icon: string; text: string }> = {
  idle: { icon: "fa-solid fa-circle-check", text: "Salvo" },
  dirty: { icon: "fa-solid fa-pen", text: "Alterações não salvas" },
  saving: { icon: "fa-solid fa-spinner fa-spin", text: "Salvando..." },
  saved: { icon: "fa-solid fa-circle-check", text: "Salvo" },
  error: { icon: "fa-solid fa-triangle-exclamation", text: "Não foi possível salvar" },
  conflict: { icon: "fa-solid fa-code-merge", text: "Conflito" },
};

export function SaveStatus({ state, detail }: { state: SaveState; detail: string }) {
  const label = LABELS[state];
  return (
    <output className={`diagram-status diagram-status--${state}`} title={detail || undefined}>
      <i className={label.icon} aria-hidden="true" /> {label.text}
    </output>
  );
}

export function ConflictBanner({ onLoadSaved, onKeepMine }: { onLoadSaved: () => void; onKeepMine: () => void }) {
  return (
    <div className="diagram-banner" role="alert">
      <span>
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Este diagrama foi alterado em outra aba.
      </span>
      <button type="button" className="diagram-btn" onClick={onLoadSaved}>
        <i className="fa-solid fa-rotate" aria-hidden="true" /> Carregar a versão salva
      </button>
      <button type="button" className="diagram-btn" onClick={onKeepMine}>
        <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Manter a minha
      </button>
    </div>
  );
}
