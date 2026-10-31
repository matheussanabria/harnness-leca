// Proof island for the React foundation (ADR-011, story 16.00): renders props and keeps local state.
import { useState } from "react";
import type { IslandProps } from "../../shared/island";
import "./lab.css";

export function LabIsland({ slug, params }: IslandProps) {
  const [count, setCount] = useState(0);
  return (
    <section className="lab-island" aria-labelledby="lab-island-title">
      <header className="lab-island__header">
        <h1 id="lab-island-title">
          <i className="fa-solid fa-flask" aria-hidden="true" /> React island lab
        </h1>
        <a className="lab-island__back" href="#/chats">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to chats
        </a>
      </header>
      <dl className="lab-island__facts">
        <dt>Project</dt>
        <dd data-testid="lab-slug">{slug || "(none)"}</dd>
        <dt>Route params</dt>
        <dd data-testid="lab-params">{params.length ? params.join(" / ") : "(none)"}</dd>
      </dl>
      <button type="button" className="lab-island__counter" onClick={() => setCount((value) => value + 1)}>
        <i className="fa-solid fa-plus" aria-hidden="true" /> Clicked <span data-testid="lab-count">{count}</span> times
      </button>
    </section>
  );
}
