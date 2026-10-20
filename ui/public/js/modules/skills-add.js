// @ts-check
// Modal de adicionar skill: bundles, templates e skill personalizada.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sks } from "./skills-store.js";
import { renderImportSkillsList } from "./skills-import.js";

export async function openAddSkillModal() {
  const P = state.P;
  if (!P || !P.slug) return;
  if (!sks.catalogTemplates) {
    try {
      const res = await fetch(`/api/project/${P.slug}/skills/templates`);
      if (res.ok) sks.catalogTemplates = await res.json();
    } catch {}
  }

  const targets = (P.skills && P.skills.targets) || [];
  const sel = $("addSkillTargetSelect");
  sel.innerHTML = targets.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("");

  const preferred = targets.find((t) => t.id.includes("web") || t.id.includes("api") || t.hasAgents);
  if (preferred) sel.value = preferred.id;

  onAddSkillTargetChange(sel.value);
  switchAddSkillTab("templates");
  $("addSkillDlg").showModal();
}

export function onAddSkillTargetChange(targetId) {
  const P = state.P;
  const targets = (P && P.skills && P.skills.targets) || [];
  const target = targets.find((t) => t.id === targetId) || targets[0];
  const isApi = target && (target.type === "api" || target.id.includes("api"));
  const kind = isApi ? "api" : "web";

  $("templateBundleTitle").textContent = isApi ? "Pacote Backend Java / Spring Boot ST12" : "Pacote Frontend Angular / Web ST12";
  $("templateBundleDesc").textContent = isApi
    ? "Instala as 4 skills recomendadas para backend: anti-patterns, boas-práticas, infra-qualidade e padrões de código."
    : "Instala as 5 skills recomendadas para frontend: anti-patterns, boas-práticas, design-systems, infra-qualidade e padrões de código.";

  if (sks.catalogTemplates && sks.catalogTemplates[kind]) {
    const list = sks.catalogTemplates[kind];
    $("templateCardsList").innerHTML = list
      .map(
        (t) => `
      <div class="skill-template-card">
        <div class="skill-template-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">⚡</span>
            <b style="font-size:13px;color:var(--text)">${esc(t.name)}</b>
            <span class="tag">${esc(t.title)}</span>
          </div>
          <button type="button" class="btn-vp" onclick="installSkillTemplate('${esc(t.name)}')" style="font-size:11.5px;padding:3px 10px;color:var(--accent);border-color:var(--accent)">
            + Instalar
          </button>
        </div>
        <div class="skill-template-desc">${esc(t.description)}</div>
      </div>
    `
      )
      .join("");
  }

  renderImportSkillsList(targetId);
}

export function switchAddSkillTab(tab) {
  document.querySelectorAll("#addSkillTabs .eng-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  $("addSkillTabTemplates").style.display = tab === "templates" ? "block" : "none";
  $("addSkillTabCustom").style.display = tab === "custom" ? "flex" : "none";
  $("addSkillTabImport").style.display = tab === "import" ? "flex" : "none";
}

export async function installSkillBundle() {
  const P = state.P;
  if (!P || !P.slug) return;
  const targetId = $("addSkillTargetSelect").value;
  const targets = (P.skills && P.skills.targets) || [];
  const target = targets.find((t) => t.id === targetId) || targets[0];
  const isApi = target && (target.type === "api" || target.id.includes("api"));
  const bundleKind = isApi ? "bundle:api" : "bundle:web";

  const btn = $("btnInstallBundle");
  btn.disabled = true;
  btn.textContent = "Instalando...";
  try {
    const res = await fetch(`/api/project/${P.slug}/skills/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, templateName: bundleKind }),
    });
    if (!res.ok) throw new Error("Erro na instalação do pacote");
    if (window.load) await window.load(P.slug);
    $("addSkillDlg").close();
    alert(`Pacote de skills instalado com sucesso em ${target.label}!`);
  } catch (err) {
    alert("Erro: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Instalar Pacote Completo";
  }
}

export async function installSkillTemplate(templateName) {
  const P = state.P;
  if (!P || !P.slug) return;
  const targetId = $("addSkillTargetSelect").value;
  try {
    const res = await fetch(`/api/project/${P.slug}/skills/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, templateName }),
    });
    if (!res.ok) throw new Error("Erro ao instalar template");
    if (window.load) await window.load(P.slug);
    $("addSkillDlg").close();
    alert(`Skill "${templateName}" instalada com sucesso!`);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

export async function createCustomSkill() {
  const P = state.P;
  if (!P || !P.slug) return;
  const targetId = $("addSkillTargetSelect").value;
  const name = $("customSkillName").value.trim();
  const desc = $("customSkillDesc").value.trim();
  const ver = $("customSkillVersion").value.trim() || "1.0.0";
  const content = $("customSkillContent").value.trim();

  if (!name) {
    alert("Informe o nome identificador da skill.");
    return;
  }

  try {
    const res = await fetch(`/api/project/${P.slug}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId,
        name,
        frontmatter: {
          name,
          description: desc,
          version: ver,
        },
        content,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao criar skill");
    }
    if (window.load) await window.load(P.slug);
    $("addSkillDlg").close();
    alert(`Skill "${name}" criada com sucesso!`);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}
