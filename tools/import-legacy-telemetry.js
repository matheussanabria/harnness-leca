#!/usr/bin/env node
// @ts-check
// Imports logs/telemetry/{hia-executions,runtime-shadow}.jsonl into the EP-09 event store of a project.
// Idempotent, marked origin=legacy / quality=unknown. Legacy files are only read, never changed.
//   node tools/import-legacy-telemetry.js --project <slug> [--dry-run | --apply] [--files a.jsonl,b.jsonl] [--json]
const path = require("path");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { importLegacyTelemetry } = require("./lib/telemetry-import");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

function run(argv, io = console) {
  const slug = opt("project", argv);
  if (!slug || slug.startsWith("--")) throw new CliError("Missing --project <slug>.");
  if (!SLUG_RE.test(slug)) throw new CliError(`Invalid project slug '${slug}'.`);
  if (flag("apply", argv) && flag("dry-run", argv)) throw new CliError("Use either --apply or --dry-run, not both.");
  const rawFiles = opt("files", argv);
  const files = rawFiles && !rawFiles.startsWith("--") ? rawFiles.split(",").map((f) => f.trim()).filter(Boolean) : undefined;
  if (flag("files", argv) && !files) throw new CliError("--files needs a comma-separated list of paths.");
  const summary = importLegacyTelemetry({ slug, apply: flag("apply", argv), files });
  if (flag("json", argv)) {
    io.log(JSON.stringify(summary, null, 2));
  } else {
    io.log(`Legacy telemetry import for '${summary.slug}' (${summary.mode})`);
    for (const f of summary.files) {
      const note = f.error ? ` ERROR: ${f.error}` : "";
      io.log(`- ${path.basename(f.file)}: read=${f.read} imported=${f.imported} duplicate=${f.duplicate} invalid=${f.invalid} flagged=${f.flagged}${note}`);
      for (const s of f.invalidSamples) io.log(`    invalid line ${s.line}: ${s.reason}`);
    }
  }
  if (summary.files.some((f) => f.error)) process.exitCode = 1;
  return summary;
}

module.exports = { run };
if (require.main === module) runAsScript(run);
