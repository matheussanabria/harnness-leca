// @ts-check
// EP-03: the office UI must use FontAwesome icons only, with no emoji code points.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const EMOJI_REGEX = /[\u{1F000}-\u{1FAFF}\u{2039}\u{203A}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
const OFFICE3D_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2705}\u{274C}\u{FE0F}\u{2714}\u{2716}\u{2726}]/u;
const DISALLOWED_DIALOGS = /\bwindow\.(?:confirm|alert|prompt)\s*\(/;

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function walk(directory, extensions) {
  const files = [];
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(relativePath, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(relativePath);
  }
  return files;
}

const SCANNED_FILES = [
  "ui/public/office.html",
  "ui/public/css/office.css",
  ...readdirSync(join(ROOT, "ui/public/js"))
    .filter((name) => /^office.*\.js$/.test(name))
    .map((name) => `ui/public/js/${name}`),
  ...walk("ui/public/js/office", [".js"]),
  ...walk("ui/public/css/office", [".css"])
];

const OFFICE3D_FILES = walk("ui/public/js/office3d", [".js"]);

function assertClean(relativePath) {
  const content = read(relativePath);
  const lines = content.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    const match = line.match(EMOJI_REGEX);
    if (match) hits.push(`${relativePath}:${index + 1}: ${match[0]}`);
  });

  assert.deepEqual(hits, [], `Emoji encontrado na UI do escritório: ${hits.join(", ")}`);
  assert.equal(DISALLOWED_DIALOGS.test(content), false, `${relativePath} usa window.confirm/alert/prompt`);
  assert.ok(lines.length <= 300, `${relativePath} passou do limite de 300 linhas (${lines.length})`);
}

test("EP-03: office.html não tem emojis e usa ícones FontAwesome", () => {
  assertClean("ui/public/office.html");
  const html = read("ui/public/office.html");
  assert.match(html, /class="fa-solid fa-/, "office.html deve usar ícones FontAwesome");
  assert.match(html, /fa-solid fa-xmark/, "botões de fechar devem usar fa-xmark");
});

test("EP-03: HTML, JS e CSS do escritório não têm emojis", () => {
  for (const file of SCANNED_FILES) assertClean(file);
});

test("EP-03: JS do office3d não tem emojis", () => {
  assert.ok(OFFICE3D_FILES.length > 0, "office3d deve ter arquivos JS para varrer");
  for (const file of OFFICE3D_FILES) {
    const content = read(file);
    const lines = content.split(/\r?\n/);
    const hits = [];

    lines.forEach((line, index) => {
      const match = line.match(OFFICE3D_EMOJI_REGEX);
      if (match) hits.push(`${file}:${index + 1}: ${match[0]}`);
    });

    assert.deepEqual(hits, [], `Emoji encontrado no office3d: ${hits.join(", ")}`);
    assert.equal(DISALLOWED_DIALOGS.test(content), false, `${file} usa window.confirm/alert/prompt`);
    assert.ok(lines.length <= 300, `${file} passou do limite de 300 linhas (${lines.length})`);
  }
});

test("EP-03: a varredura cobre os módulos do office3d", () => {
  assert.ok(OFFICE3D_FILES.includes("ui/public/js/office3d/orchestration/tab-control.js"));
  assert.ok(OFFICE3D_FILES.includes("ui/public/js/office3d/war-screen/war-screen-agents.js"));
  assert.ok(OFFICE3D_FILES.length > 15);
});

test("EP-03: HUD alterna ícones FontAwesome sem ler emoji do DOM", () => {
  const hud = read("ui/public/js/office/office-hud-controller.js");
  assert.match(hud, /fa-solid fa-eye/);
  assert.match(hud, /fa-solid fa-eye-slash/);
  assert.equal(/icon\.textContent\s*=\s*isHidden/.test(hud), false);
  assert.match(hud, /agent-name-cell[^`]*fa-solid/);
});

test("EP-03: a lista de arquivos varridos cobre o diretório office", () => {
  assert.ok(SCANNED_FILES.includes("ui/public/js/office/office-hud-controller.js"));
  assert.ok(SCANNED_FILES.includes("ui/public/js/office/office-drawer-views.js"));
  assert.ok(SCANNED_FILES.includes("ui/public/css/office/02-topbar.css"));
  assert.ok(SCANNED_FILES.length > 30);
});
