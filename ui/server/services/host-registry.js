// @ts-check
// Known Harness hosts (EP-23.06): this machine, the VPS, any other install the user runs. Each host keeps its own
// database; switching host only changes which web server the browser opens, nothing is copied between hosts.
// data/hosts.json holds { id, name, url, token }; the token is the remote host's access PIN, used only by this
// server to read the other host's /api/host/info, and never sent back whole to the browser (last 4 characters).
// RF4: a remote host is accepted only over HTTPS, or over HTTP on loopback, a private network or a Tailscale address.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../tools/lib/root");

const HOST_INFO_PROTOCOL = 1;
const CHECK_TIMEOUT_MS = 3000;
const MAX_HOSTS = 20;

const hostsFile = () => process.env.HARNESS_HOSTS_FILE || path.join(ROOT, "data", "hosts.json");

/** @typedef {{ id: string, name: string, url: string, token: string }} HostEntry */

/** True for addresses that never leave this machine, the LAN or the Tailscale network. @param {string} hostname */
function isPrivateHost(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost") || h.endsWith(".ts.net")) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Normalizes a host URL to its origin, or throws a message for the user.
 * @param {unknown} value @returns {string}
 */
function validateHostUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.username || url.password) throw new Error("A URL não pode ter usuário ou senha.");
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && isPrivateHost(url.hostname)) return url.origin;
  if (url.protocol === "http:") throw new Error("Host remoto só por HTTPS ou por endereço de túnel privado (Tailscale); HTTP em endereço público é recusado.");
  throw new Error("Use uma URL http:// ou https://.");
}

/** @param {string} name */
const slug = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** @returns {HostEntry[]} */
function readHosts() {
  try {
    const data = JSON.parse(fs.readFileSync(hostsFile(), "utf8"));
    return Array.isArray(data.hosts) ? data.hosts.filter((h) => h && typeof h.id === "string" && typeof h.url === "string") : [];
  } catch {
    return [];
  }
}

/** @param {HostEntry[]} hosts */
function writeHosts(hosts) {
  const file = hostsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ hosts }, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * What the browser may see. The story asked for the last 4 characters; the access PIN usually has 6 digits, so
 * short secrets (up to 8 characters) show only their last 2, or 4 would give most of the PIN away.
 * @param {HostEntry} h
 */
const publicHost = (h) => ({ id: h.id, name: h.name, url: h.url, tokenHint: h.token ? `••••${h.token.slice(h.token.length > 8 ? -4 : -2)}` : "" });

/**
 * Adds or updates a host. An empty token keeps the stored one (the browser never has it).
 * @param {{ id?: string, name?: unknown, url?: unknown, token?: unknown }} input @returns {HostEntry}
 */
function saveHost(input) {
  const name = String(input.name || "").trim().slice(0, 60);
  if (!name) throw new Error("Dê um nome ao host.");
  const url = validateHostUrl(input.url);
  const hosts = readHosts();
  const id = typeof input.id === "string" && hosts.some((h) => h.id === input.id) ? input.id : slug(name) || `host-${hosts.length + 1}`;
  const previous = hosts.find((h) => h.id === id);
  const token = typeof input.token === "string" && input.token.trim() ? input.token.trim().slice(0, 200) : previous?.token || "";
  const entry = { id, name, url, token };
  const next = previous ? hosts.map((h) => (h.id === id ? entry : h)) : [...hosts, entry];
  if (next.length > MAX_HOSTS) throw new Error(`No máximo ${MAX_HOSTS} hosts.`);
  writeHosts(next);
  return entry;
}

/** @param {string} id @returns {boolean} */
function removeHost(id) {
  const hosts = readHosts();
  const next = hosts.filter((h) => h.id !== id);
  if (next.length === hosts.length) return false;
  writeHosts(next);
  return true;
}

/**
 * Reads another host's /api/host/info with its PIN. Never throws.
 * @param {HostEntry} host @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ state: "online"|"offline"|"incompatible"|"locked", version?: string, name?: string }>}
 */
async function checkHost(host, fetchImpl = fetch) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${host.url}/api/host/info`, { headers: host.token ? { "X-Harness-Pin": host.token } : {}, signal: ac.signal, redirect: "error" });
    if (res.status === 401 || res.status === 429) return { state: "locked" };
    if (!res.ok) return { state: "offline" };
    const info = await res.json();
    if (info.protocol !== HOST_INFO_PROTOCOL) return { state: "incompatible", version: info.version };
    return { state: "online", version: info.version, name: info.name };
  } catch {
    return { state: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { HOST_INFO_PROTOCOL, isPrivateHost, validateHostUrl, readHosts, saveHost, removeHost, publicHost, checkHost, hostsFile };
