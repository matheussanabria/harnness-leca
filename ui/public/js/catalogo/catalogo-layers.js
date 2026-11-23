// "Camadas por projeto": the effective skills, agents and workflows of a project (DAI, global, project) and the
// creation/removal of items on the project layer. API: /api/project/:slug/layers.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { skill: "Skill", agent: "Agente", workflow: "Workflow" };
const LAYER = { dai: "DAI", global: "Global", project: "Projeto" };
let current = "";

function msg(text, cls) {
  const el = $("lyMsg");
  el.textContent = text;
  el.className = "ly-msg " + (cls || "");
}

function rows(items) {
  if (!items.length) return '<tr><td colspan="5" class="c-empty">Nada encontrado.</td></tr>';
  return items.map((i) => {
    const own = i.layer === "project";
    const over = i.overrides && i.overrides.length ? `substitui ${i.overrides.map((l) => LAYER[l]).join(", ")}` : "";
    const del = own ? `<button type="button" class="btn-row ly-del" data-kind="${esc(i.kind)}" data-id="${esc(i.id)}" aria-label="Remover ${esc(i.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` : "";
    return `<tr><td>${esc(KIND[i.kind])}</td><td><b>${esc(i.id)}</b><div class="ly-desc">${esc(i.description)}</div></td><td><span class="ly-tag ly-${esc(i.layer)}">${esc(LAYER[i.layer])}</span></td><td class="ly-over">${esc(over)}</td><td>${del}</td></tr>`;
  }).join("");
}

async function load() {
  if (!current) return;
  $("lyBody").innerHTML = '<tr><td colspan="5" class="c-empty">Carregando...</td></tr>';
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(current)}/layers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const kind = $("lyKind").value;
    $("lyBody").innerHTML = rows(data.items.filter((i) => !kind || i.kind === kind));
    const own = data.items.filter((i) => i.layer === "project").length;
    $("lySummary").textContent = `${data.items.length} item(ns): ${own} do projeto${data.daiFound ? "" : " (DAI não encontrado)"}${data.disabled.length ? `, ${data.disabled.length} desligado(s) no project.json` : ""}`;
  } catch (err) {
    $("lyBody").innerHTML = `<tr><td colspan="5" class="c-empty">Não foi possível carregar (${esc(err.message)}).</td></tr>`;
  }
}

async function post(path, body) {
  const res = await fetch(`/api/project/${encodeURIComponent(current)}/layers${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function create(ev) {
  ev.preventDefault();
  const kind = $("lyNewKind").value, id = $("lyNewId").value.trim(), description = $("lyNewDesc").value.trim();
  try {
    await post("", { kind, id, description });
    msg(`${KIND[kind]} ${id} criado na camada do projeto.`, "ok");
    $("lyNewId").value = "";
    $("lyNewDesc").value = "";
    await load();
  } catch (err) { msg(`Falha ao criar: ${err.message}`, "err"); }
}

async function remove(btn) {
  const { kind, id } = btn.dataset;
  if (!window.confirm(`Remover ${KIND[kind]} "${id}" da camada do projeto? Itens do DAI e do global não são afetados.`)) return;
  try {
    await post("/delete", { kind, id, confirm: true });
    msg(`${KIND[kind]} ${id} removido.`, "ok");
    await load();
  } catch (err) { msg(`Falha ao remover: ${err.message}`, "err"); }
}

export async function startLayersSection() {
  if (!$("kLayers")) return;
  try {
    const state = await (await fetch("/api/state")).json();
    $("lyProject").innerHTML = state.projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
    current = state.active && state.projects.includes(state.active) ? state.active : state.projects[0] || "";
    $("lyProject").value = current;
  } catch { return; }
  $("lyProject").addEventListener("change", () => { current = $("lyProject").value; load(); });
  $("lyKind").addEventListener("change", load);
  $("lyForm").addEventListener("submit", create);
  $("lyBody").addEventListener("click", (ev) => { const b = ev.target.closest(".ly-del"); if (b) remove(b); });
  load();
}
