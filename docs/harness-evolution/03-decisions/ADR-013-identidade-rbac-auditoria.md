---
id: ADR-013
titulo: Local identity, role-based access control and a tamper-evident audit trail
status: proposta
data: 2026-11-01
historias: [17.04, 17.05, 17.06, 17.10]
tags: [harness-evolution, adr, rbac, auditoria, seguranca]
---

# ADR-013: Local identity, RBAC and a tamper-evident audit trail

## Context

Today the only identity is one shared PIN, enforced for remote access only (`ui/server/config.js:13`, `tools/lib/network-access.js:71-75`). There are no users and no roles. The `actor` of a deploy authorization or a workflow approval is a string sent by the client (`deploy/authorization.service.js:8`, `deploy-actions.service.js:84-143`), so it can be forged. About 89 mutating routes exist and several run commands or write outside ROOT. The event store carries a `trust` field but no authenticated actor, and its retention would prune audit rows (`event-retention.js:19-25`).

The user plans RBAC and audit as part of future maturity.

## Decision

1. **Identity.** Tables `users`, `auth_sessions`, `user_preferences`. Local accounts with a password hash (scrypt from `node:crypto`), server-side sessions in an `HttpOnly`, `SameSite=Lax` cookie, and a loopback bootstrap that creates the first `owner`. The shared PIN becomes a legacy fallback behind a flag and is removed in the last story of the wave.
2. **RBAC.** Tables `roles`, `permissions`, `role_permissions`, `user_roles`, optionally scoped by `project_id`. A permission is a stable string `resource:action` (for example `deploy:execute`, `scrum:write`, `atelier:write`, `audit:read`). Seed roles: `owner`, `admin`, `maintainer`, `contributor`, `viewer`. A route table declares the required permission per route; a missing declaration fails closed (deny) and a test enumerates every route.
3. **Audit trail.** Append-only table `audit_log` written in the same transaction as the change it describes: `id`, `at`, `actor_user_id`, `actor_kind` (`user`, `agent`, `system`), `on_behalf_of`, `project_id`, `action`, `resource_type`, `resource_id`, `outcome` (`allowed`, `denied`, `failed`), `request_id`, `ip`, `before_hash`, `after_hash`, `detail` (redacted JSON), `prev_hash`, `hash`. The hash chains each row to the previous one so tampering is detectable by a verify command. No UPDATE or DELETE statements exist in the code, and a trigger rejects them.
4. **Scope.** Every mutating route and every denied attempt is audited. Reads are audited only for sensitive resources (audit log, users, secrets-adjacent settings). Agent runs record the agent as actor and the human who started them as `on_behalf_of`.
5. **Retention.** The audit log and RBAC tables are exempt from all retention sweeps. Archiving is an explicit, audited export, never a silent delete.
6. **Privacy.** `detail` goes through the same redaction as chat import (secrets, e-mail, CPF, phone). Chat content is never copied into the audit log, only its identifiers.
7. **Rollout.** Audit first, in `observe` mode with the PIN or anonymous actor (17.05). Then identity (17.04), then RBAC in `report-only` mode (log would-be denials), then `enforce` (17.06).

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| Keep the shared PIN and add an actor field | Trivial | Actor stays self-asserted; no revocation; no per-role limits |
| OAuth/OIDC provider | Standard, SSO | Needs network and an external provider; breaks local-first |
| Audit in `events.sqlite` | Reuses the store | Count-based pruning deletes rows; envelope has no actor or hash chain |
| Audit as JSONL with hashes | Simple, diffable | No transactional link to the change; slow verification and queries |
| Policy engine (OPA/Casbin) | Expressive | New dependency for a small permission set |

## Consequences

Positive: a trustworthy actor on every action, least privilege per role and project, forensic trail, ready for multi-user use.

Trade-offs: every route needs a declared permission; login adds friction on a single-user machine (mitigated by the loopback owner bootstrap and a long session); password and session handling raise the security bar (threat model required in 17.04).

Migration: existing `actor` strings in `deploy-actions.jsonl` are imported as `actor_kind=legacy` with their original text; they are never promoted to a real user.

## Review

Revisit when the harness is exposed beyond loopback or the LAN, or when SSO is requested.
