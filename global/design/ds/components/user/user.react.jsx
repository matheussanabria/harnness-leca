// UserMenu.jsx  (React 18)
import { useState, useRef, useEffect } from 'react';
import './user.css';

const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function UserMenu({ user, items, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <div className="user-wrap" ref={ref}>
      <button className="user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="user__avatar">{initials(user.name)}<i className="user__dot" /></span>
        <span className="user__info"><b>{user.name}</b><small>{user.role}</small></span>
      </button>
      {open && (
        <div className="user-menu" role="menu">
          {items.map((i) => <a key={i.to} role="menuitem" href={i.to}>{i.label}</a>)}
          <button role="menuitem" onClick={onLogout}>Sair</button>
        </div>
      )}
    </div>
  );
}