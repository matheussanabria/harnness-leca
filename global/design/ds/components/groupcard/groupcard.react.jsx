// GroupCard.jsx  (React 18)
import { useState } from 'react';
import { Pill } from './Pill';
import './group.css';

export function GroupCard({ title, status, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="group">
      <button className="group__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title} <Pill status={status}>{status}</Pill>
      </button>
      {open && children}
    </section>
  );
}
// <GroupCard title="Financiamento Banco Inter" status="ATIVO" defaultOpen><DataTable … /></GroupCard>