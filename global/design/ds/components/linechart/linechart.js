function points(values, max, w, h) {
  return values.map(function (v, i) {
    return (50 + (i * (w - 50)) / (values.length - 1)) + ',' + (h - (v / max) * (h - 20));
  }).join(' ');
}
line.setAttribute('points', points(entradas, 30000, 590, 146));