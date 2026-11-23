document.querySelectorAll('[role=switch]').forEach(function (sw) {
  sw.addEventListener('click', function () {
    var on = sw.getAttribute('aria-checked') === 'true';
    sw.setAttribute('aria-checked', String(!on));
    sw.querySelector('.switch__label').textContent = on ? 'Inativo' : 'Ativo';
  });
});