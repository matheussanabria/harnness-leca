function scale(values, height) {
  var max = Math.ceil(Math.max.apply(null, values) / 10000) * 10000;
  return { max: max, h: function (v) { return (v / max) * height; } };
}
var s = scale(data.flat(), 126);
bars.forEach(function (rect, i) {
  var h = s.h(values[i]);
  rect.setAttribute('height', h);
  rect.setAttribute('y', 146 - h);
});