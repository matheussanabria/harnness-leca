// @ts-check
// Regras de ordenacao das projecoes (ADR-TEL-005, itens 3 e 4).
//
// A ordem de chegada (seq) NAO e a ordem dos fatos: um evento atrasado pode chegar depois.
// Por isso cada campo projetado guarda o "carimbo" (momento `at`, desempate por seq) do evento que
// o definiu e so aceita evento de carimbo maior ou igual. Estados terminais de execucao tem
// precedencia: um `execution.started` tardio nao regride uma execucao ja concluida.
//
// Como a regra e por campo (e nao exige reordenar o log), o fold e incremental: a memoria e
// proporcional ao numero de entidades, nao ao numero de eventos, e o resultado nao depende da
// ordem em que os eventos sao lidos (reconstruivel do log).

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

/**
 * @typedef {{ ms: number, seq: number }} Stamp
 */

/** Carimbo mais antigo possivel (campo ainda nao definido). */
const EPOCH = Object.freeze({ ms: Number.NEGATIVE_INFINITY, seq: 0 });

/**
 * @param {any} event
 * @param {string | number} cursor cursor (seq) do evento no log
 * @returns {Stamp}
 */
function stampOf(event, cursor) {
  const ms = Date.parse(String(event?.at || ""));
  return { ms: Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms, seq: Number(cursor) || 0 };
}

/**
 * Compara dois carimbos: negativo se a < b.
 * @param {Stamp} a
 * @param {Stamp} b
 * @returns {number}
 */
function compareStamps(a, b) {
  if (a.ms !== b.ms) return a.ms < b.ms ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
function isTerminal(status) {
  return TERMINAL_STATUSES.has(String(status || ""));
}

/**
 * Campo simples: o carimbo maior vence (empate: maior seq).
 * @template T
 * @param {{ value: T | null, stamp: Stamp }} slot
 * @param {T} value
 * @param {Stamp} stamp
 * @returns {boolean} true se o valor foi aceito
 */
function setByStamp(slot, value, stamp) {
  if (compareStamps(stamp, slot.stamp) < 0) return false;
  slot.value = value;
  slot.stamp = stamp;
  return true;
}

/**
 * Status de execucao: terminal tem precedencia sobre nao terminal.
 *  - atual terminal + novo nao terminal: ignora;
 *  - atual terminal + novo terminal: vence o carimbo maior;
 *  - atual nao terminal + novo terminal: aceita mesmo com `at` mais antigo;
 *  - ambos nao terminais: vence o carimbo maior.
 * @param {{ value: string | null, stamp: Stamp }} slot
 * @param {string} status
 * @param {Stamp} stamp
 * @returns {boolean}
 */
function setExecutionStatus(slot, status, stamp) {
  const incoming = isTerminal(status);
  if (isTerminal(slot.value)) {
    if (!incoming || compareStamps(stamp, slot.stamp) < 0) return false;
  } else if (!incoming && compareStamps(stamp, slot.stamp) < 0) {
    return false;
  }
  slot.value = status;
  slot.stamp = stamp;
  return true;
}

/**
 * Traduz o tipo de evento de execucao no status projetado (ou null se nao muda status).
 * @param {string} type
 * @returns {string | null}
 */
function executionStatusOf(type) {
  if (type === "execution.succeeded") return "succeeded";
  if (type === "execution.failed") return "failed";
  if (type === "execution.cancelled") return "cancelled";
  if (type === "execution.started") return "running";
  return null;
}

/**
 * Maior `at` entre dois textos de data (lastEventAt nunca volta no tempo).
 * @param {string} current
 * @param {string} candidate
 * @returns {string}
 */
function maxAt(current, candidate) {
  if (!candidate) return current;
  if (!current) return candidate;
  const a = Date.parse(current);
  const b = Date.parse(candidate);
  if (Number.isNaN(b)) return current;
  if (Number.isNaN(a)) return candidate;
  return b > a ? candidate : current;
}

/**
 * @template T
 * @param {T | null} value
 * @returns {{ value: T | null, stamp: Stamp }}
 */
function newSlot(value = null) {
  return { value, stamp: EPOCH };
}

module.exports = {
  TERMINAL_STATUSES,
  EPOCH,
  stampOf,
  compareStamps,
  isTerminal,
  setByStamp,
  setExecutionStatus,
  executionStatusOf,
  maxAt,
  newSlot,
};
