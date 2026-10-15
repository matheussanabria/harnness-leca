// Fixtures mínimas de entrada dos 4 importadores, montadas em disco pelos testes (nada disto vai para o repositório
// como arquivo de dados). Usadas pelo golden master, pelos testes de run() em memória e pelo teste do sync.
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SLUG = "demo";
const jsonl = (events) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

// Dados que DEVEM sumir na redação (e-mail, token e CPF), presentes em todas as fixtures.
const LEAKS = ["ana@exemplo.com", "abcd1234efgh5678", "123.456.789-09"];
const LEAK_TEXT = `meu e-mail é ana@exemplo.com, token=abcd1234efgh5678 e cpf 123.456.789-09`;

// ---------- fixtures: uma por importador, com um parâmetro de título para testar a renomeação ----------

const IMPORTERS = {
  "claude-code": {
    script: "import-claude-code-chats.js",
    args: () => ["--from", "c--fixture", "--project", SLUG],
    make(home, title) {
      const events = [
        { type: "ai-title", aiTitle: title },
        { type: "user", timestamp: "2026-01-10T10:00:00.000Z", cwd: "C:/git/exemplo",
          message: { content: `<system-reminder>ruído do harness</system-reminder>Olá, ${LEAK_TEXT}` } },
        { type: "assistant", timestamp: "2026-01-10T10:00:05.000Z", message: { id: "m1", content: [
          { type: "thinking", thinking: "preciso ler o arquivo" },
          { type: "text", text: "Vou ler o arquivo." },
          { type: "tool_use", id: "t1", name: "Read", input: { file_path: "a.txt" } },
        ] } },
        { type: "user", timestamp: "2026-01-10T10:00:06.000Z", message: { content: [
          { type: "tool_result", tool_use_id: "t1", content: "conteúdo\n:::fim\nlinha" },
        ] } },
        { type: "assistant", timestamp: "2026-01-10T10:00:07.000Z", message: { id: "m2", content: [
          { type: "tool_use", id: "t2", name: "Bash", input: { command: "ls | grep x" } },
        ] } },
        { type: "user", timestamp: "2026-01-10T10:00:08.000Z", message: { content: [
          { type: "tool_result", tool_use_id: "t2", content: "falhou", is_error: true },
        ] } },
        { type: "assistant", timestamp: "2026-01-10T10:00:09.000Z", message: { id: "m3", content: [{ type: "text", text: "Pronto." }] } },
        { type: "user", timestamp: "2026-01-10T10:01:00.000Z", message: { content: [
          { type: "image", source: {} }, { type: "text", text: "e esta imagem?" },
        ] } },
        { type: "assistant", isSidechain: true, timestamp: "2026-01-10T10:02:00.000Z", message: { id: "s1", content: [{ type: "text", text: "subagente, não entra" }] } },
      ];
      write(path.join(home, ".claude", "projects", "c--fixture", "11111111-aaaa-4bbb-8ccc-222222222222.jsonl"), jsonl(events));
    },
  },

  gemini: {
    script: "import-gemini-chats.js",
    args: () => ["--from", "cccccccc", "--project", SLUG],
    make(home, title) {
      const steps = [
        { type: "USER_INPUT", created_at: "2026-02-01T09:00:00Z",
          content: `<USER_REQUEST>${title} @[C:\\git\\57multimarcas\\a.ts]\n${LEAK_TEXT}</USER_REQUEST><ADDITIONAL_METADATA>Active Document: C:\\git\\57multimarcas\\a.ts (typescript)</ADDITIONAL_METADATA>` },
        { type: "PLANNER_RESPONSE", created_at: "2026-02-01T09:00:05Z", thinking: "vou abrir o arquivo",
          tool_calls: [{ name: "view_file", args: { AbsolutePath: "C:\\git\\57multimarcas\\a.ts", toolSummary: "Lendo a.ts" } }], content: "" },
        { type: "VIEW_FILE", created_at: "2026-02-01T09:00:06Z", content: "export const a = 1;\n:::fim" },
        { type: "PLANNER_RESPONSE", created_at: "2026-02-01T09:00:07Z",
          tool_calls: [{ name: "run_command", args: { CommandLine: "npm test", Cwd: "C:\\git\\57multimarcas" } }], content: "" },
        { type: "RUN_COMMAND", created_at: "2026-02-01T09:00:08Z", status: "ERROR", content: "falhou" },
        { type: "PLANNER_RESPONSE", created_at: "2026-02-01T09:00:09Z", content: "Revisão concluída." },
      ];
      write(path.join(home, ".gemini", "antigravity-ide", "brain", "cccccccc-1111-4222-8333-444444444444", ".system_generated", "logs", "transcript.jsonl"), jsonl(steps));
    },
  },

  opencode: {
    script: "import-opencode-chats.js",
    args: () => ["--from", "ses_abc", "--project", SLUG],
    make(home, title) {
      const file = path.join(home, ".local", "share", "opencode", "opencode.db");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.rmSync(file, { force: true });
      const db = new DatabaseSync(file);
      db.exec(`CREATE TABLE session(id TEXT, title TEXT, directory TEXT, time_created INTEGER, time_updated INTEGER, agent TEXT, model TEXT, parent_id TEXT);
               CREATE TABLE message(id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
               CREATE TABLE part(id TEXT, message_id TEXT, time_created INTEGER, data TEXT);`);
      const t0 = Date.UTC(2026, 0, 10, 10, 0, 0);
      db.prepare("INSERT INTO session VALUES (?,?,?,?,?,?,?,?)").run("ses_abc123def456ghi", title, "C:/git/exemplo", t0, t0 + 60000, "build", "x", null);
      db.prepare("INSERT INTO session VALUES (?,?,?,?,?,?,?,?)").run("ses_abcSUBAGENT0001", "subagente", "C:/git/exemplo", t0, t0, "task", "x", "ses_abc123def456ghi");
      const msg = db.prepare("INSERT INTO message VALUES (?,?,?,?)"), part = db.prepare("INSERT INTO part VALUES (?,?,?,?)");
      msg.run("m1", "ses_abc123def456ghi", t0 + 1, JSON.stringify({ role: "user" }));
      part.run("p1", "m1", t0 + 1, JSON.stringify({ type: "text", text: `Olá, ${LEAK_TEXT}` }));
      part.run("p2", "m1", t0 + 2, JSON.stringify({ type: "file", filename: "tela.png" }));
      msg.run("m2", "ses_abc123def456ghi", t0 + 10, JSON.stringify({ role: "assistant" }));
      part.run("p3", "m2", t0 + 10, JSON.stringify({ type: "step-start" }));
      part.run("p4", "m2", t0 + 11, JSON.stringify({ type: "reasoning", text: "preciso ler o arquivo" }));
      part.run("p5", "m2", t0 + 12, JSON.stringify({ type: "text", text: "Vou ler o arquivo." }));
      part.run("p6", "m2", t0 + 13, JSON.stringify({ type: "tool", tool: "read", state: { status: "completed", input: { filePath: "a.txt" }, output: "conteúdo\n:::fim" } }));
      part.run("p7", "m2", t0 + 14, JSON.stringify({ type: "tool", tool: "bash", state: { status: "error", input: { command: "ls | grep x" }, output: "falhou" } }));
      msg.run("m3", "ses_abc123def456ghi", t0 + 20, JSON.stringify({ role: "assistant" }));
      part.run("p8", "m3", t0 + 20, JSON.stringify({ type: "text", text: "Pronto." }));
      msg.run("m4", "ses_abcSUBAGENT0001", t0 + 30, JSON.stringify({ role: "assistant" }));
      part.run("p9", "m4", t0 + 30, JSON.stringify({ type: "text", text: "não entra" }));
      db.close();
    },
  },

  "claude-ai": {
    script: "import-claude-ai-chats.js",
    args: (home) => ["--export", path.join(home, "export"), "--project", SLUG, "--match", ".*"],
    make(home, title) {
      const conversations = [{
        uuid: "aaaaaaaa-1111-4222-8333-444444444444", name: title, summary: "",
        created_at: "2026-03-05T12:00:00Z", updated_at: "2026-03-05T12:30:00Z",
        chat_messages: [
          { sender: "human", content: [{ type: "text", text: `<system-reminder>x</system-reminder>Oi, ${LEAK_TEXT}` }], attachments: [{ file_name: "doc.pdf" }] },
          { sender: "assistant", content: [
            { type: "thinking", thinking: "hmm" }, { type: "text", text: "Olá!" },
            { type: "tool_use", name: "web_search", input: { query: "algo" } },
            { type: "tool_result", content: [{ type: "text", text: "achou\n:::" }] },
          ] },
        ],
      }];
      const design = {
        uuid: "bbbbbbbb-1111-4222-8333-444444444444", title: "Chat de design", project: { name: "Framework de componentes" },
        created_at: "2026-03-06T08:00:00Z", updated_at: "2026-03-06T08:10:00Z",
        messages: [
          { role: "user", content: { role: "user", content: "Crie um botão", attachments: [{ type: "image", name: "ref.png" }] } },
          { role: "assistant", content: { role: "assistant", content: "feito", contentBlocks: [
            { type: "text", text: "Pronto, criei." },
            { type: "tool_call", toolCall: { name: "write", input: { path: "b.html" }, result: "ok" } },
          ] } },
        ],
      };
      write(path.join(home, "export", "conversations.json"), JSON.stringify(conversations));
      write(path.join(home, "export", "design_chats", "bbbbbbbb-1111-4222-8333-444444444444.json"), JSON.stringify(design));
    },
  },
};

module.exports = { SLUG, IMPORTERS, LEAKS, LEAK_TEXT, write };
