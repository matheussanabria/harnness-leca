// Accordion.jsx  (React 18)
import { useState, useId } from 'react';
import './accordion.css';

export function Accordion({ items, multiple = false, defaultOpen = [0] }) {
  const [open, setOpen] = useState(new Set(defaultOpen));
  const id = useId();
  const toggle = (i) => setOpen((s) => {
    const n = new Set(multiple ? s : []);
    s.has(i) ? n.delete(i) : n.add(i);
    return n;
  });
  return (
    <div className="acc">
      {items.map((it, i) => (
        <section key={it.title}>
          <button className="acc__head" id={id + 'h' + i} aria-expanded={open.has(i)} aria-controls={id + 'p' + i} onClick={() => toggle(i)}>
            {it.title}{it.count != null && <span className="count">{it.count}</span>}
          </button>
          <div className="acc__body" id={id + 'p' + i} role="region" aria-labelledby={id + 'h' + i} hidden={!open.has(i)}>{it.content}</div>
        </section>
      ))}
    </div>
  );
}