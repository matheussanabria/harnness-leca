function arc(cx, cy, r, a0, a1) {
  var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  var large = a1 - a0 > Math.PI ? 1 : 0;
  return 'M' + cx + ' ' + cy + ' L' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' Z';
}
var total = data.reduce(function (a, d) { return a + d.value; }, 0), angle = -Math.PI / 2;
data.forEach(function (d, i) {
  var next = angle + (d.value / total) * 2 * Math.PI;
  svg.insertAdjacentHTML('beforeend', '<path d="' + arc(100, 100, 90, angle, next) + '" fill="var(--chart-' + (i + 1) + ')"/>');
  angle = next;
});