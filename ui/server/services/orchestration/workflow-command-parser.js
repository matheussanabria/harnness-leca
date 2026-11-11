// @ts-check
// Pure parser of chat workflow commands: "/workflows" and "/workflow(s) <slug> <description> [--story K] [--from S]".
// No I/O and no knowledge of the catalog: slug resolution lives in workflow-command.service.js.

const LIST_RE = /^\/workflows\s*$/i;
const START_RE = /^\/workflows?(?:\s+([\s\S]*))?$/i;

/**
 * @param {string} text
 * @returns {{ kind: "none" } | { kind: "list" } | { kind: "start", slug: string, description: string, story: string, from: string }}
 */
function parseWorkflowCommand(text) {
  const raw = String(text || "").trim();
  if (LIST_RE.test(raw)) return { kind: "list" };
  const match = START_RE.exec(raw);
  if (!match) return { kind: "none" };

  let rest = (match[1] || "").trim();
  const flags = { story: "", from: "" };
  rest = rest.replace(/(?:^|\s)--(story|from)(?:=|\s+)(\S+)/gi, (_all, name, value) => {
    flags[/** @type {"story"|"from"} */ (name.toLowerCase())] = value;
    return " ";
  });
  const [slug = "", ...words] = rest.split(/\s+/).filter(Boolean);
  return { kind: "start", slug: slug.toLowerCase(), description: words.join(" "), story: flags.story, from: flags.from.toLowerCase() };
}

/** True when the text is a workflow command (used by the chat to intercept before the engine). */
function isWorkflowCommand(text) {
  return parseWorkflowCommand(text).kind !== "none";
}

module.exports = { parseWorkflowCommand, isWorkflowCommand };
