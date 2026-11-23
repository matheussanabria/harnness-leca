var steps = document.querySelectorAll('.stepper li');
var current = 0;
function go(n) {
  current = Math.max(0, Math.min(steps.length - 1, n));
  steps.forEach(function (li, i) {
    li.classList.toggle('is-done', i < current);
    if (i === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}