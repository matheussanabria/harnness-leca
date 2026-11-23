var zone = document.querySelector('.dropzone');
var input = zone.querySelector('input[type=file]');
zone.addEventListener('click', function () { input.click(); });
zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-over'); });
zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
zone.addEventListener('drop', function (e) {
  e.preventDefault(); zone.classList.remove('is-over');
  handleFiles(e.dataTransfer.files);
});
input.addEventListener('change', function () { handleFiles(input.files); });