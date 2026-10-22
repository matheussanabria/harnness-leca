// @ts-check
const fs = require("node:fs");
const path = require("node:path");

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = String(content);
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function writeJson(file, data) {
  writeText(file, JSON.stringify(data, null, 2));
}

function longText(label, times = 60) {
  const lines = [];
  for (let i = 0; i < times; i += 1) {
    lines.push(`${label} ${i + 1}`);
  }
  return lines.join("\n");
}

module.exports = { writeText, writeJson, longText };
