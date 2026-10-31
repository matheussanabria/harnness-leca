---
domain: tools
module: engines
feature: opencode-delegation
summary: OpenCode delegation and EP-14 story packaging runners, plus the design system component publisher.
paths: [tools/opencode-*.js, tools/lib/opencode-delegate.js, tools/lib/opencode-package/*.js, tools/add-ds-component.js, tools/ds-docs/component-page.js, tests/opencode-delegate.test.js, tests/opencode-package.test.js, tests/add-ds-component.test.js]
keywords: [opencode, delegate, package, worktree, free models, add-ds-component, design system]
updated: 2026-10-31
---
# OpenCode Delegation

| File | Responsibility |
|---|---|
| `tools/opencode-package.js` | Runs an EP-14 story with opencode in its own `git worktree` (`--dry-run`, `--verify`); never commits or merges. |
| `tools/opencode-delegate.js` | Governed delegation CLI for bounded tasks: free OpenCode models by default, `9router/harness-*` combos only with `--allow-combo`; inline config, read-only defaults. |
| `tools/lib/opencode-delegate.js` | Delegation library: explicit write/bash capabilities, no workspace config file; registers an allowed combo in the inline config and appends each combo run to `logs/opencode-delegate.jsonl`. |
| `tools/lib/opencode-package/story.js`, `guard.js` | Read the story (branch and allowed files) and check the agent touched only those files. |
| `tools/lib/opencode-package/worktree.js`, `config.js`, `prompt.js`, `run.js` | Short-path worktree, agent permissions (edits only in worktree, shell restricted to tests), repo-rules prompt, orchestration. |
| `tools/add-ds-component.js` | Publishes a component in the design system (page, menu, registry, bundle and demo). |
| `tools/ds-docs/component-page.js` | Generates the component documentation page for `add-ds-component`. |
| `tests/opencode-delegate.test.js` | Covers default denials, narrowly enabled capabilities, inline configuration and refusal of paid models. |
| `tests/opencode-package.test.js` | Story packaging, guard and worktree flow. |
| `tests/add-ds-component.test.js` | Design system component publishing. |
