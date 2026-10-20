// @ts-check
// Configuração das camadas, tela atual, campo em foco e trace box.
import { esc } from "../shared/dom.js";
import { dls } from "./design-layers-store.js";

export const LAYER_CONFIG = [
  { id: "ui", label: "🎨 UI / UX" },
  { id: "rules", label: "⚖️ Regras de Negócio" },
  { id: "api", label: "🔌 API & Serviços" },
  { id: "data", label: "💾 Dados & Entidades" },
  { id: "tests", label: "🧪 Testes & Cobertura" },
  { id: "legacy", label: "🏛️ Legado & Paridade" },
];

/**
 * Retorna a tela atualmente selecionada.
 */
export function getCurrentScreen() {
  if (!dls.currentScreensData?.screens?.length) return null;
  return dls.currentScreensData.screens.find((s) => s.id === dls.activeScreenId) || dls.currentScreensData.screens[0];
}

/**
 * Retorna o campo atualmente em foco.
 */
export function getFocusedField(sc) {
  if (!sc || !dls.focusedFieldId || !sc.fields) return null;
  return sc.fields.find((f) => f.id === dls.focusedFieldId) || null;
}

/**
 * Renderiza o painel de rastro (Trace Box) interativo.
 * @param {any} sc
 */
export function renderTraceBox(sc) {
  const f = getFocusedField(sc);

  if (!f) {
    return `
      <div class="trace-box idle">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">🎯</span>
          <span style="color:var(--mute);font-size:12px">
            <b>Rastreamento de Ponta a Ponta:</b> Clique em qualquer campo da tela abaixo para iluminar sua ligação com a <b>Regra</b>, <b>API</b>, <b>Tabela de Banco</b>, <b>Teste</b> e <b>Legado</b>.
          </span>
        </div>
      </div>
    `;
  }

  // Identifica conexões do campo f
  const matchingRule = (sc.rules || []).find((r) => Array.isArray(r.refs) && r.refs.includes(f.id));
  const matchingEp = (sc.endpoints || []).find((e) => Array.isArray(e.refs) && e.refs.includes(f.id));
  const matchingEnt = (sc.entities || []).find((e) => Array.isArray(e.refs) && e.refs.includes(f.id));
  const matchingLeg = (sc.legacy || []).find((l) => Array.isArray(l.refs) && l.refs.includes(f.id));

  return `
    <div class="trace-box active">
      <div class="trace-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="trace-num">${esc(f.n || f.id)}</span>
          <div>
            <b>${esc(f.label || f.id)}</b>
            <span style="font-size:11px;color:var(--mute);margin-left:6px">${esc(f.ui?.c || '')}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <label style="font-size:11.5px;color:var(--mute);cursor:pointer;display:flex;align-items:center;gap:4px">
            <input type="checkbox" ${dls.filterOnlyFocused ? 'checked' : ''} onchange="toggleFilterOnlyFocused(this.checked)">
            Mostrar apenas itens deste campo nas camadas
          </label>
          <button type="button" class="btn-card-action" onclick="setFocusedField(null)">✕ Limpar</button>
        </div>
      </div>

      <div class="trace-chain-grid">
        <div class="trace-chain-step ${dls.activeLayer === 'ui' ? 'highlight' : ''}" onclick="setLayerTab('ui')">
          <span class="trace-chain-label">🎨 Interface</span>
          <div class="trace-chain-val">${esc(f.ui?.t || 'Elemento de tela')}</div>
          <small>${esc(f.ui?.st || 'ok')}</small>
        </div>

        <div class="trace-chain-step ${dls.activeLayer === 'rules' ? 'highlight' : ''}" onclick="setLayerTab('rules')">
          <span class="trace-chain-label">⚖️ Regra</span>
          <div class="trace-chain-val">${esc(matchingRule?.title || f.rule || 'Sem regra explícita')}</div>
          <small>${esc(matchingRule?.st || 'ok')}</small>
        </div>

        <div class="trace-chain-step ${dls.activeLayer === 'api' ? 'highlight' : ''}" onclick="setLayerTab('api')">
          <span class="trace-chain-label">🔌 API / Rota</span>
          <div class="trace-chain-val"><code>${esc(matchingEp ? `${matchingEp.m} ${matchingEp.r}` : (f.api || 'Sem chamada direta'))}</code></div>
          <small>${esc(matchingEp?.svc || '')}</small>
        </div>

        <div class="trace-chain-step ${dls.activeLayer === 'data' ? 'highlight' : ''}" onclick="setLayerTab('data')">
          <span class="trace-chain-label">💾 Tabela / DTO</span>
          <div class="trace-chain-val">${esc(matchingEnt?.name || f.data || 'Persistência no banco')}</div>
          <small>${esc(matchingEnt?.kind || 'entidade')}</small>
        </div>

        <div class="trace-chain-step ${dls.activeLayer === 'legacy' ? 'highlight' : ''}" onclick="setLayerTab('legacy')">
          <span class="trace-chain-label">🏛️ Legado</span>
          <div class="trace-chain-val">${esc(matchingLeg?.title || 'Sem histórico registrado')}</div>
          <small>${esc(matchingLeg?.par || 'igual')}</small>
        </div>
      </div>
    </div>
  `;
}
