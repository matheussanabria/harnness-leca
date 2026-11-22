// @ts-check
// Executive report as Markdown (tools/exec-report.js). The report is read by the user, so its text is in
// Portuguese; the code stays in English. Pure: receives the collected data, returns a string.

const STATUS_LABEL = { concluida: "Concluída", aceita: "Aceita", implementada: "Implementada", planejada: "Planejada", "em-andamento": "Em andamento" };

/** @param {string} status */
const statusLabel = (status) => STATUS_LABEL[/** @type {keyof typeof STATUS_LABEL} */ (status)] || status || "sem status";

/** @param {string} text */
const cell = (text) => String(text || "").replace(/\|/g, "/").replace(/\r?\n/g, " ");

/**
 * @param {{
 *   since: string, until: string,
 *   merges: import("./collect").Merge[],
 *   stories: Map<string, import("./collect").Story | null>,
 *   totals: { commits: number, insertions: number, deletions: number },
 * }} data
 */
function renderReport({ since, until, merges, stories, totals }) {
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
  out.push(`- ${pendingCount} pendências registradas nas histórias (lista abaixo).`, "");

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
  if (!any) out.push("- Nenhuma registrada.");
  out.push("");

  const divergences = known.filter((s) => s && s.divergences.length);
  if (divergences.length) {
    out.push("## Decisões que mudaram o plano", "");
    for (const s of divergences) if (s) for (const d of s.divergences) out.push(`- **${s.id}:** ${cell(d)}`);
    out.push("");
  }

  const missing = ids.filter((id) => !stories.get(id));
  if (missing.length) out.push(`> Histórias citadas em merges sem arquivo encontrado: ${missing.join(", ")}.`, "");
  out.push(`_Gerado por \`node tools/exec-report.js --since ${since} --until ${until}\` a partir dos merges da \`main\` e das seções de evidência das histórias._`);
  return out.join("\n") + "\n";
}

module.exports = { renderReport, statusLabel };
