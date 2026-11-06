// @ts-check
"use strict";
// Judges one model answer the way the app would: real block extraction, real outline parser, real board normalizer.
// Pure given the loaded env, so it is unit-tested with canned answers (tests/canvas-chat-probe.test.js).

const MAP_BOARD_NODE_LIMIT = 25;
const MAP_NODE_LIMIT = 40;
const MAP_DEPTH_LIMIT = 4;

const depthOf = (/** @type {{children: any[]}[]} */ nodes) => nodes.reduce((max, n) => Math.max(max, 1 + depthOf(n.children)), 0);
const countOf = (/** @type {{children: any[]}[]} */ nodes) => nodes.reduce((sum, n) => sum + 1 + countOf(n.children), 0);

/** Counts distinct node ids of a flowchart body: `A[Text] --> B` mentions. Rough, only to flag runaway diagrams. */
function countFlowNodes(/** @type {string} */ body) {
  const ids = new Set();
  for (const m of body.matchAll(/(?:^|\s|;|>|\|)([A-Za-z_][\w]*)\s*(?:\[|\(|\{|-->|---|==>|-\.|\s*$)/gm)) ids.add(m[1]);
  return ids.size;
}

/** @param {string[]} codes @param {Record<string, unknown>} [details] */
const result = (codes, details = {}) => ({ verdict: codes.some((c) => !c.startsWith("note:")) ? "FAIL" : "PASS", codes, details });

function judgeMindmap(env, scenario, answer) {
  const blocks = env.bridge.extractMindmapBlocks(answer);
  const { expect } = scenario;
  if (expect.noBlock) return result(blocks.length ? ["UNEXPECTED_BLOCK"] : []);
  if (!blocks.length) return result(["NO_BLOCK"]);
  const codes = [];
  const first = blocks[0];
  if (expect.mode && ![].concat(expect.mode).includes(first.mode)) codes.push("WRONG_MODE");
  if (expect.parent && first.parent !== expect.parent) codes.push("WRONG_PARENT");
  if (/```/.test(first.body)) codes.push("note:FENCE_INSIDE_BLOCK");
  const parsed = env.parseOutline(first.body);
  const count = countOf(parsed.nodes);
  const depth = depthOf(parsed.nodes);
  if (!count) codes.push("EMPTY_OUTLINE");
  if (count < (expect.minAdded || 1)) codes.push("TOO_FEW_NODES");
  if (count > MAP_NODE_LIMIT) codes.push("note:OVER_PROMPT_NODE_LIMIT");
  if (depth > MAP_DEPTH_LIMIT) codes.push("note:OVER_PROMPT_DEPTH_LIMIT");
  if (parsed.truncated) codes.push("TRUNCATED");
  if (blocks.length > 1) codes.push("note:MULTIPLE_BLOCKS");
  return result(codes, { nodes: count, depth, blocks: blocks.length });
}

function judgeBoard(env, scenario, answer) {
  const blocks = env.bridge.extractBoardBlocks(answer);
  const { expect } = scenario;
  if (expect.noBlock) return result(blocks.length ? ["UNEXPECTED_BLOCK"] : []);
  if (!blocks.length) return result(expect.allowNoBlock ? ["note:DECLINED_WITHOUT_BLOCK"] : ["NO_BLOCK"]);
  const codes = [];
  const normalized = env.normalizeBoardBlock(blocks[0]);
  if (!normalized.ok) return result([normalized.reason === "unsupported diagram type" ? "UNSUPPORTED_TYPE" : "INVALID_BLOCK"], { reason: normalized.reason });
  if (expect.mode && ![].concat(expect.mode).includes(normalized.mode)) codes.push("WRONG_MODE");
  const header = normalized.source.split("\n")[0].trim().toLowerCase();
  if (expect.headers && !expect.headers.some((/** @type {string} */ h) => header.startsWith(h))) codes.push("UNEXPECTED_TYPE");
  if (/^(flowchart|graph)/.test(header)) {
    if (!/(-->|---|==>|-\.->)/.test(normalized.source)) codes.push("NO_EDGES");
    if (countFlowNodes(normalized.source) > MAP_BOARD_NODE_LIMIT) codes.push("OVER_NODE_LIMIT");
  }
  if (/```/.test(blocks[0].body)) codes.push("note:FENCE_INSIDE_BLOCK");
  return result(codes, { header, chars: normalized.source.length });
}

/** @param {{ bridge: any, parseOutline: Function, normalizeBoardBlock: Function }} env @param {any} scenario @param {string} answer */
function judge(env, scenario, answer) {
  return scenario.kind === "board" ? judgeBoard(env, scenario, answer) : judgeMindmap(env, scenario, answer);
}

module.exports = { judge, depthOf, countOf };
