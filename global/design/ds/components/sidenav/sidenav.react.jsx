// SideNav.jsx  (React 18)
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './sidenav.css';

export function SideNav({ items, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [open, setOpen] = useState(null);
  return (
    <nav className={'sidenav' + (collapsed ? ' sidenav--collapsed' : '')} aria-label="Principal">
      <button className="sidenav__toggle" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed(!collapsed)}>☰</button>
      {items.map((i) => i.children ? (
        <div key={i.label}>
          <button className="sidenav__item" aria-expanded={open === i.label} onClick={() => setOpen(open === i.label ? null : i.label)} title={i.label}>
            {i.icon}<span>{i.label}</span>
          </button>
          {open === i.label && i.children.map((c) => <NavLink key={c.to} to={c.to} className="sidenav__item sidenav__item--child">{c.label}</NavLink>)}
        </div>
      ) : (
        <NavLink key={i.to} to={i.to} className="sidenav__item" title={i.label}>{i.icon}<span>{i.label}</span></NavLink>
      ))}
    </nav>
  );
}