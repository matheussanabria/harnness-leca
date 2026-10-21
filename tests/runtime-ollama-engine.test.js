// @ts-check
// Testes — Caminho de motor local (Ollama) na extração de artefatos (EP-08.01)

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(".");
const RUNNER_PATH = path.join(ROOT, "tools", "lib", "runtime", "ollama-cli.js");

// A inferência local exige RAM livre: o perfil de memória é fixado como apto para
// que o resultado não dependa da carga da máquina em que a suíte roda.
const hwPath = require.resolve("../tools/lib/hia/hardware-profiler");
const realHardware = require(hwPath);
require.cache[hwPath] = {
  id: hwPath,
  filename: hwPath,
  loaded: true,
  exports: {
    ...realHardware,
    getMemoryProfile: () => ({ ...realHardware.getMemoryProfile(), freeMb: 8192, safeForInference: true }),
    getHardwareSnapshot: () => ({ ...realHardware.getHardwareSnapshot(), viable: true, alert: undefined }),
  },
};

const { generateText, generateStructured } = require("../tools/lib/runtime/ollama-client");

test("motor local - generateText devolve texto livre sem exigir JSON", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let sentBody = null;
    // @ts-ignore
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          model: "qwen3.5:4b",
          response: "## Memórias\n- fato durável",
          total_duration: 900000000,
          prompt_eval_count: 30,
          eval_count: 12,
        }),
      };
    };

    const res = await generateText({ prompt: "extraia em markdown" });
    assert.equal(res.raw, "## Memórias\n- fato durável");
    assert.equal(res.metrics.tokensPrompt, 30);
    assert.equal(res.metrics.tokensGenerated, 12);
    // Sem `format: json` — o fluxo de artefatos pede Markdown.
    assert.equal(sentBody.format, undefined);
    assert.equal(sentBody.stream, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("motor local - generateStructured mantém o formato JSON", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let sentBody = null;
    // @ts-ignore
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          model: "qwen3.5:4b",
          response: JSON.stringify({ decisoes: ["manter local-first"] }),
          total_duration: 800000000,
        }),
      };
    };

    const res = await generateStructured({ prompt: "extraia o json" });
    assert.deepEqual(res.data, { decisoes: ["manter local-first"] });
    assert.equal(sentBody.format, "json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("motor local - ask() com engine ollama devolve texto do daemon local", async (t) => {
  const { spawn } = require("node:child_process");

  // O daemon fake roda em processo separado: ask() é síncrono e bloquearia o event loop
  // do próprio teste, impedindo que um servidor in-process respondesse.
  const daemon = spawn(
    process.execPath,
    [
      "-e",
      `const http=require("http");const s=http.createServer((req,res)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({model:"qwen3.5:4b",response:"## Regras e prefer\\u00eancias\\n- sempre rodar o check",total_duration:400000000}));});});s.listen(0,"127.0.0.1",()=>{console.log("PORT="+s.address().port);});`,
    ],
    { stdio: ["ignore", "pipe", "inherit"] }
  );

  const port = await new Promise((resolve, reject) => {
    let buf = "";
    daemon.stdout.on("data", (c) => {
      buf += c;
      const m = buf.match(/PORT=(\d+)/);
      if (m) resolve(m[1]);
    });
    daemon.on("error", reject);
    setTimeout(() => reject(new Error("daemon fake não subiu")), 10000);
  });

  const previousUrl = process.env.OLLAMA_URL;
  const previousMin = process.env.OLLAMA_MIN_FREE_MB;
  process.env.OLLAMA_URL = `http://127.0.0.1:${port}`;
  process.env.OLLAMA_MIN_FREE_MB = "64";

  try {
    const { ask } = require("../tools/lib/llm");
    const out = ask({ engine: "ollama", model: "qwen3.5:4b", prompt: "extrair artefatos" });
    assert.match(out, /## Regras e prefer/);
  } catch (err) {
    if (/Mem[oó]ria RAM livre insuficiente/.test(String(err.message))) {
      t.skip("RAM livre insuficiente para inferência local neste ambiente");
      return;
    }
    throw err;
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = previousUrl;
    if (previousMin === undefined) delete process.env.OLLAMA_MIN_FREE_MB;
    else process.env.OLLAMA_MIN_FREE_MB = previousMin;
    daemon.kill();
  }
});

test("motor local - runner da CLI lê o prompt no stdin e devolve a resposta", async (t) => {
  const http = require("node:http");
  const { spawn } = require("node:child_process");

  let receivedBody = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      receivedBody = JSON.parse(body || "{}");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          model: "qwen3.5:4b",
          response: "## Decisões\n- usar ollama local",
          total_duration: 500000000,
          prompt_eval_count: 10,
          eval_count: 5,
        })
      );
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [RUNNER_PATH, "--model", "qwen3.5:4b"], {
        env: { ...process.env, OLLAMA_URL: `http://127.0.0.1:${port}`, OLLAMA_MIN_FREE_MB: "64" },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (c) => (stdout += c));
      child.stderr.on("data", (c) => (stderr += c));
      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.stdin.end("extrair artefatos em markdown");
    });

    if (result.code !== 0 && /Mem[oó]ria RAM livre insuficiente/.test(result.stderr)) {
      t.skip("RAM livre insuficiente para inferência local neste ambiente");
      return;
    }

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /## Decisões/);
    assert.equal(receivedBody.format, undefined, "fluxo de artefatos não deve forçar JSON");
    assert.equal(receivedBody.stream, false);
  } finally {
    server.close();
  }
});
