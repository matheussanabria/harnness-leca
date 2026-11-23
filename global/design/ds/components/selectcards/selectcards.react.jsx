// SelectCards.jsx  (React 18)
import './choice.css';

export function SelectCards({ label, options, value, onChange, multiple = false }) {
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const pick = (v) => onChange(multiple ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : v);
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={isOn(o.value)}
          className="choice" onClick={() => pick(o.value)}>{o.icon}{o.label}</button>
      ))}
    </div>
  );
}