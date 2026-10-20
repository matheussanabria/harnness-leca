// @ts-check
// Modais de criação e edição de projetos e ambientes, teste de webhook.
import { dp } from "./deploy-store.js";
import { fetchHistory } from "./deploy-data.js";
import { renderAll, renderStats, renderHistory } from "./deploy-render.js";
import { persistConfig, openModal, escapeHtml, showToast } from "./deploy-utils.js";

// Modais de Criação e Edição
window.openNewProjectModal = function () {
  const select = document.getElementById("newProjectSelect");
  const nameInput = document.getElementById("newProjectName");
  const idInput = document.getElementById("newProjectId");

  if (select) {
    select.innerHTML = `<option value="">-- Selecione um projeto local ou crie customizado --</option>`;
    dp.availableProjects.forEach((slug) => {
      const already = dp.deployConfig.projects?.some((p) => p.id === slug);
      select.innerHTML += `<option value="${escapeHtml(slug)}">${already ? '✔ ' : ''}${escapeHtml(slug)}</option>`;
    });
    select.onchange = function () {
      if (select.value) {
        idInput.value = select.value;
        nameInput.value = select.value;
      }
    };
  }

  if (nameInput) nameInput.value = "";
  if (idInput) idInput.value = "";
  document.getElementById("newProjectDesc").value = "";

  openModal("modalNewProject");
};

window.saveNewProject = async function () {
  const name = document.getElementById("newProjectName").value.trim();
  let id = document.getElementById("newProjectId").value.trim();
  const desc = document.getElementById("newProjectDesc").value.trim();

  if (!name) {
    showToast("Informe o nome do projeto", "error");
    return;
  }
  if (!id) id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  const exists = dp.deployConfig.projects?.some((p) => p.id === id);
  if (exists) {
    showToast("Já existe um projeto com este identificador", "error");
    return;
  }

  const newProj = {
    id,
    name,
    description: desc,
    environments: [
      {
        id: "staging",
        name: "Staging",
        type: "staging",
        webhookUrl: "",
        method: "POST",
        requireConfirm: false,
      },
      {
        id: "production",
        name: "Produção",
        type: "production",
        webhookUrl: "",
        method: "POST",
        requireConfirm: true,
      },
    ],
  };

  dp.deployConfig.projects.push(newProj);
  await persistConfig();
  closeModal("modalNewProject");
  renderAll();
  showToast(`Projeto ${name} adicionado com sucesso!`, "success");
};

window.openEditProjectModal = function (projectId) {
  const proj = dp.deployConfig.projects?.find((p) => p.id === projectId);
  if (!proj) return;
  dp.activeEditProject = proj;

  document.getElementById("editProjectId").value = proj.id;
  document.getElementById("editProjectName").value = proj.name || "";
  document.getElementById("editProjectDesc").value = proj.description || "";

  openModal("modalEditProject");
};

window.saveEditProject = async function () {
  if (!dp.activeEditProject) return;
  const name = document.getElementById("editProjectName").value.trim();
  const desc = document.getElementById("editProjectDesc").value.trim();

  if (!name) {
    showToast("Informe o nome do projeto", "error");
    return;
  }

  dp.activeEditProject.name = name;
  dp.activeEditProject.description = desc;

  await persistConfig();
  closeModal("modalEditProject");
  renderAll();
  showToast("Informações do projeto atualizadas!", "success");
};

window.deleteProject = async function (projectId) {
  const proj = dp.deployConfig.projects?.find((p) => p.id === projectId);
  if (!proj) return;

  window.openConfirmModal(
    `Excluir Projeto ${proj.name}?`,
    `Tem certeza que deseja remover as configurações de deploy de <b>${escapeHtml(proj.name)}</b>? Isso não apagará arquivos do seu disco, apenas o atalho de webhook.`,
    async () => {
      dp.deployConfig.projects = dp.deployConfig.projects.filter((p) => p.id !== projectId);
      await persistConfig();
      renderAll();
      showToast("Projeto removido das configurações", "success");
    }
  );
};

window.openEditEnvModal = function (projectId, envId) {
  const proj = dp.deployConfig.projects?.find((p) => p.id === projectId);
  const env = proj?.environments?.find((e) => e.id === envId);
  if (!proj || !env) return;

  dp.activeEditProject = proj;
  dp.activeEditEnv = env;

  document.getElementById("envModalTitle").textContent = `Configurar Webhook · ${proj.name} [${env.name || env.id}]`;
  document.getElementById("envNameInput").value = env.name || "";
  document.getElementById("envUrlInput").value = env.webhookUrl || "";
  document.getElementById("envMethodSelect").value = env.method || "POST";
  document.getElementById("envConfirmCheck").checked = Boolean(env.requireConfirm);

  openModal("modalEditEnv");
};

window.saveEditEnv = async function () {
  if (!dp.activeEditProject || !dp.activeEditEnv) return;

  const name = document.getElementById("envNameInput").value.trim();
  const url = document.getElementById("envUrlInput").value.trim();
  const method = document.getElementById("envMethodSelect").value;
  const confirm = document.getElementById("envConfirmCheck").checked;

  if (!name) {
    showToast("Informe o nome do ambiente", "error");
    return;
  }

  dp.activeEditEnv.name = name;
  dp.activeEditEnv.webhookUrl = url;
  dp.activeEditEnv.method = method;
  dp.activeEditEnv.requireConfirm = confirm;

  await persistConfig();
  closeModal("modalEditEnv");
  renderAll();
  showToast(`Configurações de ${name} salvas!`, "success");
};

window.testWebhookFromModal = async function () {
  const url = document.getElementById("envUrlInput").value.trim();
  const method = document.getElementById("envMethodSelect").value;

  if (!url) {
    showToast("Insira a URL do webhook antes de testar", "error");
    return;
  }

  const testBtn = document.getElementById("btnTestEnvWebhook");
  const origHtml = testBtn ? testBtn.innerHTML : "";
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.innerHTML = `<span class="spin-icon">🔄</span> Testando...`;
  }

  try {
    const res = await fetch("/api/deploy/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: url,
        method: method,
        projectId: dp.activeEditProject?.id || "teste",
        envId: dp.activeEditEnv?.id || "teste",
      }),
    });

    const data = await res.json();
    if (data.ok) {
      showToast(`✔ Webhook respondeu com sucesso! (HTTP ${data.status} · ${data.durationMs}ms)`, "success");
    } else {
      showToast(`Resposta do webhook: HTTP ${data.status} - ${data.statusText || 'Erro'}`, "error");
    }
    await fetchHistory();
    renderHistory();
    renderStats();
  } catch (err) {
    showToast(`Erro na requisição: ${err.message}`, "error");
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML = origHtml;
    }
  }
};
