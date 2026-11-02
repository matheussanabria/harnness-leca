// @ts-check
// Agendador de recargas da Central de Sessões (EP-09.03).
// Converte uma rajada de eventos SSE em no máximo uma consulta por vez:
// debounce final, espera máxima, uma carga em voo e nenhuma carga com a aba oculta.
// Sem DOM além do alvo opcional de visibilitychange; timers são os globais (mockáveis em teste).

/**
 * @typedef {Object} VisibilityTarget
 * @property {(type: string, listener: () => void) => void} addEventListener
 * @property {(type: string, listener: () => void) => void} removeEventListener
 * @property {boolean} [hidden]
 */

/**
 * @typedef {Object} RefreshSchedulerOptions
 * @property {(signal: AbortSignal) => Promise<unknown>} load carrega o read model; deve respeitar o signal
 * @property {(result: unknown) => void} apply aplica o resultado; só é chamado se a carga não foi abortada nem substituída
 * @property {number} [debounceMs=500] espera após o último pedido
 * @property {number} [maxWaitMs=2000] espera máxima desde o primeiro pedido pendente
 * @property {() => boolean} [isHidden] true quando a aba está oculta (padrão: document.hidden)
 * @property {VisibilityTarget | null} [doc] alvo de visibilitychange (padrão: document, quando existir)
 */

/**
 * Cria o agendador. `cancel()` é definitivo: um novo painel cria outro agendador.
 * Falhas de `load` são silenciosas: a tela mantém o último estado válido e o próximo evento tenta de novo.
 * @param {RefreshSchedulerOptions} options
 * @returns {{ request: () => void, cancel: () => void }}
 */
export function createRefreshScheduler(options) {
  const { load, apply } = options;
  const debounceMs = options.debounceMs ?? 500;
  const maxWaitMs = options.maxWaitMs ?? 2000;
  const doc = options.doc !== undefined ? options.doc : defaultDocument();
  const isHidden = options.isHidden || (() => doc?.hidden === true);

  let cancelled = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let maxWaitTimer = null;
  /** @type {AbortController | null} */
  let inFlight = null;
  /** Pedido chegou durante uma carga: repetir uma vez ao fim dela. */
  let rerun = false;
  /** Pedido bloqueado pela aba oculta: aguardar a aba ficar visível. */
  let deferred = false;
  let listening = false;

  function clearTimers() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
    debounceTimer = null;
    maxWaitTimer = null;
  }

  function onVisibilityChange() {
    if (cancelled || !deferred || isHidden()) return;
    deferred = false;
    detachVisibility();
    run();
  }

  function attachVisibility() {
    if (listening || !doc) return;
    doc.addEventListener("visibilitychange", onVisibilityChange);
    listening = true;
  }

  function detachVisibility() {
    if (!listening || !doc) return;
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    listening = false;
  }

  /** Coalesce: cada pedido reinicia o debounce; o primeiro pedido pendente arma a espera máxima. */
  function request() {
    if (cancelled) return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fire, debounceMs);
    if (maxWaitTimer === null) maxWaitTimer = setTimeout(fire, maxWaitMs);
  }

  function fire() {
    clearTimers();
    if (cancelled) return;
    if (isHidden()) {
      deferred = true;
      attachVisibility();
      return;
    }
    run();
  }

  function run() {
    if (inFlight) {
      rerun = true;
      return;
    }
    start();
  }

  function start() {
    const controller = new AbortController();
    inFlight = controller;
    new Promise((resolve) => resolve(load(controller.signal))).then(
      (value) => finish(controller, () => apply(value)),
      () => finish(controller, () => {}),
    );
  }

  /**
   * @param {AbortController} controller
   * @param {() => void} settle
   */
  function finish(controller, settle) {
    // Resultado de carga substituída ou cancelada: descartado sem aplicar.
    if (inFlight !== controller) return;
    inFlight = null;
    if (controller.signal.aborted || cancelled) return;
    try {
      settle();
    } finally {
      if (rerun) {
        rerun = false;
        start();
      }
    }
  }

  function cancel() {
    cancelled = true;
    clearTimers();
    rerun = false;
    deferred = false;
    detachVisibility();
    const controller = inFlight;
    inFlight = null;
    controller?.abort();
  }

  return { request, cancel };
}

/** @returns {VisibilityTarget | null} */
function defaultDocument() {
  return typeof document !== "undefined" ? /** @type {VisibilityTarget} */ (/** @type {unknown} */ (document)) : null;
}
