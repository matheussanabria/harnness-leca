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
    items,
  };
}

/**
 * Diretórios de destino. Precedência: parâmetro, variável de ambiente, padrão.
 * Variáveis: HARNESS_EXPORT_CLAUDE_PROJECTS, HARNESS_EXPORT_GEMINI_HOME.
 * @param {{ claudeProjectsDir?: string, geminiHome?: string }} [o]
 */
function resolveTargets(o = {}) {
  const env = process.env;
  const home = os.homedir();
  const geminiHome = o.geminiHome || env.HARNESS_EXPORT_GEMINI_HOME || path.join(home, ".gemini");
  return {
    claudeProjectsDir: o.claudeProjectsDir || env.HARNESS_EXPORT_CLAUDE_PROJECTS || path.join(home, ".claude", "projects"),
    geminiKnowledgeDir: path.join(geminiHome, "antigravity-ide", "knowledge"),
    geminiRulesDir: path.join(geminiHome, "config", "rules"),
  };
}

module.exports = { readFileSafe, collectProjectData, resolveTargets };
