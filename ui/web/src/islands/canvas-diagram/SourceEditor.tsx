// Text editor with a line gutter; the line with the syntax error is marked (aria-label for screen readers).
import { useRef } from "react";

export function SourceEditor({
  value,
  errorLine,
  onChange,
}: {
  value: string;
  errorLine: number | undefined;
  onChange: (next: string) => void;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const count = value.split("\n").length;
  return (
    <div className="diagram-editor__code">
      <div className="diagram-editor__gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => {
          const line = index + 1;
          return (
            <div
              key={index}
              className={line === errorLine ? "diagram-editor__line diagram-editor__line--bad" : "diagram-editor__line"}
            >
              {line}
            </div>
          );
        })}
      </div>
      <textarea
        className="diagram-editor__text"
        aria-label="Código do diagrama (Mermaid)"
        aria-invalid={errorLine !== undefined}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}
