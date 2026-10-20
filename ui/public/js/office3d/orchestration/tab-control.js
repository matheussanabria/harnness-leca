// @ts-check
// DAI HQ — M2 Orquestração: Aba de Controle Operacional & Ações Auditadas

/**
 * Aba 4: Controle Operacional
 * @param {any} orchState
 * @param {string} activeProj
 */
export function renderControlTab(orchState, activeProj) {
  return `
    <div class="drawer-card" style="border-color:rgba(56,189,248,0.3)">
      <div class="drawer-card-title" style="color:#38bdf8;margin-bottom:8px">⚙️ Ações Operacionais Suportadas</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">
        Operações executadas com validação de pré-condições, rastreabilidade via <code>operationId</code> e auditoria no backend.
      </div>

      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(56,189,248,0.2);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;color:#f8fafc;font-size:13px">1. Sincronizar Projeto Ativo</span>
          <span style="font-size:10px;font-weight:800;color:#22c55e;background:rgba(34,197,94,0.15);padding:2px 6px;border-radius:4px">SUPORTADO</span>
        </div>
        <p style="font-size:11.5px;color:#94a3b8;margin:0 0 10px">
          Varre os históricos do Claude Code, Gemini e OpenCode e atualiza as conversas e memórias do projeto <b>${activeProj}</b>.
        </p>
        <button id="btnOpSyncProject" class="header-nav-btn" style="width:100%;justify-content:center;background:#0284c7;color:#fff;font-weight:700;border:none">
          🔄 Executar Sincronização
        </button>
      </div>

      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(56,189,248,0.2);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;color:#f8fafc;font-size:13px">2. Rotina de Extração de Conhecimento</span>
          <span style="font-size:10px;font-weight:800;color:#22c55e;background:rgba(34,197,94,0.15);padding:2px 6px;border-radius:4px">SUPORTADO</span>
        </div>
        <p style="font-size:11.5px;color:#94a3b8;margin:0 0 10px">
          Aciona a rotina de análise semântica e atualização de <code>extraido-memorias.md</code> para o projeto selecionado.
        </p>
        <button id="btnOpTriggerRoutine" class="header-nav-btn" style="width:100%;justify-content:center;background:#0369a1;color:#fff;font-weight:700;border:none">
          ⚡ Disparar Rotina de Extração
        </button>
      </div>

      <div id="opResultFeedback" style="display:none;padding:10px 12px;border-radius:6px;font-size:12px;margin-top:10px"></div>
    </div>

    <div class="drawer-card">
      <div class="drawer-card-title" style="margin-bottom:8px">🔒 Capacidades Não Disponíveis (Auditoria M2)</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="background:rgba(0,0,0,0.25);padding:8px 10px;border-radius:6px;border-left:3px solid #64748b">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="font-weight:600;color:#94a3b8">Cancelamento Forçado de Execução</span>
            <span style="font-size:10px;color:#ef4444;font-weight:700">DESABILITADO</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">
            Justificativa: A API dos provedores não expõe sinal seguro de interrupção externa sem risco de corrupção do workspace.
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.25);padding:8px 10px;border-radius:6px;border-left:3px solid #64748b">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="font-weight:600;color:#94a3b8">Pausar / Retomar Execução</span>
            <span style="font-size:10px;color:#ef4444;font-weight:700">DESABILITADO</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">
            Justificativa: Os motores operam chamadas atômicas; o Harness não simula estados de pausa inexistentes.
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Registra listeners de operações do painel
 * @param {any} state
 */
export function setupControlOperations(state) {
  const btnSync = document.getElementById("btnOpSyncProject");
  const btnRoutine = document.getElementById("btnOpTriggerRoutine");
  const feedbackEl = document.getElementById("opResultFeedback");

  btnSync?.addEventListener("click", async () => {
    if (!btnSync || !feedbackEl) return;
    btnSync.textContent = "⏳ Enviando solicitação...";
    // @ts-ignore
    btnSync.disabled = true;

    try {
      const res = await fetch("/api/orchestration/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": window.location.origin
        },
        body: JSON.stringify({
          action: "sync_project",
          target: { provider: "harness", projectId: state.activeProject }
        })
      });

      const data = await res.json();
      feedbackEl.style.display = "block";

      if (res.ok && data.status === "completed") {
        feedbackEl.style.background = "rgba(34,197,94,0.15)";
        feedbackEl.style.color = "#22c55e";
        feedbackEl.style.border = "1px solid rgba(34,197,94,0.3)";
        feedbackEl.innerHTML = `✔ <b>Operação Concluída!</b><br>ID: <code>${data.operationId}</code><br>${data.result?.message || 'Sincronização executada com sucesso.'}`;
        await state.refreshProject?.();
      } else {
        feedbackEl.style.background = "rgba(239,68,68,0.15)";
        feedbackEl.style.color = "#ef4444";
        feedbackEl.style.border = "1px solid rgba(239,68,68,0.3)";
        feedbackEl.innerHTML = `✖ <b>Falha na Operação:</b> ${data.error || data.result?.message || 'Erro desconhecido'}`;
      }
    } catch (_) {
      feedbackEl.style.display = "block";
      feedbackEl.style.background = "rgba(239,68,68,0.15)";
      feedbackEl.style.color = "#ef4444";
      feedbackEl.innerHTML = `✖ <b>Erro de Conexão:</b> Não foi possível contatar o servidor.`;
    } finally {
      btnSync.textContent = "🔄 Executar Sincronização";
      // @ts-ignore
      btnSync.disabled = false;
    }
  });

  btnRoutine?.addEventListener("click", async () => {
    if (!btnRoutine || !feedbackEl) return;
    btnRoutine.textContent = "⏳ Enviando solicitação...";
    // @ts-ignore
    btnRoutine.disabled = true;

    try {
      const res = await fetch("/api/orchestration/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": window.location.origin
        },
        body: JSON.stringify({
          action: "trigger_routine",
          target: { provider: "harness", projectId: state.activeProject },
          parameters: { routineId: "extrair-artefatos" }
        })
      });

      const data = await res.json();
      feedbackEl.style.display = "block";

      if (res.ok && data.status === "completed") {
        feedbackEl.style.background = "rgba(34,197,94,0.15)";
        feedbackEl.style.color = "#22c55e";
        feedbackEl.style.border = "1px solid rgba(34,197,94,0.3)";
        feedbackEl.innerHTML = `✔ <b>Rotina Disparada!</b><br>ID: <code>${data.operationId}</code><br>${data.result?.message || 'Rotina iniciada com sucesso.'}`;
      } else {
        feedbackEl.style.background = "rgba(239,68,68,0.15)";
        feedbackEl.style.color = "#ef4444";
        feedbackEl.style.border = "1px solid rgba(239,68,68,0.3)";
        feedbackEl.innerHTML = `✖ <b>Falha na Operação:</b> ${data.error || data.result?.message || 'Erro desconhecido'}`;
      }
    } catch (_) {
      feedbackEl.style.display = "block";
      feedbackEl.style.background = "rgba(239,68,68,0.15)";
      feedbackEl.style.color = "#ef4444";
      feedbackEl.innerHTML = `✖ <b>Erro de Conexão:</b> Não foi possível contatar o servidor.`;
    } finally {
      btnRoutine.textContent = "⚡ Disparar Rotina de Extração";
      // @ts-ignore
      btnRoutine.disabled = false;
    }
  });
}
