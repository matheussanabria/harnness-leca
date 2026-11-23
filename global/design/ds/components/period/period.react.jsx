// PeriodNav.jsx  (React 18)
import { useState } from 'react';
import './period.css';

export function PeriodNav({ onChange, allowFuture = false }) {
  const [d, setD] = useState(() => new Date());
  const move = (n) => setD((cur) => { const x = new Date(cur.getFullYear(), cur.getMonth() + n, 1); onChange?.(x); return x; });
  const isNow = d.getFullYear() === new Date().getFullYear() && d.getMonth() === new Date().getMonth();
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
  return (
    <div className="period">
      <button aria-label="Mês anterior" onClick={() => move(-1)}>‹</button>
      <span>{label}</span>
      <button aria-label="Próximo mês" disabled={!allowFuture && isNow} onClick={() => move(1)}>›</button>
    </div>
  );
}