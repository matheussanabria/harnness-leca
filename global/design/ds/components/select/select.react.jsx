// SelectField.jsx  (React 18)
export function SelectField({ label, options, value, onChange, required, placeholder = 'Selecione' }) {
  return (
    <label className="field">{label}{required && <abbr title="obrigatório"> *</abbr>}
      <select value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}