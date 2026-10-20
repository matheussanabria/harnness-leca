// @ts-check
// Encerramento de árvore de processos e limpeza ao sair.
const path = require("path");
const cp = require("child_process");
const { runningServices } = require("./proc-manager-store");

/**
 * Encerra uma árvore inteira de processos de forma garantida.
 * No Windows, child.kill() mata apenas o cmd.exe/shell pai, deixando o node/vite/java órfão.
 * O taskkill.exe /T /F garante a eliminação de todos os processos filhos.
 * @param {cp.ChildProcess} child
 */
function killTree(child) {
  if (!child || !child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    try {
      cp.execFileSync(taskkill, ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } catch {
      try { child.kill(); } catch {}
    }
  } else {
    try {
      child.kill("SIGTERM");
      const forceTimer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 1500);
      forceTimer.unref();
    } catch {}
  }
}
// Limpeza no encerramento do processo Node principal
process.on("exit", () => {
  for (const info of runningServices.values()) {
    if (info.child && info.child.exitCode === null) {
      killTree(info.child);
    }
  }
});

module.exports = { killTree };
