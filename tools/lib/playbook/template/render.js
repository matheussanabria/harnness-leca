/* Browser renderer. Reads the global DATA injected by tools/playbook.js. No emojis, no icon fonts needed. */
let lang = (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "pt";
let theme = "auto";
try { lang = localStorage.getItem("hsf-lang") || lang; theme = localStorage.getItem("hsf-theme") || "auto"; } catch (e) {}
if (lang !== "en") lang = "pt";
if (!["auto", "light", "dark"].includes(theme)) theme = "auto";

const x = (o) => (o && o[lang]) || "";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, "<code>$1</code>").replace(/`(.+?)`/g, "<code>$1</code>");
const codes = (arr) => arr.map((c) => "<code>" + esc(c) + "</code>").join("");
const pad = (i) => String(i + 1).padStart(2, "0");
const phaseLabel = (id) => x((DATA.phases.items.find((p) => p.id === id) || {}).label);

const head = (id, h, intro) => `<section id="${id}"><h2>${esc(x(h))}</h2>${intro ? `<p class="kicker">${esc(x(intro))}</p>` : ""}`;

function hero() {
  const U = DATA.ui;
  return `<header class="hero"><div class="eyebrow">${esc(x(U.eyebrow))}</div><h1>${esc(x(U.h1))}</h1><p class="lede">${esc(x(U.lede))}</p>
    <div class="readers">${U.readers.map((r) => `<div class="reader"><b>${esc(x(r.title))}</b>${esc(x(r.text))}</div>`).join("")}</div></header>`;
}

function layers() {
  const L = DATA.layers;
  return head("ideia", L.heading, L.intro) +
    `<div class="layers">${L.items.map((l) => `<div class="layer"><h3>${esc(x(l.name))}</h3><p>${esc(x(l.text))}</p><div class="mem">${esc(l.members)}</div></div>`).join("")}</div></section>`;
}

function blocks() {
  const B = DATA.blocks;
  return head("blocos", B.heading, B.intro) +
    `<div class="blocks">${B.items.map((b, i) => `<div class="brow"><h3><span>${pad(i)}</span>${esc(x(b.name))}</h3><p>${esc(x(b.text))}</p><div class="where">${codes(b.where)}</div></div>`).join("")}</div></section>`;
}

function stageCard(s, i) {
  const U = DATA.ui;
  const num = s.trigger ? "&mdash;" : pad(i);
  return `<li class="stage${s.trigger ? " trigger" : ""}"><header><span class="n">${num}</span><h3>${esc(x(s.name))}</h3><span class="ph ph-${s.phase}">${esc(phaseLabel(s.phase))}</span><span class="id">${esc(s.id)}</span></header><p>${esc(x(s.text))}</p>
    <dl><dt>${esc(x(U.who))}</dt><dd>${esc(x(s.who))}</dd><dt>${esc(x(U.out))}</dt><dd>${esc(x(s.out))}</dd><dt>${esc(x(U.gate))}</dt><dd class="gate">${esc(x(s.gate))}</dd></dl></li>`;
}

function line() {
  const S = DATA.stages;
  return head("esteira", S.heading, S.intro) + `<p class="note">${esc(x(DATA.phases.note))}</p>
    <ol class="line">${S.items.map(stageCard).join("")}</ol><p class="kicker">${esc(x(S.after))}</p></section>`;
}

function gates() {
  const G = DATA.gates;
  return head("gates", G.heading, G.intro) + `<div class="gtable"><table><thead><tr>${G.columns.map((c) => `<th>${esc(x(c))}</th>`).join("")}</tr></thead><tbody>${
    G.items.map((g) => `<tr><td class="when">${esc(x(g.when))}</td><td><code>${esc(g.gate)}</code></td><td>${esc(x(g.text))}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function boilerplate() {
  const P = DATA.boilerplate;
  return head("boilerplate", P.heading, P.intro) +
    `<ol class="steps">${P.steps.map((s) => `<li><b>${esc(x(s.title))}</b><p>${fmt(x(s.text))}</p></li>`).join("")}</ol>
    <h3 style="font-size:26px;margin-top:12px">${esc(x(P.treeHeading))}</h3>
    <div class="tree"><button class="tbtn copy" id="copy" type="button">${esc(x(DATA.ui.copy))}</button><pre>${esc(P.tree.join("\n"))}</pre></div>
    <p class="note">${esc(x(P.treeNote))}</p></section>`;
}

function principles() {
  const P = DATA.principles;
  return head("principios", P.heading) + `<div class="cols">${P.items.map((p) => `<div class="princ"><h3>${esc(x(p.name))}</h3><p>${esc(x(p.text))}</p></div>`).join("")}</div></section>`;
}

function agents() {
  const R = DATA.reference.agents;
  if (!DATA.agents.length) return "";
  return head("agentes", R.heading, R.intro) + `<div class="agents">${DATA.agents.map((a) => `<div class="agent"><h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p>
    <div class="stg">${a.stages.map((s) => `<code>${esc(s.id)}${s.role === "support" ? "*" : ""}</code>`).join("")}</div><div class="note"><code>${esc(a.path)}</code></div></div>`).join("")}</div>
    <p class="note">${esc(x(R.legend))}</p></section>`;
}

function matrix() {
  const M = DATA.matrix, R = DATA.reference.matrix;
  if (!M.rows.length) return "";
  const cell = (r, s) => { const v = r.cells[s]; return `<td class="cell ${v === "executor" ? "ex" : v ? "sp" : ""}">${v === "executor" ? "E" : v ? "A" : ""}</td>`; };
  return head("matriz", R.heading, R.intro) + `<div class="gtable matrix"><table><thead><tr><th>${esc(x(R.agent))}</th>${M.stages.map((s) => `<th class="rot">${esc(s)}</th>`).join("")}</tr></thead><tbody>${
    M.rows.map((r) => `<tr><td><code>${esc(r.agent)}</code></td>${M.stages.map((s) => cell(r, s)).join("")}</tr>`).join("")}</tbody></table></div><p class="note">${esc(x(R.legend))}</p></section>`;
}

function examples() {
  const R = DATA.reference.examples;
  return head("exemplos", R.heading, R.intro) + `<div class="examples">${DATA.examples.map((e) => `<details class="example"><summary>${esc(x(e.name))}<span class="file">${esc(e.file)}</span></summary><pre>${esc(e.body)}</pre></details>`).join("")}</div></section>`;
}

function realExample() {
  const E = DATA.example;
  return head("exemplo", E.heading, E.intro) + `<div class="stats">${E.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(x(s.label))}</span></div>`).join("")}</div></section>`;
}

function gaps() {
  const G = DATA.gaps;
  return head("lacunas", G.heading, G.intro) + `<div class="cols">${G.items.map((g) => `<div class="gap"><h3>${esc(x(g.name))}</h3><p>${fmt(x(g.text))}</p></div>`).join("")}</div></section>`;
}

function render() {
  const U = DATA.ui;
  const html = [hero(), layers(), blocks(), line(), agents(), matrix(), examples(), gates(), boilerplate(), principles(), realExample(), gaps(), `<p class="foot">${esc(x(U.foot))}</p>`];
  document.getElementById("app").innerHTML = html.join("");
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  document.getElementById("lang-pt").setAttribute("aria-pressed", String(lang === "pt"));
  document.getElementById("lang-en").setAttribute("aria-pressed", String(lang === "en"));
  document.getElementById("theme").textContent = x(U.theme[theme]);
  const c = document.getElementById("copy");
  if (c) c.onclick = () => {
    const done = () => { c.textContent = x(U.copied); setTimeout(() => { c.textContent = x(U.copy); }, 1400); };
    try { navigator.clipboard.writeText(DATA.boilerplate.tree.join("\n")).then(done, selectTree); } catch (e) { selectTree(); }
  };
}

function selectTree() {
  const pre = document.querySelector(".tree pre");
  if (!pre) return;
  const r = document.createRange(); r.selectNodeContents(pre);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
}

function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

document.getElementById("lang-pt").onclick = () => { lang = "pt"; save("hsf-lang", lang); render(); };
document.getElementById("lang-en").onclick = () => { lang = "en"; save("hsf-lang", lang); render(); };
document.getElementById("theme").onclick = () => {
  theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
  save("hsf-theme", theme); applyTheme(); render();
};
applyTheme();
render();
