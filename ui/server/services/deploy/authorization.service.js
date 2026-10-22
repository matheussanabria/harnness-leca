// @ts-check
// Autorizacoes de acao de deploy: emissao com prazo curto e uso unico (EP-10.04).
const crypto = require("node:crypto");
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");

const AUTHORIZATIONS_REL = path.join("global", "deploy-authorizations.json");
const TTL_MINUTES = 15;
const MAX_BYTES = 256 * 1024;
const MAX_RECORDS = 500;

function absolute(rel) {
  return path.join(ROOT, rel);
}

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Le as autorizacoes, tolerando arquivo invalido.
 * @returns {{ records: Object[], warnings: string[] }}
 */
function readAuthorizations() {
  const file = absolute(AUTHORIZATIONS_REL);
  try {
    if (!fs.existsSync(file)) return { records: [], warnings: [] };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return { records: [], warnings: ["Manifesto de autorizacoes invalido."] };
    if (stat.size > MAX_BYTES) return { records: [], warnings: ["Manifesto de autorizacoes acima do limite."] };
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed?.records) ? parsed.records : [];
    return { records, warnings: [] };
  } catch {
    return { records: [], warnings: ["Manifesto de autorizacoes invalido."] };
  }
}

/**
 * Grava as autorizacoes de forma atomica.
 * @param {Object[]} records
 * @returns {boolean}
 */
function writeAuthorizations(records = []) {
  try {
    const file = absolute(AUTHORIZATIONS_REL);
    const payload = {
      _v: 1,
      updatedAt: new Date().toISOString(),
      records: records.slice(-MAX_RECORDS),
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Emite uma autorizacao para uma acao.
 * @param {{ actionId: string, actor: string, note?: string, ttlMinutes?: number }} params
 * @returns {Object}
 */
function issueAuthorization({ actionId, actor, note = "", ttlMinutes = TTL_MINUTES }) {
  const who = String(actor || "").trim().slice(0, 80);
  if (!who) throw fail(400, "Autorizacao exige o responsavel.");
  const at = new Date();
  const record = {
    id: `auth-${crypto.randomUUID()}`,
    actionId: String(actionId || "").trim(),
    actor: who,
    note: String(note || "").slice(0, 300),
    issuedAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + ttlMinutes * 60000).toISOString(),
    usedAt: "",
  };
  const manifest = readAuthorizations();
  const records = [...manifest.records, record];
  if (!writeAuthorizations(records)) throw fail(500, "Nao foi possivel gravar as autorizacoes.");
  return record;
}

/**
 * Localiza uma autorizacao pelo identificador.
 * @param {string} authorizationId
 * @returns {Object | null}
 */
function findAuthorization(authorizationId) {
  const id = String(authorizationId || "").trim();
  if (!id) return null;
  const manifest = readAuthorizations();
  return manifest.records.find((record) => record.id === id) || null;
}

/**
 * Valida a autorizacao para uma acao: existe, nao expirada, nao usada e da mesma acao.
 * @param {string} authorizationId
 * @param {string} actionId
 * @returns {Object}
 */
function assertUsableAuthorization(authorizationId, actionId) {
  const record = findAuthorization(authorizationId);
  if (!record) throw fail(409, "Autorizacao inexistente.");
  if (record.actionId !== actionId) throw fail(409, "Autorizacao de outra acao.");
  if (record.usedAt) throw fail(409, "Autorizacao ja utilizada.");
  if (Date.parse(record.expiresAt) <= Date.now()) throw fail(409, "Autorizacao expirada.");
  return record;
}

/**
 * Marca a autorizacao como utilizada.
 * @param {string} authorizationId
 * @returns {Object | null}
 */
function consumeAuthorization(authorizationId) {
  const manifest = readAuthorizations();
  let consumed = null;
  const records = manifest.records.map((record) => {
    if (record.id !== authorizationId) return record;
    consumed = { ...record, usedAt: new Date().toISOString() };
    return consumed;
  });
  if (consumed) writeAuthorizations(records);
  return consumed;
}

module.exports = {
  AUTHORIZATIONS_REL,
  TTL_MINUTES,
  MAX_RECORDS,
  readAuthorizations,
  writeAuthorizations,
  issueAuthorization,
  findAuthorization,
  assertUsableAuthorization,
  consumeAuthorization,
};
