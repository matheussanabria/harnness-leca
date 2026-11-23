// StatusBadge.jsx  (React 18)
import './status.css';

export const Status = ({ tone = 'success', children }) => (
  <span className={'status status--' + tone}><i aria-hidden="true" />{children}</span>
);

export const Count = ({ n }) => <span className="count" aria-label={n + ' itens'}>{n > 99 ? '99+' : n}</span>;