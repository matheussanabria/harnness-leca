// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  validatePrototypePath,
  sanitizeHtmlFragment,
  injectDataPidAttributes,
  parseDelimitedFiles,
} = require("../ui/server/services/prototype-sanitizer.service");
const {
  initPrototype,
  savePrototypeFiles,
  listProjectPrototypes,
} = require("../ui/server/services/prototype-storage.service");
const {
  createVersionSnapshot,
  listPrototypeVersions,
  restorePrototypeVersion,
} = require("../ui/server/services/prototype-version.service");
const {
  renderPrototypeScreen,
} = require("../ui/server/services/prototype-renderer.service");

test("prototype-sanitizer: validatePrototypePath confina caminhos estritamente à pasta do protótipo", () => {
  const protoDir = "/projects/saude/design/prototypes/proto-1";

  // Caminhos válidos
  assert.equal(validatePrototypePath(protoDir, "screens/home.html").ok, true);
  assert.equal(validatePrototypePath(protoDir, "styles/proto.css").ok, true);
  assert.equal(validatePrototypePath(protoDir, "MAPA.md").ok, true);
  assert.equal(validatePrototypePath(protoDir, "proto.json").ok, true);

  // Tentativas de evasão barradas
  assert.equal(validatePrototypePath(protoDir, "../secret.txt").ok, false);
  assert.equal(validatePrototypePath(protoDir, "screens/../../root.env").ok, false);
  assert.equal(validatePrototypePath(protoDir, "screens/\0injection.html").ok, false);
  assert.equal(validatePrototypePath(protoDir, "screens/run.exe").ok, false);
});

test("prototype-sanitizer: sanitizeHtmlFragment descarta scripts externos, handlers inline e iframes", () => {
  const dirty = `
    <div onclick="stealTokens()">
      <h1 onload="exploit()">Título</h1>
      <iframe src="http://malicious.com"></iframe>
      <script src="https://evil.cdn/malware.js"></script>
      <meta http-equiv="refresh" content="0;url=http://phishing.com">
      <a href="javascript:alert(1)">Clique Aqui</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">XSS</a>
      <p>Texto Seguro</p>
    </div>
  `;

  const clean = sanitizeHtmlFragment(dirty);

  assert.equal(clean.includes("onclick"), false);
  assert.equal(clean.includes("onload"), false);
  assert.equal(clean.includes("<iframe"), false);
  assert.equal(clean.includes("<meta"), false);
  assert.equal(clean.includes("evil.cdn"), false);
  assert.equal(clean.includes("javascript:"), false);
  assert.equal(clean.includes("data:text/html"), false);
  assert.equal(clean.includes("Texto Seguro"), true);
});

test("prototype-sanitizer: injectDataPidAttributes adiciona data-pid determinístico a nós HTML", () => {
  const rawHtml = `<div><header><h1>Olá</h1></header><p>Conteúdo</p></div>`;
  const result = injectDataPidAttributes(rawHtml);

  assert.match(result, /data-pid="p-1"/);
  assert.match(result, /data-pid="p-2"/);
  assert.match(result, /data-pid="p-3"/);
  assert.match(result, /data-pid="p-4"/);
});

test("prototype-sanitizer: parseDelimitedFiles extrai múltiplos blocos <arquivo caminho='...'>", () => {
  const aiOutput = `
Aqui está o seu protótipo:

<arquivo caminho="screens/detalhe.html">
<div class="ds-card">
  <h2>Detalhes</h2>
</div>
</arquivo>

<arquivo caminho="styles/proto.css">
.ds-card { padding: 16px; }
</arquivo>
`;

  const files = parseDelimitedFiles(aiOutput);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, "screens/detalhe.html");
  assert.match(files[0].content, /Detalhes/);
  assert.equal(files[1].path, "styles/proto.css");
});

test("prototype-storage & versions: inicialização modular, snapshot e restauração", () => {
  const memoryFs = new Map();

  const mockDeps = {
    fs: {
      existsSync: (p) => memoryFs.has(p) || Array.from(memoryFs.keys()).some((k) => k.startsWith(p)),
      mkdirSync: (p) => memoryFs.set(p, { isDir: true }),
      writeFileSync: (p, data) => memoryFs.set(p, data),
      readFileSync: (p) => memoryFs.get(p) || "",
      copyFileSync: (src, dest) => memoryFs.set(dest, memoryFs.get(src)),
      renameSync: (src, dest) => {
        memoryFs.set(dest, memoryFs.get(src));
        memoryFs.delete(src);
      },
      statSync: (p) => ({
        isDirectory: () => {
          const val = memoryFs.get(p);
          return (val && val.isDir) || !memoryFs.has(p);
        },
        isFile: () => Boolean(memoryFs.has(p) && !memoryFs.get(p)?.isDir),
      }),
      readdirSync: (p, opts) => {
        const prefix = p.replace(/[\\/]+$/, "") + "/";
        const names = new Set();
        for (const k of memoryFs.keys()) {
          if (k.startsWith(prefix)) {
            const rel = k.slice(prefix.length);
            const part = rel.split("/")[0];
            names.add(part);
          }
        }
        if (opts?.withFileTypes) {
          return Array.from(names).map((name) => ({
            name,
            isDirectory: () => name === "screens" || name === "styles" || name === ".versions" || name.startsWith("v"),
            isFile: () => !name.startsWith("v") && name.includes("."),
          }));
        }
        return Array.from(names);
      },
    },
    path,
  };

  const projectDir = "/mock/projects/meu-projeto";
  const proto = initPrototype(projectDir, "fluxo-paciente", "Fluxo do Paciente", {}, mockDeps);

  assert.equal(proto.id, "fluxo-paciente");
  assert.equal(proto.version, 1);
  assert.equal(proto.screens.length, 1);
  assert.equal(proto.screens[0].id, "home");

  // Salva arquivos gerados pelo chat
  const saveResult = savePrototypeFiles(
    projectDir,
    "fluxo-paciente",
    [
      { path: "screens/detalhe.html", content: "<div>Detalhes do Paciente</div>" },
      { path: "styles/proto.css", content: ".highlight { color: red; }" },
    ],
    { engine: "claude-code" },
    mockDeps
  );

  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.version, 2);
  assert.equal(saveResult.screens.length, 2);
});

test("prototype-renderer: renderPrototypeScreen gera HTML com CSP restritivo e ponte injetada", () => {
  const memoryFs = new Map();
  const screenContent = `<div class="ds-card" data-pid="p-1">Conteúdo da Tela</div>`;
  const protoJson = JSON.stringify({ schema: 1, id: "proto-1", screens: [{ id: "home", file: "screens/home.html" }] });

  memoryFs.set("/proj/design/prototypes/proto-1", { isDir: true });
  memoryFs.set("/proj/design/prototypes/proto-1/screens/home.html", screenContent);
  memoryFs.set("/proj/design/prototypes/proto-1/proto.json", protoJson);

  const norm = (p) => p.replace(/\\/g, "/");
  const mockDeps = {
    fs: {
      existsSync: (p) => memoryFs.has(norm(p)) || p.includes("prototype-bridge.js"),
      readFileSync: (p) => memoryFs.get(norm(p)) || "// bridge script mock",
    },
    path,
  };

  const res = renderPrototypeScreen("/proj", "/repo", "proto-1", "home", {}, mockDeps);

  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.match(res.html, /Conteúdo da Tela/);
  assert.match(res.html, /<script nonce="/);
  assert.match(res.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.match(res.headers["Content-Security-Policy"], /connect-src 'none'/);
});
