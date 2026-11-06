// ---------- sincronização de um projeto (POST /api/project/:slug/sync, resposta em JSON) ----------
let rowBusy = false;
function rowMsg(text, cls) {
  const el = $("rowMsg");
  el.textContent = text;
  el.className = "row-msg show " + (cls || "");
  clearTimeout(rowMsg._t);
  rowMsg._t = setTimeout(() => { el.className = "row-msg"; }, 6000);
}
// Sync geral e sync por projeto nunca rodam juntos: cada um bloqueia os controles do outro.
function applyLocks() {
  const locked = rowBusy || running;
  document.querySelectorAll("[data-sync]").forEach((b) => { b.disabled = locked; });
  $("btnRun").disabled = locked;
}
function setRowButtons(busy, slug) {
  document.querySelectorAll("[data-sync]").forEach((b) => {
    const label = b.querySelector(".btn-label");
    if (label) label.textContent = busy && b.getAttribute("data-sync") === slug ? "Sincronizando…" : "Sync";
  });
}
async function syncRow(slug) {
  if (rowBusy || running) return;
  rowBusy = true;
  setRowButtons(true, slug);
  applyLocks();
  rowMsg(`Sincronizando ${slug} (Claude, Gemini e OpenCode)…`, "");
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: "all" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
    const novo = (data.totalNova || 0) + (data.totalAtualizada || 0);
    rowMsg(`${slug}: ${data.mensagem || (novo ? `${novo} conversa(s) atualizada(s)` : "tudo em dia")}`, novo ? "ok" : "");
    await loadOverview();
  } catch (err) {
    rowMsg(`Erro em ${slug}: ${err.message}`, "err");
  } finally {
    rowBusy = false;
    setRowButtons(false, slug);
    applyLocks();
  }
}

// ---------- ação do sistema: sync geral em streaming (POST /api/sync, SSE) ----------
let running = false;
const ENGINES = ["claude", "gemini", "opencode"];
const ENGINE_NAMES = { claude: "Claude Code", gemini: "Gemini", opencode: "OpenCode" };

function updateEngSummary() {
  const n = document.querySelectorAll(".eng:checked").length;
  $("engSummary").textContent = `${n} de ${ENGINES.length} motores`;
}
document.addEventListener("change", (ev) => {
  if (ev.target && ev.target.classList && ev.target.classList.contains("eng")) updateEngSummary();
});
updateEngSummary();

// Gravar conversas pede confirmação; a simulação (dry-run) não grava e dispensa. Sem o diálogo, não executa.
async function confirmSyncAll(engines) {
  try {
    const { requestConfirmation } = await import("/js/shared/confirm-dialog.js");
    return await requestConfirmation({
      title: "Sincronizar todos os projetos?",
      message: `Vai importar conversas de ${engines.map((e) => ENGINE_NAMES[e]).join(", ")} em todos os projetos.`,
      confirmLabel: "Sincronizar",
      cancelLabel: "Cancelar",
    });
  } catch {
    setRunState("não foi possível abrir a confirmação", "err");
    return false;
  }
}

function setRunState(text, cls) { $("runState").textContent = text; $("runState").className = "run-state " + (cls || ""); }
function logLine(html) {
  const log = $("log");
  log.innerHTML += html + "\n";
  log.scrollTop = log.scrollHeight;
}
const logEsc = (s) => `<b>${esc(s)}</b>`;

async function runSyncAll() {
  if (running) return;
  const engines = [...document.querySelectorAll(".eng:checked")].map(c => c.value);
  if (!engines.length) { setRunState("marque ao menos um motor", "err"); return; }
  const dryRun = $("dryRun").checked;
  if (rowBusy) { setRunState("aguarde a sincronização do projeto", "busy"); return; }
  if (!dryRun && !(await confirmSyncAll(engines))) return;

  running = true;
  applyLocks();
  document.body.classList.add("running");
  $("log").innerHTML = "";
  setRunState("sincronizando…", "busy");
  logLine(logEsc(`$ node tools/sync.js --engine ${engines.join(",")}${dryRun ? " --dry-run" : ""}`));

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engines, dryRun }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "HTTP " + res.status);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let fim = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i).trim();
        buf = buf.slice(i + 2);
        if (!chunk.startsWith("data: ")) continue;
        const ev = JSON.parse(chunk.slice(6));
        if (ev.type === "log") logLine(esc(ev.line));
        else if (ev.type === "error") { logLine(`<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(ev.error)}</span>`); fim = { code: -1, ms: 0 }; }
        else if (ev.type === "done") fim = ev;
      }
    }
    if (!fim) throw new Error("conexão interrompida");
    if (fim.code === 0) {
      setRunState(`concluído em ${(fim.ms / 1000).toFixed(1).replace(".", ",")}s`, "ok");
      logLine(`<i class="fa-solid fa-check"></i> ${logEsc("sincronização concluída")}`);
    } else {
      $("syncDetails").open = true;
      setRunState(`finalizou com código ${fim.code}`, "err");
      logLine(`<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> sincronização terminou com código ${fim.code}</span>`);
    }
    await loadOverview();
  } catch (err) {
    $("syncDetails").open = true;
    setRunState("falhou, tente de novo", "err");
    logLine(`<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message || String(err))}</span>`);
  } finally {
    running = false;
    applyLocks();
    document.body.classList.remove("running");
  }
}

