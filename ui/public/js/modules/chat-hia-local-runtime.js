// @ts-check
// Bloco de telemetria do Local AI Runtime (Ollama) no painel HIA.
// Renderiza as métricas de inferência local sem depender de roundtrip de nuvem.
// Zero emojis. Ícones via FontAwesome (fa-solid).

const TYPE_LABELS = {
  bug: "Correção",
  feature: "Funcionalidade",
  refactor: "Refatoração",
  docs: "Documentação",
  test: "Testes",
};

const EXECUTOR_LABELS = {
  local_llm: "Motor local",
  cloud_llm: "Motor nuvem",
  script: "Script",
  human: "Humano",
};

/**
 * @param {number} value
 * @returns {string}
 */
function _fmtNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

/**
 * @param {number} ms
 * @returns {string}
 */
function _fmtDuration(ms) {
  const value = Number(ms || 0);
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1).replace(".", ",")} s`;
}

/**
 * @param {Record<string, number>} dist
 * @param {Record<string, string>} labels
 * @returns {string}
 */
function _renderDistribution(dist, labels) {
  const entries = Object.entries(dist || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return `<p class="hia-runtime__empty"><i class="fa-solid fa-circle-minus"></i> Sem registros ainda.</p>`;
  }
  const total = entries.reduce((acc, [, count]) => acc + count, 0) || 1;
  return entries
    .map(([key, count]) => {
      const label = labels[key] || key;
      const pct = Math.round((count / total) * 100);
      return `
        <div class="hia-runtime__dist-row">
          <span class="hia-runtime__dist-label">${label}</span>
          <span class="hia-runtime__dist-bar"><span class="hia-runtime__dist-fill" style="width:${pct}%"></span></span>
          <span class="hia-runtime__dist-count">${count}</span>
        </div>`;
    })
    .join("");
}

/**
 * Gera o HTML do bloco de telemetria do runtime local
 * @param {any} runtime - payload `localRuntime` de GET /api/hia/metrics
 * @returns {string}
 */
export function renderLocalRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") return "";

  const total = Number(runtime.totalInferences || 0);
  const valid = Number(runtime.validInferences || 0);
  const invalid = Number(runtime.invalidInferences || 0);
  const promptTokens = Number(runtime.totalPromptTokens || 0);
  const generatedTokens = Number(runtime.totalGeneratedTokens || 0);

  if (total === 0) {
    return `
      <div class="hia-runtime">
        <div class="hia-runtime__title"><i class="fa-solid fa-microchip"></i> Runtime local (Ollama)</div>
        <p class="hia-runtime__empty"><i class="fa-solid fa-circle-minus"></i> Nenhuma inferência local registrada.</p>
      </div>`;
  }

  const successRate = Math.round((valid / total) * 100);

  return `
    <div class="hia-runtime">
      <div class="hia-runtime__title"><i class="fa-solid fa-microchip"></i> Runtime local (Ollama)</div>

      <div class="hia-metrics-grid">
        <div class="hia-metric-card">
          <i class="fa-solid fa-play hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${_fmtNumber(total)}</div>
          <div class="hia-metric-card__label">Inferências locais</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-circle-check hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${successRate}%</div>
          <div class="hia-metric-card__label">Validade (${_fmtNumber(valid)} ok / ${_fmtNumber(invalid)} falhas)</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-tokens hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${_fmtNumber(promptTokens + generatedTokens)}</div>
          <div class="hia-metric-card__label">Tokens locais (${_fmtNumber(promptTokens)} + ${_fmtNumber(generatedTokens)})</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-stopwatch hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${_fmtDuration(runtime.avgDurationMs)}</div>
          <div class="hia-metric-card__label">Duração média</div>
        </div>
      </div>

      <div class="hia-runtime__section">
        <span class="hia-runtime__section-title"><i class="fa-solid fa-diagram-project"></i> Por tipo de tarefa</span>
        ${_renderDistribution(runtime.byType, TYPE_LABELS)}
      </div>

      <div class="hia-runtime__section">
        <span class="hia-runtime__section-title"><i class="fa-solid fa-route"></i> Por executor sugerido</span>
        ${_renderDistribution(runtime.bySuggestedExecutor, EXECUTOR_LABELS)}
      </div>
    </div>`;
}
