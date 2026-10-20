// @ts-check
// Limpeza de texto, título e detecção de projeto das sessões do Antigravity/Gemini.
const path = require("path");
const { matchers, projectFromPath } = require("../projects");

function cleanUserText(text) {
  if (!text) return "";
  // Se tem a tag <USER_REQUEST>, prioriza o conteúdo dela
  const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  let clean = reqMatch ? reqMatch[1] : text;

  // Remove blocos de metadados e settings injetados pelo sistema
  clean = clean
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, "")
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, "")
    .replace(/<(system-reminder|ide_[a-z_]+|command-[a-z-]+|local-command-[a-z-]+|project-harness|task-notification)>[\s\S]*?<\/\1>/gi, "")
    .trim();

  // Limpa menções @[c:\...] deixando apenas o nome legível do arquivo
  clean = clean.replace(/@\[([^\]]+)\]/g, (m, p) => `\`${path.basename(p)}\``);

  return clean.trim();
}

// Associações de projects/ (nomes das pastas + apelidos de .sources.json), lidas uma vez por execução.
let projectMatchers = null;

function detectProjectFromText(text) {
  if (!text) return null;
  if (/saude[\\/]dispensacao/i.test(text)) return "saude-dispensacao";
  if (/57multimarcas/i.test(text)) return "57multimarcas";
  if (/saude[\\/]prontuario|prontuario-web|prontuario-api/i.test(text)) return "saude-prontuario";
  if (/harness-leca/i.test(text)) return "harness-leca";
  if (/conversor-relatorio-maquininhas/i.test(text)) return "conversor-relatorio-maquininhas";
  if (/cerebro-digital|Obsidian/i.test(text)) return "obsidian";

  const gitMatch = text.match(/[\\/]git[\\/]([a-zA-Z0-9_-]+)/i);
  if (gitMatch) return gitMatch[1].toLowerCase();

  return projectFromPath(text, (projectMatchers ||= matchers()));
}

function cleanTitle(raw) {
  if (!raw) return "Conversa sem título";
  let t = raw
    .replace(/<USER_REQUEST>/gi, "")
    .replace(/<\/USER_REQUEST>/gi, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[`*#_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Se começou com caminho de arquivo, pega o nome base ou o texto após o caminho
  const fileStartMatch = t.match(/^([a-zA-Z]:\\[^ ]+)\s*(.*)/);
  if (fileStartMatch) {
    const base = path.basename(fileStartMatch[1]);
    t = fileStartMatch[2] ? `${base} — ${fileStartMatch[2]}` : base;
  }

  return t.slice(0, 70).trim() || "Conversa sem título";
}

function toolHint(name, argsObj) {
  if (!argsObj) return "";
  let obj = argsObj;
  if (typeof argsObj === "string") {
    try { obj = JSON.parse(argsObj); } catch {}
  }
  const raw = obj.toolSummary ||
    obj.toolAction ||
    obj.AbsolutePath ||
    obj.TargetFile ||
    obj.CommandLine ||
    obj.Query ||
    obj.DirectoryPath ||
    obj.Url ||
    "";
  return String(raw).replace(/\s+/g, " ").slice(0, 120);
}


/** Descarta o cache de associações (relê projects/ e .sources.json na próxima detecção). */
function resetProjectMatchers() {
  projectMatchers = null;
}

module.exports = { cleanUserText, detectProjectFromText, cleanTitle, toolHint, resetProjectMatchers };
