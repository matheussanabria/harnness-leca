document.querySelectorAll('.acc__head').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    btn.nextElementSibling.hidden = open;
  });
});