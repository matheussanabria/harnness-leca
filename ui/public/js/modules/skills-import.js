// @ts-check
// Importação de skills reconhecidas e clonagem entre alvos.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sks } from "./skills-store.js";

export async function loadRecognizedSkills() {
  const P = state.P;
  if (sks.recognizedSkillsCache || !P || !P.slug) return sks.recognizedSkillsCache;
  try {
    const res = await fetch(`/api/project/${P.slug}/skills/recognized`);
    if (res.ok) {
      sks.recognizedSkillsCache = await res.json();
    }
  } catch (err) {
    console.error("Erro ao carregar skills reconhecidas:", err);
  }
  return sks.recognizedSkillsCache || [];
}

export async function renderImportSkillsList(currentTargetId) {
  const P = state.P;
  const container = $("importSkillsList");
  if (!container || !P) return;

  container.innerHTML = `<div class="empty">Carregando skills disponíveis...</div>`;
  await loadRecognizedSkills();
  filterImportSkills();
}

export function filterImportSkills(filterText) {
  const P = state.P;
  if (filterText !== undefined) sks.currentImportFilterText = filterText.toLowerCase();
  const sel = $("importSkillSourceSelect");
  if (sel) sks.currentImportSourceFilter = sel.value;

  const container = $("importSkillsList");
  if (!container || !P) return;

  const currentTargetId = $("addSkillTargetSelect").value;
  const recognized = sks.recognizedSkillsCache || [];
  const otherSkills = (P.skills && P.skills.skills ? P.skills.skills : []).filter(
    (s) => s.targetId !== currentTargetId && s.hasSkillMd
  );

  const q = sks.currentImportFilterText.trim().toLowerCase();
  const src = sks.currentImportSourceFilter;

  const filteredRecognized = recognized.filter((s) => {
    if (src !== "all" && s.source !== src) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  const filteredOther = otherSkills.filter((s) => {
    if (src !== "all" && src !== "project") return false;
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
  });

  if (!filteredRecognized.length && !filteredOther.length) {
    container.innerHTML = `<div class="empty">Nenhuma skill encontrada com o filtro selecionado.</div>`;
    return;
  }

  let html = "";
  if (filteredRecognized.length) {
    html +=
      `<div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px;display:flex;align-items:center;gap:6px">` +
      `<span>🌟 Skills Reconhecidas no Sistema</span> <span class="tag">${filteredRecognized.length}</span></div>`;
    html += filteredRecognized
      .map((s) => {
        const srcBadge =
          s.source === "gemini"
            ? "🌐 Global Gemini"
            : s.source === "dai"
            ? "📐 Catálogo DAI"
            : s.source === "harness"
            ? "⚡ Harness"
            : "📦 Projeto";
        return `
        <div class="skill-template-card">
          <div class="skill-template-head">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>⚡</span>
              <b style="font-size:13px;color:var(--text)">${esc(s.name)}</b>
              <span class="tag" title="${esc(s.sourcePath)}">${srcBadge}</span>
              <span class="tag">v${esc(s.version || "1.0.0")}</span>
              ${s.referencesCount ? `<span class="skill-refs-badge" title="${s.referencesCount} arquivos de referência">📚 ${s.referencesCount} refs</span>` : ""}
            </div>
            <button type="button" class="btn-vp" onclick="importRecognizedSkillToTarget('${esc(s.name)}', '${esc(s.sourcePath)}')" style="font-size:11.5px;padding:3px 12px;color:var(--accent);border-color:var(--accent);font-weight:600">
              📥 Importar
            </button>
          </div>
          <div class="skill-template-desc">${esc(s.description || "Sem descrição cadastrada.")}</div>
        </div>
      `;
      })
      .join("");
  }

  if (filteredOther.length) {
    html +=
      `<div style="font-size:12px;font-weight:600;color:var(--text);margin-top:14px;padding-top:10px;border-top:1px dashed var(--line);display:flex;align-items:center;gap:6px">` +
      `<span>📋 Clonar de Outros Repositórios deste Projeto</span> <span class="tag">${filteredOther.length}</span></div>`;
    html += filteredOther
      .map(
        (s) => `
      <div class="skill-template-card">
        <div class="skill-template-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span>📋</span>
            <b style="font-size:13px;color:var(--text)">${esc(s.name)}</b>
            <span class="tag">de ${esc(s.targetLabel)}</span>
          </div>
          <button type="button" class="btn-vp" onclick="cloneSkillToTarget('${esc(s.targetId)}', '${esc(s.name)}')" style="font-size:11.5px;padding:3px 10px">
            Clonar para este destino
          </button>
        </div>
        <div class="skill-template-desc">${esc(s.description || "Sem descrição")}</div>
      </div>
    `
      )
      .join("");
  }

  container.innerHTML = html;
}

export async function importRecognizedSkillToTarget(skillName, sourcePath) {
  const P = state.P;
  if (!P || !P.slug) return;
  const targetId = $("addSkillTargetSelect").value;
  try {
    const res = await fetch(`/api/project/${P.slug}/skills/import-recognized`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, skillName, sourcePath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    if (window.load) await window.load(P.slug);
    $("addSkillDlg").close();
    alert(`Skill reconhecida "${skillName}" importada com sucesso para o destino selecionado!`);
  } catch (err) {
    alert("Erro ao importar skill reconhecida: " + err.message);
  }
}

export async function cloneSkillToTarget(sourceTargetId, skillName) {
  const P = state.P;
  if (!P) return;
  const targetId = $("addSkillTargetSelect").value;
  try {
    const detailRes = await fetch(
      `/api/project/${P.slug}/skills/detail?target=${encodeURIComponent(sourceTargetId)}&name=${encodeURIComponent(skillName)}`
    );
    if (!detailRes.ok) {
      const err = await detailRes.json().catch(() => ({}));
      throw new Error(err.error || "Não foi possível ler a skill de origem");
    }
    const detail = await detailRes.json();

    const saveRes = await fetch(`/api/project/${P.slug}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId,
        name: skillName,
        content: detail.content,
        references: detail.references,
      }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao clonar skill");
    }
    if (window.load) await window.load(P.slug);
    $("addSkillDlg").close();
    alert(`Skill "${skillName}" clonada com sucesso para o destino selecionado!`);
  } catch (err) {
    alert("Erro ao clonar skill: " + err.message);
  }
}
