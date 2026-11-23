// NoteEntry.jsx  (React 18)
import './note.css';

const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function NoteEntry({ note, onRemove }) {
  const expired = note.deadline && new Date(note.deadline) < new Date();
  return (
    <article className="note">
      <header>
        <b>{fmt(note.at)}</b>{expired && <span className="pill pill--danger">EXPIRADO</span>}
        <button className="btn btn--tertiary btn--danger" onClick={() => window.confirm('Excluir anotação?') && onRemove(note.id)}>Excluir</button>
      </header>
      <p>{note.text}</p>
      <small>Registrado por {note.author}</small>
    </article>
  );
}