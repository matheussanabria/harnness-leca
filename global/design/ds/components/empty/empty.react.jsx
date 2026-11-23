// EmptyState.jsx  (React 18)
import './empty.css';

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action && <a className="btn btn--secondary" href={action.url}>{action.label}</a>}
    </div>
  );
}
// {items.length ? <List items={items} /> : <EmptyState title="Nenhum depoimento pendente" />}