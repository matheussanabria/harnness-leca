// Switch.jsx  (React 18)
import './switch.css';

export function Switch({ checked, onChange, onLabel = 'Ativo', offLabel = 'Inativo' }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track"><span className="switch__knob" /></span>
      <span className="switch__label">{checked ? onLabel : offLabel}</span>
    </button>
  );
}