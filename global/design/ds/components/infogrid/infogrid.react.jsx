// InfoGrid.jsx  (React 18)
import './info-grid.css';

export const InfoGrid = ({ items }) => (
  <dl className="info-grid">
    {items.map((i) => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}
  </dl>
);
// <InfoGrid items={[{ label: 'Valor de tabela', value: 'R$ 124.900,00' }]} />