# Raw discovery: DAI stories, requirements, DoR/DoD, gates, export, coordination (read-only)

Subagent report, 2026-10-31. DAI repo HEAD 7248777. Nothing run or modified. Paths relative to the DAI repo.

## Dossier and templates
- No example dossier exists; docs/features/ is absent. Real Scrum-like examples exist only under memory/projects/57multimarcas/scrum/ (see below).
- _status.md is markdown only, no frontmatter (skills/orquestracao/sdlc-pipeline/SKILL.md:52-74). Frontmatter exists only for modeling notes (skills/documentacao/obsidian-feature-modeler/references/01-estrutura-do-dossie.md:18-26: tags, aliases, status rascunho|verificado).
- 01-story.md template (skills/produto/requirements-engineering/workflows/write-story.md): title "# <ID> - <title>", Como/quero/para que, sections Criterios de aceite (numbered), Regras de negocio (RN01), Requisitos nao funcionais, Fora de escopo, Perguntas abertas (<question> - <owner>). Gherkin keywords in Portuguese (references/user-stories.md:8-31). Functional requirement template: RF-{{n}}, Status, Rastreio (US, criteria ids, RN) in spec-templates/references/templates/functional-requirements.md. Story/rule id patterns are placeholders only ({{story_id_pattern}}).
- Jira story model (skills/produto/jira-story-publishing/references/story-quality-rules.md): Descricao, Contexto, Historia de usuario, Criterios de Aceitacao, Cenarios de Testes Automatizados (Given-When-Then), cut_marker.
- No field-level templates read for .feature, tests, review, commit-pr, deploy artifacts.

## Skills relevant to backlog and refinement
| Skill | Purpose | Writes files | Jira |
|---|---|---|---|
| produto/requirements-engineering | elicitation, story + INVEST/DoR, impact analysis; output 01-story.md | yes | no |
| metodologias/product-discovery | discovery, MoSCoW and RICE | docs | no |
| produto/agile-ceremonies | setup, planning, daily, review with PO acceptance, retro, impediments, metrics; output sprint goal and sprint backlog | docs | no |
| produto/jira-story-publishing | quality rules, markdown to Jira markup, publish and re-read | publishes | yes |
| documentacao/spec-templates | 9 templates with placeholders | docs | no |
| orquestracao/sdlc-orchestrator | request routing | no | no |
| engenharia/technical-breakdown | story to tasks [BE][FE][TEST][INFRA][DOC] with estimates | yes | no |
| epic-evolution-architect | epics and atomic stories, ADRs, master index (body not read) | unknown | unknown |
- Jira authorization (jira-story-publishing/SKILL.md:41-47, rules/external-systems-read-only.md): per-item authorization every time; read before write; never overwrite existing text; change only the requested field (never title, type, status, epic, assignee); re-read afterwards; do not blindly repeat a POST without response. Config (tracker_base_url, custom_fields, protected_projects, write_exceptions) comes from the project's .agents.md or CLAUDE.md, not the repo.

## DoR, DoD, gates
- DoR: human-judged checklist skills/produto/requirements-engineering/validation/checklist.md (INVEST, numbered verifiable criteria, explicit rules, NFR metric, out-of-scope, dependencies, open questions with owner, prototype reference). rules/acceptance-criteria-required.md makes DoR the precondition of feature-delivery (prompt-enforced).
- DoD: no global file; per story only ("Criterios de DoD" in 03-plano-implementacao.md) and in the legacy orchestrator prompt (.agents/00-sdlc-orchestrator-prompt.md:210-211).
- Gate ids (workflows/feature-delivery/manifest.yaml ~l.310-400): dossier-created (auto), story-approved, bdd-approved, prototype-approved, modeling-approved, implementation-done (build, lint: scriptable), tests-green (suite passes: scriptable; every BDD scenario covered; WCAG), review-clean (human reviewer who is not the author, no blocker), pr-opened (Conventional Commits regex-checkable), deploy-validated (CI green, smoke test). Only `requires` file-existence checks are mechanical; most `checks` are prose judged by agent or user; approval: user. max_retries_per_state 2; tests and review fall back to dev.

## Hotfix
- Stages start, dev, tests, review, commit-pr, deploy, done; story, bdd, prototype, modeling recorded as [~]. policies/routing.md:58 exempts hotfix from "story with acceptance criteria"; routing.md:36 routes small fixes to software-developer. commit-pr and deploy still require explicit confirmation. No post-incident requirement (retro, post-mortem, backfilling the story) found.

## Multi-engine export
- scripts/export_native.py (untracked, read only): engines claude, codex, opencode, antigravity (targets ~/.gemini/antigravity/); no separate Gemini engine. Output dist/<engine>/{skills,agents} (git-ignored). Claude -> ~/.claude/agents and skills via export_claude_code.py; Codex -> ~/.codex/skills; OpenCode -> ~/.config/opencode/{agents,skills}. Workflows become skills dai-workflow-<id>; agents become prompt-only skills dai-agent-<id>.
- Lost on non-Claude engines: manifest tools, hooks, subagent delegation and sandboxing; agent manifest.yaml contents; global rule injection (inject_global_rules is not in export_native.py). Gate machine-readability depends on the engine honoring skill text.

## Concurrency and identity
- Claim/handoff/ledger documented in skills/orquestracao/multi-agent-coordination/ (SKILL.md:42-74, references/runbook-comandos.md): verbs init, status, inbox, claim, start, heartbeat, complete --evidence, handoff --to, notify; providers gemini, codex, claude, opencode; state at projects/<slug>/coordination/state.json. tools/coordination.js is NOT in the DAI repo (tools/ has only notion-sync): documentation without code in this checkout (the code lives in Harness Leca, see ADR-007).
- Inside the dossier: no story id, run id, lock. Dossier keyed by slug. Idempotency limited to the "FAIL n/max_retries_per_state" counter (SKILL.md:37). orchestration/feed.md and docs/HANDOFF_TEMPLATE.md are legacy.

## Existing Scrum overlap in DAI
- memory/projects/57multimarcas/scrum/01-backlog.md (items, Status, Prioridade Sugerida, story link); story ids 57M-001..057M-017 under .../scrum/sprints/sprint-1/57M-0NN/ with 00-visao-geral.md (Status, Prioridade, Tipo, Sprint "A definir", Criado em, Agentes envolvidos), 01-user-story.md, 03-plano-implementacao.md, sometimes 04-handoff-back-qa.md.
- tools/notion-sync/ (not run) syncs the backlog to a Notion Kanban database (fields Historia, Titulo, Status, Prioridade, Tipo, Modulo, Sprint, Agentes DAI, Artefatos DAI, # Backlog, Descricao).
- No lane/kanban concept in the pipeline itself.

## Status table
| Item | Status |
|---|---|
| Story template | Existing |
| Gherkin in story + .feature stage | Existing |
| DoR checklist | Existing (human) |
| DoD (global) | Partial (per story) |
| Gates per stage | Existing (mostly prose, human-approved) |
| Dossier example on disk | Absent |
| Frontmatter in stage artifacts | Partial |
| _status.md machine-readable | Absent |
| Jira write (authorized per item) | Existing |
| Hotfix post-incident requirements | Absent |
| Multi-engine export | Existing (lossy) |
| Claim/handoff/ledger in DAI | Partial (docs only) |
| Story/run id, lock, idempotency key | Absent |

## Unknowns
epic-evolution-architect body; field templates for bdd/tests/review/commit-pr/deploy artifacts; contents of .claude/ and "Claude outputs/"; 02-requisitos.md of the 57M stories; harness/linker identity concept; Notion sync behaviour.
