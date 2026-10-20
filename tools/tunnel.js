// @ts-check
// Inicializador de Túnel Remoto HTTPS (Cloudflare Quick Tunnel via cloudflared/untun)
// Permite acessar o Harness Leca e o App de qualquer lugar pela internet (4G/5G).
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const netLib = require("./lib/network");

const PORT = Number(process.env.PORT) || 4321;
const PIN = process.env.HARNESS_PIN || String(Math.floor(100000 + Math.random() * 900000));

async function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/state`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Localiza binário nativo do cloudflared pré-existente no PATH ou em cache
 * @returns {string|null}
 */
function findCloudflaredBinary() {
  // 1. Verifica no PATH do sistema
  try {
    const cmd = process.platform === "win32" ? "where cloudflared" : "which cloudflared";
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) return out.split(/\r?\n/)[0];
  } catch {}

  // 2. Verifica se o untun já baixou em tmpdir/node-untun
  const tmpUntun = path.join(os.tmpdir(), "node-untun");
  if (fs.existsSync(tmpUntun)) {
    try {
      const files = fs.readdirSync(tmpUntun);
      const isWin = process.platform === "win32";
      const exe = files.find((f) => f.startsWith("cloudflared") && (isWin ? f.endsWith(".exe") : true));
      if (exe) return path.join(tmpUntun, exe);
    } catch {}
  }

  return null;
}

async function main() {
  console.log("🌐 Preparando Acesso Remoto via Túnel Cloudflare...");

  // 1. Se o servidor do Harness não estiver rodando, inicia em segundo plano
  const alreadyRunning = await isServerRunning(PORT);
  let serverProcess = null;

  if (!alreadyRunning) {
    console.log(`⚡ Iniciando servidor do Harness na porta ${PORT} com suporte remoto...`);
    serverProcess = spawn(process.execPath, ["ui/server.js", "--remote", "--pin", PIN], {
      stdio: "inherit",
      windowsHide: true,
    });
    // Aguarda o servidor subir
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await isServerRunning(PORT)) break;
    }
  } else {
    console.log(`✅ Servidor Harness detectado rodando na porta ${PORT}.`);
  }

  // 2. Inicia o túnel Cloudflare seguro
  console.log("🚀 Abrindo túnel Cloudflare seguro (sem necessidade de cadastro)...");
  const binPath = findCloudflaredBinary();
  let tunnelProcess;

  if (binPath) {
    // Execução direta nativa: ultra-rápida, sem npx e sem avisos de depreciação
    tunnelProcess = spawn(binPath, ["tunnel", "--url", `http://127.0.0.1:${PORT}`], {
      windowsHide: true,
    });
  } else {
    // Fallback via untun com aceite automático de termos e sem DEP0190
    process.env.UNTUN_ACCEPT_CLOUDFLARE_NOTICE = "1";
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    tunnelProcess = spawn(npxCmd, ["-y", "untun", "tunnel", "--port", String(PORT)], {
      env: { ...process.env, UNTUN_ACCEPT_CLOUDFLARE_NOTICE: "1" },
      windowsHide: true,
    });
  }

  let tunnelUrl = "";
  const recentLogs = [];

  const onData = (data) => {
    const text = data.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        recentLogs.push(line.trim());
        if (recentLogs.length > 20) recentLogs.shift();
      }
    }

    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      const summary = netLib.getRemoteSummary(PORT, PIN, tunnelUrl);
      console.log("\n=======================================================");
      console.log("🎉 TÚNEL CLOUDFLARE ATIVO COM SUCESSO!");
      console.log(`🔗 URL Pública HTTPS: ${tunnelUrl}/?pin=${PIN}`);
      console.log(`🔑 PIN de Acesso:     ${PIN}`);
      console.log("=======================================================\n");
      console.log("📱 Aponte a câmera do celular no 4G/5G para acessar:");
      console.log(summary.asciiQr);
      console.log("\nPressione Ctrl+C para encerrar o túnel.");
    }
  };

  tunnelProcess.stdout.on("data", onData);
  tunnelProcess.stderr.on("data", onData);

  tunnelProcess.on("error", (err) => {
    console.error("❌ Erro ao iniciar processo do túnel:", err.message);
  });

  tunnelProcess.on("close", (code) => {
    if (!tunnelUrl) {
      console.error(`\n❌ O túnel encerrou antes de estabelecer conexão (código ${code}).`);
      if (recentLogs.length > 0) {
        console.error("📋 Mensagens registradas:");
        console.error(recentLogs.map((l) => `   ${l}`).join("\n"));
      }
    } else {
      console.log(`Túnel encerrado (código ${code}).`);
    }
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("\nEncerrando túnel e servidor...");
    tunnelProcess.kill();
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Falha ao iniciar túnel:", err);
  process.exit(1);
});

