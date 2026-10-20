// @ts-check
// DAI HQ — M2 Orquestração: Aba de Timeline de Eventos SSE em Tempo Real

/**
 * Aba 3: Timeline de Eventos SSE
 * @param {Array<any>} events
 */
export function renderTimelineTab(events) {
  if (events.length === 0) {
    return `
      <div class="drawer-card">
        <div style="text-align:center;padding:24px 10px;color:#94a3b8">
          <div style="font-size:28px;margin-bottom:8px">⏳</div>
          <div style="font-weight:700;color:#f8fafc;margin-bottom:4px">Aguardando eventos do Event Engine...</div>
          <div style="font-size:12px">Conexão Server-Sent Events estabelecida. Novos eventos aparecerão aqui automaticamente sem recarregar.</div>
        </div>
      </div>
    `;
  }

  const eventsHtml = events.slice(0, 35).map((evt) => {
    let typeCol = "#38bdf8";
    if (evt.type.includes("failed")) typeCol = "#ef4444";
    else if (evt.type.includes("completed")) typeCol = "#22c55e";
    else if (evt.type.includes("created")) typeCol = "#eab308";

    const prov = evt.source?.provider || "harness";
    const conf = evt.source?.confidence || "observed";
    const srcTime = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "-";
    const recTime = evt.receivedAt ? new Date(evt.receivedAt).toLocaleTimeString() : "-";

    return `
      <div style="border-left:3px solid ${typeCol};background:rgba(30,41,59,0.6);padding:8px 12px;border-radius:0 8px 8px 0;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:700;color:${typeCol};font-size:12.5px">${evt.type}</span>
          <span style="font-size:10px;color:#64748b;font-family:monospace">Fonte: ${srcTime} | Harness: ${recTime}</span>
        </div>
        <div style="font-size:11.5px;color:#cbd5e1;margin-bottom:4px">
          Motor: <b style="color:#f8fafc">${prov}</b> · ID: <code>${evt.id.slice(0, 12)}...</code> · Confiança: <span style="color:#a855f7;font-weight:600">${conf}</span>
        </div>
        ${evt.payload && Object.keys(evt.payload).length > 0 ? `
          <details style="font-size:11px;color:#94a3b8;margin-top:4px">
            <summary style="cursor:pointer;color:#38bdf8">Ver Payload</summary>
            <pre style="background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;overflow-x:auto;margin:4px 0 0;font-size:10.5px">${JSON.stringify(evt.payload, null, 2)}</pre>
          </details>
        ` : ''}
      </div>
    `;
  }).join("");

  return `
    <div class="drawer-card">
      <div class="drawer-card-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span>Timeline de Eventos (SSE)</span>
        <span style="font-size:11px;color:#22c55e">● Conectado ao /api/orchestration/stream</span>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
        Registros cronológicos recebidos via streaming nativo, separando o instante de geração na fonte do recebimento no Harness.
      </div>
      <div style="max-height:480px;overflow-y:auto;padding-right:4px">
        ${eventsHtml}
      </div>
    </div>
  `;
}
