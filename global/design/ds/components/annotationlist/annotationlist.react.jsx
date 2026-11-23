// AnnotationList.jsx  (React 18)
import { useState } from 'react';
import './annotations.css';

export function AnnotationList({ items }) {
  const [open, setOpen] = useState(0); // a mais recente abre por padrão
  return (
    <ul className="annotations">
      {items.map((n, i) => (
        <li key={n.id}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>{n.date}</button>
          {open === i && <div>{n.text}</div>}
        </li>
      ))}
    </ul>
  );
}