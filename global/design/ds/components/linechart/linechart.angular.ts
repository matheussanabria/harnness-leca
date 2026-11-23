// Pizza e rosca: gera os caminhos SVG a partir dos valores
slices = computed(() => {
  const total = this.data().reduce((s, d) => s + d.value, 0);
  let a = -Math.PI / 2;
  return this.data().map(d => {
    const sweep = (d.value / total) * Math.PI * 2, a1 = a + sweep, big = sweep > Math.PI ? 1 : 0;
    const p = (r: number, t: number) => `${100 + r * Math.cos(t)} ${100 + r * Math.sin(t)}`;
    const path = `M100 100 L${p(90, a)} A90 90 0 ${big} 1 ${p(90, a1)} Z`;   // pizza
    const arc = `M${p(62, a)} A62 62 0 ${big} 1 ${p(62, a1)}`;                 // rosca (stroke-width 28)
    a = a1; return { ...d, path, arc, pct: d.value / total };
  });
});

pts = computed(() => this.data().map((v, i) => `${50 + i * 100},${146 - v / this.max() * 126}`).join(' '));