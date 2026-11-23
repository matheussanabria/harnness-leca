// TextArea.jsx  (React 18)
import { useState } from 'react';

export function TextArea({ label, max = 200, rows = 4, onChange }) {
  const [v, setV] = useState('');
  return (
    <label className="field">{label}
      <textarea rows={rows} maxLength={max} value={v} style={{ resize: 'vertical' }}
        onChange={(e) => { setV(e.target.value); onChange?.(e.target.value); }} />
      <small className="field__count">{v.length}/{max}</small>
    </label>
  );
}