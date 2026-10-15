// Regras puras do controle de extração (sem arquivos, sem relógio): qual o status de uma conversa e como ela aparece
// na tabela de conversas. Quem lê e grava o estado em disco é tools/lib/state.js.

// status: "nova" (nunca analisada) | "alterada" (mudou depois da análise) | "ok" (em dia)
// prev: o que o estado guardou da conversa (ou undefined); chat: { hash, turnos } lido do .md agora.
// `adopt` indica uma entrada antiga (hash do arquivo inteiro, sem `v`): se o nº de turnos não mudou, o hash novo é
// adotado uma vez e a conversa conta como em dia; quem decide persistir isso é o chamador (state.migrateLegacy).
function statusOf(prev, chat) {
  if (!prev) return { status: "nova", adopt: false };
  if (prev.hash === chat.hash) return { status: "ok", adopt: false };
  if (prev.v !== 2 && prev.turnos === chat.turnos) return { status: "ok", adopt: true };
  return { status: "alterada", adopt: false };
}

// Tabela Markdown de projects/<slug>/context/extraido-conversas.md. `today`: "AAAA-MM-DD" (parâmetro para ser testável).
// rows: o que state.scan devolve. Sem conversas, devolve "".
function renderTable(slug, rows, today) {
  if (!rows.length) return "";
  const n = (s) => rows.filter((r) => r.status === s).length;
  const lines = [
    `# Mapeamento de Conversas e Estado de Extração — ${slug}`,
    "",
    `> Gerado automaticamente por \`tools/extraction-state.js\` em ${today}.`,
    `> **Sugestões para revisão**: nada aqui foi copiado para \`memory.md\` ou \`instructions.md\`.`,
    "",
    `### Resumo`,
    `- **Total de conversas:** ${rows.length}`,
    `- **Em dia (analisadas):** ${n("ok")}`,
    `- **Pendentes (novas):** ${n("nova")}`,
    `- **Alteradas (com novos turnos após análise):** ${n("alterada")}`,
    "",
    "### Como analisar as conversas pendentes",
    "Use a skill `extrair-artefatos` ou execute:",
    "```bash",
    `node tools/extraction-state.js --project ${slug} status`,
    `node tools/extraction-state.js --project ${slug} pending --limit 5`,
    "```",
    "",
    "### Tabela de Mapeamento",
    "",
    "| # | Conversa / Título | Arquivo | Data | Turnos | Status | Analisado por | Analisado em |",
    "|---|---|---|:---:|:---:|:---:|:---:|:---:|",
  ];

  rows.forEach((r, idx) => {
    const isAlt = r.status === "alterada";
    const stIcon = r.status === "ok" ? "✅ Em dia" : isAlt ? "↻ Alterada" : "⏳ Pendente";
    const turnosStr = isAlt && r.antes ? `${r.antes.turnos} → ${r.turnos}` : `${r.turnos}`;
    const por = r.antes ? r.antes.por || "desconhecido" : "-";
    const dataAnalisado = r.antes && r.antes.analisadoEm ? r.antes.analisadoEm.slice(0, 10) : "-";
    const cleanTitle = r.titulo.replace(/\|/g, "\\-").replace(/[\r\n]+/g, " ");
    lines.push(`| ${idx + 1} | [${cleanTitle}](../chats/${r.name}) | \`${r.name}\` | ${r.data || "-"} | ${turnosStr} | ${stIcon} | ${por} | ${dataAnalisado} |`);
  });

  lines.push("");
  return lines.join("\n");
}

module.exports = { statusOf, renderTable };
