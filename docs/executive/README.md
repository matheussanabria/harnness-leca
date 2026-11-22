# Executive log and report

Goal: at any point, produce an executive report of everything that was done, with numbers and evidence that can be checked. Two parts: a short **log** that agents write as they work, and a **fact sheet** generated from it plus git, stories and dossiers. The report itself is written from the fact sheet.

## What goes where

| Source | Holds | Written by |
|---|---|---|
| Git history | What changed, when, how many files and lines | commits |
| Stories (`docs/harness-evolution/02-epics/`) | Scope, status, evidence section | the delivery route |
| Dossiers (`docs/features/<slug>/`) | Route, stages done, skipped (with reason) or open, screenshots | the delivery route |
| ADRs (`docs/harness-evolution/03-decisions/`) | Architecture decisions | architecture work |
| **Executive log (`docs/executive/log.jsonl`)** | What none of the above keeps: decisions taken in conversation, findings, corrections (including our own mistakes), user approvals, pending items, headline metrics | **`node tools/exec-log.js add`** |
| `projects/<slug>/context/diario/` | Raw activity per day (requests, files touched) from the chats; not outcomes | `tools/daily-journal.js` |

The log is not a diary of actions. One entry is a fact someone reading the report should know, in one or two sentences, pointing to proof.

## When to add an entry (agents: do it as you go, not at the end)

| Kind | Add one when |
|---|---|
| `delivery` | A story or fix reached main (or the branch is ready and verified). Put the dossier and the merge commit as evidence; headline numbers in `--metrics`. |
| `decision` | A choice with consequences was made (stack, scope cut, route, trade-off). Say what was chosen and what was rejected. |
| `finding` | Something learned that changes understanding (a limit of a library, a real cause). |
| `correction` | Something was wrong and was fixed, **including a wrong statement or mistake of the agent**. Say what was believed, what is true, how it was found. Never hide these. |
| `approval` | The user approved or accepted something (a prototype, an epic, a merge). |
| `pending` | Work or a decision is open and someone has to act. Close it later with a new entry that has `--resolves L-nnnn`. |
| `risk` | Something may go wrong and is not fixed. Same closing rule as `pending`. |
| `metric` | A measured number worth keeping on its own (suite size, timing). Needs `--metrics`. |

## Commands

```
node tools/exec-log.js add --kind delivery --title "Short title" --summary "One or two sentences." \
     --epic EP-24 --story 24.03 --evidence docs/features/motion-player/_status.md,fc0f606 \
     --metrics tests_pass=2889,tests_fail=0 [--key unique-key] [--resolves L-0007] [--date AAAA-MM-DD]
node tools/exec-log.js list [--kind k] [--epic EP-24] [--from D] [--to D]
node tools/exec-log.js verify                       # every evidence file and commit must exist; ids unique
node tools/exec-log.js report --from 2026-11-21 --to 2026-11-22 [--epic EP-24] [--out file.md]
```

- Text is English and short (title up to 120 characters, summary up to 700). The report is written in the reader's language from it.
- **No secrets, no personal data.** The command refuses text that looks like a credential, e-mail, CPF or phone number.
- `--key` makes `add` idempotent: the same key twice adds nothing.
- Evidence is a repository path, a commit hash (7 to 40 hex characters) or a URL. `verify` fails on a path or commit that does not exist, so run it before writing a report.

## Producing the report

1. `node tools/exec-log.js verify` and fix what it lists.
2. `node tools/exec-log.js report --from <first day> --to <last day> --out <scratch>/fact-sheet.md`.
3. Read the sheet. It has totals (commits by type, files, lines, stories, dossiers), the stories table, dossiers with stage counts, the log sections, a metrics table, **open items** and an evidence index.
4. Write the report for its reader. Suggested structure: executive summary (five lines); what was delivered; decisions; quality and tests; problems found and corrections; risks and pending; next steps; evidence appendix.
5. **Cite only what is on the sheet.** A number that is not there is measured again or left out. Mistakes listed under corrections stay in the report, stated plainly.
6. Publish as the reader needs (a page or a PDF). Say who the report was written for.

The entries up to L-0019 (2026-11-21 and 2026-11-22) were reconstructed afterwards from commits, dossiers and the conversation, each with its dossier or commit as proof. From L-0020 on, entries are written as the work happens.
