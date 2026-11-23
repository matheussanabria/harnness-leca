// EntityHeader.jsx  (React 18)
import { useState } from 'react';
import './entity.css';

export function EntityHeader({ kicker, name, meta, extra }) {
  const [more, setMore] = useState(false);
  return (
    <header className="entity">
      <small className="entity__kicker">{kicker}</small>
      <h1 className="entity__name">{name}</h1>
      <p className="entity__meta">
        {meta.map((m, i) => <span key={m.label}>{i > 0 && ' | '}{m.label}: <b>{m.value}</b></span>)}
        {extra && <> | <button className="link" aria-expanded={more} onClick={() => setMore(!more)}>{more ? '− ver menos' : '+ ver mais'}</button></>}
      </p>
      {more && extra}
    </header>
  );
}