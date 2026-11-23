// CollapsibleCard.jsx  (React 18)
import { useState, useId } from 'react';
import './card.css';

export function CollapsibleCard({ title, count = 0, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="card">
      <button className="card__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {title}{count > 0 && <span className="count">{count}</span>}
      </button>
      <div id={id} className="card__body" hidden={!open}>{children}</div>
    </section>
  );
}