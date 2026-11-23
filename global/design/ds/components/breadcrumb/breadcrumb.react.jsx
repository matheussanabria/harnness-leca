// Breadcrumb.jsx  (React 18)
import { Link } from 'react-router-dom';
import './breadcrumb.css';

export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Você está aqui">
      <ol className="breadcrumb">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return <li key={c.label} aria-current={last ? 'page' : undefined}>{last ? c.label : <Link to={c.to}>{c.label}</Link>}</li>;
        })}
      </ol>
    </nav>
  );
}