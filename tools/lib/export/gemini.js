// @ts-check
// Destino Gemini / Antigravity: Knowledge Item (memória curada) e regra global.

const path = require("path");
const { ROOT } = require("../root");

const LEGACY_ARTIFACTS = ["regras.md", "conversas-indice.md"];
// Cabeçalhos de arquivos gerados antes de o marcador harness:generated existir.
const LEGACY_HEADERS = [/^# Mem[oó]rias e Arquitetura: /, /"id":\s*"ki-projeto-/, /^# Harness Leca: Conhecimento Global/];

function planGeminiProject(data, targets) {
  const kiSlug = `ki-projeto-${data.slug}`;
  const kiDir = path.join(targets.geminiKnowledgeDir, kiSlug);
  const now = new Date().toISOString();
  const root = targets.geminiKnowledgeDir;

  const items = Array.isArray(data.items) ? data.items : [];
  const artifacts = ["artifacts/memory.md"];
  const writes = [];

  // Gera metadata.summary com base nas descrições de user e feedback se houver itens
  let summary = `Memória curada do projeto ${data.slug} preservada pelo Harness Leca (${data.chatsCount} conversas salvas no harness).`;
  const highPrioritySummaries = items
    .filter((e) => e.item && (e.item.meta.type === "user" || e.item.meta.type === "feedback"))
    .map((e) => e.item.meta.description);

  if (highPrioritySummaries.length > 0) {
    summary = `Memória curada (${data.slug}): ` + highPrioritySummaries.slice(0, 3).join("; ");
  }

  // Desacoplamento dos itens individuais em artifacts/items/<tipo>-<name>.md
  for (const entry of items) {
    if (!entry.item) continue;
    const itemMeta = entry.item.meta;
    const itemFileName = `${itemMeta.type}-${itemMeta.name}.md`;
    const relArtifact = `artifacts/items/${itemFileName}`;
    artifacts.push(relArtifact);

    const { serializeItem } = require("../memory/item");
    const itemContent = serializeItem(itemMeta, entry.item.body || "");

    writes.push({
      dest: "gemini",
      kind: "generated",
      root,
      legacy: LEGACY_HEADERS,
      file: path.join(kiDir, "artifacts", "items", itemFileName),
      content: itemContent,
    });
  }

  const metadata = {
    id: kiSlug,
    title: `Projeto: ${data.slug} - Memória curada`,
    summary,
    created_at: now,
    updated_at: now,
    tags: ["harness-leca", data.slug, "memoria", "contexto"],
    references: [path.join(ROOT, "projects", data.slug)],
    artifacts,
  };

  writes.push(
    { dest: "gemini", kind: "generated", root, legacy: LEGACY_HEADERS, file: path.join(kiDir, "metadata.json"), content: JSON.stringify(metadata, null, 2) + "\n" },
    {
      dest: "gemini", kind: "generated", root, legacy: LEGACY_HEADERS,
      file: path.join(kiDir, "artifacts", "memory.md"),
      content: `# Memórias e Arquitetura: ${data.slug}\n\n${data.memoryMd || "Nenhuma memória formal gravada ainda."}\n`,
    }
  );

  const legacy = LEGACY_ARTIFACTS.map((f) => ({ dest: "gemini", root, file: path.join(kiDir, "artifacts", f) }));
  return { writes, legacy };
}

/** Regra global que lista os projetos disponíveis. */
function planGeminiGlobal(overview, targets, today) {
  const list = overview
    .map((p) => `- **${p.slug}**: ${p.chatsCount} conversas salvas no harness-leca. Memória curada em \`ki-projeto-${p.slug}\` e em \`projects/${p.slug}/\`.`)
    .join("\n");
  const content = `# Harness Leca: Conhecimento Global de Projetos
Gerado automaticamente em ${today}. Não editar manualmente.
Este documento registra a lista e o estado dos projetos gerenciados pelo Harness Leca na máquina.

## Projetos Ativos e Memórias Disponíveis:
${list}

## Diretriz de Uso para o Gemini/Antigravity:
Ao trabalhar em qualquer tarefa desses projetos, consulte os Knowledge Items correspondentes ou leia \`projects/<slug>/memory.md\` para respeitar as preferências de código, arquitetura e decisões históricas.
`;
  return {
    dest: "gemini", kind: "generated", root: targets.geminiRulesDir, legacy: LEGACY_HEADERS,
    file: path.join(targets.geminiRulesDir, "harness-projects-overview.md"), content,
  };
}

module.exports = { planGeminiProject, planGeminiGlobal };
