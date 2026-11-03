// @ts-check
// Catálogo de ferramentas atômicas e schemas para o Atelier Agent Loop (EP-15.02).
// Permite aos modelos operar em loop multi-turnos com chamadas de ferramenta estruturadas.
const fs = require("fs");
const path = require("path");
const { sanitizeHtmlFragment, injectDataPidAttributes } = require("./prototype-sanitizer.service");
const { validateScreenHtml } = require("./atelier-screen-guards.service");
const { writeScratchFile } = require("./atelier-scratchpad.service");
const { createVersionSnapshot } = require("./prototype-version.service");

/**
 * Schemas canônicos das ferramentas do Ateliê.
 */
const ATELIER_TOOL_DEFINITIONS = [
  {
    name: "atelier_plan",
    description: "Registra ou atualiza o plano em etapas do protótipo e suposições de design antes ou durante a implementação.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description: "Lista ordenada de etapas da construção",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Identificador da etapa, ex: 'layout_base'" },
              title: { type: "string", description: "Descrição clara da etapa" },
              status: { type: "string", enum: ["pending", "in_progress", "done"], description: "Status da etapa" },
            },
            required: ["id", "title", "status"],
          },
        },
        assumptions: {
          type: "array",
          items: { type: "string" },
          description: "Suposições assumidas pelo modelo sobre regras de negócio ou Design System",
        },
      },
      required: ["steps"],
    },
  },
  {
    name: "atelier_write_screen",
    description: "Cria ou atualiza modularmente o HTML de uma tela do protótipo (ex: 'home', 'produtos', 'detalhe').",
    parameters: {
      type: "object",
      properties: {
        screenId: { type: "string", description: "ID da tela (somente letras, números, hífens ou underlines), ex: 'home'" },
        htmlContent: { type: "string", description: "Fragmento HTML do corpo da tela (sem <html>/<head>)" },
        isPartial: { type: "boolean", description: "True se for um bloco parcial sendo montado incrementalmente" },
      },
      required: ["screenId", "htmlContent"],
    },
  },
  {
    name: "atelier_patch_styles",
    description: "Adiciona ou substitui estilos CSS específicos do protótipo em styles/proto.css.",
    parameters: {
      type: "object",
      properties: {
        cssRules: { type: "string", description: "Regras CSS com classes do protótipo e tokens var(--...)" },
        mode: { type: "string", enum: ["append", "replace"], description: "Adicionar ao fim ('append') ou sobrescrever ('replace')" },
      },
      required: ["cssRules"],
    },
  },
  {
    name: "atelier_ask_user",
    description: "Suspende a execução e solicita um esclarecimento interativo ou escolha de direção ao usuário antes de continuar.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "A pergunta objetiva para o usuário" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Opções selecionáveis para resposta rápida (opcional)",
        },
        context: { type: "string", description: "Contexto ou motivo da dúvida (opcional)" },
      },
      required: ["question"],
    },
  },
  {
    name: "atelier_complete",
    description: "Finaliza o ciclo de implementação, gerando versão no histórico e consolidando a prévia no canvas.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo executivo do que foi construído ou alterado" },
        changedFiles: {
          type: "array",
          items: { type: "string" },
          description: "Lista dos arquivos afetados",
        },
      },
      required: ["summary"],
    },
  },
];

/**
 * Converte schemas para o formato FunctionDeclarations da API Gemini do Google AI Studio.
 */
function getGeminiFunctionDeclarations() {
  return ATELIER_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Converte schemas para o formato Tools padrão OpenAI / OpenCode.
 */
function getOpenCodeTools() {
  return ATELIER_TOOL_DEFINITIONS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Executa uma ferramenta atômica do Ateliê em um protótipo.
 * @param {string} toolName
 * @param {object} args
 * @param {{ projectDir: string, protoId: string, author?: string }} ctx
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 * @returns {Promise<{ ok: boolean, result?: any, error?: string, yieldsControl?: boolean }>}
 */
/** Sobe a versão do proto.json e grava o snapshot. Usada ao concluir e ao encerrar uma execução com telas já gravadas. */
function finalizeVersion(protoDir, { author, message }, deps = { fs, path }) {
  const protoJsonPath = deps.path.join(protoDir, "proto.json");
  let currentVersion = 1;
  if (deps.fs.existsSync(protoJsonPath)) {
    try {
      const protoJson = JSON.parse(deps.fs.readFileSync(protoJsonPath, "utf8"));
      currentVersion = (Number(protoJson.version) || 1) + 1;
      protoJson.version = currentVersion;
      protoJson.metadata = protoJson.metadata || {};
      protoJson.metadata.updatedAt = new Date().toISOString();
      deps.fs.writeFileSync(protoJsonPath, JSON.stringify(protoJson, null, 2), "utf8");
    } catch {}
  }
  createVersionSnapshot(protoDir, currentVersion, { author, message }, deps);
  return currentVersion;
}

async function executeAtelierTool(toolName, args, ctx, deps = { fs, path }) {
  if (!ctx || !ctx.projectDir || !ctx.protoId) {
    return { ok: false, error: "Contexto do protótipo incompleto." };
  }

  const { projectDir, protoId } = ctx;
  const protoDir = deps.path.join(projectDir, "design", "prototypes", protoId);
  if (!deps.fs.existsSync(protoDir)) {
    return { ok: false, error: `Protótipo '${protoId}' não encontrado.` };
  }

  try {
    switch (toolName) {
      case "atelier_plan": {
        const { steps, assumptions = [] } = args || {};
        if (!Array.isArray(steps)) return { ok: false, error: "steps deve ser uma lista." };
        const planData = { updatedAt: new Date().toISOString(), steps, assumptions };
        writeScratchFile(projectDir, protoId, "plan.json", planData, deps);
        return { ok: true, result: { message: "Plano registrado no scratchpad.", stepCount: steps.length } };
      }

      case "atelier_write_screen": {
        let { screenId, htmlContent } = args || {};
        if (!screenId || typeof screenId !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(screenId)) {
          return { ok: false, error: `screenId inválido: "${screenId}". Use apenas letras, números e traços.` };
        }
        const guardError = validateScreenHtml(htmlContent);
        if (guardError) return { ok: false, error: guardError };
        const sanitized = sanitizeHtmlFragment(htmlContent || "");
        const cleanHtml = injectDataPidAttributes(sanitized);
        const sentBytes = Buffer.byteLength(String(htmlContent || ""), "utf8");
        const keptBytes = Buffer.byteLength(sanitized, "utf8");
        const warning = sentBytes > 200 && keptBytes < sentBytes * 0.7
          ? `O sanitizador removeu ${sentBytes - keptBytes} bytes do HTML enviado (iframe, script externo, meta ou handlers). Confira se a tela ficou completa.`
          : undefined;
        const screensDir = deps.path.join(protoDir, "screens");
        if (!deps.fs.existsSync(screensDir)) deps.fs.mkdirSync(screensDir, { recursive: true });
        const filePath = deps.path.join(screensDir, `${screenId}.html`);
        deps.fs.writeFileSync(filePath, cleanHtml, "utf8");

        // Atualiza proto.json se a tela não estiver registrada
        const protoJsonPath = deps.path.join(protoDir, "proto.json");
        if (deps.fs.existsSync(protoJsonPath)) {
          try {
            const protoJson = JSON.parse(deps.fs.readFileSync(protoJsonPath, "utf8"));
            protoJson.screens = Array.isArray(protoJson.screens) ? protoJson.screens : [];
            if (!protoJson.screens.some((s) => s.id === screenId)) {
              protoJson.screens.push({ id: screenId, title: screenId, file: `screens/${screenId}.html` });
              deps.fs.writeFileSync(protoJsonPath, JSON.stringify(protoJson, null, 2), "utf8");
            }
          } catch {}
        }
        return { ok: true, result: { message: `Tela '${screenId}' atualizada.`, screen: `screens/${screenId}.html`, bytes: Buffer.byteLength(cleanHtml, "utf8"), ...(warning ? { warning } : {}) } };
      }

      case "atelier_patch_styles": {
        const { mode = "append" } = args || {};
        const cssRules = args?.cssRules ?? args?.cssContent; // os modelos usam os dois nomes
        if (typeof cssRules !== "string") return { ok: false, error: "cssRules deve ser uma string com código CSS." };
        const stylesDir = deps.path.join(protoDir, "styles");
        if (!deps.fs.existsSync(stylesDir)) deps.fs.mkdirSync(stylesDir, { recursive: true });
        const cssPath = deps.path.join(stylesDir, "proto.css");
        let existing = "";
        if (deps.fs.existsSync(cssPath)) existing = deps.fs.readFileSync(cssPath, "utf8");
        const finalCss = mode === "replace" ? cssRules : `${existing.trimEnd()}\n\n/* Atualização incremental via Agent Loop */\n${cssRules.trim()}\n`;
        deps.fs.writeFileSync(cssPath, finalCss, "utf8");
        return { ok: true, result: { message: `styles/proto.css atualizado (${mode}).`, totalBytes: Buffer.byteLength(finalCss, "utf8") } };
      }

      case "atelier_parse_error": // não é chamada pelo modelo: o harness a cria quando uma tag não pôde ser lida
        return { ok: false, error: `A tag <tool name="${args?.tool}"> não pôde ser lida (${args?.reason}). Reenvie. Para atelier_write_screen e atelier_patch_styles escreva o conteúdo CRU no corpo da tag, sem JSON e sem escapes.` };

      case "atelier_ask_user": {
        const { question, options = [], context = "" } = args || {};
        if (!question || typeof question !== "string") return { ok: false, error: "question é obrigatória." };
        return {
          ok: true,
          yieldsControl: true,
          result: { type: "question", question, options, context },
        };
      }

      case "atelier_complete": {
        const { summary, changedFiles = [] } = args || {};
        const currentVersion = finalizeVersion(protoDir, { author: ctx.author || "agent", message: summary || "Iteração concluída via Agent Loop" }, deps);
        return { ok: true, result: { completed: true, version: currentVersion, summary, changedFiles } };
      }

      default:
        return { ok: false, error: `Ferramenta desconhecida: "${toolName}".` };
    }
  } catch (err) {
    return { ok: false, error: `Falha na execução de ${toolName}: ${err.message || String(err)}` };
  }
}

module.exports = {
  ATELIER_TOOL_DEFINITIONS,
  getGeminiFunctionDeclarations,
  getOpenCodeTools,
  executeAtelierTool,
  finalizeVersion,
};
