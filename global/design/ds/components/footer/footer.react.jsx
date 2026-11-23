// Footer.jsx  (React 18)
import './footer.css';

export function Footer({ brand, columns, developer }) {
  return (
    <footer className="footer">
      <div className="footer__main">
        {columns.map((c) => (
          <div key={c.title}><h3>{c.title}</h3>
            <ul>{c.links.map((l) => <li key={l.label}><a href={l.url}>{l.label}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="footer__legal">© {new Date().getFullYear()} {brand}{developer && <> · {developer}</>}</div>
    </footer>
  );
}