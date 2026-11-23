// "Sessões sem projeto": sessions the sync found but could not assign. Associating adds an alias (projects/.sources.json);
// the next sync imports them. Depends on $ and esc from overview.js.
const ENGINE_LABEL = { claude: "Claude Code", opencode: "OpenCode", codex: "Codex", gemini: "Gemini" };
let unmatchedBusy = false;

function unmatchedMsg(text, cls) {
  const el = $("unmatchedMsg");
  el.textContent = text;
  el.className = "row-msg show " + (cls || "");
}

function unmatchedRow(item, projects) {
  const opts = projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  const key = esc(JSON.stringify({ engine: item.engine, name: item.name }));
  return `<tr>
    <td><span class="tag">${esc(ENGINE_LABEL[item.engine] || item.engine)}</span></td>
    <td class="um-name" title="${esc(item.name)}">${esc(item.name)}</td>
    <td><label class="sr-only" for="um-${esc(item.engine)}-${esc(item.name)}">Projeto para ${esc(item.name)}</label>
      <select class="um-select" id="um-${esc(item.engine)}-${esc(item.name)}"><option value="">Escolher projeto…</option>${opts}</select></td>
    <td><button type="button" class="btn-run um-assoc" data-item="${key}"><i class="fa-solid fa-link" aria-hidden="true"></i> Associar</button></td>
  </tr>`;
}

async function loadUnmatched() {
  const card = $("unmatchedCard");
  if (!card) return;
  try {
    const res = await fetch("/api/unmatched");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { items, projects } = await res.json();
    card.hidden = !items.length;
    $("unmatchedCount").textContent = String(items.length);
    $("unmatchedBody").innerHTML = items.map((i) => unmatchedRow(i, projects)).join("");
  } catch {
    card.hidden = true; // informative panel: a failure must not disturb the page
  }
}

async function associateUnmatched(button) {
  if (unmatchedBusy) return;
  const { engine, name } = JSON.parse(button.getAttribute("data-item"));
  const slug = button.closest("tr").querySelector(".um-select").value;
  if (!slug) return unmatchedMsg("Escolha o projeto antes de associar.", "err");
  unmatchedBusy = true;
  button.disabled = true;
  try {
    const res = await fetch("/api/unmatched/associate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine, name, slug }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    unmatchedMsg(`${name} associada a ${slug}. ${data.message || ""}`, "ok");
    await loadUnmatched();
  } catch (err) {
    unmatchedMsg(`Falha ao associar: ${err.message}`, "err");
    button.disabled = false;
  } finally {
    unmatchedBusy = false;
  }
}

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest && ev.target.closest(".um-assoc");
  if (btn) associateUnmatched(btn);
});
loadUnmatched();
