// SearchField.jsx  (React 18)
import { useState, useEffect } from 'react';
import './search.css';

export function SearchField({ onSearch, delay = 300, placeholder = 'Pesquisar' }) {
  const [q, setQ] = useState('');
  useEffect(() => { const id = setTimeout(() => onSearch(q), delay); return () => clearTimeout(id); }, [q, delay, onSearch]);
  return (
    <label className="search">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" /></svg>
      <input type="search" aria-label="Pesquisar" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <button type="button" aria-label="Limpar" onClick={() => setQ('')}>×</button>}
    </label>
  );
}