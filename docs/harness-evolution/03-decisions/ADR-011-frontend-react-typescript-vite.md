---
id: ADR-011
titulo: Incremental frontend migration to React 19, TypeScript and Vite (Canvas as first island)
status: aceita
data: 2026-10-31
historias: [16.00, 16.01, 16.02, 16.03, 16.04, 16.05]
tags: [harness-evolution, adr, frontend, react, typescript, vite, biome, canvas]
---

# ADR-011: Incremental frontend migration to React 19, TypeScript and Vite

## Context

The web UI (`ui/public/`) is plain ES modules served as static files, with no bundler and no runtime dependency
(`package.json`: "Sem dependências"; `MAPA.md`: "no bundler"). Types come from JSDoc and `// @ts-check`
(`scripts/types.js` runs TypeScript 5.6.3 from a temp folder). There is no linter config (no Biome).

Measured on 2026-10-31:

| Measure | Value |
|---|---|
| Frontend JS | 344 files, ~44.5k lines; CSS ~16.2k lines |
| Growth | 256 commits since 2026-10-14 |
| `innerHTML` call sites | 308 (each needs a manual `esc()` to be XSS-safe) |
| Manual `addEventListener` | 253 |
| Files split only to respect the 300-line cap | many (`window-store-*.js`, `design-audit-*.js`, `layers-screen-replica-s2..s4`) |

Problems:
- No component or reactivity model: every screen hand-rolls rendering, state and re-render. Line-cap splits are a
  symptom, not a design.
- String templating makes XSS a per-call-site discipline instead of a framework default.
- The Harness Canvas initiative (whiteboard + Whimsical-style mind maps, see `Downloads/workspace-visual/DISCOVERY-REPORT.md`)
  needs Excalidraw and React Flow, which are React-only.
- The existing Ateliê canvas (`ui/public/js/modules/prototype-canvas/`) persists into screen-state, capped at 32 KB
  (`ui/server/services/screen-state/registry.js:60`): not a viable home for boards.

## Decision

1. **Frontend target stack:** React 19 + TypeScript (strict) + Vite, linted and formatted with Biome.
2. **Strangler migration, no big-bang rewrite.** Vite builds multiple entries; new React screens are mounted as islands
   inside the existing shell. Legacy modules keep working untouched and move only when a story already changes them.
3. **Canvas is the first React island:** Excalidraw for free boards; a semantic mind-map model (tree independent of
   graphic IDs) rendered with React Flow and laid out with d3-hierarchy.
4. **Backend unchanged:** Node 22, own router, CommonJS. Only addition: shared request/response schemas (zod) consumed
   by both server and client types, introduced per endpoint.
5. **Out of scope:** the 3D Office (three.js, `office.html`) is not migrated until a story requires it.
6. **The "no bundler / no dependencies" rule is retired** for `ui/` only. `tools/` and `ui/server/` keep the
   zero-runtime-dependency rule.

## Step 1 plan (foundation, story 16.00)

Goal: build pipeline in place, zero behavior change for existing screens.

| # | Task | Done when |
|---|---|---|
| 1 | Branch `feat/frontend-foundation` | branch exists |
| 2 | Add pinned devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@biomejs/biome`; dependencies `react`, `react-dom` | `package-lock.json` committed, exact versions |
| 3 | `ui/web/` as the Vite root for React code (`ui/web/src/islands/`, `ui/web/src/shared/`); `tsconfig.json` strict, separate from `jsconfig.json` | `npm run types` and `tsc -p ui/web` both pass |
| 4 | `vite.config.ts`: build to `ui/public/dist/` with a manifest; dev server proxies `/api` to `node ui/server.js` | `npm run build` produces `dist/manifest.json` |
| 5 | Static controller serves `ui/public/dist/` and an island loader reads the manifest (no change when dist is absent) | legacy UI identical with and without a build |
| 6 | One "hello" island mounted behind a hidden route, with FontAwesome icon, to prove the mount/unmount contract | E2E (playwright-core) opens it and navigates away cleanly |
| 7 | `biome.json` scoped to `ui/web/**` only (legacy untouched to avoid a mass diff) | `npx biome check ui/web` clean |
| 8 | Scripts: `dev:web`, `build`, `lint`; pre-commit runs `biome check` on staged `ui/web` files and `npm audit --omit=dev --audit-level=high` | pre-commit passes |
| 9 | Docs: update `MAPA.md` layout block, `CLAUDE.md`/`AGENTS.md` stack lines, `SETUP.md` (install + build), new map files under `docs/mapa/frontend/web/` | `node tools/mapa.js check` passes |

Island contract (to keep legacy and React decoupled):
`mount(el: HTMLElement, props: { slug: string; params: string[] }) => { unmount(): void }`, registered per route in
the existing `route-apply.js`. Islands talk to legacy code only through the router and `window` CustomEvents already in
use (`harness:*`), never through shared mutable modules.

## Next stories

| ID | Story | Depends on |
|---|---|---|
| 16.01 | Canvas server store: `projects/<slug>/canvas/` (index + per-board JSON, atomic write, `rev`, versioned migrations) | 16.00 |
| 16.02 | Canvas assets: content-addressed upload + GET by hash confined to the board folder (no SVG) | 16.01 |
| 16.03 | Mind-map island: model, commands (Enter/Tab/Shift+Tab, reparent with cycle guard, collapse), undo/redo, d3-hierarchy layout | 16.00, 16.01 |
| 16.04 | Board island: Excalidraw, save/reopen, export, images from 16.02 | 16.01, 16.02 |
| 16.05 | Selection to agent context pack (Markdown + JSON, deterministic char budget) | 16.03 |

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| Keep vanilla ES modules, hand-build Canvas | No new dependencies, no build | Cost of manual DOM keeps growing; Canvas features (freehand, React Flow) rebuilt by hand |
| Angular 18 | Team knows it; batteries included | Excalidraw/React Flow/tldraw are React-only; wrappers per library; heavier for islands |
| Web Components (Lit) | Close to the platform, small | Same library gap as Angular; small ecosystem for canvas/diagramming |
| **React 19 + TS + Vite, incremental (chosen)** | **Native fit for the Canvas libraries; components and safe-by-default rendering; legacy keeps running** | **Build step, npm supply chain, two paradigms during the transition** |
| Big-bang rewrite | One paradigm quickly | Freezes delivery for weeks; high regression risk on 44k lines |

## Consequences

Positive:
- New screens get components, typed props and escaped-by-default rendering.
- Canvas uses mature, MIT-licensed editors instead of a hand-built drawing engine.
- Biome and strict TypeScript give agents fast, deterministic feedback on new code.

Negative / risks and mitigations:
- **Supply chain:** exact version pins, committed lockfile, `npm audit` in pre-commit, review of every new dependency.
- **Two paradigms for a while:** the island contract above is the only bridge; no shared mutable state.
- **Agents need a build to see React screens:** `npm run dev:web` documented in `SETUP.md`; the legacy UI runs without it.
- **Bundle size (Excalidraw is large):** islands are lazy-loaded per route; the main shell does not import them.
- **Line cap still applies** to `.ts`/`.tsx` files (150 to 250, max 300).

## Rollback

Step 1 is additive. Removing the island loader call and the `dist/` serving restores the current UI exactly; the
legacy code is never edited by this ADR. Canvas data lives in its own folder and is unaffected by a rollback.
