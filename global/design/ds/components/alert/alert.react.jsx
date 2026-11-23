// Alert.jsx  (React 18)
import { useState } from 'react';
import './alert.css';

export function Alert({ type = 'info', title, children, onClose }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const role = type === 'danger' || type === 'warning' ? 'alert' : 'status';
  return (
    <div className={'alert alert--' + type} role={role}>
      {title && <strong>{title}</strong>}
      <span>{children}</span>
      <button className="alert__close" aria-label="Fechar" onClick={() => { setOpen(false); onClose?.(); }}>×</button>
    </div>
  );
}