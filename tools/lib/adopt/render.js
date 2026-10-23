// @ts-check
// Renders the seed instructions.md and memory.md for an adopted project from a detectStack() result.
// Only facts found on disk are written; everything else is listed as a question for the owner to answer.
const list = (items) => items.join(", ");

function stackLines(stack) {
  const lines = [];
  if (stack.languages.length) lines.push(`- Languages: ${list(stack.languages)}`);
  if (stack.frameworks.length) lines.push(`- Frameworks: ${list(stack.frameworks)}`);
  if (stack.tools.length) lines.push(`- Tooling: ${list(stack.tools)}`);
  if (stack.managers.length) lines.push(`- Package/build managers: ${list(stack.managers)}`);
  for (const note of stack.notes) lines.push(`- ${note}`);
  return lines;
}

/** @param {{slug:string, sourcePath:string, stack:any}} p */
function renderInstructions({ slug, sourcePath, stack }) {
  const out = [`# Project instructions: ${slug}`, "", "<!-- Seeded by tools/adopt-project.js from files found on disk. Review, correct and extend. -->", ""];
  out.push("## About", `- Source folder: \`${sourcePath}\``);
  if (stack.summary) out.push(`- README summary: ${stack.summary}`);
  out.push("", "## Stack (detected)");
  const lines = stackLines(stack);
  out.push(...(lines.length ? lines : ["- No known manifest found (package.json, pom.xml, build.gradle, pyproject.toml, go.mod, Cargo.toml, *.csproj)."]));
  if (stack.commands.length) {
    out.push("", "## Commands (detected)", ...stack.commands.map((c) => `- ${c.label}: \`${c.command}\``));
  }
  out.push(
    "", "## Rules for the assistant",
    "- Work in English. Prefer small, focused files and reuse existing patterns before adding new ones.",
    "- Read `MAPA.md` or the project README first; avoid wide scans of the repository.",
    "- Never write secrets (passwords, tokens, keys) into any file.",
    "", "## To confirm with the owner",
    "- Architecture and folder conventions (layers, naming, where tests live)?",
    "- Branch and commit conventions?",
    "- Definition of done (tests, lint, review)?",
    "- Anything the assistant must never touch (generated code, vendored folders, production configs)?",
    "",
  );
  return out.join("\n");
}

/** @param {{slug:string, date:string, stack:any}} p */
function renderMemory({ slug, date, stack }) {
  const facts = [];
  if (stack.languages.length || stack.frameworks.length) {
    facts.push(`Stack detected at adoption: ${list([...stack.languages, ...stack.frameworks])}${stack.tools.length ? ` (tooling: ${list(stack.tools)})` : ""}.`);
  }
  if (stack.commands.length) facts.push(`Detected scripts: ${stack.commands.map((c) => c.label).join(", ")}.`);
  facts.push(stack.hasGit ? "The source folder is a git repository." : "The source folder is not a git repository.");
  facts.push(`Project adopted into the harness as \`${slug}\` by tools/adopt-project.js; conversations are linked by folder name (see projects/.sources.json for aliases).`);
  return ["# Project memory", "", "<!-- Durable facts, one per line: - [YYYY-MM-DD] fact -->", "", ...facts.map((f) => `- [${date}] ${f}`), ""].join("\n");
}

module.exports = { renderInstructions, renderMemory };
