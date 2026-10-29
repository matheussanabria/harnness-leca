// @ts-check
// Orquestrador de colheita de memórias nativas (EP-13.08).
// Coleta memórias nativas do Claude e do Gemini, filtra por deduplicação
// e regras de segurança (guard), e grava em projects/<slug>/context/colhido-nativo.md.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ROOT } = require("../../root");
const { matchers, projectFromPath, existingSlugs } = require("../../projects");
const { harvestClaudeDir } = require("./claude");
const { harvestGeminiFile } = require("./gemini");
const { inspectSecrets } = require("../guard");
const { isSimilar } = require("../dedupe");
const { hashOf, normalize } = require("../item");
const { resolveMemoryDir, listItems } = require("../store");

/**
 * Resolve diretórios de pastas Claude mapeadas por slug de projeto.
 * @param {string} claudeProjectsDir
 * @param {Array<{ slug: string, size: number, re: RegExp }>} [customMatchers]
 * @returns {Map<string, string[]>}
 */
function mapClaudeDirs(claudeProjectsDir, customMatchers) {
  const bySlug = new Map();
  if (!fs.existsSync(claudeProjectsDir)) return bySlug;
  const ms = customMatchers || matchers();
  for (const d of fs.readdirSync(claudeProjectsDir, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const slug = projectFromPath(d.name, ms);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(path.join(claudeProjectsDir, d.name));
  }
  return bySlug;
}

/**
 * Executa a colheita para os projetos selecionados.
 * @param {Object} params
 * @param {string} [params.project] Slug do projeto específico ou todos se vazio
 * @param {"claude" | "gemini" | "all"} [params.engine] Motores a colher
 * @param {string} [params.claudeProjectsDir] Diretório base do Claude Code
 * @param {string} [params.geminiFilePath] Caminho do arquivo GEMINI.md
 * @param {string} [params.rootDir] Raiz do workspace (default ROOT)
 * @param {boolean} [params.dryRun]
 * @param {{ log: (m: string) => void, error: (m: string) => void }} [params.io]
 * @returns {Record<string, Array<{ texto: string, origem: string }>>}
 */
function harvestAll(params = {}) {
  const io = params.io || console;
  const rootDir = params.rootDir || ROOT;
  const claudeProjectsDir = params.claudeProjectsDir || path.join(os.homedir(), ".claude", "projects");
  const geminiFilePath = params.geminiFilePath || path.join(os.homedir(), ".gemini", "GEMINI.md");
  const selectedEngine = params.engine || "all";
  const dryRun = Boolean(params.dryRun);

  const slugs = params.project ? [params.project] : existingSlugs();
  let ms = matchers();
  if (params.project && !ms.some((m) => m.slug === params.project)) {
    const SEP = "[\\\\/\\-_ ]";
    const parts = params.project.toLowerCase().split(/[\\/\-_ ]+/).filter(Boolean);
    ms = [...ms, { slug: params.project, size: params.project.length, re: new RegExp(`(^|${SEP})${parts.join(SEP)}(?=$|${SEP})`) }];
  }
  const claudeMap = mapClaudeDirs(claudeProjectsDir, ms);

  /** @type {Record<string, Array<{ texto: string, origem: string }>>} */
  const resultsByProject = {};

  for (const slug of slugs) {
    const projDir = path.join(rootDir, "projects", slug);
    if (!fs.existsSync(projDir)) continue;

    /** @type {Array<{ texto: string, origem: string }>} */
    const rawCandidates = [];

    // 1. Claude Code
    if (selectedEngine === "all" || selectedEngine === "claude") {
      const dirs = claudeMap.get(slug) || [];
      for (const cDir of dirs) {
        rawCandidates.push(...harvestClaudeDir(cDir));
      }
    }

    // 2. Gemini (atribuído ao projeto se indicado especificamente, ou ao ativo)
    if ((selectedEngine === "all" || selectedEngine === "gemini") && fs.existsSync(geminiFilePath)) {
      // Bullets do Gemini Added Memories
      const geminiItems = harvestGeminiFile(geminiFilePath);
      if (params.project || slug === "harness-leca") {
        rawCandidates.push(...geminiItems);
      }
    }

    if (rawCandidates.length === 0) continue;

    // 3. Carrega itens já curados da memória do projeto para deduplicação
    const memDir = resolveMemoryDir(rootDir, slug);
    const { valid } = listItems(memDir);
    const legacyMemFile = path.join(projDir, "memory.md");
    const legacyLines = fs.existsSync(legacyMemFile)
      ? fs.readFileSync(legacyMemFile, "utf8").split(/\r?\n/).filter((l) => /^- /.test(l))
      : [];

    /** @type {Array<{ texto: string, origem: string }>} */
    const filtered = [];

    for (const cand of rawCandidates) {
      const text = cand.texto.trim();
      if (!text) continue;

      // RF5: Passa pelo guard.js antes de gravar; segredo vira aviso
      const violations = inspectSecrets(text, "");
      if (violations.length > 0) {
        io.error(`[harvest:${slug}] Aviso de segredo descartado em "${cand.origem}": ${violations.join(", ")}`);
        continue;
      }

      // RF4: Candidato com hash ou similaridade igual a item curado não entra
      const candHash = hashOf(text, "");
      const isCurated = valid.some((v) => v.item.meta.hash === candHash || isSimilar(v.item.meta.description, text, 0.8));
      if (isCurated) continue;

      // Confere também com bullets legados
      const candNorm = normalize(text);
      const isLegacyMatch = legacyLines.some((line) => {
        const lineNorm = normalize(line.replace(/^- (\[\d{4}-\d{2}-\d{2}\]\s*)?/, ""));
        return lineNorm === candNorm || (candNorm.length >= 25 && lineNorm.includes(candNorm));
      });
      if (isLegacyMatch) continue;

      // Evita duplicatas dentro do próprio lote de colheita
      const isDuplicateInBatch = filtered.some((f) => isSimilar(f.texto, text, 0.8));
      if (isDuplicateInBatch) continue;

      filtered.push(cand);
    }

    if (filtered.length === 0) continue;

    resultsByProject[slug] = filtered;

    if (!dryRun) {
      const contextDir = path.join(projDir, "context");
      fs.mkdirSync(contextDir, { recursive: true });
      const targetFile = path.join(contextDir, "colhido-nativo.md");

      const today = new Date().toISOString().slice(0, 10);
      const lines = [
        "# Memórias colhidas nativamente",
        "",
        "Itens colhidos diretamente dos motores de IA locais (Claude Code / Gemini).",
        `Atualizado em ${today}. Nada foi gravado em memory.md ainda.`,
        "",
        `## Colheita nativa (${today})`,
        "",
        "### Memórias",
      ];

      for (const item of filtered) {
        lines.push(`- <!-- ${item.origem} --> ${item.texto}`);
      }
      lines.push("");

      fs.writeFileSync(targetFile, lines.join("\n"), "utf8");
      io.log(`[harvest:${slug}] ${filtered.length} memória(s) colhida(s) em ${targetFile}`);
    } else {
      io.log(`[harvest:${slug}] (dry-run) ${filtered.length} memória(s) candidata(s) encontrada(s)`);
    }
  }

  return resultsByProject;
}

module.exports = {
  mapClaudeDirs,
  harvestAll,
};
