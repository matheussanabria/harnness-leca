// @ts-check
// Executive report as Markdown (tools/exec-report.js). The report is read by the user, so its text is in
// Portuguese; the code stays in English. Pure: receives the collected data, returns a string.

const STATUS_LABEL = { concluida: "Concluída", aceita: "Aceita", implementada: "Implementada", planejada: "Planejada", "em-andamento": "Em andamento" };

/** @param {string} status */
const statusLabel = (status) => STATUS_LABEL[/** @type {keyof typeof STATUS_LABEL} */ (status)] || status || "sem status";

/** @param {string} text */
const cell = (text) => String(text || "").replace(/\|/g, "/").replace(/\r?\n/g, " ");

/**
 * One executive-log entry as a bullet. The log is written in Portuguese, like the stories, so the report reads as one text.
 * @param {any} e
 */
function logBullet(e) {
  const where = e.epic ? `, ${e.epic}${e.story ? ` ${e.story}` : ""}` : "";
  const proof = e.evidence && e.evidence.length ? ` Evidências: ${e.evidence.map((/** @type {string} */ x) => `\`${x}\``).join(", ")}.` : "";
  return `- **${e.id}** (${e.date}${where}) ${cell(e.title)}. ${cell(e.summary)}${proof}`;
}

/** @typedef {{ entries: any[], open: any[] }} LogData */
/** @typedef {{ slug: string, story: string, route: string, done: number, skipped: number, open: number, evidenceFiles: number }} DossierRow */

/**
 * Sections fed by docs/executive/log.jsonl and the feature dossiers: decisions, findings and corrections, approvals and
 * quality. Empty when there is nothing to say, so a period without log entries reads exactly as before.
 * @param {LogData | null | undefined} log @param {DossierRow[]} dossiers
 */
function logSections(log, dossiers) {
  const out = [];
  const entries = log ? log.entries : [];
  const groups = /** @type {[string[], string][]} */ ([
    [["decision"], "Decisões"],
    [["finding", "correction"], "Achados e correções (inclusive erros nossos)"],
    [["approval"], "Aprovações"],
  ]);
  for (const [kinds, heading] of groups) {
    const items = entries.filter((e) => kinds.includes(e.kind));
    if (items.length) out.push(`## ${heading}`, "", ...items.map(logBullet), "");
  }
  const withMetrics = entries.filter((e) => e.metrics);
  if (withMetrics.length || dossiers.length) {
    out.push("## Qualidade", "");
    if (withMetrics.length) {
      const names = [...new Set(withMetrics.flatMap((e) => Object.keys(e.metrics)))];
      out.push(`| Data | Registro | ${names.join(" | ")} |`, `|---|---|${names.map(() => "---").join("|")}|`);
      for (const e of withMetrics) out.push(`| ${e.date} | ${e.id} ${cell(e.title)} | ${names.map((n) => (n in e.metrics ? e.metrics[n] : "")).join(" | ")} |`);
      out.push("");
    }
    if (dossiers.length) {
      out.push("| Dossiê | História | Rota | Etapas feitas | Dispensadas (com motivo) | Abertas | Evidências |", "|---|---|---|---|---|---|---|");
      for (const d of dossiers) out.push(`| ${d.slug} | ${d.story} | ${d.route} | ${d.done} | ${d.skipped} | ${d.open} | ${d.evidenceFiles} |`);
      out.push("");
    }
  }
  return out;
}

/**
 * @param {{
 *   since: string, until: string,
 *   merges: import("./collect").Merge[],
 *   stories: Map<string, import("./collect").Story | null>,
 *   totals: { commits: number, insertions: number, deletions: number },
 *   log?: LogData | null, dossiers?: DossierRow[],
 * }} data
 */
function renderReport({ since, until, merges, stories, totals, log = null, dossiers = [] }) {
  const storyMerges = merges.filter((m) => m.kind === "story");
  const ids = [...new Set(storyMerges.flatMap((m) => m.stories))];
  const known = ids.map((id) => stories.get(id)).filter(Boolean);
  const delivered = known.filter((s) => s && /implementada|concluida|aceita/.test(s.status));
  const planned = known.filter((s) => s && /planejada/.test(s.status));
  const epics = [...new Set(merges.map((m) => m.epic).filter(Boolean))].sort();

  const out = [];
  out.push(`# Relatório executivo: ${since} a ${until}`, "");
  out.push("## Resumo", "");
  out.push(`- **${delivered.length} histórias entregues** e ${planned.length} planejadas, em ${epics.length} épicos (${epics.join(", ") || "nenhum"}).`);
  out.push(`- ${merges.length} merges na \`main\`, ${totals.commits} commits, +${totals.insertions} / -${totals.deletions} linhas.`);
  const pendingCount = known.reduce((n, s) => n + (s && !/planejada/.test(s.status) ? s.pending.length + s.openCriteria.length : 0), 0);
  const closedWithOpen = known.filter((s) => s && /concluida|aceita/.test(s.status) && s.openCriteria.length);
  if (closedWithOpen.length) out.push(`- Atenção: ${closedWithOpen.length} histórias marcadas como concluídas ainda têm critérios desmarcados (${closedWithOpen.map((s) => s && s.id).join(", ")}).`);
  out.push(`- ${pendingCount} pendências registradas nas histórias (lista abaixo).`);
  if (log) {
    const n = (/** @type {string[]} */ kinds) => log.entries.filter((e) => kinds.includes(e.kind)).length;
    out.push(`- Registro executivo: ${n(["decision"])} decisões, ${n(["finding", "correction"])} achados e correções, ${n(["approval"])} aprovações; ${log.open.length} itens em aberto.`);
  }
  if (dossiers.length) {
    const sum = (/** @type {"done"|"skipped"|"open"} */ k) => dossiers.reduce((acc, d) => acc + d[k], 0);
    out.push(`- Processo: ${dossiers.length} dossiês, ${sum("done")} etapas feitas, ${sum("skipped")} dispensadas com motivo, ${sum("open")} abertas.`);
  }
  out.push("");

  out.push("## Entregas por épico", "");
  for (const epic of epics) {
    const rows = storyMerges.filter((m) => m.epic === epic);
    const epicOnly = merges.filter((m) => m.epic === epic && m.kind === "epic");
    out.push(`### ${epic}`, "");
    if (rows.length) {
      // One row per story: a story merged twice (a fix after the first merge) keeps its latest merge.
      /** @type {Map<string, import("./collect").Merge>} */
      const latest = new Map();
      for (const m of rows) for (const id of m.stories) latest.set(id, m);
      out.push("| História | O que é | Situação | Data | Merge |", "|---|---|---|---|---|");
      for (const [id, m] of latest) {
        const s = stories.get(id);
        out.push(`| ${id} | ${cell(s ? s.title : m.subject.split(":").slice(1).join(":").trim())} | ${statusLabel(s ? s.status : "")} | ${m.date} | \`${m.hash}\` |`);
      }
      out.push("");
    }
    for (const m of epicOnly) out.push(`- ${m.date}: ${cell(m.subject)} (\`${m.hash}\`)`);
    if (epicOnly.length) out.push("");
  }

  const others = merges.filter((m) => m.kind === "other");
  if (others.length) {
    out.push("## Outras entregas (correções e ferramentas)", "");
    for (const m of others) out.push(`- ${m.date}: ${cell(m.subject)} (\`${m.hash}\`)`);
    out.push("");
  }

  out.push(...logSections(log, dossiers));

  out.push("## Pendências", "");
  let any = false;
  for (const s of known) {
    // A story only planned has every criterion open by definition: that is backlog, not a pending item.
    if (!s || /planejada/.test(s.status) || (!s.pending.length && !s.openCriteria.length)) continue;
    any = true;
    out.push(`- **${s.id} ${cell(s.title)}**`);
    for (const p of s.pending) out.push(`  - ${cell(p)}`);
    for (const c of s.openCriteria) out.push(`  - Critério em aberto: ${cell(c)}`);
  }
  if (log && log.open.length) {
    any = true;
    out.push("- **Itens em aberto do registro executivo**");
    for (const e of log.open) out.push(`  - ${e.id} [${e.kind === "risk" ? "risco" : "pendência"}] ${cell(e.title)}. ${cell(e.summary)}`);
  }
  if (!any) out.push("- Nenhuma registrada.");
  out.push("");

  const divergences = known.filter((s) => s && s.divergences.length);
  if (divergences.length) {
    out.push("## Decisões que mudaram o plano", "");
    for (const s of divergences) if (s) for (const d of s.divergences) out.push(`- **${s.id}:** ${cell(d)}`);
    out.push("");
  }

  const evidence = log ? [...new Set(log.entries.flatMap((e) => e.evidence || []))] : [];
  if (evidence.length) out.push("## Evidências citadas", "", ...evidence.map((x) => `- \`${x}\``), "");

  const missing = ids.filter((id) => !stories.get(id));
  if (missing.length) out.push(`> Histórias citadas em merges sem arquivo encontrado: ${missing.join(", ")}.`, "");
  out.push(`_Gerado por \`node tools/exec-report.js --since ${since} --until ${until}\` a partir dos merges da \`main\` e das seções de evidência das histórias._`);
  return out.join("\n") + "\n";
}

module.exports = { renderReport, statusLabel };
