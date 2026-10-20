const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kb = n => (n / 1024).toFixed(1).replace(".", ",") + " KB";
const dateBR = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

// Estado da página (page/pageSize também ficam na URL para sobreviver ao refresh).
const Q = new URLSearchParams(location.search);
const SIZES = [10, 25, 50];
let OV = {
  page: Number(Q.get("page")) || 1,
  pageSize: SIZES.includes(Number(Q.get("pageSize"))) ? Number(Q.get("pageSize")) : 10,
  total: 0, pages: 1, projects: [],
};
$("selSize").value = String(OV.pageSize);

function syncUrl() {
  const q = new URLSearchParams();
  if (OV.page !== 1) q.set("page", OV.page);
  if (OV.pageSize !== 10) q.set("pageSize", OV.pageSize);
  history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
}

async function loadOverview() {
  try {
    const r = await fetch(`/api/overview?page=${OV.page}&pageSize=${OV.pageSize}`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    OV = { ...OV, ...await r.json() };
    render();
    syncUrl();
  } catch (err) {
    $("rows").innerHTML = `<tr><td colspan="6" class="empty">Não foi possível carregar a visão geral (${esc(err.message)}).</td></tr>`;
  }
}

function goPage(p) { if (p < 1 || p > OV.pages || p === OV.page) return; OV.page = p; loadOverview(); }
function setSize(v) { OV.pageSize = Number(v) || 10; OV.page = 1; loadOverview(); }

function chips(c) {
  if (!c || !c.total) return '<span class="status-badge status-none">sem conversas</span>';
  const pend = c.nova + c.alterada;
  const parts = [];
  if (c.ok) parts.push(`<span class="status-badge status-ok">${c.ok} em dia</span>`);
  if (pend) parts.push(`<span class="status-badge ${c.alterada && !c.nova ? "status-alterada" : "status-nova"}">${pend} pendente${pend > 1 ? "s" : ""}</span>`);
  return `<span class="chips">${parts.join("")}</span>`;
}

function render() {
  const p = OV.projects || [];
  $("sub").innerHTML = `${OV.total} projeto${OV.total === 1 ? "" : "s"} no harness · ${OV.active ? `ativo: <b>${esc(OV.active)}</b>` : "nenhum projeto ativo em <code>projects/.active</code>"}`;
  $("totBadge").textContent = `${OV.total} projeto${OV.total === 1 ? "" : "s"}`;
  $("pageInfo").textContent = OV.total ? `página ${OV.page} de ${OV.pages}` : "";

  $("rows").innerHTML = p.length ? p.map(x => `
    <tr data-slug="${esc(x.slug)}">
      <td class="p-name">
        <b onclick="openProject('${esc(x.slug)}')" title="Abrir projeto">${esc(x.slug)}${x.active ? '<span class="status-badge badge-active">ativo</span>' : ""}</b>
        <div class="sub2">${x.context} contexto · ${x.scheduled} agendada${x.scheduled === 1 ? "" : "s"}${x.lastChat ? " · último chat " + dateBR(x.lastChat) : ""}</div>
      </td>
      <td class="cell-num">${x.chats}${x.extraction && x.extraction.total ? `<div class="sub2">analisadas</div>` : ""}</td>
      <td>${chips(x.extraction)}</td>
      <td class="cell-num">${x.review && x.review.pendentes
        ? `<span class="status-badge status-alterada" title="Sugestões de memória esperando revisão">${x.review.pendentes} pendente${x.review.pendentes > 1 ? "s" : ""}</span>`
        : '<span class="status-badge status-ok">em dia</span>'}</td>
      <td class="cell-num">${kb(x.memoryBytes || 0)}</td>
      <td>
        <div class="acts">
          <button class="btn-row sync" title="Sincronizar conversas deste projeto (Claude, Gemini e OpenCode)" onclick="syncRow('${esc(x.slug)}', this)">🔄 Sync</button>
          <button class="btn-row" onclick="openProject('${esc(x.slug)}')">Abrir →</button>
        </div>
      </td>
    </tr>`).join("")
    : '<tr><td colspan="6" class="empty" style="text-align:center;padding:22px">Nenhum projeto ainda. Copie <code>projects/_template</code> ou importe conversas com <code>tools/import-claude-code-chats.js</code>.</td></tr>';

  const from = OV.total ? (OV.page - 1) * OV.pageSize + 1 : 0;
  const to = Math.min(OV.page * OV.pageSize, OV.total);
  $("pagerInfo").textContent = OV.total ? `Mostrando ${from}–${to} de ${OV.total}` : "—";
  $("btnPrev").disabled = OV.page <= 1;
  $("btnNext").disabled = OV.page >= OV.pages;
}

function openProject(slug) { location.href = "/?p=" + encodeURIComponent(slug); }

// ---------- sincronização de um projeto (POST /api/project/:slug/sync, resposta em JSON) ----------
let rowBusy = false;
function rowMsg(text, cls) {
  const el = $("rowMsg");
  el.textContent = text;
  el.className = "row-msg show " + (cls || "");
  clearTimeout(rowMsg._t);
  rowMsg._t = setTimeout(() => { el.className = "row-msg"; }, 6000);
}
async function syncRow(slug, btn) {
  if (rowBusy) return;
  rowBusy = true;
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "… sincronizando";
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
    rowMsg(`⚠ ${slug}: ${err.message}`, "err");
  } finally {
    rowBusy = false;
    btn.disabled = false; btn.textContent = old;
  }
}

// ---------- ação do sistema: sync geral em streaming (POST /api/sync, SSE) ----------
let running = false;
const ENGINES = ["claude", "gemini", "opencode"];

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

  running = true;
  $("btnRun").disabled = true;
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
        else if (ev.type === "error") { logLine(`<span style="color:#ef4444">⚠ ${esc(ev.error)}</span>`); fim = { code: -1, ms: 0 }; }
        else if (ev.type === "done") fim = ev;
      }
    }
    if (!fim) throw new Error("conexão interrompida");
    if (fim.code === 0) {
      setRunState(`concluído em ${(fim.ms / 1000).toFixed(1).replace(".", ",")}s`, "ok");
      logLine(logEsc("✔ sincronização concluída"));
    } else {
      setRunState(`finalizou com código ${fim.code}`, "err");
      logLine(`<span style="color:#ef4444">⚠ sincronização terminou com código ${fim.code}</span>`);
    }
    await loadOverview();
  } catch (err) {
    setRunState("falhou", "err");
    logLine(`<span style="color:#ef4444">⚠ ${esc(err.message || String(err))}</span>`);
  } finally {
    running = false;
    $("btnRun").disabled = false;
    document.body.classList.remove("running");
  }
}

loadOverview();
