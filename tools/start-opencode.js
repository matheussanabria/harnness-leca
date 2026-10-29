// @ts-check
// `npm run opencode`: sobe o servidor do opencode (API v2) na porta do harness, com a mesma senha que a interface usa
// (OPENCODE_SERVER_PASSWORD em global/.env; gerada na primeira vez).
const { spawn } = require("child_process");
const { loadEnv } = require("./lib/env");
const { ensureOpenCodePassword } = require("./lib/engine-autostart");

loadEnv();
ensureOpenCodePassword(process.env);
const child = spawn(process.env.OPENCODE_BIN || "opencode", ["serve", "--port", "63186"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => { console.error(`Não foi possível iniciar o opencode: ${err.message}`); process.exit(1); });
