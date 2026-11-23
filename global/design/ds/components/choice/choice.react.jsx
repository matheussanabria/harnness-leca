// ChoiceGroup.jsx  (React 18)
export function ChoiceGroup({ legend, name, options, value, onChange, multiple = false }) {
  const type = multiple ? 'checkbox' : 'radio';
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const toggle = (v) => onChange(multiple ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : v);
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value}><input type={type} name={name} value={o.value} checked={isOn(o.value)} onChange={() => toggle(o.value)} /> {o.label}</label>
      ))}
    </fieldset>
  );
}