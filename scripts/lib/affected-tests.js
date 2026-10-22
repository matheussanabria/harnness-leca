// Mapeia arquivos staged para os testes que o pre-commit precisa rodar (EP-14.02).
// Convencao de nome: foo.js -> tests/foo*.test.js, comparando sem hifen/ponto.
// Dependencia direta: entra o teste que faz require/import do arquivo staged.
// Arquivo sem mapa: roda o conjunto de contrato fixo (CONTRACT_TESTS).
const fs = require("fs");
const path = require("path");

const CONTRACT_TESTS = Object.freeze([
  "tests/affected-tests.test.js",
  "tests/precommit.test.js",
  "tests/verify-index.test.js",
]);

function normalize(file) {
  return String(file).replace(/\\/g, "/").replace(/^\.\//, "");
}

function isDoc(file) {
  const p = normalize(file);
  return /\.md$/i.test(p) || p.startsWith("docs/");
}

function isDocsOnly(files) {
  return files.length > 0 && files.every(isDoc);
}

function isTestFile(file) {
  const p = normalize(file);
  return p.startsWith("tests/") && p.endsWith(".test.js");
}

// "scripts/pre-commit.js" -> "precommit"; "tests/precommit.test.js" -> "precommit".
function stem(file) {
  const base = path.posix.basename(normalize(file));
  return base.replace(/\.test\.js$/i, "").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameMatches(file, testFile) {
  const source = stem(file);
  return source.length > 0 && stem(testFile).startsWith(source);
}

const SPECIFIER_PATTERNS = [
  /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s+["']([^"']+)["']/g,
];

function specifiers(source) {
  const out = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) out.add(match[1]);
  }
  return [...out];
}

function candidatesFor(testRel, spec) {
  if (!spec.startsWith(".")) return [];
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(normalize(testRel)), spec));
  return [base, `${base}.js`, `${base}.json`, `${base}.mjs`, `${base}.cjs`, `${base}/index.js`];
}

function requiresStaged(testRel, targetRel, readFile, root) {
  let source;
  try {
    source = readFile(path.join(root, testRel));
  } catch {
    return false;
  }
  const target = normalize(targetRel);
  return specifiers(source).some((spec) => candidatesFor(testRel, spec).includes(target));
}

function listTestFiles(root) {
  try {
    return fs.readdirSync(path.join(root, "tests"))
      .filter((name) => name.endsWith(".test.js"))
      .sort()
      .map((name) => `tests/${name}`);
  } catch {
    return [];
  }
}

function affectedTests(stagedFiles, options = {}) {
  const root = options.root || path.resolve(__dirname, "..", "..");
  const testFiles = options.testFiles || listTestFiles(root);
  const readFile = options.readFile || ((file) => fs.readFileSync(file, "utf8"));
  const staged = [...new Set((stagedFiles || []).map(normalize).filter(Boolean))];
  const selected = new Set();
  const unmatched = [];

  for (const file of staged) {
    if (isTestFile(file)) {
      selected.add(file);
      continue;
    }
    if (isDoc(file)) continue;

    const matched = testFiles.filter((test) => nameMatches(file, test) || requiresStaged(test, file, readFile, root));
    if (matched.length) matched.forEach((test) => selected.add(test));
    else unmatched.push(file);
  }

  if (unmatched.length) CONTRACT_TESTS.forEach((test) => selected.add(test));

  return {
    tests: [...selected].sort(),
    unmatched,
    contract: unmatched.length > 0,
    docsOnly: isDocsOnly(staged),
  };
}

module.exports = { CONTRACT_TESTS, affectedTests, isDoc, isDocsOnly, isTestFile, nameMatches };
