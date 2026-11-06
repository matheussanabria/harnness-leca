// @ts-check
"use strict";
// Loads the real legacy bridge (browser module) and the TS island parsers under plain Node. The bridge only needs a
// window-like event target and a document without a toast element; Node 24 strips types from the .ts sources.
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..", "..", "..");
const url = (/** @type {string[]} */ ...parts) => pathToFileURL(path.join(ROOT, ...parts)).href;

/** @returns {Promise<{ bridge: any, applyBlocks: Function, parseOutline: Function, normalizeBoardBlock: Function }>} */
async function loadBridgeEnv() {
  // @ts-ignore
  if (!globalThis.window) globalThis.window = new EventTarget();
  // @ts-ignore
  if (!globalThis.document) globalThis.document = { getElementById: () => null };
  const bridge = await import(url("ui", "public", "js", "modules", "canvas-chat-bridge.js"));
  const mind = await import(url("ui", "web", "src", "features", "mindmap", "chatBridge.ts"));
  const outline = await import(url("ui", "web", "src", "features", "mindmap", "outline.ts"));
  const board = await import(url("ui", "web", "src", "features", "board", "chatBridge.ts"));
  return { bridge, applyBlocks: mind.applyBlocks, parseOutline: outline.parseOutline, normalizeBoardBlock: board.normalizeBoardBlock };
}

module.exports = { loadBridgeEnv };
