---
domain: intelligence
module: hia
feature: automation
summary: HIA Intelligence & Automation: registry, context engine, routing, guard, telemetry, benchmark and dashboard.
paths: [docs/harness-intelligence/*.md, schemas/hia-*.schema.json, tools/hia*.js, tools/lib/hia/*.js, tools/lib/engines/ollama.js, tests/hia-*.test.js, ui/server/controllers/hia.controller.js]
keywords: [hia, intelligence, automation, script-first, local-first, router, registry, context-engine, ollama, benchmark]
updated: 2026-10-31
---
# Intelligence and Automation (HIA)

| File | Responsibility |
|---|---|
| `docs/harness-intelligence/README.md` | Dossier index of the initiative (Script-First, Local-First, Cloud-on-Demand) and the status of each document. |
| `docs/harness-intelligence/01-current-state-audit.md` | F0: audit of engines, injected context, metrics, infrastructure and opportunities, facts separated from hypotheses. |
| `docs/harness-intelligence/02-target-architecture.md` | F1: target architecture in 5 pillars, modules, execution flow and integration with existing engines. |
| `docs/harness-intelligence/03-technical-decisions.md` | F1: ADR-HIA-001 contracts, 002 subagent fan-out, 003 fallback policy and 004 Ollama runtime. |
| `docs/harness-intelligence/04-implementation-backlog.md` | F1: detailed backlog HIA-001 to HIA-014 with dependencies, acceptance criteria and priorities. |
| `docs/harness-intelligence/06-security-and-quality.md` | F1: security governance (allowlist, path traversal, secret obfuscation) and quality (anti-monolith under 300 lines, FontAwesome). |
| `schemas/hia-task.schema.json` | F1: canonical JSON Schema (Draft-07) contract for task and intent definitions in HIA. |
| `schemas/hia-execution.schema.json` | F1: canonical JSON Schema contract for telemetry and task execution records. |
| `schemas/hia-tool.schema.json` | F1: canonical JSON Schema contract for the Automation Registry (safe deterministic scripts). |
| `schemas/hia-model.schema.json` | F1: canonical JSON Schema contract for the Model Registry (capabilities, RAM/CPU requirements and costs). |
| `tools/hia.js` | F2: CLI to inspect and safely run Automation Registry tools (`npm run hia`). |
| `tools/lib/hia/registry.js` | F2: declarative catalog of deterministic Harness tools with schema validation. |
| `tools/lib/hia/executor.js` | F2: safe executor with path sandbox, command sanitizing, timing metrics and timeouts. |
| `tests/hia-registry.test.js` | F2: unit tests of the Automation Registry and execution safeguards. |
| `tools/lib/hia/context-engine.js` | F3: selective Context Engine with scopes (minimal/project_only/full), MAPA.md slicer and token estimate. `getMapSection` slices map sections, joining the parts of a split section. |
| `tools/lib/hia/index-cache.js` | F3: in-memory SHA-256 hash cache for incremental indexing of context files. |
| `tests/hia-context.test.js` | F3: unit tests of the Context Engine, scopes and on-demand slicing. |
| `tools/lib/hia/hardware-profiler.js` | F4: measures AMD Ryzen 5 CPU and host RAM capacity with safe thread allocation and free-RAM alert. |
| `tests/hia-hardware.test.js` | F4: unit tests of the hardware profiler and safety limits. |
| `tools/lib/engines/ollama.js` | F4: local Ollama CPU engine adapter with SSE streaming, RAM guard and model listing. |
| `tests/hia-ollama.test.js` | F4: unit tests of the Ollama engine and resilient daemon error handling. |
| `docs/harness-intelligence/05-benchmark-plan.md` | F4: benchmark plan and empirical evaluation criteria for local models. |
| `tests/fixtures/benchmark/intent-classification.json` | F4: versioned dataset for intent classification and extraction benchmark. |
| `tools/lib/hia/benchmark.js` | F4: automated benchmark runner of local models against versioned datasets. |
| `tests/hia-benchmark.test.js` | F4: unit tests of the benchmark runner. |
| `tools/lib/hia/model-registry.js` | F5: canonical catalog of models, contexts, tiers and technical capabilities. |
| `tools/lib/hia/router.js` | F5: layered smart router (Script-First, Local-First, Cloud) with feature flag `HIA_ROUTING_ENABLED`. Cloud decisions also carry an informative `suggestedCombo`. |
| `tools/lib/hia/combo-map.js` | Pure map from SDLC task type to 9Router combo (`9router/harness-*`): keyword classifier and `suggestCombo`; experiment combos (fusion, smart) are excluded. |
| `tests/hia-combo-map.test.js` | Unit tests of the classifier, the general fallback and the model reference format. |
| `tools/lib/hia/quality-gate.js` | Model-free answer check used by the opencode engine: flags empty, truncated (`finish: length`) and fake tool-call answers that 9Router returns as HTTP 200; flags only, never retries. |
| `tests/hia-quality-gate.test.js` | Quality gate tests with real fake tool-call outputs, plus false-positive and truncation cases. |
| `tests/hia-router.test.js` | F5: unit tests of routing decisions and flag-based disabling. |
| `tools/lib/hia/guard.js` | F6: Resource Governor (max concurrency 1 for CPU) and loop repetition detector. |
| `tools/lib/hia/telemetry.js` | F6: JSONL telemetry persistence with execution metrics and tokens saved. |
| `tests/hia-guard.test.js` | F6: unit tests of the Execution Guard, concurrency and telemetry. |
| `ui/server/controllers/hia.controller.js` | F7: REST endpoint `GET /api/hia/metrics` exposing telemetry, hardware and router configuration. |
