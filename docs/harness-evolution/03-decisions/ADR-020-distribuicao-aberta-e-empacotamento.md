---
id: ADR-020
titulo: Open self-hosted distribution, bring-your-own-keys and packaging order
status: proposta
data: 2026-11-23
historias: [25.08, 25.09]
tags: [harness-evolution, adr, distribuicao, docker, desktop, licenca]
---

# ADR-020: Open self-hosted distribution, bring-your-own-keys and packaging order

## Context

The owner shares the Harness as an assembly of existing ideas under a "knowledge without borders" stance. Audience: students of AI courses built on the Harness, and engineers who want something ready to use without setup overhead. Monetization is indirect (courses, voluntary donations). No subscription service is planned. The backend is Node without runtime dependencies, uses `node:sqlite` (ADR-012) and runs local agent CLIs with computer access. EP-23 decided that desktop comes later and that the host selector (23.06) is what a desktop app would reuse.

## Decision

1. **Open and self-hosted.** The repository is public with setup docs. Each user runs it locally or on their own VPS. No multi-tenant isolation, billing or shared-key gateway is built.
2. **Bring your own keys.** Each user configures their LLM keys in their own 9Router. Keys never enter git (`.gitignore` plus the secret refusal already in `tools/memory.js`).
3. **Docker first.** One image, one persistent volume (SQLite, blobs, git data), `docker compose up`, first-run wizard. The server listens on `127.0.0.1` by default. Exposing it on a VPS is documented with a warning to put authentication in front (reverse proxy with basic auth at minimum).
4. **Repository mode stays.** `npm run ui` keeps working for engineers. Docker is a wrapper, not a replacement.
5. **Desktop later, by demand.** A thin Electron shell (window plus embedded Node pointing at the same local server) is built only when promotion criteria are met: at least 5 users who cannot use Docker (for example Windows without WSL2) report it, and a signing path exists (Windows certificate, Apple Developer account). Until then, no desktop code.
6. **License is the owner's decision** (MIT or Apache-2.0 for maximum reuse, AGPL-3.0 to keep hosted forks open). Story 25.09 records the choice here as an amendment and adds `CREDITS.md` listing sources and licenses of incorporated components.
7. The UI talks to the server only over HTTP on localhost, with no assumption that the client is a browser tab, so a future desktop shell needs no backend change.

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| SaaS with one container per tenant | Easy onboarding | Third-party code on your infrastructure; billing, support and security burden fall on one person |
| Electron now | Best first run for lay users | Code signing, three operating systems, auto-update and agent CLI discovery maintained by one person |
| Repository only, no Docker | Zero packaging work | Setup overhead for students and engineers alike |
| PWA or `--app` shortcut | Cheap window | Does not install Node or agents |

## Consequences

- Packaging work is useful to every audience and does not depend on a business model.
- The first-run wizard must detect `git` and agent CLIs and guide installation, with or without Docker.
- Revisit this ADR when promotion criteria for desktop are met, or if a hosted offering is ever wanted.
