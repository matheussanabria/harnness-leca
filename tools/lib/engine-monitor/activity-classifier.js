// @ts-check
// Classificador declarativo de eventos de motor para estados de atividade (EP-09.06).

/**
 * Tabela declarativa de comandos reconhecidos como "testando".
 */
const TEST_COMMAND_PATTERNS = [
  /\bnpm\s+(?:run\s+)?test\b/i,
  /\bnode\s+--test\b/i,
  /\bmvn\s+test\b/i,
  /\bmvn\s+verify\b/i,
  /\bpytest\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\bng\s+test\b/i,
  /\bcargo\s+test\b/i,
  /\bgo\s+test\b/i,
];

/**
 * Verifica se uma linha de comando corresponde a uma execução de testes.
 * @param {string} commandLine
 * @returns {boolean}
 */
function isTestCommand(commandLine) {
  if (!commandLine || typeof commandLine !== "string") return false;
  return TEST_COMMAND_PATTERNS.some((re) => re.test(commandLine));
}

/**
 * Classifica um evento de stream ou mensagem em um estado de atividade canônico.
 * @param {{
 *   type?: string,
 *   toolName?: string,
 *   command?: string,
 *   isThinking?: boolean,
 *   isPlanning?: boolean,
 *   isWaitingUser?: boolean
 * }} event
 * @returns {import("./activity-machine").AtividadeEstado | null}
 */
function classifyActivityEvent(event) {
  if (!event || typeof event !== "object") return null;

  // 1. Pedido de permissão ou pergunta ao usuário
  if (event.isWaitingUser || event.type === "permission_request" || event.type === "question" || event.toolName === "ask_question" || event.toolName === "atelier_ask_user") {
    return "aguardando_resposta";
  }

  // 2. Comandos de teste
  if (event.command && isTestCommand(event.command)) {
    return "testando";
  }
  if (event.toolName && /test/i.test(event.toolName)) {
    return "testando";
  }

  // 3. Ferramentas de alteração de estado (Executando)
  const writeTools = ["write_to_file", "replace_file_content", "multi_replace_file_content", "run_command", "atelier_write_screen", "atelier_patch_styles"];
  if (event.toolName && writeTools.includes(event.toolName)) {
    return "executando";
  }

  // 4. Ferramentas de leitura (Lendo)
  const readTools = ["view_file", "list_dir", "grep_search", "read_url_content", "read_resource", "list_resources", "search_web"];
  if (event.toolName && readTools.includes(event.toolName)) {
    return "lendo";
  }

  // 5. Planejamento
  if (event.isPlanning || event.toolName === "atelier_plan" || event.type === "plan") {
    return "planejando";
  }

  // 6. Raciocínio (Pensando)
  if (event.isThinking || event.type === "thinking" || event.type === "thought") {
    return "pensando";
  }

  // Tipo de stream genérico
  if (event.type === "tool_call" || event.type === "tool_use") {
    return "executando";
  }

  return null;
}

module.exports = {
  TEST_COMMAND_PATTERNS,
  isTestCommand,
  classifyActivityEvent,
};
