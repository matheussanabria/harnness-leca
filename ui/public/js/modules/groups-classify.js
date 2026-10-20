// @ts-check
// Classificação automática em lote.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { gs } from "./groups-store.js";
import { renderManageGroupsList } from "./groups-manage.js";

export async function loadAutoClassifySuggestions(all = false) {
  const P = state.P;
  if (!P || !P.slug) return;
  const btn = all ? $("btnBatchSuggestAll") : $("btnBatchSuggestPending");
  const container = $("batchSuggestContainer");
  const origText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">⏳</span> Analisando...`;
  }
  try {
    const res = await fetch("/api/project/" + encodeURIComponent(P.slug) + "/groups/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: !!all }),
    });
    const data = await res.json();
    if (!data.ok || !data.suggestions) {
      alert("Não foi possível gerar sugestões.");
      return;
    }

    gs.pendingBatchSuggestions = data.suggestions;
    container.style.display = "block";

    const total = data.total || 0;
    const classified = data.classified || 0;

    $("batchSuggestStats").innerHTML = `<b>${gs.pendingBatchSuggestions.length}</b> sugestões geradas (${classified} já vinculadas de ${total} totais):`;

    if (!gs.pendingBatchSuggestions.length) {
      $("batchSuggestList").innerHTML = `<div class="empty" style="padding:18px;text-align:center">Nenhuma conversa pendente para classificar! Todas já possuem grupo definido.</div>`;
      $("btnApplyBatchSuggestions").style.display = "none";
      return;
    }

    $("btnApplyBatchSuggestions").style.display = "inline-flex";
    $("btnApplyBatchSuggestions").textContent = `✓ Aplicar ${gs.pendingBatchSuggestions.length} Sugestões`;

    $("batchSuggestList").innerHTML = gs.pendingBatchSuggestions
      .map((item) => {
        const sug = item.suggestion || {};
        const conf = Math.round((sug.confidence || 0.8) * 100);
        const subTxt = sug.subgroup ? ` › <span style="color:var(--text)">${esc(sug.subgroup)}</span>` : "";
        const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(sug.color || "#d97757")};margin-right:5px"></span>`;
        const curTxt = item.current ? `<span style="font-size:11px;color:var(--mute)">(Atual: ${esc(item.current.group || "")})</span>` : "";

        return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:var(--bg);border:1px solid var(--line);border-radius:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(item.title || item.file)}
            </div>
            <div style="font-size:11.5px;color:var(--mute);margin-top:2px">
              <code>${esc(item.file)}</code> ${curTxt}
            </div>
          </div>
          <div style="flex-shrink:0;text-align:right">
            <div style="font-size:12.5px;font-weight:600;color:var(--accent);display:flex;align-items:center;justify-content:flex-end">
              ${dot} ${esc(sug.group)}${subTxt}
            </div>
            <div style="font-size:11px;color:var(--mute);margin-top:2px">
              Confiança: ${conf}% · ${esc(sug.reason || "")}
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    alert("Erro ao buscar sugestões: " + (err.message || String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

export function closeBatchSuggestContainer() {
  const c = $("batchSuggestContainer");
  if (c) c.style.display = "none";
}

export async function applyBatchClassifySuggestions() {
  const P = state.P;
  if (!gs.pendingBatchSuggestions.length || !P || !P.slug) return;
  const btn = $("btnApplyBatchSuggestions");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Aplicando...";
  }

  const itemsToApply = gs.pendingBatchSuggestions.map((item) => ({
    file: item.file,
    group: item.suggestion.group,
    subgroup: item.suggestion.subgroup || "",
    color: item.suggestion.color || "#d97757",
  }));

  try {
    const res = await fetch("/api/project/" + encodeURIComponent(P.slug) + "/groups/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply: true, items: itemsToApply }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert("Erro ao aplicar sugestões.");
      return;
    }

    // Atualiza estado do projeto
    P.groups = { groups: data.groups || [], assignments: data.assignments || {} };
    localStorage.setItem("harness_groups_" + P.slug, JSON.stringify(P.groups));

    // Atualiza chats em memória
    const assigns = P.groups.assignments || {};
    (P.chats || []).forEach((c) => {
      const a = assigns[c.name];
      c.group = a ? a.group || a.groupId || "" : "";
      c.groupId = a ? a.groupId || "" : "";
      c.subgroup = a ? a.subgroup || "" : "";
    });

    closeBatchSuggestContainer();
    renderManageGroupsList();
    if (window.renderProjectChats) window.renderProjectChats();
    alert(`Sucesso! ${itemsToApply.length} conversas foram classificadas em grupos.`);
  } catch (err) {
    alert("Falha ao salvar sugestões: " + (err.message || String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✓ Aplicar Sugestões";
    }
  }
}
