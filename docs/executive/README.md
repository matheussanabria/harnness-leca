# Executive log and report

Goal: at any point, produce an executive report of everything that was done, with numbers and evidence that can be checked. The report is one command, `npm run report` (`tools/exec-report.js`). It reads git, the story files, the feature dossiers and a short **log** that agents write as they work (`docs/executive/log.jsonl`, managed by `tools/exec-log.js`).

## What goes where

| Source | Holds | Written by |
|---|---|---|
| Git merges on main | What was delivered, when, how many commits and lines | the delivery route (subjects like `Merge EP-24.06: ...`) |
| Stories (`docs/harness-evolution/02-epics/`) | Scope, status, acceptance criteria, `**Pendente:**` and `**Divergência:**` bullets in the evidence section | the delivery route |
| Dossiers (`docs/features/<slug>/`) | Route, stages done, skipped (with reason) or open, screenshots | the delivery route |
| ADRs (`docs/harness-evolution/03-decisions/`) | Architecture decisions | architecture work |
| **Executive log (`docs/executive/log.jsonl`)** | What none of the above keeps: decisions taken in conversation, findings, corrections (including our own mistakes), user approvals, open items, headline metrics | **`node tools/exec-log.js add`** |
| `projects/<slug>/context/diario/` | Raw activity per day (requests, files touched) from the chats; not outcomes | `tools/daily-journal.js` |

The log is not a diary of actions. One entry is a fact a reader of the report should know, in one or two sentences, pointing to proof. **Entries are written in Portuguese**, like the stories: the report quotes them as they are, so the reader gets one text in one language. Code, tool output and this file stay in English.

## When to add an entry (agents: do it as you go, not at the end)

| Kind | Add one when |
|---|---|
| `delivery` | A story or fix reached main. Evidence: the dossier and the merge commit; headline numbers in `--metrics`. |
| `decision` | A choice with consequences was made (stack, scope cut, route, trade-off). Say what was chosen and what was rejected. |
| `finding` | Something learned that changes understanding (a limit of a library, a real cause, a divergence from a story). |
| `correction` | Something was wrong and was fixed, **including a wrong statement or mistake of the agent**. Say what was believed, what is true and how it was found. Never hide these. |
| `approval` | The user approved or accepted something (a prototype, an epic, a merge). |
| `pending` | An item is open and someone has to act, **and it is not already a `**Pendente:**` bullet in a story**. Close it later with a new entry that has `--resolves L-nnnn`. |
| `risk` | Something may go wrong and is not fixed. Same closing rule as `pending`. |
| `metric` | A measured number worth keeping on its own (suite size, timing). Needs `--metrics`. |

## Commands

```
node tools/exec-log.js add --kind delivery --title "Título curto" --summary "Uma ou duas frases." \
     --epic EP-24 --story 24.03 --evidence docs/features/motion-player/_status.md,fc0f606 \
     --metrics testes_passaram=2889,testes_falharam=0 [--key chave-unica] [--resolves L-0007] [--date AAAA-MM-DD]
node tools/exec-log.js list [--kind k] [--epic EP-24] [--from D] [--to D]
node tools/exec-log.js verify                     # every evidence file and commit must exist; ids unique
npm run report -- --since 2026-11-21 [--until 2026-11-22] [--out relatorio.md]   # same as: node tools/exec-log.js report ...
```

- Title up to 120 characters, summary up to 700.
- **No secrets, no personal data.** The command refuses text that looks like a credential, e-mail, CPF or phone number.
- `--key` makes `add` idempotent: the same key twice adds nothing.
- Evidence is a repository path, a commit hash (7 to 40 hex characters) or a URL. `verify` fails on a path or commit that does not exist, so run it before reporting.

## What the report contains

Summary; deliveries per epic with status and merge; other deliveries; **decisions**, **findings and corrections**, **approvals** and **quality** (metrics table and one row per dossier: route, stages done, skipped with reason, open, evidence files) from the log and dossiers; **pending items** (from the stories and the open log items); plan changes; evidence cited. The summary warns when a story marked as concluded still has unchecked acceptance criteria.

## Producing the report

1. `node tools/exec-log.js verify` and fix what it lists.
2. `npm run report -- --since <first day> --until <last day> --out <scratch>/relatorio.md`.
3. Read it. Everything in it comes from git, the stories, the dossiers or the log, so a number that is not there is measured again or left out.
4. For a reader who is not the user, write a version for that reader from it (a page or a PDF on request) and say who it was written for. Corrections stay in, stated plainly.

The entries up to L-0023 (2026-11-21 and 2026-11-22) were reconstructed afterwards from commits, dossiers and the conversation, each with its dossier or commit as proof. From the next entry on, they are written as the work happens.
