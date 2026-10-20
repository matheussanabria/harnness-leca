// @ts-check
// Disparo de deploy e acompanhamento da execução.
import { dp } from "./deploy-store.js";
import { fetchHistory } from "./deploy-data.js";
import { renderStats, renderHistory } from "./deploy-render.js";
import { maskUrl, escapeHtml, showToast } from "./deploy-utils.js";

// Ações de Deploy
window.triggerDeploy = async function (projectId, envId) {
  const proj = dp.deployConfig.projects?.find((p) => p.id === projectId);
  const env = proj?.environments?.find((e) => e.id === envId);
  if (!proj || !env) return;

  if (!env.webhookUrl || !env.webhookUrl.trim()) {
    showToast("Webhook não configurado para este ambiente!", "error");
    return;
  }

  // Se exige confirmação (ex: Produção)
  if (env.requireConfirm) {
    window.openConfirmModal(
      `Confirmar Deploy em ${env.name || env.id}`,
      `Você está prestes a disparar o deploy de <b>${escapeHtml(proj.name)}</b> no ambiente <b>${escapeHtml(env.name || env.id)}</b>.<br><br>Webhook: <code>${escapeHtml(maskUrl(env.webhookUrl))}</code><br><br>Deseja continuar com a publicação?`,
      async () => {
        await executeDeploy(projectId, envId, proj, env);
      }
    );
    return;
  }

  await executeDeploy(projectId, envId, proj, env);
};

export async function executeDeploy(projectId, envId, proj, env) {
  const btn = document.getElementById(`btn-deploy-${projectId}-${envId}`);
  const dot = document.getElementById(`dot-${projectId}-${envId}`);
  const text = document.getElementById(`statustext-${projectId}-${envId}`);

  const origBtnHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin-icon">🔄</span> Disparando...`;
  }
  if (dot) dot.className = "indicator-dot dot-loading";
  if (text) text.textContent = "Conectando...";

  try {
    const res = await fetch("/api/deploy/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        envId,
      }),
    });

    let data;
    if (res.status === 404) {
      const start = Date.now();
      try {
        await fetch(env.webhookUrl, {
          method: env.method || "POST",
          mode: "no-cors",
        });
        data = {
          ok: true,
          status: 200,
          statusText: "Disparado (Browser)",
          durationMs: Date.now() - start,
          snippet: "Webhook chamado diretamente pelo navegador (reinicie 'npm run remote' para habilitar proxy com logs completos).",
        };
      } catch (browserErr) {
        throw new Error("Falha ao chamar webhook diretamente: " + browserErr.message);
      }
    } else {
      data = await res.json();
    }

    if (data.ok) {
      showToast(`🚀 Deploy de ${proj.name} [${env.name}] iniciado com sucesso! (HTTP ${data.status} · ${data.durationMs}ms)`, "success");
      if (dot) dot.className = "indicator-dot dot-success";
      if (text) text.textContent = `Sucesso (${data.status})`;
    } else {
      showToast(`Falha no deploy: ${data.statusText || data.error || 'Erro'} (HTTP ${data.status})`, "error");
      if (dot) dot.className = "indicator-dot dot-error";
      if (text) text.textContent = `Erro (${data.status})`;
    }

    if (!data.historyItem) {
      dp.deployHistory.unshift({
        timestamp: new Date().toISOString(),
        projectId,
        projectName: proj.name,
        envId,
        envName: env.name,
        status: data.status,
        statusText: data.statusText,
        ok: data.ok,
        durationMs: data.durationMs,
        snippet: data.snippet || data.bodySnippet || "",
      });
      localStorage.setItem("harness_deploy_history", JSON.stringify(dp.deployHistory.slice(0, 50)));
    } else {
      await fetchHistory();
    }
    renderStats();
    renderHistory();
  } catch (err) {
    showToast(`Erro no disparo: ${err.message}`, "error");
    if (dot) dot.className = "indicator-dot dot-error";
    if (text) text.textContent = "Erro local";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
    }
  }
}
