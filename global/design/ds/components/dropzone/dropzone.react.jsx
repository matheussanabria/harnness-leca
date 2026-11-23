// Dropzone.jsx  (React 18)
import { useRef, useState } from 'react';
import './dropzone.css';

export function Dropzone({ accept = '.csv,.xlsx', onFiles }) {
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const add = (list) => { const f = [...files, ...list]; setFiles(f); onFiles?.(f); };
  return (
    <>
      <div className={'dropzone' + (over ? ' is-over' : '')} tabIndex={0} role="button"
        onClick={() => input.current.click()} onKeyDown={(e) => e.key === 'Enter' && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <strong>Arraste e solte seus arquivos aqui</strong><span>ou clique para selecionar</span>
        <input ref={input} type="file" accept={accept} multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      <ul>{files.map((f, i) => <li key={f.name + i}>{f.name} <button aria-label={'Remover ' + f.name} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></li>)}</ul>
    </>
  );
}