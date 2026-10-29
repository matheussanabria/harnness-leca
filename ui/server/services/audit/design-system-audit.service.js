// @ts-check
// Scanner de inconsistências visuais e conformidade com o Design System (EP-11.04).
// Detecta cores hardcoded, emojis e ausência de tokens obrigatórios.

const fs = require("fs");
const path = require("path");

const HEX_COLOR_RE = /#([a-f0-9]{3,8})\b/gi;
const RGB_COLOR_RE = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+%?)?\s*\)/gi;
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

/**
 * Mapeamento sugerido para cores comumente hardcoded.
 */
const TOKEN_SUGGESTIONS = {
  "#ffffff": "var(--pure-0) ou var(--neutral-body)",
  "#000000": "var(--pure-100) ou var(--surface-base)",
  "#0284c7": "var(--primary-interactive) ou var(--blue-600)",
  "#38bdf8": "var(--primary-hover) ou var(--blue-400)",
  "#ef4444": "var(--status-danger)",
  "#22c55e": "var(--status-success)",
  "#eab308": "var(--status-warning)",
};

/**
 * Analisa o conteúdo de um arquivo CSS ou HTML.
 * @param {string} content
 * @param {string} relPath
 * @returns {Array<{ relPath: string, line: number, type: string, severity: string, message: string, suggestion?: string }>}
 */
function scanContentForVisualIssues(content, relPath) {
  const issues = [];
  const lines = String(content || "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const text = lines[i];

    // Ignora declarações do próprio arquivo de definição de tokens
    if (relPath.endsWith("tokens.css") || relPath.endsWith("theme.css")) continue;

    // 1. Detecção de emojis proibidos
    if (EMOJI_RE.test(text)) {
      issues.push({
        relPath,
        line: lineNum,
        type: "emoji",
        severity: "error",
        message: "Uso de emoji detectado na interface.",
        suggestion: "Substitua por ícone vetorial FontAwesome (ex: <i class='fa-solid fa-*'></i>).",
      });
    }

    // Ignora comentários CSS ou HTML
    const trimmed = text.trim();
    if (trimmed.startsWith("/*") || trimmed.startsWith("<!--") || trimmed.startsWith("//")) continue;

    // 2. Cores Hexadecimais hardcoded
    let match;
    const hexRe = new RegExp(HEX_COLOR_RE.source, "gi");
    while ((match = hexRe.exec(text)) !== null) {
      const hex = match[0].toLowerCase();
      issues.push({
        relPath,
        line: lineNum,
        type: "color-token",
        severity: "warning",
        message: `Cor hardcoded '${hex}' utilizada diretamente no estilo.`,
        suggestion: TOKEN_SUGGESTIONS[hex] ? `Utilize ${TOKEN_SUGGESTIONS[hex]}` : "Utilize uma variável semântica de tokens.css ou theme.css.",
      });
    }

    // 3. Cores RGB/RGBA hardcoded
    const rgbRe = new RegExp(RGB_COLOR_RE.source, "gi");
    while ((match = rgbRe.exec(text)) !== null) {
      const rgb = match[0];
      issues.push({
        relPath,
        line: lineNum,
        type: "color-token",
        severity: "warning",
        message: `Cor RGB '${rgb}' utilizada diretamente no estilo.`,
        suggestion: "Utilize tokens semânticos do Design System com opacidade regulada se necessário.",
      });
    }
  }

  return issues;
}

/**
 * Audita a conformidade do Design System em um projeto.
 * @param {string} projectDir Caminho de projects/<slug>
 * @param {object} [deps] Injeção de dependências para testes
 * @returns {{ score: number, compliant: boolean, totalIssues: number, tokensFound: boolean, issues: Array<any> }}
 */
function auditProjectDesignSystem(projectDir, deps = { fs, path }) {
  const issues = [];
  const dsDir = deps.path.join(projectDir, "design", "ds");

  const tokensExists = deps.fs.existsSync(deps.path.join(dsDir, "tokens.css"));
  const themeExists = deps.fs.existsSync(deps.path.join(dsDir, "theme.css"));

  if (!tokensExists) {
    issues.push({
      relPath: "design/ds/tokens.css",
      line: 1,
      type: "missing-tokens",
      severity: "error",
      message: "Arquivo obrigatório tokens.css do Design System não encontrado no projeto.",
      suggestion: "Execute a importação do Design System via 'tools/import-ds-docs.js'.",
    });
  }

  if (!themeExists) {
    issues.push({
      relPath: "design/ds/theme.css",
      line: 1,
      type: "missing-tokens",
      severity: "warning",
      message: "Arquivo theme.css com mapeamentos semânticos não encontrado no projeto.",
      suggestion: "Crie o mapeamento semântico de temas conforme EP-12.09.",
    });
  }

  // Varredura recursiva de arquivos CSS e HTML sob design/ e ui/
  const scanDirs = [deps.path.join(projectDir, "design")];
  for (const dir of scanDirs) {
    if (!deps.fs.existsSync(dir)) continue;
    try {
      const entries = deps.fs.readdirSync(dir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith(".css") || entry.name.endsWith(".html"))) {
          const parent = entry.parentPath || dir;
          const fullPath = deps.path.join(parent, entry.name);
          const relPath = deps.path.relative(projectDir, fullPath).replace(/\\/g, "/");
          try {
            const content = deps.fs.readFileSync(fullPath, "utf8");
            const fileIssues = scanContentForVisualIssues(content, relPath);
            issues.push(...fileIssues);
          } catch {}
        }
      }
    } catch {}
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  // Cálculo de score de conformidade: base 100 - (errors * 15) - (warnings * 3)
  const penalty = errors * 15 + warnings * 3;
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    compliant: score >= 80 && errors === 0,
    tokensFound: tokensExists && themeExists,
    totalIssues: issues.length,
    counts: { errors, warnings },
    issues,
  };
}

module.exports = {
  scanContentForVisualIssues,
  auditProjectDesignSystem,
  TOKEN_SUGGESTIONS,
};
