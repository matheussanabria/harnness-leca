// Header.jsx  (React 18)
import { Link, NavLink } from 'react-router-dom';
import './header.css';

export function Header({ brand, links, user, onLogin }) {
  return (
    <header className="header">
      <Link className="header__brand" to="/">{brand}</Link>
      <nav className="header__nav" aria-label="Principal">
        {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
      </nav>
      {user ? <UserMenu user={user} /> : <button className="btn btn--light" onClick={onLogin}>Entrar</button>}
    </header>
  );
}
// z-index: 50 no .header para o menu do usuário ficar acima de carrosséis e cards