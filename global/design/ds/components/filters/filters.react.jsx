// FilterPanel.jsx  (React 18)
import { useState } from 'react';
import './filters.css';

const EMPTY = { cambio: [], preco: 150, marca: '' };

export function FilterPanel({ onApply }) {
  const [f, setF] = useState(EMPTY);
  const toggle = (c) => setF((s) => ({ ...s, cambio: s.cambio.includes(c) ? s.cambio.filter((x) => x !== c) : [...s.cambio, c] }));
  return (
    <aside className="filters">
      <header><h2>Filtros</h2><button className="link" onClick={() => { setF(EMPTY); onApply(EMPTY); }}>Limpar</button></header>
      <fieldset><legend>Câmbio</legend>
        {['Manual', 'Automático'].map((c) => <label key={c}><input type="checkbox" checked={f.cambio.includes(c)} onChange={() => toggle(c)} /> {c}</label>)}
      </fieldset>
      <label className="field">Preço até (mil)<input type="range" min="30" max="300" value={f.preco} onChange={(e) => setF({ ...f, preco: +e.target.value })} /></label>
      <button className="btn btn--primary" onClick={() => onApply(f)}>Aplicar filtros</button>
    </aside>
  );
}