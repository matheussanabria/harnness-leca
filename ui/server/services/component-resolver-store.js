// @ts-check
// Estado/constantes compartilhados de component-resolver.service.

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".angular",
  "dist",
  ".vscode",
  ".idea",
  "coverage",
]);

const FORBIDDEN_DIRS = new Set([
  "node_modules",
  ".git",
  ".angular",
  "dist",
  ".vscode",
  ".idea",
  "coverage",
]);

const MAX_FILE_SIZE = 500 * 1024; // 500 KB

module.exports = { IGNORED_DIRS, FORBIDDEN_DIRS, MAX_FILE_SIZE };
