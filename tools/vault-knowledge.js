#!/usr/bin/env node
// @ts-check
// Read-only lookup into an Obsidian knowledge vault: `find` ranks notes by keywords, `stats` sizes the vault.
// Nothing is copied into the harness; agents open only the notes this prints. Vault path: --vault or HARNESS_VAULT.
"use strict";
const { opt, CliError, runAsScript } = require("./lib/cli");
const { scanVault } = require("./lib/vault/scan");
const { findNotes, vaultStats, estimateTokens } = require("./lib/vault/query");

const USAGE = "Usage: node tools/vault-knowledge.js find <keywords> | stats  [--vault <dir>] [--sub <folder,folder>] [--limit <n>]";

function main(argv, io = console) {
  const [cmd, ...words] = argv.filter((a, i) => !a.startsWith("--") && !["--vault", "--sub", "--limit"].includes(argv[i - 1]));
  const vault = opt("vault", argv) || process.env.HARNESS_VAULT;
  if (!vault) throw new CliError(`Set --vault or HARNESS_VAULT.\n${USAGE}`);
  const subs = (opt("sub", argv) || "Conhecimento").split(",");
  const notes = scanVault(vault, subs);
  if (cmd === "stats") {
    const s = vaultStats(notes);
    return io.log(`${s.total} notes: ${s.substantive} substantive (~${s.substantiveTokens} tokens if read whole), ${s.stubs} stubs skipped, ${notes.skipped.length} unreadable (offline OneDrive files)`);
  }
  if (cmd !== "find" || !words.length) throw new CliError(USAGE);
  const hits = findNotes(notes, words.join(" "), Number(opt("limit", argv)) || 5);
  if (!hits.length) return io.log("no substantive note matches; try other keywords");
  for (const { note, score } of hits) {
    const where = [note.meta.area, note.meta.dominio, note.meta.tema].filter(Boolean).join(" > ");
    io.log(`${note.rel} (~${estimateTokens(note.bytes)} tok, score ${score})${note.rel.endsWith(`/${note.title}.md`) ? "" : `: ${note.title}`}${where ? ` [${where}]` : ""}`);
  }
}

if (require.main === module) runAsScript(main);
module.exports = { main };
