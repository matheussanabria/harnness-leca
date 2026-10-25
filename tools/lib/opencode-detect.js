// @ts-check
// Resolve a URL do servidor HTTP do OpenCode: candidatos (OPENCODE_URL, portas descobertas, padrão), cada um
// validado com GET /session. Nada é engolido: o resultado diz o que foi tentado e por que cada endereço falhou.
const { discoverPorts, realSys } = require("./opencode-ports");

const DEFAULT_URL = "http://localhost:63186";
const PROBE_TIMEOUT_MS = 1500;
const CACHE_MS = 10000;

/** Cabeçalho Basic (usuário "opencode") quando OPENCODE_SERVER_PASSWORD existe; nunca é registrado em log. */
function authHeaders(env = process.env) {
  const pass = env.OPENCODE_SERVER_PASSWORD;
  if (!pass) return {};
  return { Authorization: "Basic " + Buffer.from(`opencode:${pass}`).toString("base64") };
}

/** fetch para o servidor do OpenCode, já com a autenticação opcional. */
function ocFetch(url, init = {}) {
  return globalThis.fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
}

/** Valida que a URL fala a API do OpenCode (GET /session responde 200 com JSON). @returns {Promise<{url:string, ok:boolean, reason:string, status?:number}>} */
async function probe(url) {
  try {
    const res = await ocFetch(`${url}/session`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (res.status === 401) return { url, ok: false, status: 401, reason: "HTTP 401 (senha necessária)" };
    if (!res.ok) return { url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    try { await res.json(); } catch { return { url, ok: false, status: res.status, reason: "resposta não é JSON (outro serviço nesta porta)" }; }
    return { url, ok: true, status: res.status, reason: "ok" };
  } catch (err) {
    const cause = /** @type {any} */ (err)?.cause?.code || /** @type {any} */ (err)?.name || "erro";
    return { url, ok: false, reason: cause === "TimeoutError" ? "sem resposta em 1,5 s" : `conexão recusada ou falhou (${cause})` };
  }
}

const norm = (u) => String(u).replace(/\/+$/, "");

/**
 * @param {{ sys?: import("./opencode-ports").OsLayer, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<{ url: string|null, tried: {url:string, ok:boolean, reason:string, status?:number}[], discoveryErrors: string[] }>}
 */
async function detectOpenCodeUrl({ sys = realSys, env = process.env } = {}) {
  const tried = [];
  const seen = new Set();
  const attempt = async (url) => {
    const key = norm(url);
    if (seen.has(key)) return null;
    seen.add(key);
    const r = await probe(key);
    tried.push(r);
    return r.ok ? key : null;
  };

  if (env.OPENCODE_URL) {
    const hit = await attempt(env.OPENCODE_URL);
    if (hit) return { url: hit, tried, discoveryErrors: [] };
  }
  const { ports, errors } = await discoverPorts(sys);
  for (const port of ports) {
    const hit = await attempt(`http://127.0.0.1:${port}`);
    if (hit) return { url: hit, tried, discoveryErrors: errors };
  }
  const hit = await attempt(DEFAULT_URL);
  return { url: hit, tried, discoveryErrors: errors };
}

/** Mensagem em português para quando nenhum candidato respondeu. */
function failureMessage(tried) {
  const list = tried.map((t) => `${t.url} (${t.reason})`).join("; ") || DEFAULT_URL;
  if (tried.some((t) => t.status === 401)) {
    return `O servidor do OpenCode pediu senha (HTTP 401). Defina OPENCODE_SERVER_PASSWORD com a senha do servidor. Endereços testados: ${list}.`;
  }
  return `O servidor do OpenCode não respondeu nos endereços testados: ${list}. Inicie-o com "opencode serve" ou defina OPENCODE_URL com o endereço correto.`;
}

let cached = null;
let cachedAt = 0;

function invalidateOpenCodeUrl() { cached = null; cachedAt = 0; }

/**
 * URL validada do servidor (cache curto). Lança PublicError quando nenhum endereço responde.
 * @param {{ sys?: import("./opencode-ports").OsLayer, env?: NodeJS.ProcessEnv }} [opts]
 */
async function resolveOpenCodeUrl(opts = {}) {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const r = await detectOpenCodeUrl(opts);
  if (!r.url) {
    const { PublicError } = require("./engines/common");
    throw Object.assign(new PublicError(failureMessage(r.tried)), { tried: r.tried });
  }
  cached = r.url;
  cachedAt = Date.now();
  return r.url;
}

module.exports = { detectOpenCodeUrl, resolveOpenCodeUrl, invalidateOpenCodeUrl, probe, ocFetch, authHeaders, failureMessage, DEFAULT_URL };

if (require.main === module) {
  detectOpenCodeUrl().then((r) => console.log("DETECTED:", JSON.stringify(r)));
}
