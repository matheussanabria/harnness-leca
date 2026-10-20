// @ts-check
const fs = require("fs");
const path = require("path");
const { paths } = require("./storage");

function totals(state) {
  const stories = Object.values(state.stories);
  return {
    all: stories.length,
    done: stories.filter((item) => item.status === "done").length,
    active: stories.filter((item) => ["claimed", "in_progress", "review"].includes(item.status)).length,
    blocked: stories.filter((item) => item.status === "blocked").length,
  };
}

function providerTable(state) {
  return Object.entries(state.providers).map(([id, provider]) => {
    const owned = Object.values(state.stories).filter((item) => item.owner === id && item.status !== "done").length;
    return `| ${id} | ${provider.enabled ? "ativo" : "inativo"} | ${owned} | ${provider.transport} | ${provider.reason} |`;
  }).join("\n");
}

function storyTable(state, filter) {
  const items = Object.values(state.stories).filter(filter);
  if (!items.length) return "Nenhum item.";
  return [
    "| Historia | Estado | Responsavel | Lease | Titulo |",
    "|---|---|---|---|---|",
    ...items.map((item) => `| ${item.id} | ${item.status} | ${item.owner || "-"} | ${item.lease?.expiresAt || "-"} | ${item.title} |`),
  ].join("\n");
}

function renderStatus(state) {
  const count = totals(state);
  return `# Coordenacao automatica: ${state.project}

> Gerado automaticamente. Nao editar manualmente. Revisao ${state.revision}, ${state.updatedAt}.

## Resumo

- Concluidas: ${count.done}/${count.all}
- Em execucao: ${count.active}
- Bloqueadas: ${count.blocked}

## Provedores

| Provedor | Politica | Pendencias atribuidas | Transporte | Motivo |
|---|---|---:|---|---|
${providerTable(state)}

## Trabalho ativo

${storyTable(state, (item) => ["claimed", "in_progress", "review", "blocked"].includes(item.status))}

## Proximas pendencias por responsavel

${storyTable(state, (item) => ["planned", "ready"].includes(item.status))}
`;
}

function renderContext(state) {
  const unread = state.messages.filter((message) => !message.readAt);
  const active = Object.values(state.stories).filter((item) => ["claimed", "in_progress", "blocked", "review"].includes(item.status));
  return `# Contexto de coordenacao

> Projecao automatica da revisao ${state.revision}. Fonte: \`projects/${state.project}/coordination/state.json\`.

## Protocolo obrigatorio

1. Consulte sua caixa: \`node tools/coordination.js inbox --provider <provedor> --project ${state.project}\`.
2. Antes de editar: \`node tools/coordination.js claim <EP-xx.yy> --provider <provedor> --project ${state.project}\`.
3. Ao iniciar, use \`start\`; durante trabalho longo, use \`heartbeat\`.
4. Finalize com \`complete --evidence <arquivo-ou-comando>\` ou transfira com \`handoff --to <provedor> --message <texto>\`.

Provedores ativos: ${Object.entries(state.providers).filter(([, item]) => item.enabled).map(([id]) => id).join(", ")}.
Provedores cadastrados e inativos: ${Object.entries(state.providers).filter(([, item]) => !item.enabled).map(([id]) => id).join(", ")}.

## Trabalho ativo

${active.length ? active.map((item) => `- ${item.id}: ${item.status}, responsavel ${item.owner}.`).join("\n") : "- Nenhum."}

## Mensagens nao lidas

${unread.length ? unread.map((item) => `- [${item.to}] ${item.storyId}: ${item.message} (de ${item.from})`).join("\n") : "- Nenhuma."}
`;
}

function renderInbox(state, provider) {
  const policy = state.providers[provider];
  const messages = state.messages.filter((item) => item.to === provider && !item.readAt);
  const owned = Object.values(state.stories).filter((item) => item.owner === provider && item.status !== "done");
  return `# Caixa de entrada: ${provider}

> Gerada automaticamente na revisao ${state.revision}. Provedor ${policy.enabled ? "ativo" : "inativo"}.

## Mensagens nao lidas

${messages.length ? messages.map((item) => `- ${item.storyId || "geral"}: ${item.message} (de ${item.from}, ${item.createdAt})`).join("\n") : "- Nenhuma."}

## Trabalho atribuido

${owned.length ? owned.map((item) => `- ${item.id}: ${item.status} — ${item.title}`).join("\n") : "- Nenhum."}
`;
}

function project(root, project, state) {
  const target = paths(root, project);
  fs.mkdirSync(path.dirname(target.context), { recursive: true });
  fs.mkdirSync(target.inbox, { recursive: true });
  fs.writeFileSync(target.status, renderStatus(state), "utf8");
  fs.writeFileSync(target.context, renderContext(state), "utf8");
  for (const provider of Object.keys(state.providers)) {
    fs.writeFileSync(path.join(target.inbox, `${provider}.md`), renderInbox(state, provider), "utf8");
  }
}

module.exports = { totals, renderStatus, renderContext, renderInbox, project };
