// @ts-check
// Seção de skills do projeto: listagem, visualização, edição e exclusão.
import { esc } from "../shared/dom.js";
import { md } from "../shared/markdown.js";
import { state } from "../shared/state.js";
import { sks } from "./skills-store.js";

export function renderSkillsSection() {
  const P = state.P;
  const sk = (P && P.skills) || { targets: [], skills: [] };
  const count = sk.skills ? sk.skills.length : 0;

  let bodyHtml = "";
  if (!count) {
    bodyHtml =
      `<div class="empty" style="margin-bottom:8px">Nenhuma skill encontrada nos repositórios.</div>` +
      `<button type="button" class="btn-chat-action" style="width:100%;font-size:12px;padding:6px;display:flex;align-items:center;justify-content:center;gap:6px" onclick="openAddSkillModal()"><span>⚡</span> Incluir Skills no Projeto</button>`;
  } else {
    const byTarget = {};
    for (const s of sk.skills) {
      if (!byTarget[s.targetId]) byTarget[s.targetId] = { label: s.targetLabel, type: s.targetType, items: [] };
      byTarget[s.targetId].items.push(s);
    }

    let groupsHtml = "";
    for (const [targetId, grp] of Object.entries(byTarget)) {
      const isApi = grp.type === "api" || targetId.includes("api");
      const isWeb = grp.type === "web" || targetId.includes("web");
      const icon = isApi ? "☕" : isWeb ? "🌐" : "📦";

      groupsHtml +=
        `<div class="skill-target-group">` +
        `<div class="skill-target-hdr"><span>${icon} <b>${esc(grp.label)}</b></span> <span class="tag">${grp.items.length}</span></div>` +
        `<div class="skill-chips-wrap">` +
        grp.items
          .map(
            (s) => `
          <div class="skill-item-row" onclick="openSkillViewerModal('${esc(s.targetId)}', '${esc(s.name)}')">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
              <span class="skill-dot ${s.hasSkillMd ? "active" : "draft"}"></span>
              <span class="skill-item-name" title="${esc(s.description || s.name)}">${esc(s.name)}</span>
              ${s.references && s.references.length ? `<span class="skill-refs-badge" title="${s.references.length} arquivos de referência">📚 ${s.references.length}</span>` : ""}
            </div>
            <span class="skill-status-tag ${s.hasSkillMd ? "active" : "draft"}">${s.hasSkillMd ? "v" + esc(s.version || "1.0.0") : "rascunho"}</span>
          </div>
        `
          )
          .join("") +
        `</div></div>`;
    }

    bodyHtml =
      groupsHtml +
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)">` +
      `<span style="font-size:11px;color:var(--mute)">${count} skill${count > 1 ? "s" : ""} em .agents</span>` +
      `<button type="button" class="btn-assign-grp" onclick="openAddSkillModal()" style="font-weight:600">➕ Incluir Skill</button>` +
      `</div>`;
  }

  return `<div class="sec"><h4><span>⚡ Skills (.agents)</span><span class="tag">${count}</span></h4>${bodyHtml}</div>`;
}

export async function openSkillViewerModal(targetId, skillName) {
  const P = state.P;
  if (!P || !P.slug) return;
  const dlg = $("skillViewerDlg");
  if (!dlg) return;

  try {
    const res = await fetch(`/api/project/${P.slug}/skills/detail?target=${encodeURIComponent(targetId)}&name=${encodeURIComponent(skillName)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    sks.currentSkillDetail = await res.json();

    $("skillViewTitle").textContent = sks.currentSkillDetail.name || skillName;
    $("skillViewTargetBadge").textContent = sks.currentSkillDetail.targetLabel || targetId;

    const fm = sks.currentSkillDetail.frontmatter || {};
    $("skillViewVersionBadge").textContent = "v" + (fm.version || "1.0.0");
    $("skillViewDesc").textContent = fm.description || sks.currentSkillDetail.description || "Sem descrição no frontmatter.";

    const refs = Array.isArray(sks.currentSkillDetail.references) ? sks.currentSkillDetail.references : [];
    $("skillRefsCount").textContent = String(refs.length);

    $("skillMdBody").innerHTML = md(sks.currentSkillDetail.body || sks.currentSkillDetail.content || "*Conteúdo vazio.*");

    if (refs.length) {
      $("skillRefsBody").innerHTML = refs
        .map(
          (r) => `
        <div class="card" style="padding:12px 14px;background:var(--panel2)">
          <h4 style="margin:0 0 6px;display:flex;align-items:center;justify-content:space-between">
            <span>📄 <b>${esc(r.name || "arquivo")}</b></span>
            <span class="tag">${r.size || 0} bytes</span>
          </h4>
          <div class="preview" style="-webkit-line-clamp:8;line-clamp:8;white-space:pre-wrap;font-family:monospace;font-size:12px">${esc(r.preview || "")}</div>
        </div>
      `
        )
        .join("");
    } else {
      $("skillRefsBody").innerHTML = `<div class="empty">Nenhum arquivo adicional na pasta references/.</div>`;
    }

    toggleEditSkillMode(false);
    showSkillSubTab("md");

    if (dlg.open) {
      try {
        dlg.close();
      } catch {}
    }
    dlg.showModal();
  } catch (err) {
    console.error("Erro ao abrir skill:", err);
    const toast = $("syncToast");
    if (toast) {
      toast.style.display = "inline-flex";
      toast.className = "sync-toast error";
      toast.innerHTML = `⚠️ Falha ao abrir skill: ${esc(err.message || String(err))}`;
      setTimeout(() => {
        toast.style.display = "none";
      }, 4000);
    } else {
      alert("Não foi possível carregar a skill: " + err.message);
    }
  }
}

export function showSkillSubTab(tab) {
  sks.currentSkillSubTab = tab;
  $("subtabSkillMd").classList.toggle("active", tab === "md");
  $("subtabSkillRefs").classList.toggle("active", tab === "refs");
  $("skillMdBody").style.display = tab === "md" ? "block" : "none";
  $("skillRefsBody").style.display = tab === "refs" ? "flex" : "none";
}

export function toggleEditSkillMode(edit) {
  const isEdit = edit !== undefined ? edit : $("skillEditModeContent").style.display === "none";
  $("skillViewModeContent").style.display = isEdit ? "none" : "flex";
  $("skillEditModeContent").style.display = isEdit ? "flex" : "none";
  $("btnToggleSkillEdit").textContent = isEdit ? "👁️ Visualizar" : "✏️ Editar";
  if (isEdit && sks.currentSkillDetail) {
    $("skillEditTextarea").value = sks.currentSkillDetail.content || "";
    $("skillEditStatus").textContent = "";
  }
}

export async function saveCurrentSkillEdit() {
  const P = state.P;
  if (!sks.currentSkillDetail || !P) return;
  const newContent = $("skillEditTextarea").value;
  $("btnSaveSkillEdit").disabled = true;
  $("btnSaveSkillEdit").textContent = "Salvando...";
  try {
    const res = await fetch(`/api/project/${P.slug}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId: sks.currentSkillDetail.targetId,
        name: sks.currentSkillDetail.name,
        content: newContent,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar");
    }
    if (window.load) await window.load(P.slug);
    await openSkillViewerModal(sks.currentSkillDetail.targetId, sks.currentSkillDetail.name);
    $("skillEditStatus").textContent = "Salvo com sucesso!";
  } catch (err) {
    alert("Erro: " + err.message);
  } finally {
    $("btnSaveSkillEdit").disabled = false;
    $("btnSaveSkillEdit").textContent = "💾 Salvar Alterações";
  }
}

export async function deleteCurrentSkill() {
  const P = state.P;
  if (!sks.currentSkillDetail || !P) return;
  if (!confirm(`Tem certeza que deseja excluir a skill "${sks.currentSkillDetail.name}" de ${sks.currentSkillDetail.targetLabel}?`)) return;
  try {
    const res = await fetch(`/api/project/${P.slug}/skills/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId: sks.currentSkillDetail.targetId,
        name: sks.currentSkillDetail.name,
      }),
    });
    if (!res.ok) throw new Error("Erro ao excluir skill");
    $("skillViewerDlg").close();
    if (window.load) await window.load(P.slug);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}
