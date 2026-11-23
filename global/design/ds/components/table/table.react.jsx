// DataTable.jsx  (React 18)
import { useMemo, useState } from 'react';
import './table.css';

export function DataTable({ columns, rows, empty = 'Nenhum registro' }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    return [...rows].sort((a, b) => sort.dir * String(a[sort.key]).localeCompare(String(b[sort.key]), 'pt-BR', { numeric: true }));
  }, [rows, sort]);
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          {columns.map((c) => (
            <th key={c.key} className={c.num ? 'num' : undefined}
              aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
              {c.sortable ? <button className="th-sort" onClick={() => toggle(c.key)}>{c.label} ↕</button> : c.label}
            </th>
          ))}
        </tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : undefined}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
          ))}
          {!sorted.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}