// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { createAtelierAgentLoop } = require("../ui/server/services/atelier-agent-loop.service");

test("atelier-agent-loop: executa múltiplos turnos (plano -> escrita -> conclusão)", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-loop-test-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "proto-loop");
  fs.mkdirSync(protoDir, { recursive: true });
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: "proto-loop", screens: [] }), "utf8");

  const events = [];
  let turnStep = 0;

  // Modelo simulado que planeja no turno 1, escreve no turno 2 e completa no turno 3
  const fakeModel = async (history) => {
    turnStep++;
    if (turnStep === 1) {
      return {
        text: "Iniciando o planejamento...",
        toolCalls: [
          {
            name: "atelier_plan",
            args: { steps: [{ id: "step1", title: "Criar tela de catálogo", status: "in_progress" }] },
          },
        ],
      };
    }
    if (turnStep === 2) {
      return {
        text: "Gerando a tela...",
        toolCalls: [
          {
            name: "atelier_write_screen",
            args: { screenId: "catalogo", htmlContent: "<div class='vitrine'><h1>Produtos</h1></div>" },
          },
        ],
      };
    }
    return {
      text: "Finalizando protótipo.",
      toolCalls: [
        {
          name: "atelier_complete",
          args: { summary: "Catálogo criado com sucesso.", changedFiles: ["screens/catalogo.html"] },
        },
      ],
    };
  };

  const loop = createAtelierAgentLoop({
    projectDir: tmpDir,
    protoId: "proto-loop",
    modelTurn: fakeModel,
  });

  const res = await loop.run("Crie uma tela de catálogo de produtos", {
    onEvent: (e) => events.push(e),
  });

  assert.equal(res.status, "completed");
  assert.equal(res.turnCount, 3);

  // Valida que os arquivos em disco foram gerados
  const planFile = path.join(protoDir, "scratch", "plan.json");
  assert.ok(fs.existsSync(planFile));

  const screenFile = path.join(protoDir, "screens", "catalogo.html");
  assert.ok(fs.existsSync(screenFile));
  const html = fs.readFileSync(screenFile, "utf8");
  assert.ok(html.includes("Produtos"));

  // Valida eventos emitidos
  assert.ok(events.some((e) => e.type === "tool_calls"));
  assert.ok(events.some((e) => e.type === "complete"));
});

test("atelier-agent-loop: suspende execução quando ferramenta pede intervenção (atelier_ask_user)", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-loop-yield-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "proto-yield");
  fs.mkdirSync(protoDir, { recursive: true });

  const fakeModelAsk = async () => ({
    text: "Preciso de um esclarecimento sobre o fluxo.",
    toolCalls: [
      {
        name: "atelier_ask_user",
        args: { question: "Deseja autenticação na primeira tela?", options: ["Sim", "Não"] },
      },
    ],
  });

  const loop = createAtelierAgentLoop({
    projectDir: tmpDir,
    protoId: "proto-yield",
    modelTurn: fakeModelAsk,
  });

  const res = await loop.run("Inicie o fluxo de checkout");
  assert.equal(res.status, "yielded");
  assert.equal(res.controlPayload.type, "question");
  assert.equal(res.controlPayload.question, "Deseja autenticação na primeira tela?");
  assert.equal(loop.isRunning(), false);
});

test("atelier-agent-loop: aborta respeitando AbortSignal", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-loop-abort-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "proto-abort");
  fs.mkdirSync(protoDir, { recursive: true });

  const ac = new AbortController();
  ac.abort();

  const loop = createAtelierAgentLoop({
    projectDir: tmpDir,
    protoId: "proto-abort",
    modelTurn: async () => ({ text: "Nunca deve rodar" }),
  });

  const res = await loop.run("Comando cancelado", { signal: ac.signal });
  assert.equal(res.status, "aborted");
});
