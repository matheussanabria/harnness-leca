// @ts-check
// Configuracao do pacote de revisao: le projects/<slug>/pacote-revisao.json e valida o formato.
// Tudo que e decisao humana (status informado, correcao do mapa, trecho escondido do prototipo) mora aqui,
// com data e motivo, para o `check` avisar quando o fato passar a vir da fonte e o ajuste ficar velho.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const KEY = /^[A-Z][A-Z0-9]+-\d+$/;

/** Pasta dos projetos: HARNESS_PROJECTS_DIR (worktrees e testes) ou projects/ do repositorio. */
function projectsDir() {
  return process.env.HARNESS_PROJECTS_DIR ? path.resolve(process.env.HARNESS_PROJECTS_DIR) : path.join(ROOT, "projects");
}

/** @param {string} slug */
function configPath(slug) {
  return path.join(projectsDir(), slug, "pacote-revisao.json");
}

/** Raiz do repositorio do projeto, declarada em mcp.json ("repo"). @param {string} slug */
function repoDirOf(slug) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(projectsDir(), slug, "mcp.json"), "utf8").replace(/^﻿/, ""));
    return data && data.repo && fs.existsSync(data.repo) ? path.resolve(data.repo) : null;
  } catch {
    return null;
  }
}

/** @param {unknown} v @param {string} where */
function obj(v, where) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`pacote-revisao: ${where} deve ser um objeto`);
  return /** @type {Record<string, any>} */ (v);
}

/** @param {unknown} v @param {string} where */
function list(v, where) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new Error(`pacote-revisao: ${where} deve ser uma lista`);
  return v;
}

/** @param {any} item @param {string} where */
function needMotivo(item, where) {
  if (!item.desde || !item.motivo) throw new Error(`pacote-revisao: ${where} exige "desde" e "motivo"`);
}

/**
 * Valida a configuracao ja lida e devolve a forma normalizada.
 * @param {any} raw
 */
function normalize(raw) {
  const c = obj(raw, "arquivo");
  const historias = list(c.historias, "historias");
  if (!historias.length) throw new Error("pacote-revisao: historias nao pode ser vazia");
  for (const k of historias) if (!KEY.test(String(k))) throw new Error(`pacote-revisao: chave de historia invalida: ${k}`);
  const colunas = list(c.colunas, "colunas");
  if (!colunas.length) throw new Error("pacote-revisao: colunas nao pode ser vazia");
  for (const col of colunas) obj(col, "colunas[]");
  const statusForcado = list(c.statusForcado, "statusForcado");
  statusForcado.forEach((s, i) => needMotivo(obj(s, `statusForcado[${i}]`), `statusForcado[${i}]`));
  const correcoes = list(c.correcoes, "correcoes");
  correcoes.forEach((s, i) => needMotivo(obj(s, `correcoes[${i}]`), `correcoes[${i}]`));
  const esconder = list(c.esconderNoPrototipo, "esconderNoPrototipo");
  esconder.forEach((s, i) => needMotivo(obj(s, `esconderNoPrototipo[${i}]`), `esconderNoPrototipo[${i}]`));
  return {
    titulo: String(c.titulo || "Quadro de revisao"),
    pasta: c.pasta ? String(c.pasta) : "",
    historias: historias.map(String),
    epicos: c.epicos ? obj(c.epicos, "epicos") : {},
    colunas,
    statusParaColuna: c.statusParaColuna ? obj(c.statusParaColuna, "statusParaColuna") : {},
    statusForcado,
    correcoes,
    esconderNoPrototipo: esconder,
  };
}

/**
 * @param {string} slug
 * @param {string} [file] caminho alternativo
 */
function loadConfig(slug, file) {
  const target = file ? path.resolve(file) : configPath(slug);
  if (!fs.existsSync(target)) throw new Error(`pacote-revisao: configuracao nao encontrada: ${target}`);
  const raw = JSON.parse(fs.readFileSync(target, "utf8").replace(/^﻿/, ""));
  return { file: target, config: normalize(raw) };
}

module.exports = { loadConfig, normalize, configPath, projectsDir, repoDirOf, ROOT };
