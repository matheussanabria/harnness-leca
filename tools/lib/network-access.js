// @ts-check
// Interfaces locais, detecção de localhost, PIN e hosts permitidos.
const os = require("os");
const { PRIVATE_IPV4_REGEX, TUNNEL_DOMAINS_REGEX } = require("./network-store");

/**
 * Detecta todos os endereços IPv4 locais e os classifica por tipo de interface
 * @returns {Array<{ name: string, ip: string, type: 'wifi' | 'vpn' | 'tailscale' | 'ethernet' | 'other' }>}
 */
function getNetworkInterfaces() {
  const nets = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    const list = nets[name] || [];
    for (const item of list) {
      if (item.family !== "IPv4" || item.internal) continue;
      const lower = name.toLowerCase();
      /** @type {'other' | 'wifi' | 'tailscale' | 'vpn' | 'ethernet'} */
      let type = "other";
      if (lower.includes("wi-fi") || lower.includes("wlan") || lower.includes("wireless") || lower.includes("sem fio")) {
        type = "wifi";
      } else if (lower.includes("tailscale") || item.address.startsWith("100.")) {
        type = "tailscale";
      } else if (lower.includes("vpn") || lower.includes("tun") || lower.includes("tap") || lower.includes("wireguard")) {
        type = "vpn";
      } else if (lower.includes("eth") || lower.includes("ethernet") || lower.includes("rede local")) {
        type = "ethernet";
      }

      results.push({ name, ip: item.address, type });
    }
  }

  // Ordena dando preferência a Wi-Fi, depois Ethernet, depois VPN/Tailscale
  const order = { wifi: 1, ethernet: 2, tailscale: 3, vpn: 4, other: 5 };
  results.sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));
  return results;
}

/**
 * Retorna o IP primário mais provável para conexão do celular (geralmente Wi-Fi)
 * @returns {string|null}
 */
function getPrimaryLocalIp() {
  const ifaces = getNetworkInterfaces();
  return ifaces.length > 0 ? ifaces[0].ip : null;
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOST_REGEX = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i;

// Cabeçalhos que um proxy ou túnel (cloudflared, ngrok, localtunnel, nginx) acrescenta ao encaminhar o tráfego.
// O túnel conecta a partir do próprio computador, então o socket sozinho parece loopback.
const PROXY_HEADERS = [
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "forwarded", "x-real-ip",
  "via", "true-client-ip", "cf-connecting-ip", "cf-ray", "cf-visitor", "cf-ipcountry", "cdn-loop",
];

/**
 * A requisição chegou por proxy ou túnel (mesmo que o socket seja loopback)?
 * @param {import("http").IncomingMessage} req
 * @returns {boolean}
 */
function isProxiedRequest(req) {
  const headers = (req && req.headers) || {};
  return PROXY_HEADERS.some((name) => headers[name] !== undefined);
}

/**
 * Verifica se a requisição se originou no próprio computador, sem passar por proxy ou túnel.
 * Exige socket loopback, nenhum cabeçalho de proxy e Host loopback quando houver Host.
 * @param {import("http").IncomingMessage} req
 * @returns {boolean}
 */
function isLocalhostRequest(req) {
  const remote = req && req.socket && req.socket.remoteAddress;
  if (!remote || !LOOPBACK_ADDRESSES.has(remote)) return false;
  if (isProxiedRequest(req)) return false;
  const host = req.headers && req.headers.host;
  return !host || LOOPBACK_HOST_REGEX.test(String(host).trim());
}

/**
 * Identifica o cliente para limitar tentativas. Atrás do Cloudflare o socket é sempre o mesmo, então vale o IP
 * que o proxy informa; esse cabeçalho só importa para o limite, nunca para autorizar.
 * @param {import("http").IncomingMessage} req
 * @returns {string}
 */
function clientKey(req) {
  const headers = (req && req.headers) || {};
  const cf = headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  const raw = (req && req.socket && req.socket.remoteAddress) || "unknown";
  return raw.replace(/^::ffff:/, "");
}

/**
 * Extrai o PIN enviado na requisição (Query Param ou Header). O cookie guarda só o token de sessão.
 * @param {import("http").IncomingMessage} req
 * @param {URL} [url]
 * @returns {string}
 */
function extractRequestPin(req, url) {
  if (url && url.searchParams.has("pin")) {
    return url.searchParams.get("pin") || "";
  }
  const headerPin = req.headers["x-harness-pin"];
  if (typeof headerPin === "string" && headerPin.trim()) return headerPin.trim();
  return "";
}

/**
 * Verifica se um host é permitido (localhost, IP privado LAN, Tailscale ou túnel seguro)
 * @param {string} host
 * @returns {boolean}
 */
function isAllowedHost(host) {
  if (!host) return false;
  const clean = host.replace(/:\d+$/, "").toLowerCase();
  if (clean === "localhost" || clean === "127.0.0.1" || clean === "[::1]" || clean === "::1") return true;
  if (PRIVATE_IPV4_REGEX.test(clean)) return true;
  if (TUNNEL_DOMAINS_REGEX.test(clean)) return true;
  const ifaces = getNetworkInterfaces();
  if (ifaces.some((i) => i.ip.toLowerCase() === clean)) return true;
  return false;
}

module.exports = { getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, isProxiedRequest, clientKey, extractRequestPin, isAllowedHost };
