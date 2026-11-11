---
domain: tools
module: rastreio
feature: historias
summary: Story to files traceability from git history (commit subjects keyed DIS-n), for the stories board "candidate files".
paths: [tools/rastreio-historias.js, tools/lib/rastreio/historias.js, tests/rastreio-historias.test.js]
keywords: [rastreabilidade, historia, jira, git log, commits, arquivos, quadro, DIS-XXX, placeholder, dedupe]
updated: 2026-11-11
---
# Story to files traceability (git history)

Run: `node tools/rastreio-historias.js --repo api=<dir> --repo web=<dir> [--prefix DIS] [--story DIS-443] [--out file.json]`. Read-only on the repositories; JSON goes to stdout when `--out` is absent.
Source: `git log --all --no-merges --name-only` per repo. Subject formats read: `KEY Title | type(scope): desc`, `KEY Title`, `KEY - Title`. Anything else counts in `semChave`.
Placeholder `DIS-XXX` is resolved to the numeric key other commits use with the same story title. The same commit rewritten on several branches (same description and file set) counts once, numeric key preferred. Lockfiles, `node_modules/` and `dist/` are dropped.
Output: `{ geradoEm, repos, semChave, historias: { KEY: { titulos, commits, repos: { name: [{ path, commits, ultimo }] } } } }`.
Not the rule to code to test gate (`tools/rastreio/`): that is another axis, this one only links stories to files.

| File | Responsibility |
|---|---|
| `tools/rastreio-historias.js` | CLI: arguments, per-repo reading, JSON output and summary line. |
| `tools/lib/rastreio/historias.js` | Subject parser, `git log` reader, dedupe, placeholder resolution and per-story aggregation. |
| `tests/rastreio-historias.test.js` | Parser formats, placeholder, lockfile and legacy subjects, cross-branch dedupe, CLI. |
