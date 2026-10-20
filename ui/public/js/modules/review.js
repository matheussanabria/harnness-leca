// @ts-check
import { $, esc, openDlg } from "../shared/dom.js";

// ---------- revisão das sugestões de memória ----------
// Fluxo: a extração gera sugestões em context/extraido-memorias.md; aqui o usuário promove (vai para memory.md, que é
// enviada em toda mensagem), edita antes de promover ou descarta. Nada é promovido sem uma ação explícita.
const RV_CAT = { memoria: "Memória", regra: "Regra", decisao: "Decisão", termo: "Termo" };
const RV_PLURAL = { todas: "Todas", memoria: "Memórias", regra: "Regras", decisao: "Decisões", termo: "Termos" };
const RV_PAGE = 25;
const RV_HEAVY = 8 * 1024; // acima disto a memória começa a pesar em toda mensagem
let R = null;

async function showReview() {
  const currentP = typeof P !== "undefined" ? P : (window.P || {});
  openDlg("Revisar memória — " + currentP.slug, "", '<div id="rv"><p class="empty">Carregando…</p></div>');
  $("dbody").onclick = reviewClick;
  $("dbody").oninput = reviewInput;
  try {
    const r = await (await fetch("/api/project/" + currentP.slug + "/review")).json();
    if (!r.pendentes) throw new Error(r.error || "resposta inválida");
    R = { items: r.pendentes, bytes: r.memoriaBytes, cat: "todas", q: "", page: 0, editing: null, confirm: false, busy: false, msg: "" };
    renderReview();
  } catch {
    $("rv").innerHTML = '<p class="empty">Não foi possível carregar as sugestões.</p>';
  }
}

function reviewVisible() {
  const q = R.q.trim().toLowerCase();
  return R.items.filter((i) =>
    (R.cat === "todas" || i.categoria === R.cat) &&
    (!q || i.texto.toLowerCase().includes(q) || i.conversas.some((c) => (c.titulo || "").toLowerCase().includes(q)))
  );
}

function renderReview() {
  const count = (c) => (c === "todas" ? R.items.length : R.items.filter((i) => i.categoria === c).length);
  const heavy = R.bytes > RV_HEAVY;
  $("rv").innerHTML =
    '<div class="rv-info' +
    (heavy ? " warn" : "") +
    '">memory.md atual: ' +
    (R.bytes / 1024).toFixed(1) +
    " KB. Ela vai junto em <b>toda mensagem</b>; mantenha enxuta (ideal abaixo de " +
    RV_HEAVY / 1024 +
    " KB)" +
    (heavy ? " — já está pesada: prefira descartar mais" : "") +
    ".</div>" +
    '<div class="rv-bar">' +
    ["todas", "memoria", "regra", "decisao", "termo"]
      .map(
        (c) =>
          '<button class="rv-chip' +
          (R.cat === c ? " on" : "") +
          '" data-act="cat" data-cat="' +
          c +
          '">' +
          RV_PLURAL[c] +
          " (" +
          count(c) +
          ")</button>"
      )
      .join("") +
    '<input class="rv-search" id="rv-q" placeholder="Buscar texto ou conversa…" value="' +
    esc(R.q) +
    '"></div>' +
    '<div class="rv-msg" id="rv-msg"></div><div id="rv-list"></div>';
  renderReviewList();
}

function renderReviewList() {
  const vis = reviewVisible();
  const pages = Math.max(1, Math.ceil(vis.length / RV_PAGE));
  R.page = Math.min(R.page, pages - 1);
  const slice = vis.slice(R.page * RV_PAGE, R.page * RV_PAGE + RV_PAGE);
  $("rv-msg").textContent = R.msg;
  const discard = !slice.length
    ? ""
    : R.confirm
    ? '<button data-act="descartar-pagina-ok">Confirmar: descartar estas ' +
      slice.length +
      '</button><button data-act="descartar-pagina-cancel">Cancelar</button>'
    : '<button data-act="descartar-pagina">❌ Descartar todas desta página</button>';
  const pager =
    '<div class="rv-pager"><button data-act="pag-ant"' +
    (R.page === 0 ? " disabled" : "") +
    ">←</button>" +
    "<span>" +
    (vis.length ? R.page * RV_PAGE + 1 + "–" + (R.page * RV_PAGE + slice.length) + " de " + vis.length : "nenhuma sugestão") +
    "</span>" +
    '<button data-act="pag-prox"' +
    (R.page >= pages - 1 ? " disabled" : "") +
    ">>→</button>" +
    discard +
    "</div>";
  $("rv-list").innerHTML = pager + (slice.length ? slice.map(reviewItemHtml).join("") + pager : '<p class="empty">Tudo revisado por aqui. 🎉</p>');
}

function reviewItemHtml(i) {
  const first = i.conversas[0] || {};
  const src =
    esc(first.titulo || "conversa") +
    (first.data ? " · " + esc(first.data) : "") +
    (i.conversas.length > 1 ? " +" + (i.conversas.length - 1) : "");
  const body =
    R.editing === i.id
      ? '<textarea class="rv-edit" id="rv-edit">' +
        esc(i.texto) +
        '</textarea><div class="rv-actions"><button data-act="salvar">✅ Salvar e promover</button><button data-act="cancelar">Cancelar</button></div>'
      : '<div class="rv-text">' +
        esc(i.texto) +
        '</div><div class="rv-actions"><button data-act="promover">✅ Promover</button><button data-act="editar">✏️ Editar</button><button data-act="descartar">❌ Descartar</button></div>';
  return (
    '<div class="rv-item" data-id="' +
    esc(i.id) +
    '"><div class="rv-top"><span class="rv-cat">' +
    (RV_CAT[i.categoria] || "") +
    "</span><span>" +
    src +
    "</span></div>" +
    body +
    "</div>"
  );
}

function reviewInput(e) {
  if (e.target.id !== "rv-q") return;
  R.q = e.target.value;
  R.page = 0;
  R.confirm = false;
  renderReviewList();
}

function reviewClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn || !R || R.busy) return;
  const act = btn.dataset.act;
  const item = btn.closest(".rv-item");
  const id = item ? item.dataset.id : null;
  const onPage = () => reviewVisible().slice(R.page * RV_PAGE, R.page * RV_PAGE + RV_PAGE);
  R.msg = "";
  if (act === "cat") {
    R.cat = btn.dataset.cat;
    R.page = 0;
    R.confirm = false;
    R.editing = null;
    return renderReview();
  }
  if (act === "pag-ant") {
    R.page--;
    R.confirm = false;
    R.editing = null;
    return renderReviewList();
  }
  if (act === "pag-prox") {
    R.page++;
    R.confirm = false;
    R.editing = null;
    return renderReviewList();
  }
  if (act === "editar") {
    R.editing = id;
    R.confirm = false;
    renderReviewList();
    const t = $("rv-edit");
    if (t) {
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    }
    return;
  }
  if (act === "cancelar") {
    R.editing = null;
    return renderReviewList();
  }
  if (act === "promover") return reviewApply([{ id, acao: "promover" }]);
  if (act === "salvar") return reviewApply([{ id, acao: "promover", texto: $("rv-edit").value }]);
  if (act === "descartar") return reviewApply([{ id, acao: "descartar" }]);
  if (act === "descartar-pagina") {
    R.confirm = true;
    return renderReviewList();
  }
  if (act === "descartar-pagina-cancel") {
    R.confirm = false;
    return renderReviewList();
  }
  if (act === "descartar-pagina-ok") {
    R.confirm = false;
    return reviewApply(onPage().map((i) => ({ id: i.id, acao: "descartar" })));
  }
}

async function reviewApply(acoes) {
  if (!acoes.length) return;
  const currentP = typeof P !== "undefined" ? P : (window.P || {});
  const loadFn = typeof load === "function" ? load : (window.load || (() => {}));
  R.busy = true;
  $("rv-msg").textContent = "Aplicando…";
  try {
    const res = await fetch("/api/project/" + currentP.slug + "/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acoes }),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "falhou");
    const skipped = new Set(r.ignoradas || []);
    const done = new Set(acoes.map((a) => a.id).filter((id) => !skipped.has(id)));
    R.items = R.items.filter((i) => !done.has(i.id));
    R.bytes = r.memoriaBytes;
    R.editing = null;
    R.msg = [
      r.promovidas ? "✓ " + r.promovidas + " promovida(s)" : "",
      r.descartadas ? r.descartadas + " descartada(s)" : "",
      skipped.size ? skipped.size + " já não estava(m) pendente(s)" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    currentP.review = { pendentes: r.pendentes };
    renderReview();
    loadFn(currentP.slug); // atualiza o cartão de Memória e a contagem, sem fechar o diálogo
  } catch (err) {
    R.msg = "⚠ " + err.message;
    renderReviewList();
  } finally {
    R.busy = false;
  }
}

export { showReview, reviewVisible, renderReview, renderReviewList, reviewItemHtml, reviewInput, reviewClick, reviewApply };
