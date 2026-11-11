const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { buildZip, crc32 } = require("../ui/server/services/zip-writer.service");
const { buildHandoffBundle } = require("../ui/server/services/handoff-bundle.service");
const { buildMcpJson } = require("../ui/server/services/handoff-docs.service");

/** Reads a ZIP through its central directory; returns { name: Buffer }. */
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let pos = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(pos + 10);
    const crc = buf.readUInt32LE(pos + 16);
    const size = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const local = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + nameLen).toString("utf8");
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.slice(dataStart, dataStart + size);
    const data = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.strictEqual(crc32(data), crc, `crc ${name}`);
    files[name] = data;
    pos += 46 + nameLen;
  }
  return files;
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-"));
  const proto = path.join(root, "design", "prototypes", "demo");
  fs.mkdirSync(path.join(proto, "screens"), { recursive: true });
  fs.mkdirSync(path.join(proto, ".history"), { recursive: true });
  fs.writeFileSync(path.join(proto, "proto.json"), JSON.stringify({ id: "demo", title: "Demo", screens: [{ id: "home", file: "screens/home.html" }] }));
  fs.writeFileSync(path.join(proto, "screens", "home.html"), '<div data-pid="p-1">Olá</div>');
  fs.writeFileSync(path.join(proto, ".history", "x.json"), "{}");
  fs.mkdirSync(path.join(root, "design", "ds", "components"), { recursive: true });
  fs.writeFileSync(path.join(root, "design", "ds", "tokens.css"), ":root{--a:1}");
  return root;
}

test("zip writer round-trips content and unicode names", () => {
  const files = readZip(buildZip([{ name: "a/ç.txt", data: "x".repeat(500) }, { name: "b.bin", data: Buffer.from([1, 2, 3]) }]));
  assert.strictEqual(files["a/ç.txt"].toString(), "x".repeat(500));
  assert.deepStrictEqual([...files["b.bin"]], [1, 2, 3]);
});

test("zip writer rejects path traversal", () => {
  assert.throws(() => buildZip([{ name: "../evil", data: "x" }]));
});

test("bundle has prototype, design system, guides and skips history", () => {
  const root = makeProject();
  const { zip, manifest } = buildHandoffBundle({ slug: "demo-proj", projectDir: root, repo: null, mcpServers: {}, prototypeIds: ["demo"], includeDs: true, includeMcp: true, compileStandalone: () => "<html></html>" });
  const files = readZip(zip);
  for (const name of ["prototypes/demo/proto.json", "prototypes/demo/screens/home.html", "design-system/tokens.css", "standalone/demo.html", "README.md", "AGENTS.md", "CLAUDE.md", "MAPA.md", "manifest.json", "package.json", "tools/preview-server.js"]) {
    assert.ok(files[name], `missing ${name}`);
  }
  assert.ok(!Object.keys(files).some((n) => n.includes(".history")));
  assert.ok(!files[".mcp.json"], "no .mcp.json without servers");
  assert.deepStrictEqual(manifest.prototypes, ["demo"]);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(files["README.md"].toString()), "no emoji in guides");
});

test("design system export also ships the showcase prototype from ds-config.json", () => {
  const root = makeProject();
  const vit = path.join(root, "design", "prototypes", "vit");
  fs.mkdirSync(path.join(vit, "screens"), { recursive: true });
  fs.writeFileSync(path.join(vit, "proto.json"), JSON.stringify({ id: "vit", title: "Showcase", screens: [{ id: "a", file: "screens/a.html" }] }));
  fs.writeFileSync(path.join(vit, "screens", "a.html"), "<p>a</p>");
  fs.writeFileSync(path.join(root, "design", "ds", "ds-config.json"), JSON.stringify({ schema: 1, namespace: "x", vitrine: "vit" }));
  const base = { slug: "p", projectDir: root, repo: null, mcpServers: {}, prototypeIds: ["demo"], includeMcp: false, compileStandalone: () => "<html></html>" };
  const withDs = readZip(buildHandoffBundle({ ...base, includeDs: true }).zip);
  assert.ok(withDs["prototypes/vit/proto.json"] && withDs["standalone/vit.html"], "showcase is included with the design system");
  const without = readZip(buildHandoffBundle({ ...base, includeDs: false }).zip);
  assert.ok(!without["prototypes/vit/proto.json"], "no showcase without the design system");
});

test("bundle rejects unknown or malformed prototype ids and empty selections", () => {
  const root = makeProject();
  const base = { slug: "p", projectDir: root, repo: null, mcpServers: {}, includeDs: false, includeMcp: false };
  assert.throws(() => buildHandoffBundle({ ...base, prototypeIds: ["../x"] }), /inválido/);
  assert.throws(() => buildHandoffBundle({ ...base, prototypeIds: ["nope"] }), /não encontrado/);
  assert.throws(() => buildHandoffBundle({ ...base, prototypeIds: [] }), /Nada para exportar/);
});

test("mcp.json uses relative paths and points the design system dir at the bundle", () => {
  const json = JSON.parse(buildMcpJson([{ name: "dis", entry: "src/server.js", env: { DIS_DESIGN_SYSTEM_DIR: "C:/abs/ds", OTHER: "1" } }]));
  assert.deepStrictEqual(json.mcpServers.dis.args, ["mcp/dis/src/server.js"]);
  assert.strictEqual(json.mcpServers.dis.env.DIS_DESIGN_SYSTEM_DIR, "./design-system");
  assert.strictEqual(json.mcpServers.dis.env.OTHER, "1");
});
