// @ts-check
// Peças comuns aos motores de chat: erro público, validação do que vem do navegador e contexto do projeto.
const fs = require("fs");
const path = require("path");
const state = require("../state");
const { ROOT } = require("../root");

// Erro cuja mensagem pode ir ao navegador (config do usuário, motor ausente, tempo esgotado). Qualquer outro erro
// (stderr do CLI, caminhos locais, respostas de APIs) fica só no log do servidor: o cliente recebe uma mensagem genérica.
class PublicError extends Error {}

// Valores que chegam do navegador e viram argumento de linha de comando: só formatos conhecidos passam.
const MODEL_RE = /^[a-z0-9][a-z0-9._:\/-]{0,63}$/i;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const safeModel = (m) => (typeof m === "string" && MODEL_RE.test(m) ? m : "");
const safeEffort = (e) => (EFFORTS.has(e) ? e : "medium");

const { getDaiAgentPrompt } = require("../dai");

// Carrega instruções e memórias de um projeto para enriquecer o contexto
/**
 * @param {string} slug
 * @param {{ daiAgent?: string, scope?: "none" | "minimal" | "project_only" | "full", sections?: Array<string | number> }|string} [options]
 */
function getProjectContext(slug, options = {}) {
  const daiAgent = typeof options === "string" ? options : (options && typeof options === "object" ? options.daiAgent : null);
  const scope = typeof options === "object" && options.scope ? options.scope : undefined;
  const sections = typeof options === "object" && options.sections ? options.sections : undefined;
  const { buildContext } = require("../hia/context-engine");
  return buildContext(slug, { daiAgent, scope, sections }).context;
}

// Impede que o conteúdo feche o bloco <contexto_do_harness> ou forje outro (igual à Neutralize do hook).
function neutralizeContext(s) {
  return String(s).replace(/<(\/?)\s*contexto_do_harness/gi, "<$1contexto_do_harness-escaped");
}

module.exports = { PublicError, safeModel, safeEffort, getProjectContext };
