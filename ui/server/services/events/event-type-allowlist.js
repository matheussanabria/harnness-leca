// @ts-check
// Allowlist de tipos aceitos na entrada (POST) do event log (ADR-TEL-007).
//
// Construida a partir de tudo que o repositorio produz ou consome hoje:
//  - tipos canonicos do EP-09 (contrato congelado 10-contrato-leitura-central.md e event-projector);
//  - aliases de entrada (TYPE_ALIASES do event-store), resolvidos antes da checagem;
//  - catalogo EP-08.04 (orchestration/event-contract.js), importado para nao divergir;
//  - tipos novos da telemetria: usage.observed, skill.*, run.*.
// Tipo fora da lista e rejeitado com erro claro (quarentena fica fora de escopo).
const { EVENT_CATALOG } = require("../orchestration/event-contract");

const EP09_TYPES = [
  "session.discovered",
  "session.updated",
  "session.linked",
  "session.archived",
  "execution.started",
  "execution.succeeded",
  "execution.failed",
  "execution.cancelled",
  "workflow.transitioned",
  "workflow.blocked",
  "workflow.unblocked",
  "approval.requested",
  "approval.resolved",
  "attention.opened",
  "attention.acknowledged",
  "attention.resolved",
];

const TELEMETRY_TYPES = [
  "usage.observed",
  "skill.discovered",
  "skill.loaded",
  "skill.applied",
  "run.started",
  "run.finished",
];

/** Aliases aceitos na entrada (espelha TYPE_ALIASES do event-store; um teste garante a paridade). */
const ALIAS_TYPES = [
  "execution.completed",
  "execution.finished",
  "workflow.transition",
  "approval.approved",
  "approval.rejected",
];

const ALLOWED_TYPES = new Set([...EP09_TYPES, ...EVENT_CATALOG, ...TELEMETRY_TYPES, ...ALIAS_TYPES]);

/**
 * @param {string} type tipo ja resolvido por alias (ou o proprio alias)
 * @returns {boolean}
 */
function isAllowedType(type) {
  return ALLOWED_TYPES.has(type);
}

module.exports = { ALLOWED_TYPES, EP09_TYPES, TELEMETRY_TYPES, ALIAS_TYPES, isAllowedType };
