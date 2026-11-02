// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { STORY_ID_PATTERN, parseTrailers, readStoryCommits } = require("../ui/server/services/project-scrum-commits");

const { cleanGitEnv, initSandboxRepo } = require("./helpers/git-sandbox");

const created = [];

function cleanEnv() {
  return cleanGitEnv({ GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" });
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, shell: false, encoding: "utf8", env: cleanEnv() });
  assert.equal(result.status, 0, `git ${args.join(" ")} falhou`);
  return String(result.stdout || "");
}

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-commits-"));
  created.push(repo);
  initSandboxRepo(repo, { name: "Teste", email: "teste@example.com" });
  return repo;
}

function commit(repo, subject, body) {
  const args = ["commit", "--allow-empty", "--quiet", "-m", subject];
  if (body !== undefined) args.push("-m", body);
  git(repo, args);
}

test.after(() => {
  for (const directory of created) fs.rmSync(directory, { recursive: true, force: true });
});

test("parseTrailers le apenas o ultimo paragrafo com trailers", () => {
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory: US-1\n"), { story: ["US-1"] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory: US-1\nStory: US-2\n"), { story: ["US-1", "US-2"] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nSTORY: US-3\n"), { story: ["US-3"] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory:   US-4   \n"), { story: ["US-4"] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nTexto que cita Story: US-5 no meio da prosa.\n"), { story: [] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory:\n"), { story: [] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory: US-6\nStory: US-6\n"), { story: ["US-6"] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory: US-7\nCo-Authored-By: Alguem <a@b.c>\n"), { story: ["US-7"] });
  assert.deepEqual(parseTrailers("fix: ajuste"), { story: [] });
});

test("readStoryCommits retorna apenas commits com o trailer pedido", () => {
  const repo = makeRepo();
  commit(repo, "feat: primeiro", "Story: US-1");
  commit(repo, "feat: segundo", "Story: us-1\nStory: US-2");
  commit(repo, "chore: terceiro", "Sem trailer algum.");
  const first = readStoryCommits(repo, ["US-1"]);
  assert.equal(first.available, true);
  assert.deepEqual(first.commits.map(({ subject }) => subject), ["feat: segundo", "feat: primeiro"]);
  assert.deepEqual(first.commits.map(({ shortSha }) => shortSha.length), [7, 7]);
  assert.deepEqual(first.commits.map(({ verified }) => verified), [true, true]);
  assert.deepEqual(first.commits.map(({ source }) => source), ["git", "git"]);
  assert.deepEqual(first.byStory["US-1"], first.commits.map(({ sha }) => sha));
  const second = readStoryCommits(repo, ["US-2"]);
  assert.deepEqual(second.commits.map(({ subject }) => subject), ["feat: segundo"]);
});

test("casamento ignora caixa e devolve storyIds com a caixa pedida", () => {
  const repo = makeRepo();
  commit(repo, "feat: caixa", "story: us-7");
  const result = readStoryCommits(repo, ["Us-7"]);
  assert.equal(result.commits.length, 1);
  assert.deepEqual(result.commits[0].storyIds, ["Us-7"]);
  assert.deepEqual(result.byStory, { "Us-7": [result.commits[0].sha] });
});

test("mencao de Story em prosa nao conta como trailer", () => {
  const repo = makeRepo();
  commit(repo, "feat: prosa", "Explico o caso Story: US-9 aqui.\n\nFim do texto sem trailer.");
  const result = readStoryCommits(repo, ["US-9"]);
  assert.deepEqual(result.commits, []);
  assert.deepEqual(result.byStory, {});
});

test("ids invalidos sao ignorados sem consultar o git", () => {
  const repo = makeRepo();
  commit(repo, "feat: valido", "Story: US-1");
  const invalid = ["x; rm -rf /", "--all", "", "a".repeat(200)];
  for (const id of invalid) assert.equal(STORY_ID_PATTERN.test(id), false);
  const result = readStoryCommits(repo, invalid);
  assert.equal(result.available, true);
  assert.deepEqual(result.commits, []);
  assert.deepEqual(result.byStory, {});
});

test("maxCount e respeitado e valores invalidos sao limitados", () => {
  const repo = makeRepo();
  for (let index = 0; index < 5; index += 1) commit(repo, `feat: ${index}`, "Story: US-1");
  assert.equal(readStoryCommits(repo, ["US-1"], { maxCount: 2 }).commits.length, 2);
  assert.equal(readStoryCommits(repo, ["US-1"], { maxCount: -5 }).commits.length, 1);
  assert.equal(readStoryCommits(repo, ["US-1"], { maxCount: "abc" }).commits.length, 5);
  assert.equal(readStoryCommits(repo, ["US-1"], { maxCount: 1e9 }).commits.length, 5);
});

test("repositorio invalido devolve motivo sem caminhos absolutos", () => {
  const repo = makeRepo();
  const missing = path.join(os.tmpdir(), `scrum-commits-ausente-${process.pid}-${Date.now()}`);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-commits-vazio-"));
  created.push(empty);
  const file = path.join(repo, "arquivo.txt");
  fs.writeFileSync(file, "x", "utf8");
  const cases = [
    [readStoryCommits(missing, ["US-1"]), "no-repo"],
    [readStoryCommits(file, ["US-1"]), "no-repo"],
    [readStoryCommits(null, ["US-1"]), "no-repo"],
    [readStoryCommits(empty, ["US-1"]), "not-a-git-repo"],
  ];
  for (const [result, reason] of cases) {
    assert.equal(result.available, false);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.commits, []);
    assert.deepEqual(result.byStory, {});
    assert.equal(JSON.stringify(result).includes(os.tmpdir()), false);
  }
});

test("commits em outra branch sao encontrados com --all", () => {
  const repo = makeRepo();
  commit(repo, "feat: principal", "Story: US-1");
  const current = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  git(repo, ["checkout", "--quiet", "-b", "feature"]);
  commit(repo, "feat: feature", "Story: US-5");
  git(repo, ["checkout", "--quiet", current]);
  const result = readStoryCommits(repo, ["US-5"]);
  assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0].subject, "feat: feature");
});

test("todo commit devolvido tem sha completo e verificacao verdadeira", () => {
  const repo = makeRepo();
  commit(repo, "feat: um", "Story: US-1");
  commit(repo, "feat: dois", "Story: US-1");
  const result = readStoryCommits(repo, ["US-1"]);
  assert.equal(result.commits.length, 2);
  for (const item of result.commits) {
    assert.equal(item.verified, true);
    assert.match(item.sha, /^[0-9a-f]{40}$/);
    assert.equal(item.sha.slice(0, 7), item.shortSha);
  }
});

test("GIT_DIR herdado de hook nao desvia a leitura", () => {
  const repo = makeRepo();
  commit(repo, "feat: ambiente", "Story: US-1");
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(os.tmpdir(), "git-dir-falso");
  try {
    const result = readStoryCommits(repo, ["US-1"]);
    assert.equal(result.available, true);
    assert.equal(result.commits.length, 1);
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
});

test("ultimo paragrafo que mistura prosa e uma linha Story nao e bloco de trailers", () => {
  assert.deepEqual(parseTrailers("fix: ajuste\n\nExplicacao do motivo.\nStory: US-8\n"), { story: [] });
  assert.deepEqual(parseTrailers("fix: ajuste\n\nStory: US-8\nobservacao solta sem chave\n"), { story: [] });
  const repo = makeRepo();
  commit(repo, "fix: mistura", "Explicacao do motivo.\nStory: US-8");
  assert.deepEqual(readStoryCommits(repo, ["US-8"]).commits, []);
});

test("id invalido nunca casa, mesmo quando um trailer traz exatamente o mesmo texto", () => {
  const repo = makeRepo();
  commit(repo, "fix: valor estranho", "Story: x; rm -rf /");
  commit(repo, "fix: flag", "Story: --all");
  commit(repo, "fix: normal", "Story: US-10");
  const result = readStoryCommits(repo, ["x; rm -rf /", "--all", "US-10"]);
  assert.equal(result.commits.length, 1);
  assert.deepEqual(Object.keys(result.byStory), ["US-10"]);
});
