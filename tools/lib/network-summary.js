// @ts-check
// Resumo de acesso remoto e banner no terminal.
const { generateAsciiQr, generateSvgQr } = require("./qrcode");
const http = require("http");
const { getNetworkInterfaces } = require("./network-access");

/**
 * Monta o resumo de URLs e arte de inicialização do modo remoto
 * @param {number} port
 * @param {string} pin
 * @param {string} [tunnelUrl]
 */
function getRemoteSummary(port, pin, tunnelUrl = "") {
  const interfaces = getNetworkInterfaces();
  const urls = [];

  urls.push({ label: "Computador (Local)", url: `http://localhost:${port}` });

  for (const iface of interfaces) {
    const pinPart = pin ? `#pin=${pin}` : "";
    let label = iface.name;
    if (iface.type === "wifi") label = `📱 Wi-Fi (${iface.name})`;
    else if (iface.type === "vpn") label = `🔒 VPN (${iface.name})`;
    else if (iface.type === "tailscale") label = `🌐 Tailscale (${iface.name})`;
    else if (iface.type === "ethernet") label = `🔌 Cabo (${iface.name})`;

    urls.push({
      label,
      ip: iface.ip,
      type: iface.type,
      url: `http://${iface.ip}:${port}/${pinPart}`,
      rawUrl: `http://${iface.ip}:${port}`,
    });
  }

  if (tunnelUrl) {
    const pinPart = pin ? `#pin=${pin}` : "";
    urls.push({
      label: "🌍 Túnel Remoto (Internet / 4G)",
      url: `${tunnelUrl.replace(/\/+$/, "")}/${pinPart}`,
      rawUrl: tunnelUrl,
    });
  }

  // Escolhe a melhor URL para o QR Code (Wi-Fi ou túnel)
  const qrTarget = tunnelUrl
    ? `${tunnelUrl.replace(/\/+$/, "")}/${pin ? "#pin=" + pin : ""}`
    : urls.find((u) => u.type === "wifi")?.url || urls[1]?.url || urls[0].url;

  const asciiQr = generateAsciiQr(qrTarget);
  const svgQr = generateSvgQr(qrTarget);

  return {
    port,
    pin,
    interfaces,
    urls,
    qrTarget,
    asciiQr,
    svgQr,
  };
}

/**
 * Imprime no console o banner com as URLs e o QR code
 * @param {ReturnType<typeof getRemoteSummary>} summary
 */
function printRemoteBanner(summary) {
  console.log("");
  console.log("╭─────────────────────────────────────────────────────────────╮");
  console.log("│           🚀 HARNESS LECA - ACESSO REMOTO & MOBILE          │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│ 💻 Local:    http://localhost:${summary.port}`);

  for (const u of summary.urls) {
    if (u.ip) {
      console.log(`│ ${u.label}:  ${u.url}`);
    }
  }

  if (summary.pin) {
    console.log("│");
    console.log(`│ 🔑 PIN de Acesso Celular:  ${summary.pin}`);
  }
  console.log("╰─────────────────────────────────────────────────────────────╯");
  console.log("");
  console.log("📱 Aponte a câmera do celular para conectar instantaneamente:");
  console.log(summary.asciiQr);
  console.log("");
}

module.exports = { getRemoteSummary, printRemoteBanner };
