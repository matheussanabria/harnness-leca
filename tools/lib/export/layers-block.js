// @ts-check
// "Skills, agents and workflows" section of the AGENTS.md block: the effective set of the project by layer.
// Project-layer items carry their description and path; inherited ones (DAI, global) are listed by id only, to keep the
// block small. The full table with paths is one command away.
const MAX_PROJECT = 40;
const MAX_DESC = 160;

/** @typedef {{ id: string, kind: string, layer: string, file: string, description?: string, overrides?: string[] }} LayerItem */

/** @param {LayerItem[]} items @param {string} slug @returns {string[]} */
function layersLines(items, slug) {
  if (!items.length) return ["No skills, agents or workflows found."];
  const own = items.filter((i) => i.layer === "project");
  const inherited = items.filter((i) => i.layer !== "project");
  const lines = [`Resolved by layer (project over global over DAI). Paths and origin: \`node tools/layers.js show ${slug} --json\`.`];
  if (own.length) {
    lines.push("", "Project layer (open the file only when the description matches the task):");
    for (const i of own.slice(0, MAX_PROJECT)) {
      const d = String(i.description || "").slice(0, MAX_DESC);
      const over = i.overrides && i.overrides.length ? ` [replaces ${i.overrides.join(", ")}]` : "";
      lines.push(`- ${i.kind} **${i.id}**${over}${d ? `: ${d}` : ""} (\`${i.file}\`)`);
    }
    if (own.length > MAX_PROJECT) lines.push(`- ... and ${own.length - MAX_PROJECT} more.`);
  }
  for (const kind of ["agent", "workflow", "skill"]) {
    const ids = inherited.filter((i) => i.kind === kind).map((i) => i.id);
    if (ids.length) lines.push("", `Inherited ${kind}s (${ids.length}, ids only): ${ids.join(", ")}`);
  }
  return lines;
}

module.exports = { layersLines };
