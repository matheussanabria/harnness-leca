// @ts-check
// Interfaces locais, detecção de localhost, PIN e hosts permitidos.
const os = require("os");
const { PRIVATE_IPV4_REGEX, TUNNEL_DOMAINS_REGEX, authenticatedIps } = require("./network-store");

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

/**
 * Verifica se a requisição se originou no próprio computador (localhost)
 * @param {http.IncomingMessage} req
 * @returns {boolean}
 */
function isLocalhostRequest(req) {
  const remote = req.socket && req.socket.remoteAddress;
  if (!remote) return false;
  return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
}

/**
 * Extrai o PIN enviado na requisição (via Cookie, Header ou Query Param)
 * @param {http.IncomingMessage} req
 * @param {URL} [url]
 * @returns {string}
 */
function extractRequestPin(req, url) {
  if (url && url.searchParams.has("pin")) {
    return url.searchParams.get("pin") || "";
  }
  const headerPin = req.headers["x-harness-pin"];
  if (typeof headerPin === "string" && headerPin.trim()) return headerPin.trim();

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)harness_pin=([^;]+)/);
  if (match) return decodeURIComponent(match[1]).trim();

  return "";
}



/**
 * Valida o PIN para requisições que não vêm de localhost
 * @param {http.IncomingMessage} req
 * @param {string} configuredPin
 * @param {URL} [url]
 * @returns {boolean}
 */
function validatePin(req, configuredPin, url) {
  // Se veio do próprio computador (localhost), acesso é livre
  if (isLocalhostRequest(req)) return true;

  // Se não há PIN configurado no servidor, acesso é livre
  if (!configuredPin) return true;

  const rawIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
  const clientIp = rawIp.replace(/^::ffff:/, "");

  const sentPin = extractRequestPin(req, url);
  if (sentPin === configuredPin) {
    if (clientIp) authenticatedIps.set(clientIp, Date.now() + 24 * 3600 * 1000);
    return true;
  }

  // Se o IP do cliente já tiver sido autenticado nas últimas 24h (útil para assets do iframe sem cookie)
  if (clientIp && authenticatedIps.has(clientIp)) {
    const expiresAt = authenticatedIps.get(clientIp);
    if (Date.now() < expiresAt) return true;
    authenticatedIps.delete(clientIp);
  }

  return false;
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

module.exports = { getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, extractRequestPin, validatePin, isAllowedHost };
