// Leitura mínima de argumentos de linha de comando (--nome e --nome valor), sem dependências.
// Os dois leem process.argv a cada chamada; `argv` existe para os testes.
const rest = () => process.argv.slice(2);

const flag = (name, argv = rest()) => argv.includes(`--${name}`);
const opt = (name, argv = rest()) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

module.exports = { flag, opt };
