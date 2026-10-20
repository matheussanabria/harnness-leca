// @ts-check
// DAI HQ — M2 Orquestração: Aba de Diário de Bordo & Conversas Preservadas

/**
 * Aba 2: Diário de Bordo & Conversas Preservadas
 * @param {any} state
 * @param {string} activeProj
 */
export function renderJournalTab(state, activeProj) {
  const days = state?.journal?.days || (Array.isArray(state?.journal) ? state.journal : []);
  const projChats = state?.projectData?.chats || [];

  let totalSessions = 0;
  let totalPrompts = 0;
  for (const d of days) {
    totalSessions += (d.sessions || []).length;
    for (const s of (d.sessions || [])) {
      totalPrompts += (s.prompts || []).length;
    }
  }

  const hasDays = days.length > 0 && totalSessions > 0;
  const countLabel = hasDays ? `${totalSessions} sessões` : `${projChats.length} conversas`;

  return `
    <div class="drawer-card">
      <div class="drawer-card-title">Diário de Bordo & Histórico de Conversas</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
        Todas as conversas dos agentes no projeto <b>${activeProj}</b>, incluindo pedidos do usuário, turnos, ferramentas e arquivos modificados.
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px">
        <select id="journalAgentFilter" style="flex:1;padding:8px;border-radius:6px;border:1px solid rgba(56,189,248,0.2);background:#0f172a;color:#f8fafc;font-size:12px">
          <option value="">Todos os Motores (Claude, Gemini, OpenCode)</option>
          <option value="claude">🤖 Claude Code</option>
          <option value="gemini">✦ Gemini Antigravity</option>
          <option value="opencode">◆ OpenCode Lab</option>
        </select>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input type="text" id="journalSearchInput" placeholder="Filtrar por pedido, título ou arquivo..." style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid rgba(56,189,248,0.2);background:#0f172a;color:#f8fafc;font-size:12px">
      </div>

      <div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(2,132,199,0.1);border-radius:6px;margin-bottom:14px;border:1px solid rgba(56,189,248,0.2);font-size:11.5px">
        <span style="color:#94a3b8">Registros Preservados: <b style="color:#38bdf8">${countLabel}</b></span>
        ${hasDays ? `<span style="color:#94a3b8">Pedidos dos Usuários: <b style="color:#22c55e">${totalPrompts}</b></span>` : ''}
      </div>

      <div id="journalSessionList" style="display:flex;flex-direction:column;gap:10px;max-height:460px;overflow-y:auto;padding-right:4px">
        ${renderJournalSessionCards(days, projChats)}
      </div>

      <div style="margin-top:14px;text-align:center">
        <a href="/diario" style="color:#38bdf8;text-decoration:none;font-size:12px;font-weight:700">
          📓 Abrir Diário de Bordo Completo com Linha do Tempo ↗
        </a>
      </div>
    </div>
  `;
}

export function renderJournalSessionCards(days, fallbackChats = [], filterAgent = "", filterText = "") {
  let html = "";
  const q = (filterText || "").trim().toLowerCase();
  const agentFilter = (filterAgent || "").trim().toLowerCase();

  if (days && days.length > 0) {
    for (const d of days) {
      const filteredSessions = (d.sessions || []).filter(s => {
        if (agentFilter && (s.agente || "").toLowerCase() !== agentFilter) return false;
        if (q) {
          const matchTitle = (s.titulo || "").toLowerCase().includes(q);
          const matchFile = (s.file || "").toLowerCase().includes(q);
          const matchPrompts = (s.prompts || []).some(p => p.toLowerCase().includes(q));
          const matchEdited = (s.edited || []).some(e => e.toLowerCase().includes(q));
          if (!matchTitle && !matchFile && !matchPrompts && !matchEdited) return false;
        }
        return true;
      });

      if (filteredSessions.length === 0) continue;

      html += `<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;padding:4px 0;margin-top:4px">📅 ${d.day} (${filteredSessions.length} sessões)</div>`;

      for (const s of filteredSessions) {
        const ag = (s.agente || "harness").toLowerCase();
        let agCol = "#94a3b8";
        let agBadge = ag.toUpperCase();
        if (ag.includes("claude")) { agCol = "#d97757"; agBadge = "CLAUDE"; }
        else if (ag.includes("gemini")) { agCol = "#5c87f2"; agBadge = "GEMINI"; }
        else if (ag.includes("opencode")) { agCol = "#3cb371"; agBadge = "OPENCODE"; }

        const prompts = s.prompts || [];
        const edited = s.edited || [];
        const chatUrl = `/?chat=${encodeURIComponent(s.file || '')}`;

        html += `
          <div style="background:rgba(30,41,59,0.7);border:1px solid rgba(56,189,248,0.18);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${agCol}22;color:${agCol};border:1px solid ${agCol}55">${agBadge}</span>
                <span style="font-weight:700;color:#f8fafc;font-size:12.5px">${s.titulo || s.file || 'Sessão sem título'}</span>
              </div>
              <a href="${chatUrl}" title="Abrir conversa completa" style="font-size:11.5px;color:#38bdf8;text-decoration:none;white-space:nowrap;font-weight:700">Abrir ↗</a>
            </div>

            ${prompts.length > 0 ? `
              <div style="background:rgba(15,23,42,0.8);border-radius:6px;padding:8px;font-size:11.5px;color:#cbd5e1;border-left:2px solid ${agCol}">
                <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px">💬 PEDIDO / PROMPT DO USUÁRIO:</div>
                <div style="white-space:pre-wrap;line-height:1.4">${prompts[0].length > 180 ? prompts[0].slice(0, 180) + '...' : prompts[0]}</div>
                ${prompts.length > 1 ? `<div style="font-size:10.5px;color:#38bdf8;margin-top:4px">+ ${prompts.length - 1} pedidos adicionais</div>` : ''}
              </div>
            ` : ''}

            ${edited.length > 0 ? `
              <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:2px">
                <span style="font-size:10px;color:#64748b">Arquivos:</span>
                ${edited.slice(0, 3).map(f => `<code style="font-size:10px;background:rgba(0,0,0,0.3);padding:1px 5px;border-radius:3px;color:#38bdf8">${f.split(/[\/\\]/).pop()}</code>`).join("")}
                ${edited.length > 3 ? `<span style="font-size:10px;color:#64748b">+${edited.length - 3}</span>` : ''}
              </div>
            ` : ''}

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;margin-top:2px;border-top:1px solid rgba(255,255,255,0.05);padding-top:4px">
              <span>chats/${s.file || ''}</span>
              <span>${s.toolCount ? `${s.toolCount} tools` : ''}</span>
            </div>
          </div>
        `;
      }
    }
  }

  if (!html && fallbackChats && fallbackChats.length > 0) {
    const filteredFallback = fallbackChats.filter(c => {
      const name = (c.title || c.name || c.id || "").toLowerCase();
      const eng = (c.engine || "").toLowerCase();
      if (agentFilter && !eng.includes(agentFilter)) return false;
      if (q && !name.includes(q)) return false;
      return true;
    });

    html = filteredFallback.slice(0, 20).map(c => `
      <div style="background:rgba(30,41,59,0.7);border:1px solid rgba(56,189,248,0.18);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;color:#f8fafc;font-size:12.5px">${c.title || c.name || c.id}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${c.date || 'Preservado'} · ${c.engine || 'motor'}</div>
        </div>
        <a href="/?chat=${encodeURIComponent(c.id || c.name || '')}" style="font-size:11.5px;color:#38bdf8;text-decoration:none;font-weight:700">Abrir ↗</a>
      </div>
    `).join("");
  }

  return html || `<div style="text-align:center;padding:24px 10px;color:#94a3b8;font-style:italic">Nenhuma conversa encontrada com os filtros selecionados.</div>`;
}
