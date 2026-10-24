---
id: ADR-TEL-007
titulo: "Privacy: metadata only by default, text behind an explicit flag, sanitization at ingest"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T07, T1.2, T3.1, T5.x]
tags: [harness-telemetria, adr]
---

# ADR-TEL-007: Privacy

Evidence labels: verified, documented, assumption.

## Context

- Ingest does no sanitization: `POST /events` stores `body.payload` as-is with a 256 KB cap; the documented "no secrets in log" rule is not enforced (`central-events.controller.js:101`, `09.02:52`) (A1 section 3 P1). Verified.
- `normalizeEvent` accepts any `type` string and `trust=declared` although the contract allows only observed and inferred (`event-store.js:25,92-93`; `10-contrato:94`) (A1 section 3 P1). Verified.
- `POST .../events` is an open loopback publish endpoint; `GET /events` and `/projections` have no loopback check (`controller:74,93`) (A1 section 3 P5). Verified.
- Prompts and history flow through every spawn site (for example `claude.js:34-38`); the payload policy (hash, length or none) was undecided (A4 section 7 item 7). Verified flow, policy open.
- The runtime-shadow writer already uses an explicit field allowlist and stores no prompt text; the test asserts no raw prompt (`runtime/telemetry.js:42-59`, `runtime-local.test.js:155-181`) (A2 section 2.2, 8). Verified. The hia writer spreads the caller object with no allowlist (`...record`) (A2 section 2.1). Verified.
- Engines can export prompt and tool text: Claude `OTEL_LOG_USER_PROMPTS` and `OTEL_LOG_TOOL_DETAILS`; Gemini `logPrompts` defaults to true (A5 section 2.1, 2.3, 4). Documented. Claude transcripts and Codex rollouts contain prompt content, so parsers must drop text at read time (A5 section 4). Documented/observed.
- `security-by-default` global rule: validate and sanitize inputs, no sensitive data in logs, DTOs with allowlists, size limits, paths normalised and confined.
- Plan assumption: no prompt text is persisted by default (plan section 2). Data policy: no secrets, credentials or PII in produced artifacts.
- `events.sqlite` lives under `projects/`; its git-ignore status is unconfirmed (A1 section 4). Assumption.

## Decision

1. Default is metadata only: ids, types, timestamps, counts, token numbers, durations, model and tool names, status and error class. No prompt text, completion text, tool arguments, tool output, file contents or absolute user paths.
2. Text capture is off by default and enabled only by an explicit flag (name to be set in T1.2), scoped to project and engine, recorded in the event as `contentCaptured=true` with the flag source, and stored in a separate payload field that retention can drop independently. Turning the flag on never enables Claude `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS` or Gemini `logPrompts` implicitly; the launcher sets them off explicitly when injecting env.
3. Sanitization happens at ingest, in the one ingest function all sources share (ADR-TEL-002), before anything reaches SQLite:
   - type allowlist; unknown types rejected or quarantined;
   - per-type payload allowlist of fields (no mass assignment);
   - strip secret-shaped values (tokens, keys, authorization headers, `.env` style pairs) and replace with a marker;
   - normalise paths to project-relative; reject paths outside the project root;
   - cap string length and payload size (keep the 256 KB ceiling, add lower per-field caps);
   - reject `trust=declared` where the contract forbids it;
   - rate limit the publish endpoint per source.
4. Adapters drop text fields at read time, before building the event, so text never exists in the ingest path unless the flag is on. Fixtures used in tests are sanitized.
5. Read endpoints (`GET /events`, `/projections`, SSE) get the same loopback or access check as publish; the receiver (when built) binds loopback and requires authentication.
6. Failures are generic to the client: no stack traces, detail only in a protected log.
7. Legacy importer applies the same allowlist; legacy rows keep only the fields already allowlisted by the runtime-shadow writer; the hia `...record` extras are dropped.
8. `events.sqlite` must be git-ignored and excluded from any export before usage data is stored.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Capture full prompts and tool text for richer analysis | Debuggability, skill detection from text | Secrets and PII leak into a durable local file; text volume; conflicts with data policy and `security-by-default` |
| Hash prompts instead of dropping | Allows duplicate detection | Hash of low-entropy text is reversible by guessing; adds little over lengths and ids; can be added later behind the flag |
| Sanitize at read time (UI) | Raw data kept for later | Raw secrets persist on disk and in backups; fails closed only if every reader cooperates |
| Rely on engine-side redaction | Less code | Engine defaults differ (Gemini `logPrompts=true`); no control over versions |
| Encrypt text at rest instead of excluding | Retains content | Key management burden; does not remove the need to minimise; out of scope for a local harness |
| Per-adapter sanitization only | Close to source | Inconsistent; one missed adapter leaks; central ingest is the enforcement point |

## Consequences

- Easier: small log, safe backups and exports, defensible default; a single place to audit.
- Harder: lower diagnostic richness by default; skill and tool evidence relies on names and ids, not text; sanitizer false negatives are possible and need tests with realistic secret shapes.
- Per-type payload schemas must be maintained as new event types are added.
- The text-capture flag adds a configuration surface and a retention class that must be documented.
- Access checks on read endpoints change current behaviour; the Central client must be checked (assumption on impact).

## Verification

- Sanitizer unit tests: secret-shaped strings, absolute paths, oversized fields, unknown fields, and `trust=declared` are rejected or scrubbed.
- Adapter fixture tests assert no text field survives with the flag off.
- Launcher test asserts prompt and tool-detail export variables are not enabled by default.
- Endpoint tests: non-loopback requests to publish and read are refused.
- Scan test: a script greps `events.sqlite` produced by the fixtures for known canary strings placed in fixture prompts; zero hits with the flag off.
- `git check-ignore` on `events.sqlite` before release.
- `security-engineer` review on ingest and receiver (plan section 7).

## Evidence references

- A1 `event-store.js:25,92-93`; `central-events.controller.js:74,93,101`; `10-contrato:94`; `09.02:46,52` - verified/documented.
- A2 `runtime/telemetry.js:42-59`; `hia/telemetry.js` (`...record`); `runtime-local.test.js:155-181` - verified.
- A4 `claude.js:34-38`; privacy question 7 - verified flow.
- A5 section 2.1, 2.3, 4 (prompt and tool-detail export variables, `logPrompts`, transcripts contain prompts) - documented/observed.
- Git-ignore status of `events.sqlite`, sanitizer coverage of real secret shapes, impact on Central client - assumption.
