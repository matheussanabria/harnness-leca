// @ts-check
// Configuração do agente implementador: escreve só dentro do worktree, roda só testes e git de leitura.
// Passada ao opencode por OPENCODE_CONFIG (arquivo fora do worktree, para não sujar o diff).
const AGENT = "implementador";

const BASH = {
  "*": "deny",
  "node --test*": "allow",
  "npm test*": "allow",
  "npm run check*": "allow",
  "git status*": "allow",
  "git diff*": "allow",
  "git log*": "allow",
};

function packageConfig() {
  const permission = {
    edit: "allow",
    bash: BASH,
    webfetch: "deny",
    websearch: "deny",
    task: "deny",
    external_directory: "deny",
    doom_loop: "deny",
  };
  return {
    $schema: "https://opencode.ai/config.json",
    autoupdate: false,
    share: "disabled",
    permission,
    agent: { [AGENT]: { mode: "primary", description: "Implementa uma história do EP-14 no worktree", permission } },
  };
}

module.exports = { AGENT, BASH, packageConfig };
