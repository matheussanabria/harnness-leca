var overlay = document.querySelector('.overlay');
var opener = null;
function openModal(trigger) {
  opener = trigger; overlay.hidden = false;
  overlay.querySelector('button, [href], input, select, textarea').focus();
}
function closeModal() { overlay.hidden = true; if (opener) opener.focus(); }
overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });