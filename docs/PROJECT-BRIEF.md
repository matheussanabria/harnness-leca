# Harness: project brief

Language: [Português](PROJECT-BRIEF.pt-BR.md) | **English**

Snapshot: 2026-11-16. Audience: new contributors and external LLM reviewers.
This describes repository capabilities, not a certification that every integration works on a fresh installation.

## Purpose

Harness is a local-first workspace for developers using multiple AI coding engines. It organizes project instructions, curated memory, reference files and conversation history so that work can continue across tools and sessions.

Beyond conversation management, the repository includes visual prototyping, project boards, agent workflows, traceability checks and activity monitoring. These support a developer supervising AI-assisted work; their presence does not imply fully autonomous delivery.

## Capabilities and evidence

| Area | Responsibility | Source / navigation |
|---|---|---|
| Projects | Organize instructions, memory, context, chats and routines; adopt existing repositories | [Overview](setup/01-overview.md), [adoption](setup/05-adopt-existing-projects.md) |
| Ingestion | Import histories into Markdown and redact recognized sensitive patterns | [Sync entry point](../tools/sync.js) |
| Knowledge | Curate memory and export context; rebuild Claude sessions | [Memory CLI](../tools/memory.js), [context export](../tools/export-context.js), [session export](../tools/export-claude-sessions.js) |
| Chat | Select engine adapters and stream responses with project context | [Engine registry](../tools/lib/engines/index.js) |
| Studio and design | Edit source, work with prototypes, design systems, inspection and visual boards | [Studio map](mapa/frontend/studio/studio-review-skills.md), [Atelier map](mapa/frontend/design/atelier.md), [Canvas map](mapa/frontend/canvas/canvas-board-island.md) |
| Delivery | Manage Scrum activities, skills, workflows and coordination records | [Domain routes](../ui/server/routes/index.js), [coordination map](mapa/backend/orchestration/coordination.md) |
| Quality and visibility | Record sessions, events and usage; provide traceability gates and checks | [Session map](mapa/intelligence/runtime/sessions.md), [gate map](mapa/tools/gates/harness-gates.md), [test map](mapa/tools/testing/running-tests.md) |

Chat adapters include Claude, Codex, Gemini, OpenCode and Ollama. Availability depends on installation, authentication and configuration. Default `sync` imports Claude Code, Gemini/Antigravity and OpenCode; Codex history import is separate. Chat support and default sync coverage are different capabilities.

## Architecture and information flow

```text
Engine histories -> import and redaction -> project chats
Project chats -> extraction and review -> curated memory
Instructions + memory + selected context -> engine context / chat
Browser UI -> Node HTTP routes -> controllers and services
Services -> local artifacts / external project repositories / engine adapters
```

Context selection varies by screen. Project chat, Atelier and board interactions must not be assumed to receive identical context; see [context by surface](architecture/01-chat-context-by-surface.md).

| Location | Responsibility |
|---|---|
| `tools/`, `tools/lib/` | CLI operations, import/export, memory, engine adapters and shared logic |
| `ui/server.js`, `ui/server/` | Node HTTP entry point, domain routes, controllers and services |
| `ui/public/` | Existing HTML, CSS and browser JavaScript interface |
| `ui/web/` | React/TypeScript islands built with Vite into `ui/public/dist/` |
| `projects/<slug>/` | Local project knowledge and operational artifacts |
| `global/` | Shared configuration and local user context |
| `tests/`, `scripts/` | Automated tests, integrity checks and development utilities |
| `docs/` | Setup, architecture, decisions, evolution plans and responsibility maps |

[package.json](../package.json) declares Node >=22.13. Backend and CLI code use Node built-ins; frontend dependencies include React, Excalidraw and Mermaid. React islands require dependency installation and a build. The Claude context hook uses PowerShell; documented onboarding targets Windows.

## Data and execution boundaries

Project knowledge is primarily stored as local files, including Markdown and JSON. Import sources include engine JSONL histories and OpenCode's SQLite store. Configuration may also reference an external project repository; its files and the Harness project directory are distinct.

Local-first describes storage and orchestration. A configured cloud engine can receive context externally. Ollama provides a local engine option. Redaction is heuristic, not a guarantee that imported material is safe to share.

A fresh clone needs its own configuration, project creation/adoption and engine setup. Local project data and credentials are not an onboarding package. Save memory through `node tools/memory.js save`; do not manually edit the generated memory index.

## Current state and future plans

The capability table is grounded in source entry points and module maps. It does not assert end-to-end validation of every feature.

The [architecture index](architecture/README.md), dated 2026-11-13, records gaps involving shared chat context, configuration resolution and validation coverage. Recheck those findings against code before treating them as a current backlog. The [evolution index](harness-evolution/00-index.md) contains plans and delivery history; planned features are not automatically shipped features.

The documentation audit on 2026-11-16 found conflicting installation instructions, machine-specific links and map validation failures. This documentation effort has not yet validated installation on a clean machine.

A future white paper, infographic or slide deck should use this brief as its factual base and separately present the validated project plan: problem, current capabilities, target architecture, milestones, dependencies, risks and success measures. Delivery dates and commitments require an approved plan.

The [initial assessment and plan in English](harness-evolution/README.en.md) provides historical background. Its Phase 0 proposals must not be presented as the current delivery status.

## Reading paths

- **External LLM review:** supply this brief and the specific question. Add a relevant architecture page or module map for implementation-level advice.
- **New contributor:** read the [overview](setup/01-overview.md), [installation](setup/02-installation.md) and [bootstrap](agents/BOOTSTRAP.md). Also read the React build section in [SETUP.en.md](../SETUP.en.md).
- **Find code:** start with [MAPA.md](../MAPA.md), run `node tools/mapa.js find <topic>`, then read the matching module map.
- **Understand evolution:** read the [architecture index](architecture/README.md) and [evolution index](harness-evolution/00-index.md), distinguishing proposals from implementation.

Suggested prompt for another LLM:

> Assess this project against [objective]. Distinguish supplied facts from assumptions. Prioritize suggestions by benefit, effort and dependencies. Identify missing evidence before recommending implementation. Do not assume roadmap items are delivered.

Maintain this brief when capabilities, execution boundaries or major architectural choices change. Verify claims against source entry points; keep detailed file inventories in module maps.

Update the Portuguese and English versions together. References may still lead to documents available in only one language.
