// @ts-check
// Parser da documentacao versionada de historias em doc/scrum/DIS-*/user-story.md.
const fs = require("fs");
const path = require("path");

function fold(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function sectionsOf(markdown) {
  const sections = [];
  let current = { title: "", lines: [] };
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)\s*$/);
    if (heading) {
      sections.push(current);
      current = { title: heading[1].trim(), lines: [] };
    } else current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

function trimBlock(lines) {
  const copy = [...lines];
  while (copy.length && !copy[0].trim()) copy.shift();
  while (copy.length && !copy.at(-1).trim()) copy.pop();
  return copy.join("\n");
}

function parseCriteria(lines) {
  const criteria = [];
  let current = null;
  for (const line of lines) {
    const match = line.match(/^-\s+\*\*(Crit[^*]+)\*\*:\s*(.*)$/i);
    if (match) {
      if (current) criteria.push(current);
      current = { id: `criterion-${criteria.length + 1}`, label: match[1].trim(), lines: [match[2]] };
    } else if (current) current.lines.push(line);
  }
  if (current) criteria.push(current);
  return criteria.map(({ lines: contentLines, ...criterion }) => ({ ...criterion, content: trimBlock(contentLines) }));
}

function parseScenarios(lines) {
  const scenarios = [];
  let current = null;
  for (const line of lines) {
    const match = line.match(/^###\s+(.+)\s*$/);
    if (match) {
      if (current) scenarios.push(current);
      current = { id: `scenario-${scenarios.length + 1}`, title: match[1].trim(), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) scenarios.push(current);
  return scenarios.map(({ lines: contentLines, ...scenario }) => ({ ...scenario, content: trimBlock(contentLines) }));
}

function parseStoryDocument(markdown, meta = {}) {
  const sections = sectionsOf(markdown);
  const context = sections.find((section) => fold(section.title).startsWith("contexto"));
  const description = sections.find((section) => fold(section.title).startsWith("descricao"));
  const userStory = sections.find((section) => fold(section.title).includes("historia de usuario"));
  const criteria = sections.find((section) => fold(section.title).includes("criterios de aceitacao"));
  const scenarios = sections.find((section) => fold(section.title).includes("cenarios de testes"));
  const outOfScope = sections.find((section) => fold(section.title).includes("fora do escopo"));
  const additionalInfo = sections.find((section) => fold(section.title).includes("informacoes adicionais"));
  const links = new Map();
  for (const match of String(markdown || "").matchAll(/\[([^\]]*DIS-\d+[^\]]*)\]\(([^)]+)\)/gi)) {
    const key = (match[1].match(/DIS-\d+/i) || match[2].match(/DIS-\d+/i))?.[0]?.toUpperCase();
    if (key) links.set(key, { key, label: match[1], href: match[2] });
  }
  return {
    key: meta.key || null,
    context: context ? trimBlock(context.lines) : null,
    description: description ? trimBlock(description.lines) : null,
    userStory: userStory ? trimBlock(userStory.lines) : null,
    acceptanceCriteria: criteria ? parseCriteria(criteria.lines) : [],
    scenarios: scenarios ? parseScenarios(scenarios.lines) : [],
    outOfScope: outOfScope ? trimBlock(outOfScope.lines) : null,
    additionalInfo: additionalInfo ? trimBlock(additionalInfo.lines) : null,
    documentLinks: [...links.values()],
    sourceFile: meta.file || null,
    updatedAt: meta.updatedAt || null,
  };
}

function loadStoryDocuments(repoRoot, keys = []) {
  const root = path.resolve(repoRoot, "doc", "scrum");
  const wanted = new Set(keys.map((key) => String(key).toUpperCase()));
  const documents = new Map();
  if (!fs.existsSync(root)) return documents;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const key = entry.name.toUpperCase();
    if (!entry.isDirectory() || !/^DIS-\d+$/.test(key) || (wanted.size && !wanted.has(key))) continue;
    const file = path.join(root, entry.name, "user-story.md");
    if (!fs.existsSync(file)) continue;
    const stats = fs.statSync(file);
    documents.set(key, parseStoryDocument(fs.readFileSync(file, "utf8"), {
      key,
      file: path.relative(repoRoot, file).replace(/\\/g, "/"),
      updatedAt: stats.mtime.toISOString(),
    }));
  }
  return documents;
}

module.exports = { loadStoryDocuments, parseStoryDocument };
