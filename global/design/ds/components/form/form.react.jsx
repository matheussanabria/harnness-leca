// CascadingSelects.jsx  (React 18)
import { useState } from 'react';

export function CascadingSelects({ tree, onChange }) {
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [versao, setVersao] = useState('');
  const modelos = tree[marca] ?? {};
  const versoes = modelos[modelo] ?? [];
  const emit = (m, mo, v) => onChange?.({ marca: m, modelo: mo, versao: v });
  return (
    <>
      <label className="field">Marca
        <select value={marca} onChange={(e) => { setMarca(e.target.value); setModelo(''); setVersao(''); emit(e.target.value, '', ''); }}>
          <option value="">Selecione</option>{Object.keys(tree).map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="field">Modelo
        <select value={modelo} disabled={!marca} onChange={(e) => { setModelo(e.target.value); setVersao(''); emit(marca, e.target.value, ''); }}>
          <option value="">Selecione</option>{Object.keys(modelos).map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="field">Versão
        <select value={versao} disabled={!modelo} onChange={(e) => { setVersao(e.target.value); emit(marca, modelo, e.target.value); }}>
          <option value="">Selecione</option>{versoes.map((v) => <option key={v}>{v}</option>)}
        </select>
      </label>
    </>
  );
}