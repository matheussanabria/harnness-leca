// Project picker with "Sem projeto", search and keyboard navigation (EP-25.05, listbox pattern).
import { useEffect, useId, useRef, useState } from "react";
import { buildOptions, moveHighlight, type ProjectOption } from "../../features/launcher/model.ts";

interface Props {
  projects: string[];
  project: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (project: string | null) => void;
}

export function ScopePicker({ projects, project, open, onOpenChange, onChoose }: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const options = buildOptions(projects, query);
  const wasOpen = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      buttonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  const choose = (option: ProjectOption | undefined) => {
    if (!option) return;
    onChoose(option.slug);
    onOpenChange(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onOpenChange(false);
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => moveHighlight(current, event.key === "ArrowDown" ? 1 : -1, options.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[highlight]);
    }
  };

  return (
    <div className="launcher-picker" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="launcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
      >
        <i className={`fa-solid ${project ? "fa-folder-open" : "fa-user"}`} aria-hidden="true" />
        <span className="launcher-btn__label">{project ?? "Sem projeto"}</span>
        <i className="fa-solid fa-chevron-down launcher-btn__chev" aria-hidden="true" />
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div className="launcher-pop">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={options.length ? `${listId}-${highlight}` : undefined}
            aria-label="Buscar projeto"
            placeholder="Buscar projeto"
            autoComplete="off"
            value={query}
            onKeyDown={onKeyDown}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
          />
          <div id={listId} role="listbox" aria-label="Projetos" className="launcher-list">
            {options.map((option, index) => (
              <div
                key={option.slug ?? "none"}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === highlight}
                className={`launcher-opt${option.slug === project ? " is-current" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") choose(option);
                }}
              >
                <i className={`fa-solid ${option.slug ? "fa-folder" : "fa-user"}`} aria-hidden="true" />
                <span className="launcher-opt__name">{option.name}</span>
                <span className="launcher-opt__meta">{option.meta}</span>
              </div>
            ))}
            {options.length === 0 && (
              <div role="presentation" className="launcher-none">
                Nada encontrado.
              </div>
            )}
            {projects.length === 0 && (
              <div role="presentation" className="launcher-none">
                Nenhum projeto criado ainda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
