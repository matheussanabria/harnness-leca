// ListBar.jsx  (React 18)
import './listbar.css';

export function ListBar({ count, sort, onSort, view, onView, sorts }) {
  return (
    <div className="listbar">
      <span><b>{count}</b> veículos</span>
      <select aria-label="Ordenar" value={sort} onChange={(e) => onSort(e.target.value)}>
        {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button aria-pressed={view === 'grid'} aria-label="Grade" onClick={() => onView('grid')}>▦</button>
      <button aria-pressed={view === 'list'} aria-label="Lista" onClick={() => onView('list')}>☰</button>
    </div>
  );
}