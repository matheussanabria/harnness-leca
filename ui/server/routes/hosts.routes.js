// @ts-check
// Host selector API (EP-23.06). GET /api/host/info is what other hosts read about this one; /api/hosts lists and
// edits the known hosts (data/hosts.json) with each one's state. Tokens never come back whole.
// Every route sits behind the router's remote PIN check, like the rest of /api.
const os = require("os");
const { send, readJsonBody } = require("../config");
const reg = require("../services/host-registry");
const version = require("../../../package.json").version || "dev";

/** Name this host shows to others: HARNESS_HOST_NAME, or the machine name. */
const hostName = () => String(process.env.HARNESS_HOST_NAME || os.hostname()).slice(0, 60);

/** GET /api/host/info */
const apiHostInfo = ({ res }) => send(res, 200, { name: hostName(), version, protocol: reg.HOST_INFO_PROTOCOL });

/** GET /api/hosts: this host first, then the saved ones with their state (checked in parallel, 3 s each). */
async function apiHostsList({ res }) {
  const saved = reg.readHosts();
  const states = await Promise.all(saved.map((h) => reg.checkHost(h)));
  return send(res, 200, {
    current: { name: hostName(), version },
    hosts: saved.map((h, i) => ({ ...reg.publicHost(h), status: states[i] })),
  });
}

/** POST /api/hosts {id?, name, url, token?}: add or update. */
async function apiHostsSave({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  try {
    return send(res, 200, reg.publicHost(reg.saveHost(body || {})));
  } catch (error) {
    return send(res, 400, { error: /** @type {any} */ (error).message });
  }
}

/** POST /api/hosts/remove {id}: DELETE is not allowed by ui/server.js outside the allowlist. */
async function apiHostsRemove({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  return reg.removeHost(String(body?.id || "")) ? send(res, 200, { ok: true }) : send(res, 404, { error: "host não encontrado" });
}

const hostsRoutes = [
  { method: "GET", path: "/api/host/info", handler: apiHostInfo },
  { method: "GET", path: "/api/hosts", handler: apiHostsList },
  { method: "POST", path: "/api/hosts", handler: apiHostsSave },
  { method: "POST", path: "/api/hosts/remove", handler: apiHostsRemove },
];

module.exports = { hostsRoutes };
