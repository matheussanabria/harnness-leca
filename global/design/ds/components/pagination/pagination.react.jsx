// Pagination.jsx  (React 18)
import './pager.css';

export function Pagination({ total, page, perPage = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = (page - 1) * perPage + 1, to = Math.min(total, page * perPage);
  return (
    <nav aria-label="Paginação" className="pager">
      <span>{from} – {to} de {total}</span>
      <button aria-label="Anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button aria-label="Próxima" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
    </nav>
  );
}
// const rows = all.slice((page - 1) * 10, page * 10);