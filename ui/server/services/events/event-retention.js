// @ts-check
// Retencao do event log (ADR-TEL-001, decisao 2): duas classes.
//
//  - Operacional (todo tipo exceto `usage.observed`): limite por CONTAGEM (operationalMax),
//    apaga os mais antigos. Apagar operacionais nunca toca em evidencia de uso.
//  - Uso (`usage.observed`): limite por TEMPO (usageMaxAgeDays, sobre `at`) e por TAMANHO
//    (usageMaxEvents, apaga os mais antigos). A contagem operacional NAO o expulsa.
//
// Custo: a contagem operacional fica em memoria por conexao (uma consulta COUNT ao abrir) e e
// atualizada a cada insercao; o excedente e apagado com custo proporcional ao excedente. Como
// outro processo pode escrever no mesmo arquivo, a contagem e recalculada a cada RECOUNT_EVERY
// insercoes. A retencao de uso roda ao abrir e a cada USAGE_SWEEP_EVERY insercoes.
//
// Os valores abaixo sao os padroes seguros; `RETENTION` e mutavel de proposito (testes e, no
// futuro, configuracao do usuario). Compactar por callId (manter o valor final de cada chamada)
// fica para a historia T5.x; ate la a poda de uso e por tempo e tamanho, nao por compactacao.
const USAGE_TYPE = "usage.observed";

const RETENTION = {
  operationalMax: 20000,
  usageMaxAgeDays: 180,
  usageMaxEvents: 200000,
  recountEvery: 1000,
  usageSweepEvery: 1000,
};

/** @type {WeakMap<object, { operational: number, sinceRecount: number, sinceSweep: number }>} */
const states = new WeakMap();

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {number}
 */
function countOperational(db) {
  return Number(db.prepare("SELECT COUNT(*) AS total FROM events WHERE type <> ?").get(USAGE_TYPE).total || 0);
}

/**
 * Apaga evidencia de uso fora da janela de tempo e acima do teto de tamanho.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {number} [nowMs]
 * @returns {number} linhas apagadas
 */
function pruneUsage(db, nowMs = Date.now()) {
  let removed = 0;
  const cutoff = new Date(nowMs - RETENTION.usageMaxAgeDays * 86400000).toISOString();
  removed += Number(db.prepare("DELETE FROM events WHERE type = ? AND at < ?").run(USAGE_TYPE, cutoff).changes);
  const total = Number(db.prepare("SELECT COUNT(*) AS total FROM events WHERE type = ?").get(USAGE_TYPE).total || 0);
  if (total > RETENTION.usageMaxEvents) {
    removed += Number(db.prepare(
      "DELETE FROM events WHERE seq IN (SELECT seq FROM events WHERE type = ? ORDER BY seq ASC LIMIT ?)",
    ).run(USAGE_TYPE, total - RETENTION.usageMaxEvents).changes);
  }
  return removed;
}

/**
 * Apaga os operacionais mais antigos alem do teto.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {number} excess
 * @returns {number} linhas apagadas
 */
function pruneOperational(db, excess) {
  if (excess <= 0) return 0;
  return Number(db.prepare(
    "DELETE FROM events WHERE seq IN (SELECT seq FROM events WHERE type <> ? ORDER BY seq ASC LIMIT ?)",
  ).run(USAGE_TYPE, excess).changes);
}

/**
 * Chamado depois de cada insercao nova. Barato no caminho comum (so incrementa contadores).
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} type tipo do evento inserido
 */
function afterInsert(db, type) {
  let state = states.get(db);
  if (!state) {
    state = { operational: countOperational(db), sinceRecount: 0, sinceSweep: 0 };
    states.set(db, state);
    pruneUsage(db);
  } else {
    if (type !== USAGE_TYPE) state.operational += 1;
    state.sinceRecount += 1;
    state.sinceSweep += 1;
  }
  if (state.sinceRecount >= RETENTION.recountEvery) {
    state.operational = countOperational(db);
    state.sinceRecount = 0;
  }
  if (state.sinceSweep >= RETENTION.usageSweepEvery) {
    pruneUsage(db);
    state.sinceSweep = 0;
  }
  if (state.operational > RETENTION.operationalMax) {
    state.operational -= pruneOperational(db, state.operational - RETENTION.operationalMax);
  }
}

/**
 * Descarta o estado em memoria de uma conexao (ao fechar o store).
 * @param {import("node:sqlite").DatabaseSync} db
 */
function forget(db) {
  states.delete(db);
}

module.exports = { USAGE_TYPE, RETENTION, afterInsert, pruneUsage, pruneOperational, countOperational, forget };
