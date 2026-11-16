# Requirements and Gap Matrix

[Leia em português](02-requirements-and-gaps.md).

> Historical planning note: this document describes the requirements and gaps recorded in the source. This translation preserves the source's status and dates; it is not a new verification of the implementation.

| Area | Status | Problem → evidence → cause | Solution | Impact / risk | Validation |
|---|---|---|---|---|---|
| Chat core | Partial | Core is shared, but `chat-ui-interaction.js` has `toggle*` and `toggleStudio*` handlers; the contract is layout-oriented | Layout adapter and shared commands | High / menus | Same tests across 3 layouts |
| Chat state | Partial | Conversation is in `state.js`, sessions/config in `chat-store.js`; evolution is split | Single `ChatSessionState` with legacy adapter | High / resuming | Switch layouts without losing turns |
| Menus | Partial | z-index ranges from 5 to 99999; independent stacks | Popover primitive, portal, and named layers | Medium / overlap | Keyboard, outside click, 375–1920 |
| Studio | Partial | Resizer supports mouse only and has 300/850 limits in `studio-core.js` | Pointer Events, keyboard, and tokens | High / accessibility | Mouse, touch, keyboard, stable preview |
| Miniwidget | Partial | Same store, custom 304-line CSS | `floating` adapter; split CSS | Medium | Two conversations and dialogs |
| Kanban | Missing for target | `sanitizeStory` and `updateStoryStatus` reduce statuses to 4 | Versioned board/lane/transition/history/blocker | High / migration | Golden tests and rollback |
| Backlog | Partial | Same model, without versioning/concurrency/audit trail | Atomic commands with revision | High / overwrites | Concurrent conflict |
| Layer Map | Partial | Six tabs and responsiveness exist; CSS has 1437 lines | Tokens and CSS by region | Medium / visual | Baselines required |
| Fidelity | Not verifiable | Screenshots were not attached | Obtain source, resolution, and scale | High | Side-by-side comparison |
| Components | Partial | Milestone checklist exists, but UI derives a single `stage` | Independent milestones; derived stage | Medium | Multiple simultaneous milestones |
| Audit | Partial | Metrics exist, without complete execution semantics | Typed `TestEvidence` | High / false positives | Generated never counts as approved |
| Agents | Partial | Events/adapters exist; lane-level binding not found | Versioned `LaneAutomationPolicy` | High / unintended execution | Idempotency and approval |
| Security | Partial | Origin, paths, redaction, permissions, and sanitization exist; proxy changes CSP | Threat model by surface | High | XSS, traversal, CSRF, and logs |

## Current versus expected

- Chat is already partly unified: complete core/UI/layout/context; do not create another one.
- Studio already has a resizer/mobile support: abstraction, touch/keyboard, and responsive matrix are missing.
- Current Scrum is a four-column board, not a twelve-lane workflow.
- Components already have a checklist; preserve it to avoid mutually exclusive milestones.
- Audit calculates indicators, but needs to store execution evidence.
- Orchestration has an event foundation; integrate by contract, without the UI calling the CLI directly.
