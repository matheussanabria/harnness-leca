#!/usr/bin/env node
"use strict";
// CLI: node tools/pricing.js list [--json] | estimate --model M [--provider P] --input N ... [--json]
const { loadTable } = require("./lib/pricing/loader");
const { estimateCost, findModel } = require("./lib/pricing");

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const k = a.slice(2);
    if (k === "json") o.json = true; else o[k] = argv[++i];
  }
  return o;
}

function main(argv, out = console.log) {
  const o = parse(argv);
  const cmd = o._[0];
  if (cmd === "list") {
    const { table } = loadTable();
    if (o.json) { out(JSON.stringify(table, null, 2)); return 0; }
    out(`price table ${table.version} (${table.reviewStatus})`);
    for (const m of table.models) {
      const r = m.rates[m.rates.length - 1];
      out(`${m.provider.padEnd(10)}${m.id.padEnd(26)}in ${r.input}  out ${r.output}  cacheRead ${r.cacheRead ?? "-"}`);
    }
    return 0;
  }
  if (cmd === "estimate") {
    const n = (v) => (v === undefined ? null : Number(v));
    const tokens = {
      input: n(o.input), output: n(o.output), cacheRead: n(o["cache-read"]),
      cacheCreation: n(o["cache-creation"]), reasoning: n(o.reasoning),
    };
    let provider = o.provider;
    if (!provider) {
      for (const p of ["anthropic", "openai", "google"]) if (findModel(p, o.model)) { provider = p; break; }
    }
    const res = estimateCost({ provider, model: o.model, tokens, at: o.at });
    if (o.json) out(JSON.stringify(res));
    else out(res ? `USD ${res.amount} (estimated, api-equivalent, table ${res.priceTableVersion})${res.missing.length ? " unpriced: " + res.missing.join(",") : ""}` : "unknown (null)");
    return 0;
  }
  out("usage: pricing.js list [--json] | estimate --model M [--provider P] --input N --output N [--cache-read N] [--cache-creation N] [--reasoning N] [--at ISO] [--json]");
  return 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, parse };
