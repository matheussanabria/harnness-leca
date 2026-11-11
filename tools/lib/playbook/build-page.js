// @ts-check
// Assembles the single-file playbook page from the data, the DAI reading and the three template files.
const fs = require("fs");
const path = require("path");

const TEMPLATE = path.join(__dirname, "template");
const read = (name) => fs.readFileSync(path.join(TEMPLATE, name), "utf8");

/** JSON that is safe inside a <script> block. */
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, " ");

/**
 * @param {Record<string, any>} data  output of loadPlaybook
 * @param {{ agents: any[], matrix: any }} dai  output of readDai
 * @returns {string}
 */
function buildPage(data, dai) {
  const payload = { ...data, agents: dai.agents, matrix: dai.matrix };
  return read("shell.html")
    .replace("{{CSS}}", () => read("page.css").trim())
    .replace("{{DATA}}", () => safeJson(payload))
    .replace("{{JS}}", () => read("render.js").trim());
}

module.exports = { buildPage, safeJson };
