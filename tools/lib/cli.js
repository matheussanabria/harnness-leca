// Leitura mínima de argumentos de linha de comando (--nome e --nome valor), sem dependências.
// Os dois leem process.argv a cada chamada; `argv` existe para os testes e para chamar os scripts em memória.
const rest = () => process.argv.slice(2);

const flag = (name, argv = rest()) => argv.includes(`--${name}`);
const opt = (name, argv = rest()) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

// Erro esperado de uso (argumento faltando ou inválido, pasta não encontrada...). Como script, a mensagem vai para o
// stderr e o processo sai com `code`; chamado em memória (sync, testes), vira uma exceção comum que quem chama trata.
class CliError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

// Executa `main(argv, io)` como script. Só CliError é tratado aqui; qualquer outro erro continua sendo um bug e estoura.
function runAsScript(main) {
  try {
    main(rest(), console);
  } catch (err) {
    if (!(err instanceof CliError)) throw err;
    console.error(err.message);
    process.exit(err.code);
  }
}

module.exports = { flag, opt, CliError, runAsScript };
