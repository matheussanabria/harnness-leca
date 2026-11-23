// TextField.jsx  (React 18)
import { useId } from 'react';
import './field.css';

export function TextField({ label, error, help, required, ...rest }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label}{required && <abbr title="obrigatório"> *</abbr>}
      <input id={id} required={required} aria-invalid={!!error} aria-describedby={error || help ? id + '-d' : undefined} {...rest} />
      {(error || help) && <span id={id + '-d'} className={error ? 'field__error' : 'field__help'}>{error ?? help}</span>}
    </label>
  );
}