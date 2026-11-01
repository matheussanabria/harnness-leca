// @ts-check
// Cheap, model-free quality gate for an engine answer. 9Router returns HTTP 200 for empty, truncated and
// fake tool-call answers, so the Harness checks them here. It only flags; it never retries or escalates.

const TOOL_MARKUP = [
  /<tool_code>[\s\S]*?(<\/tool_code>|$)/gi,
  /<tool_call>[\s\S]*?(<\/tool_call>|$)/gi,
  /<tool name=[\s\S]*?(<\/tool>|$)/gi,
  /\[TOOL_CALLS?\][\s\S]*?(\[\/TOOL_CALLS?\]|$)/gi,
  /<function=[\s\S]*?(<\/function>|$)/gi,
];
// Text left outside tool markup below this size means the answer is only the fake tool call.
const MIN_REAL_CONTENT = 200;

/** @param {string} text */
function stripToolMarkup(text) {
  return TOOL_MARKUP.reduce((t, re) => t.replace(re, " "), text);
}

/**
 * @param {{ text?: string, finish?: string }} answer
 * @returns {{ ok: boolean, code: "ok"|"empty"|"truncated"|"fake_tool_call", reason: string }}
 */
function checkAnswer({ text = "", finish = "" } = {}) {
  const body = String(text || "");
  if (!body.trim()) {
    return { ok: false, code: "empty", reason: "The model returned no content." };
  }
  const outside = stripToolMarkup(body);
  if (outside.length !== body.length && outside.trim().length < MIN_REAL_CONTENT) {
    return { ok: false, code: "fake_tool_call", reason: "The model answered with tool-call text instead of the requested content." };
  }
  if (finish === "length") {
    return { ok: false, code: "truncated", reason: "The answer was cut off at the output token limit." };
  }
  return { ok: true, code: "ok", reason: "" };
}

module.exports = { checkAnswer, stripToolMarkup };
