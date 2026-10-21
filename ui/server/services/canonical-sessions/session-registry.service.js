// @ts-check
// Registro canônico de sessões do projeto (EP-09.01).
// Arquivo: projects/<slug>/canonical-sessions.json. Escrita atômica e leitura tolerante.

const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { SCHEMA_VERSION, migrateSession, validateSession, matchesFilters } = require("./session-model");

const REGISTRY_REL = "canonical-sessions.json";
const MAX_BYTES = 8 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/;

/**
 * @param {string} slug
 * @returns {string}
 */
function projectDir(slug) {
  if (!SLUG_RE.test(String(slug || "")) || slug === "_template") throw new Error("projeto inválido");
  return path.join(ROOT, "projects", slug);
}

/**
 * @param {string} slug
 * @returns {string}
 */
function registryPath(slug) {
  return path.join(projectDir(slug), REGISTRY_REL);
}

/**
 * Leitura tolerante: arquivo ausente, corrompido ou de versão futura não derruba a aplicação.
 * @param {string} slug
 * @returns {{ schemaVersion: number, sessions: object[], warnings: string[] }}
 */
function readRegistry(slug) {
  const empty = { schemaVersion: SCHEMA_VERSION, sessions: [], warnings: [] };
  const file = registryPath(slug);
  try {
    if (!fs.existsSync(file)) return empty;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return { ...empty, warnings: ["Registro de sessões inválido."] };
    if (stat.size > MAX_BYTES) return { ...empty, warnings: ["Registro de sessões acima do limite."] };
    const parsed = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    if (!parsed || typeof parsed !== "object") return { ...empty, warnings: ["Registro de sessões ilegível."] };
    const version = Number(parsed.schemaVersion) || 1;
    if (version > SCHEMA_VERSION) return { ...empty, warnings: ["Registro de sessões de versão futura."] };
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const migrated = sessions.map((item) => migrateSession(item)).filter((item) => validateSession(item).valid);
    return { schemaVersion: version, sessions: migrated, warnings: [] };
  } catch {
    return { ...empty, warnings: ["Registro de sessões ilegível."] };
  }
}

/**
 * @param {string} slug
 * @param {object[]} sessions
 */
function writeRegistry(slug, sessions) {
  const dir = projectDir(slug);
  const file = registryPath(slug);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    sessions: sessions.map((item) => migrateSession(item)),
  };
  const tmp = path.join(dir, `.${REGISTRY_REL}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
  return payload;
}

/**
 * Insere ou atualiza sessões pelo id, preservando as que já existiam.
 * @param {string} slug
 * @param {object[]} sessions
 * @returns {{ sessions: object[], inserted: number, updated: number }}
 */
function upsertSessions(slug, sessions) {
  const current = readRegistry(slug);
  const byId = new Map(current.sessions.map((item) => [item.id, item]));
  let inserted = 0;
  let updated = 0;
  for (const incoming of sessions) {
    const session = migrateSession(incoming);
    if (!validateSession(session).valid) continue;
    const previous = byId.get(session.id);
    byId.set(session.id, previous ? { ...previous, ...session } : session);
    if (previous) updated += 1;
    else inserted += 1;
  }
  const ordered = [...byId.values()].sort((a, b) => String(b.lastObservedAt).localeCompare(String(a.lastObservedAt)));
  writeRegistry(slug, ordered);
  return { sessions: ordered, inserted, updated };
}

/**
 * @param {string} slug
 * @param {string} id
 * @returns {object | null}
 */
function getSession(slug, id) {
  const wanted = String(id || "").trim();
  return readRegistry(slug).sessions.find((item) => item.id === wanted) || null;
}

/**
 * @param {string} slug
 * @param {object} [filters]
 * @returns {object[]}
 */
function listSessions(slug, filters = {}) {
  return readRegistry(slug).sessions.filter((item) => matchesFilters(item, filters));
}

/**
 * Vínculo explícito: só o loopback chama, e só com evidência declarada.
 * @param {string} slug
 * @param {string} id
 * @param {{ projectId: string, evidence: string, actor?: string }} link
 * @returns {{ ok: boolean, session?: object, error?: string }}
 */
function linkSession(slug, id, link = {}) {
  const wanted = String(id || "").trim();
  const evidence = String(link.evidence || "").trim();
  if (!evidence) return { ok: false, error: "Vínculo exige evidência explícita." };
  const current = readRegistry(slug);
  const index = current.sessions.findIndex((item) => item.id === wanted);
  if (index < 0) return { ok: false, error: "Sessão não encontrada." };
  const session = {
    ...current.sessions[index],
    projectId: String(link.projectId || "").trim() || current.sessions[index].projectId,
    projectConfidence: "explicit",
    lastObservedAt: new Date().toISOString(),
  };
  const sessions = [...current.sessions];
  sessions[index] = session;
  writeRegistry(slug, sessions);
  return { ok: true, session };
}

module.exports = {
  REGISTRY_REL,
  projectDir,
  registryPath,
  readRegistry,
  writeRegistry,
  upsertSessions,
  getSession,
  listSessions,
  linkSession,
};
