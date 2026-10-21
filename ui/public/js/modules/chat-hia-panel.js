// @ts-check
// Painel de métricas HIA (PI-4) — ES Module para uso no browser.
// Consome GET /api/hia/metrics e renderiza com design tokens do Harness.
// Zero emojis. Ícones via FontAwesome (fa-solid).
import { $, showToast } from "../shared/dom.js";
import { renderLocalRuntime } from "./chat-hia-local-runtime.js";

/** @type {ReturnType<typeof setInterval>|null} */
let _refreshTimer = null;

/**
 * Avisa o usuário quando a máquina não tem RAM livre para inferência local.
 * Silencioso quando as métricas estão indisponíveis: melhor não alarmar sem dado.
 * @returns {Promise<boolean>} true quando dá para inferir localmente
 */
export async function warnIfLocalInferenceUnsafe() {
  const data = await _fetchMetrics();
  const hardware = (data && data.hardware) || {};
  if (hardware.viable !== false) return true;
  showToast(hardware.alert || "Memória livre baixa para modelos locais: a resposta pode demorar.", 6000);
  return false;
}

/**
 * Carrega e renderiza o painel de métricas HIA em um container.
 * @param {string} containerId - id do elemento DOM onde renderizar
 * @param {boolean} [autoRefresh=false] - se true, atualiza a cada 30 s
 */
export async function loadHiaPanel(containerId, autoRefresh = false) {
  const data = await _fetchMetrics();
  _render(containerId, data);

  if (autoRefresh && !_refreshTimer) {
    _refreshTimer = setInterval(async () => {
      const refreshed = await _fetchMetrics();
      _render(containerId, refreshed);
    }, 30_000);
  }
}

/** Para o refresh automático (chamar ao fechar o painel) */
export function stopHiaPanelRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

// --- Privado ---

async function _fetchMetrics() {
  try {
    const res = await fetch("/api/hia/metrics");
    if (!res.ok) return null;
    return /** @type {any} */ (await res.json());
  } catch {
    return null;
  }
}

function _render(containerId, data) {
  const el = $(containerId);
  if (!el) return;
  if (!data) {
    el.innerHTML = `<p class="hia-panel-empty"><i class="fa-solid fa-circle-exclamation"></i> Métricas indisponíveis.</p>`;
    return;
  }

  const telemetry = data.telemetry || {};
  const hardware = data.hardware || {};
  const routingEnabled = data.routingEnabled !== false;
  const freeRamMb = (hardware.memory && hardware.memory.freeMb) || 0;
  const cpuName = (hardware.cpu && hardware.cpu.model) || "CPU";
  const threads = (hardware.cpu && hardware.cpu.recommendedThreads) || 0;
  const toolsCount = data.registeredToolsCount || 0;
  const tokensSaved = telemetry.totalTokensSaved || 0;
  const estimatedCostAvoided = Math.round((tokensSaved / 1000) * 0.003 * 100) / 100;

  const routingClass = routingEnabled ? "hia-routing-badge--enabled" : "hia-routing-badge--disabled";
  const routingIcon = routingEnabled ? "fa-circle-check" : "fa-circle-pause";
  const routingLabel = routingEnabled ? "Roteamento HIA ativo" : "Roteamento HIA desativado";
  const hwClass = hardware.viable ? "hia-hardware-bar__status--ok" : "hia-hardware-bar__status--warn";
  const hwText = hardware.alert || `${cpuName} · ${freeRamMb} MB livres · ${threads} threads recomendados`;

  el.innerHTML = `
    <div class="hia-dashboard">
      <div class="hia-dashboard__title"><i class="fa-solid fa-bolt"></i> HIA — Intelligence &amp; Automation</div>

      <div class="hia-metrics-grid">
        <div class="hia-metric-card">
          <i class="fa-solid fa-bolt hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${telemetry.totalExecutions}</div>
          <div class="hia-metric-card__label">Automações locais</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-coins hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${tokensSaved.toLocaleString("pt-BR")}</div>
          <div class="hia-metric-card__label">Tokens economizados</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-dollar-sign hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">$${estimatedCostAvoided.toFixed(2)}</div>
          <div class="hia-metric-card__label">Custo evitado (est.)</div>
        </div>
        <div class="hia-metric-card">
          <i class="fa-solid fa-server hia-metric-card__icon"></i>
          <div class="hia-metric-card__value">${toolsCount}</div>
          <div class="hia-metric-card__label">Ferramentas no registry</div>
        </div>
      </div>

      <div class="hia-hardware-bar">
        <span class="hia-hardware-bar__status ${hwClass}"></span>
        <span class="hia-hardware-bar__text"><i class="fa-solid fa-microchip"></i> ${hwText}</span>
      </div>

      ${renderLocalRuntime(data.localRuntime)}

      <div>
        <span class="hia-routing-badge ${routingClass}">
          <i class="fa-solid ${routingIcon}"></i> ${routingLabel}
        </span>
      </div>
    </div>`;
}
