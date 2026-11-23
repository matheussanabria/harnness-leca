// DateRange.jsx  (React 18)
import { useState } from 'react';

export function DateRange({ onChange }) {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const emit = (d, a) => onChange?.({ de: d, ate: a });
  return (
    <>
      <label className="field">De
        <input type="date" value={de} max={ate || undefined} onChange={(e) => { setDe(e.target.value); emit(e.target.value, ate); }} />
      </label>
      <label className="field">Até
        <input type="date" value={ate} min={de || undefined} onChange={(e) => { setAte(e.target.value); emit(de, e.target.value); }} />
      </label>
    </>
  );
}