var label = document.querySelector('.period span');
var date = new Date();
function render() { label.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date); }
document.querySelector('[aria-label="Mês anterior"]').onclick = function () { date.setMonth(date.getMonth() - 1); render(); };
document.querySelector('[aria-label="Próximo mês"]').onclick = function () { date.setMonth(date.getMonth() + 1); render(); };