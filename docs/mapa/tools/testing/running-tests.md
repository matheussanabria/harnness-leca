---
domain: tools
module: testing
feature: running-tests
summary: How to run the test suite, git hooks for affected tests, and screen-state and workflows regression tests.
paths: [scripts/pre-commit.js, scripts/lib/affected-tests.js, .githooks/pre-push, tests/helpers/**, tests/affected-tests.test.js, tests/screen-*.test.js, tests/design-workflows-*.test.js, scripts/lib/web-gates.js, scripts/e2e-island-lab.js, tests/web-gates.test.js, tests/island-loader.test.js]
keywords: [tests, npm test, e2e, islands, biome, web-gates, node --test, pre-commit, pre-push, affected tests, fixtures]
updated: 2026-10-31
---
# Running Tests

- Whole suite: `npm test` (native Node test runner).
- Single file: `node --test tests/<name>.test.js`; per-suite files are listed in the suites page of this folder.
- Hooks run only affected tests on commit and the full suite on push.
- React islands (ADR-011): `npm run types:web`, `npm run lint:web`, and `npm run e2e:web` (headless Edge, own server on port 4399).

| File | Responsibility |
|---|---|
| `scripts/pre-commit.js` | Pre-commit hook: local data, secrets, MAPA, check of staged files and affected tests (EP-14.02). `missingFromMapa` blocks new files unless the map changes in the same commit or the path, name or folder already appears in it. |
| `scripts/lib/affected-tests.js` | Maps a staged file to tests by name and direct `require`/`import`; without a map uses the fixed contract. |
| `.githooks/pre-push` | Runs the full suite on push (and full regression when `quality/regression-enforced` exists). |
| `tests/affected-tests.test.js` | Regression of affected-test selection, restricted check and the pre-push hook. |
| `tests/screen-registry.test.js` | Registry of the 14 screens, field sanitizing, 64 KB limit and coverage of old `localStorage` keys (EP-14.04). |
| `tests/screen-state-store.test.js`, `tests/screen-state-http.test.js` | Per-screen state/history storage and endpoints: merge, 409 by `rev`, 413, ring of 500, slug, routes (EP-14.05). |
| `tests/screen-state-client.test.js` | Screen state client: registry mirror, hydration, migration, 400 ms debounce, `sendBeacon`, offline reserve, retry (EP-14.06). |
| `tests/chats-screen-state.test.js` | State adoption in chats, groups and projects screens, and no direct `localStorage` use (EP-14.07). |
| `tests/design-workflows-state.test.js` | Workflows tab reducer: catalog, selection, plan, dry run, runs, errors, unknown actions (EP-08.06). |
| `tests/design-workflows-api.test.js` | URLs and methods of each Workflows client call with fake `fetch` and loopback error (EP-08.06). |
| `tests/design-workflows-view.test.js` | Plan rendering order, agent, gate, permissions, missing skill, API text escaping and tab states (EP-08.06). |
| `tests/design-workflows-ui.test.js` | Tab registration, view-state restore, CSS import, FontAwesome, no emoji or `confirm`/`alert`/`prompt`, 300-line limit (EP-08.06). |
| `tests/helpers/temp-dir.js` | Shared helper creating a temp dir and registering its removal, with Windows retries. |
| `tests/helpers/git-sandbox.js` | Isolates throwaway git repos in tests: strips inherited `GIT_*` (the pre-commit hook exports `GIT_DIR`/`GIT_INDEX_FILE`), sets `core.hooksPath` to `os.devNull`. Use `initSandboxRepo`/`sandboxGit` for any test that runs git. |
| `tests/helpers/project-fixture.js`, `project-fixture-design-system.js`, `project-fixture-prototype.js`, `project-fixture-design-index.js`, `project-fixture-files.js` | Create a temp project outside `projects/` and return `{ dir, slug, cleanup }`. |
| `scripts/lib/web-gates.js` | Pre-commit gates for islands: Biome on staged `ui/web` files, `tsc` on both `ui/web` projects, `npm audit` (high or worse) when package files change. |
| `tests/web-gates.test.js` | Web gates skip unrelated commits, lint and type-check island files, and run `npm audit` on dependency changes. |
| `scripts/e2e-island-lab.js` | E2E for `#/lab`: builds if needed, starts its own UI server, checks props, state, unmount on leave and remount on Back. |
| `tests/island-loader.test.js` | Island loader with a fake DOM: index then entry import, CSS dedupe, unmount, not-built and missing-entry notices, unknown island, throwing unmount. |
