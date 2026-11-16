---
domain: tools
module: setup
feature: jira-setup
summary: Jira snapshot export and local query CLIs, plus setup and getting-started docs and agent guides.
paths: [tools/export-jira-snapshot.js, tools/lib/jira-export.js, tools/jira-query.js, tools/jira-refresh.js, tools/lib/jira-snapshot.js, tools/lib/jira-redact.js, tools/lib/jira-summary.js, tests/jira-query.test.js, SETUP.md, SETUP.en.md, docs/setup/*.md, docs/agents/*.md]
keywords: [jira, snapshot, setup, getting-started, bootstrap, adoption, installation, credentials, sync]
updated: 2026-10-30
---
# Jira snapshot and setup docs

| File | Responsibility |
|---|---|
| `docs/setup/VALIDATION-2026-11-16.md` | Bilingual record of isolated checkout checks, test failure and clean-install validation limits. |
| `tools/export-jira-snapshot.js` | CLI that builds the Jira snapshot via REST v2 with `JIRA_BASE_URL` and `JIRA_PAT`. |
| `tools/lib/jira-export.js` | Core of the snapshot export used by the CLI. |
| `tools/jira-query.js` | Offline CLI (`issue`, `sprint`, `search`, `status`, `summary`) over the snapshot and the local board; no network, no token. |
| `tools/jira-refresh.js` | Syncs the snapshot and regenerates the overview. |
| `tools/lib/jira-snapshot.js` | Snapshot reading, search and sprints. |
| `tools/lib/jira-redact.js` | Redacts CPF, CNS, e-mail and phone numbers. |
| `tools/lib/jira-summary.js` | Builds the overview written to `context/jira-resumo.md`. |
| `tests/jira-query.test.js` | Jira query CLI behavior. |
| `SETUP.md` | Entry point of the setup guide, split into the Portuguese files under `docs/setup/` (importers, routines and sync, interface and development). |
| `docs/setup/01-overview.md` | Getting started (English): what the harness does. |
| `docs/setup/02-installation.md` | Getting started: clone, `.env` and the hook. |
| `docs/setup/03-engines-and-credentials.md` | Getting started: install, login and credential location per engine. |
| `docs/setup/04-first-sync.md` | Getting started: first import, sync and export. |
| `docs/setup/05-adopt-existing-projects.md` | Getting started: adoption guide for existing projects. |
| `docs/agents/BOOTSTRAP.md` | Agent guide: phased setup and first sync with checks and stop rules. |
| `docs/agents/ADOPTION.md` | Agent guide: adoption procedure for agents; see `adoption.md` for the CLI. |
| `SETUP.en.md` | English translation of the root installation guide. |
| `docs/setup/01-overview.pt-BR.md` | Portuguese translation of the 01-overview onboarding guide. |
| `docs/setup/02-installation.pt-BR.md` | Portuguese translation of the 02-installation onboarding guide. |
| `docs/setup/03-engines-and-credentials.pt-BR.md` | Portuguese translation of the 03-engines-and-credentials onboarding guide. |
| `docs/setup/04-first-sync.pt-BR.md` | Portuguese translation of the 04-first-sync onboarding guide. |
| `docs/setup/05-adopt-existing-projects.pt-BR.md` | Portuguese translation of the 05-adopt-existing-projects onboarding guide. |
| `docs/agents/BOOTSTRAP.pt-BR.md` | Portuguese translation of the BOOTSTRAP agent guide. |
| `docs/agents/ADOPTION.pt-BR.md` | Portuguese translation of the ADOPTION agent guide. |

| `docs/setup/COMANDOS.md` | Portuguese reference guide: COMANDOS. |
| `docs/setup/COMANDOS.en.md` | English reference guide: COMANDOS. |
| `docs/setup/importadores.md` | Portuguese reference guide: importadores. |
| `docs/setup/importadores.en.md` | English reference guide: importadores. |
| `docs/setup/rotinas-e-sync.md` | Portuguese reference guide: rotinas-e-sync. |
| `docs/setup/rotinas-e-sync.en.md` | English reference guide: rotinas-e-sync. |
| `docs/setup/interface-e-desenvolvimento.md` | Portuguese reference guide: interface-e-desenvolvimento. |
| `docs/setup/interface-e-desenvolvimento.en.md` | English reference guide: interface-e-desenvolvimento. |

- The Scrum side of the sync is in `../../backend/projects/projects-scrum.md` (`scrum-jira-sync.controller.js`, `project-scrum-jira-source.js`).
