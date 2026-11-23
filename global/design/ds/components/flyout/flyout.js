var groups = document.querySelectorAll('.um-group');
var mobile = matchMedia('(max-width: 991px)');
groups.forEach(function (g) {
  var head = g.querySelector('.um-group__head');
  g.addEventListener('mouseenter', function () { if (!mobile.matches) open(g); });
  head.addEventListener('focus', function () { if (!mobile.matches) open(g); });
  head.addEventListener('click', function () { g.classList.contains('is-open') && mobile.matches ? close(g) : open(g); });
});
function open(g) { groups.forEach(close); g.classList.add('is-open'); g.querySelector('.um-group__head').setAttribute('aria-expanded', 'true'); }
function close(g) { g.classList.remove('is-open'); g.querySelector('.um-group__head').setAttribute('aria-expanded', 'false'); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') groups.forEach(close); });