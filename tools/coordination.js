#!/usr/bin/env node
// @ts-check
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/root");
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const service = require("./lib/coordination/service");
const { totals } = require("./lib/coordination/projection");
const flow = require("./lib/coordination/flow");

function activeProject() {
  const file = path.join(ROOT, "projects", ".active");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new CliError("projects/.active esta vazio.");
  return lines.at(-1).toLowerCase();
}

function required(name, argv) {
  const value = opt(name, argv);
  if (!value) throw new CliError(`Informe --${name}.`);
  return value;
}

function input(command, storyId, argv) {
  const provider = required("provider", argv);
  const leaseMinutes = Number(opt("lease-minutes", argv) || 120);
  const common = { provider, storyId, eventId: opt("event-id", argv) };
  if (["claim", "start", "heartbeat"].includes(command)) {
    const types = { claim: "story.claimed", start: "story.started", heartbeat: "story.heartbeat" };
    return { ...common, type: types[command], payload: { leaseMinutes } };
  }
  if (command === "complete") return { ...common, type: "story.completed", payload: { evidence: required("evidence", argv) } };
  if (command === "block") return { ...common, type: "story.blocked", payload: { reason: required("reason", argv) } };
  if (command === "handoff") return { ...common, type: "handoff.created", payload: { to: required("to", argv), message: required("message", argv) } };
  if (command === "notify") return { ...common, type: "message.sent", payload: { to: required("to", argv), message: required("message", argv) } };
  throw new CliError(`Comando desconhecido: ${command}`);
}

/** claim --worktree opens the story worktree; complete checks the recorded one for committed work. */
function prepare(command, project, storyId, argv, base) {
  const built = input(command, storyId, argv);
  const provider = built.provider;
  if (command === "claim" && flag("worktree", argv)) {
    const worktree = flow.openWorktree(ROOT, provider, storyId, base);
    built.payload = { ...built.payload, worktree: worktree.dir, branch: worktree.branch };
    return { input: built, worktree };
  }
  if (command === "complete") {
    const recorded = service.get(ROOT, project).stories[storyId]?.worktree;
    if (recorded && !flag("no-commit-check", argv)) {
      const sha = flow.assertCommitted(recorded, base);
      built.payload = { ...built.payload, evidence: `${built.payload.evidence} [commit ${sha} on ${recorded.branch}]` };
    }
  }
  return { input: built, worktree: null };
}

function sprint(project, ids, io) {
  const state = service.get(ROOT, project);
  const { waves, unscoped } = flow.planWaves(state.stories, ids.filter((id) => !id.startsWith("--")));
  waves.forEach((wave, i) => io.log(`Wave ${i + 1} (parallel): ${wave.join(", ")}`));
  if (unscoped.length) io.log(`Warning: no declared file scope (run alone): ${unscoped.join(", ")}. Add owns: [globs] to the story.`);
}

function delegateCommand(project, storyId, argv, io) {
  const story = service.get(ROOT, project).stories[storyId];
  if (!story) throw new CliError(`Historia desconhecida: ${storyId}`);
  if (!story.worktree) throw new CliError(`${storyId} nao tem worktree; use claim --worktree antes.`);
  const result = flow.delegateStory({ root: ROOT, story, worktree: story.worktree, model: opt("model", argv), timeoutMinutes: opt("timeout-min", argv) ? Number(opt("timeout-min", argv)) : undefined });
  io.log(`Delegated to ${result.model}. Review the diff in ${story.worktree.dir} before completing.
${result.answer}`);
}

function printStatus(state, io) {
  const count = totals(state);
  io.log(`${state.project}: revisao ${state.revision}; ${count.done}/${count.all} concluidas; ${count.active} ativas; ${count.blocked} bloqueadas.`);
  for (const [id, provider] of Object.entries(state.providers)) {
    io.log(`- ${id}: ${provider.enabled ? "ativo" : "inativo"} (${provider.reason})`);
  }
}

function run(argv, io = console) {
  const command = argv[0] || "status";
  const project = opt("project", argv) || activeProject();
  try {
    if (command === "init") return printStatus(service.init(ROOT, project), io);
    if (command === "sync") return printStatus(service.sync(ROOT, project), io);
    if (command === "status") return printStatus(service.get(ROOT, project), io);
    if (command === "inbox") {
      const provider = required("provider", argv);
      const messages = service.inbox(ROOT, project, provider, flag("consume", argv));
      if (!messages.length) return io.log(`Caixa de ${provider}: nenhuma mensagem nao lida.`);
      for (const item of messages) io.log(`[${item.storyId || "geral"}] ${item.from} -> ${item.to}: ${item.message}`);
      return;
    }
    if (command === "notify") {
      const result = service.mutate(ROOT, project, input(command, opt("story", argv), argv));
      io.log(`Notificacao registrada para ${result.event.payload.to}.`);
      return;
    }
    if (command === "sprint") return sprint(project, argv.slice(2), io);
    const storyId = argv[1];
    if (!storyId) throw new CliError(`Informe a historia, por exemplo EP-05.02.`);
    if (command === "delegate") return delegateCommand(project, storyId, argv, io);
    const base = opt("base", argv) || "main";
    const prepared = prepare(command, project, storyId, argv, base);
    const result = service.mutate(ROOT, project, prepared.input);
    if (result.changed && prepared.worktree && command === "claim") io.log(`Worktree: ${prepared.worktree.dir} (${prepared.worktree.branch})`);
    io.log(`${storyId}: ${result.changed ? "evento registrado" : "evento ja processado"} (${result.event.type}).`);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(error.message);
  }
}

module.exports = { run };
if (require.main === module) runAsScript(run);
