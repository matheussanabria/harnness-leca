function renderPager(total, page) {
  var pages = Math.ceil(total / 10);
  return Array.from({ length: pages }, function (_, i) {
    var n = i + 1;
    return '<button' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>';
  }).join('');
}