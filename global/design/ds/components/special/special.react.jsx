// ColorField.jsx  (React 18)
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorField({ value, onChange }) {
  return (
    <div className="color-field">
      <input type="color" aria-label="Escolher cor" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input value={value} aria-label="Valor hexadecimal" aria-invalid={!HEX.test(value)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}