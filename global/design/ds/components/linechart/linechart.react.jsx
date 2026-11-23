// Pizza e rosca
function slices(data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let a = -Math.PI / 2;
  const p = (r, t) => `${100 + r * Math.cos(t)} ${100 + r * Math.sin(t)}`;
  return data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2, a1 = a + sweep, big = sweep > Math.PI ? 1 : 0;
    const out = { ...d, path: `M100 100 L${p(90, a)} A90 90 0 ${big} 1 ${p(90, a1)} Z`, arc: `M${p(62, a)} A62 62 0 ${big} 1 ${p(62, a1)}`, pct: d.value / total };
    a = a1; return out;
  });
}
// <svg viewBox="0 0 200 200">{slices(data).map(s => <path key={s.name} d={s.path} fill={s.color} />)}</svg>

const pts = data.map((v, i) => `${50 + i * 100},${146 - (v / max) * 126}`).join(' ');
<polyline points={pts} />