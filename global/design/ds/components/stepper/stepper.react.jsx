// Stepper.jsx  (React 18)
import { useState } from 'react';
import './stepper.css';

export function Stepper({ steps, onFinish }) {
  const [cur, setCur] = useState(0);
  return (
    <>
      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s.label} className={i < cur ? 'is-done' : undefined} aria-current={i === cur ? 'step' : undefined}>
            <button disabled={i > cur} onClick={() => setCur(i)}>{i < cur ? '✓' : i + 1}</button><span>{s.label}</span>
          </li>
        ))}
      </ol>
      <div>{steps[cur].content}</div>
      <button disabled={cur === 0} onClick={() => setCur(cur - 1)}>Voltar</button>
      <button className="btn btn--primary" onClick={() => (cur === steps.length - 1 ? onFinish?.() : setCur(cur + 1))}>
        {cur === steps.length - 1 ? 'Concluir' : 'Avançar'}
      </button>
    </>
  );
}