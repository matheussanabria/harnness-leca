// @ts-check
// Coleta dos dados de um projeto do harness e resolução dos diretórios de destino.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT } = require("../root");

/** @param {string} filePath */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").replace(/^﻿/, "").trim();
  } catch {
    return "";
  }
}

/** @param {string} chatsDir */
function countChats(chatsDir) {
  try {
    return fs.readdirSync(chatsDir).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

/** Skills of the project (name, description, SKILL.md path), deduplicated by name; empty when none or unreadable. */
function collectSkills(slug) {
  try {
    const { listProjectSkills } = require("../skills/reader");
    const seen = new Set();
    return listProjectSkills(slug).skills
      .filter((s) => s.hasSkillMd && !seen.has(s.name) && seen.add(s.name))
      .map((s) => ({
        name: s.name,
        description: String(s.description || "").replace(/\s+/g, " ").trim(),
        file: String(s.skillMdFile).split(path.sep).join("/"),
      }));
  } catch {
    return [];
  }
}

/** Só a memória curada (memory.md), itens estruturados (memory/) e as instruções: nada de context/extraido-*.md. */
function collectProjectData(slug) {
  const projDir = path.join(ROOT, "projects", slug);
  const memDir = path.join(projDir, "memory");
  let items = [];
  if (fs.existsSync(memDir)) {
    const { listItems } = require("../memory/store");
    items = listItems(memDir).valid;
  }
  return {
    slug,
    memoryMd: readFileSafe(path.join(projDir, "memory.md")),
    instructionsMd: readFileSafe(path.join(projDir, "instructions.md")),
    chatsCount: countChats(path.join(projDir, "chats")),
    skills: collectSkills(slug),
    items,
  };
}

/**
 * Diretórios de destino. Precedência: parâmetro, variável de ambiente, padrão.
 * Variáveis: HARNESS_EXPORT_CLAUDE_PROJECTS, HARNESS_EXPORT_GEMINI_HOME, HARNESS_EXPORT_CODEX_PROJECTS.
 * @param {{ claudeProjectsDir?: string, geminiHome?: string, codexProjectsDir?: string }} [o]
 */
function resolveTargets(o = {}) {
  const env = process.env;
  const home = os.homedir();
  const geminiHome = o.geminiHome || env.HARNESS_EXPORT_GEMINI_HOME || path.join(home, ".gemini");
  return {
    claudeProjectsDir: o.claudeProjectsDir || env.HARNESS_EXPORT_CLAUDE_PROJECTS || path.join(home, ".claude", "projects"),
    geminiKnowledgeDir: path.join(geminiHome, "antigravity-ide", "knowledge"),
    geminiRulesDir: path.join(geminiHome, "config", "rules"),
    codexProjectsDir: o.codexProjectsDir || env.HARNESS_EXPORT_CODEX_PROJECTS || path.join(ROOT, "projects"),
  };
}

module.exports = { readFileSafe, collectProjectData, resolveTargets };
