// @ts-check
// Pure metadata extraction for Claude Code tool_use and tool_result blocks (T4.1b).
// Only allow-listed fields leave this module: never prompts, descriptions, inputs or outputs.

const TOOL_NAMES = new Set(["Skill", "Agent", "Task"]);
const META = /^[A-Za-z0-9:_-]{1,60}$/;

/** @param {unknown} value @returns {string | null} */
function meta(value) {
  return typeof value === "string" && META.test(value) ? value : null;
}

/**
 * Allow-listed metadata of a Skill/Agent/Task tool_use block.
 * @param {any} block
 * @param {unknown} messageId
 */
function extractToolUse(block, messageId) {
  if (!block || block.type !== "tool_use" || !TOOL_NAMES.has(block.name)) return null;
  const input = block.input && typeof block.input === "object" && !Array.isArray(block.input) ? block.input : {};
  const isSkill = block.name === "Skill";
  return {
    id: typeof block.id === "string" && block.id ? block.id : null,
    name: block.name,
    messageId: typeof messageId === "string" && messageId ? messageId : null,
    skillName: isSkill ? meta(input.skill) : null,
    subagentType: isSkill ? null : meta(input.subagent_type),
    model: meta(input.model),
    runInBackground: typeof input.run_in_background === "boolean" ? input.run_in_background : null,
  };
}

/**
 * Result id and outcome of a tool_result block. Absence of is_error is unknown, never success.
 * @param {any} block
 * @param {any} topLevelToolUseResult
 */
function extractToolResult(block, topLevelToolUseResult) {
  if (!block || block.type !== "tool_result") return null;
  let resultOk = null;
  if (block.is_error === false) resultOk = true;
  else if (block.is_error === true) resultOk = false;
  else if (topLevelToolUseResult && typeof topLevelToolUseResult.success === "boolean") resultOk = topLevelToolUseResult.success;
  return {
    toolUseId: typeof block.tool_use_id === "string" && block.tool_use_id ? block.tool_use_id : null,
    resultOk,
  };
}

module.exports = { extractToolUse, extractToolResult };
