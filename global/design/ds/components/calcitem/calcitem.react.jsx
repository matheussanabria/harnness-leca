// CalcItem.jsx  (React 18)
import { useMemo, useState } from 'react';
import { InfoGrid } from './InfoGrid';

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CalcItem({ vehicle }) {
  const [entrada, setEntrada] = useState(0);
  const [parcelas, setParcelas] = useState(48);
  const parcela = useMemo(() => (vehicle.valor - entrada) / parcelas, [vehicle.valor, entrada, parcelas]);
  return (
    <section className="calc">
      <h3>{vehicle.nome}</h3>
      <InfoGrid items={[{ label: 'Valor de tabela', value: brl(vehicle.valor) }]} />
      <h4>Cálculo da proposta</h4>
      <label className="field">Entrada *<input type="number" value={entrada} onChange={(e) => setEntrada(+e.target.value)} /></label>
      <label className="field">Parcelas<input type="number" value={parcelas} min={1} onChange={(e) => setParcelas(+e.target.value || 1)} /></label>
      <output>{brl(parcela)}</output>
    </section>
  );
}