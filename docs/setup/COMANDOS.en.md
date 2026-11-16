# Command and Script Catalog (package.json)

[Leia em português](COMANDOS.md).

Detailed reference for all scripts defined in the Harness `package.json`, grouped by area of responsibility.

---

## 1. Web Interface, Servers, and Remote Access

Commands to start the local UI, develop with automatic reloads, and access it remotely.

| Command | Description | Parameters & Details |
|---|---|---|
| `npm run ui` | Starts the Harness HTTP server on the default port (`http://localhost:4321`). | Native Node.js backend with no runtime dependencies. Serves the dashboard, chats, and APIs. |
| `npm run ui:dev` | Starts the interface with automatic restarts (`--watch-path`). | Watches changes in `ui/server`, `tools/lib`, and `tools/ds-docs`. Changes in `ui/public` require a page reload. |
| `npm run ui:dev:remote` | Development mode listening on all interfaces (`0.0.0.0`) with PIN authentication. | Accepts `-- --pin 123456` to set a fixed PIN and avoid reauthentication after restarts. |
| `npm run remote` | Runs the server listening on the local network (`0.0.0.0`), protected by a PIN. | Generates a 6-digit PIN shown in the terminal and a QR code. |
| `npm run remote:tunnel` | Creates a temporary public HTTPS tunnel via Cloudflare Quick Tunnel. | Provides secure access from outside the local network (e.g., a phone on 4G/5G). |
| `npm run opencode` | Starts the OpenCode service in the background (`opencode serve --port 63186`). | Uses the password configured in `global/.env` (`OPENCODE_SERVER_PASSWORD`). |

---

## 2. React Frontend and Islands (ADR-011)

Scripts to build, type-check, lint, and test the modern interface layer (`ui/web`).

| Command | Description | Parameters & Details |
|---|---|---|
| `npm run build:web` | Builds the React islands with Vite for production. | Writes bundled files to `ui/public/dist/`. |
| `npm run dev:web` | Builds the React islands continuously in *watch* mode. | Automatically rebuilds changes made in `ui/web/`. |
| `npm run types:web` | TypeScript static type check. | Runs `tsc -p ui/web` and `tsc -p ui/web/tsconfig.node.json`. |
| `npm run lint:web` | Static analysis and code formatting with Biome. | Runs `biome check ui/web`. |
| `npm run e2e:web` | End-to-End tests for the React islands foundation. | Runs Playwright with headless Microsoft Edge, validating the lifecycle in `#/lab`. |
| `npm run lint:proto` | Biome linter focused on project prototypes. | Accepts `--project <slug> [--proto <id>] [--fix]`. |
| `npm run visual:proto` | Comparative visual regression test for the Atelier. | Compares screen captures against baselines at different resolutions. |

---

## 3. AI Engine Sync, Memory, and Context

Operations for integrating the Harness with AI engines (Claude Code, Gemini/Antigravity, and OpenCode).

| Command | Description | Parameters & Details |
|---|---|---|
| `npm run sync` | Syncs conversation histories from all 3 engines to `projects/<slug>/chats/`. | Detects new chats and incremental updates. |
| `npm run sync:dry` | Runs a simulated sync. | Makes no disk changes (`--dry-run`). |
| `npm run adopt` | Adopts an existing directory and turns it into a managed project. | Accepts `-- --path <path>` and `--dry-run`. |
| `npm run export:context` | Exports rules, instructions, and memories to agents' native context. | Generates injection files for Claude Code and Antigravity/Gemini. |
| `npm run export:claude-sessions` | Converts Harness chats to `.jsonl` sessions. | Lets you resume conversations in the terminal with `claude --resume`. |

---

## 4. Multi-Agent Coordination and Automation (HIA)

Protocol for coordinating concurrent autonomous agents and recording automations.

| Command | Description | Subcommands & Parameters |
|---|---|---|
| `npm run coordination` | CLI for the AI agent coordination protocol. | Operations: `inbox`, `claim`, `start`, `heartbeat`, `complete`, `handoff`, `notify`, `status`. |
| `npm run hia` | Harness Intelligence & Automation CLI. | Commands: `list` (registered tools), `info <toolId>`, `run <toolId>`. |

---

## 5. Background Routines and Scheduling

Run scheduled tasks with cron and integrate them with the operating system.

| Command | Description | Subcommands & Parameters |
|---|---|---|
| `npm run routines` | Runs due project routines (`projects/<slug>/scheduled/*.md`). | Accepts `--project <slug>`, `--now <file>`, `--dry-run`, and `--log`. |
| `npm run routines:list` | Lists the status of scheduled routines. | Shows frequency, last run, and expected next run. |
| `npm run schedule:windows` | Manages the scheduled task in Windows Task Scheduler. | Accepts `--apply` (creates/updates an hourly task), `--status`, and `--remove`. |

---

## 6. Quality, Tests, and Type Checking

Pre-commit quality gates and continuous code validation.

| Command | Description | Parameters & Details |
|---|---|---|
| `npm run check` | Fast syntax validation without dependencies. | Checks the syntax of all `.js` files and validity of `.json` files. |
| `npm test` | Runs the repository's unit test suite. | Runs `node --test "tests/*.test.js"`. |
| `npm run regressao` | **Required pre-commit quality gate**. | Runs in sequence: `check` -> `test` -> integrity check -> `types:baseline`. |
| `npm run types` | JSDoc type checking (`@ts-check`) for the backend. | Runs `tsc` in a cached temporary folder without adding global dependencies. |
| `npm run types:baseline` | Compares type errors against the accepted baseline. | Fails if type debt grows beyond `quality/types-baseline.json`. |
| `npm run types:baseline:update` | Updates the accepted error baseline. | Saves the current count as the new starting point (`--update`). |
| `npm run setup:hooks` | Configures Git to use the local hooks. | Points `core.hooksPath` to `.githooks`. |
