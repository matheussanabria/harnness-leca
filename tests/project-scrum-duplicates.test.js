// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeTitle,
  findDuplicateCandidates,
  DUPLICATE_THRESHOLD,
  MAX_CANDIDATES,
} = require("../ui/server/services/project-scrum-duplicates");

test("normalizeTitle strips accents and punctuation", () => {
  const withNoise = normalizeTitle("Exportar relatório, mensal!");
  const plain = normalizeTitle("exportar relatorio mensal");
  assert.equal(withNoise, plain);
  assert.equal(withNoise, "exportar relatorio mensal");
});

test("normalizeTitle drops stopwords", () => {
  assert.equal(normalizeTitle("O relatório de vendas do The Evento"), "relatorio vendas evento");
});

test("normalizeTitle returns empty string for null and undefined", () => {
  assert.equal(normalizeTitle(null), "");
  assert.equal(normalizeTitle(undefined), "");
});

test("equal key matches with reason key even when titles differ, case-insensitively", () => {
  const stories = [{ id: "US-9", key: "US-1", title: "completely unrelated wording" }];
  const result = findDuplicateCandidates(stories, { key: "us-1", title: "outro assunto qualquer" });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, "key");
  assert.equal(result[0].score, 1);
  assert.equal(result[0].id, "US-9");
});

test("key matches story.id when story.key differs", () => {
  const stories = [{ id: "US-2", key: "OTHER", title: "palavras diferentes de tudo" }];
  const result = findDuplicateCandidates(stories, { key: "US-2" });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, "key");
  assert.equal(result[0].score, 1);
  assert.equal(result[0].id, "US-2");
});

test("dedupeKey match wins over key match for the same story", () => {
  const stories = [{ id: "US-3", key: "US-3", dedupeKey: "DUP-A", title: "some sample words here" }];
  const result = findDuplicateCandidates(stories, {
    key: "US-3",
    dedupeKey: "dup-a",
    title: "other totally different text",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, "dedupeKey");
  assert.equal(result[0].score, 1);
});

test("equal titles after normalization report reason title with score 1", () => {
  const stories = [{ id: "US-4", key: "US-4", title: "Exportar Relatório Mensal" }];
  const result = findDuplicateCandidates(stories, { title: "exportar relatorio mensal!" });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, "title");
  assert.equal(result[0].score, 1);
  assert.notEqual(stories[0].title, "exportar relatorio mensal!");
});

test("jaccard exactly at threshold is reported, just under is not", () => {
  const atThreshold = findDuplicateCandidates(
    [{ id: "US-5A", key: "US-5A", title: "alpha beta gamma epsilon" }],
    { title: "alpha beta gamma delta" },
  );
  assert.equal(atThreshold.length, 1);
  assert.equal(atThreshold[0].reason, "similar-title");
  assert.equal(atThreshold[0].score, 0.6);
  assert.equal(DUPLICATE_THRESHOLD, 0.6);

  const belowThreshold = findDuplicateCandidates(
    [{ id: "US-5B", key: "US-5B", title: "alpha beta gamma zeta eta" }],
    { title: "alpha beta gamma delta" },
  );
  assert.equal(belowThreshold.length, 0);
});

test("empty store and stopword-only title return an empty array", () => {
  assert.deepEqual(findDuplicateCandidates([], { title: "alpha beta gamma delta" }), []);
  const story = [{ id: "US-6", key: "US-6", title: "alpha beta gamma delta" }];
  assert.deepEqual(findDuplicateCandidates(story, { title: "de para com the of to and" }), []);
  assert.deepEqual(findDuplicateCandidates(null, { title: "alpha beta gamma delta" }), []);
});

test("more than MAX_CANDIDATES matches returns exactly five, best scores first", () => {
  const stories = [];
  for (let i = 0; i < 6; i += 1) {
    stories.push({ id: `US-7${i}`, key: `US-7${i}`, dedupeKey: "DUP-SHARED", title: "store story" });
  }
  const result = findDuplicateCandidates(stories, { title: "query", dedupeKey: "dup-shared" });
  assert.equal(MAX_CANDIDATES, 5);
  assert.equal(result.length, 5);
  for (const candidate of result) {
    assert.equal(candidate.score, 1);
    assert.ok(["dedupeKey", "key"].includes(candidate.reason));
  }
  assert.ok(!result.some((candidate) => candidate.id === "US-75"));
});

test("a 5000-char title is truncated safely and still matches an equal long story", () => {
  const chunk = "sample report consumer deeper row ";
  const long = (chunk.repeat(152)).slice(0, 5000);
  const truncatedHead = long.slice(0, 200);
  const stories = [{ id: "US-8", key: "US-8", title: `${long}12345 tail differs after cut` }];
  const result = findDuplicateCandidates(stories, { title: long });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, "title");
  assert.equal(result[0].score, 1);
  assert.equal(truncatedHead.length, 200);
});

test("input stories array is not mutated", () => {
  const stories = [
    { id: "US-9", key: "US-9", dedupeKey: "DUP-9", title: "Exportar relatório mensal" },
    { id: "US-10", key: "US-10", title: "alpha beta gamma delta" },
  ];
  const before = JSON.stringify(stories);
  findDuplicateCandidates(stories, { key: "US-9", title: "exportar relatorio mensal" });
  assert.equal(JSON.stringify(stories), before);
  assert.deepEqual(stories, JSON.parse(before));
});

test("candidates are sorted by score, highest first", () => {
  const stories = [
    { id: "US-A", key: "US-A", title: "alpha beta gamma epsilon" },
    { id: "US-B", key: "US-B", title: "alpha beta gamma delta" },
  ];
  const result = findDuplicateCandidates(stories, { title: "alpha beta gamma delta" });
  assert.deepEqual(result.map((candidate) => candidate.id), ["US-B", "US-A"]);
  assert.ok(result[0].score > result[1].score);
});
