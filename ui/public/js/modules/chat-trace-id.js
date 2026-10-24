// @ts-check
// traceId de comparação (T2.3): um id por comparação, enviado em todo POST /api/chat por motor,
// para o servidor correlacionar as execuções. Formato aceito: [A-Za-z0-9._:-]{1,100}.

/** @returns {string} */
export function newComparisonTraceId() {
  const rand = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `cmp-${rand}`.slice(0, 100);
}
