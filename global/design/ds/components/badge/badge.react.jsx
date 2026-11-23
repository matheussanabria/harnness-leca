// Pill.jsx  (React 18)
import './pill.css';

const TONES = { Pago: 'success', Pendente: 'warning', Atrasado: 'danger', Cancelado: 'neutral' };

export function Pill({ tone, status, children }) {
  const t = tone ?? TONES[status] ?? 'neutral';
  return <span className={'pill pill--' + t}>{children ?? status}</span>;
}
// <Pill status="Pago" />  <Pill tone="info">Novo</Pill>