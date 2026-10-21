// @ts-check
const fs = require("fs");
const path = require("path");

const RELATIONSHIPS_REL = "artifacts/.relationships.json";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACTS = 5000;
const MAX_LINKS = 50;
const MAX_TARGETS = 2000;
const ARTIFACT_KEY = /^[a-z]+:[^\0\r\n]{1,400}$/;
const TARGET_KEY = /^screen:[A-Za-z0-9%._~-]{1,240}\|[A-Za-z0-9%._~-]{1,80}#field:[A-Za-z0-9%._~-]{1,80}$/;
const ACTIONS = new Set(["add", "remove"]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function encodePart(value) {
  return encodeURIComponent(String(value || "").trim()).replace(/[!'()*]/g, (char) => {
    return "%" + char.charCodeAt(0).toString(16).toUpperCase();
  });
}

function screenFieldKey(route, screenId, fieldId) {
  const routePart = encodePart(route) || encodePart(screenId);
  const screenPart = encodePart(screenId);
  const fieldPart = encodePart(fieldId);
  if (!routePart || !screenPart || !fieldPart) return "";
  const key = `screen:${routePart}|${screenPart}#field:${fieldPart}`;
  return TARGET_KEY.test(key) ? key : "";
}

function normalizeArtifactKey(value) {
  const key = String(value || "").trim();
  return ARTIFACT_KEY.test(key) ? key : "";
}

function normalizeTargetKey(value) {
  const key = String(value || "").trim();
  return TARGET_KEY.test(key) ? key : "";
}

function safeLabel(value, max = 160) {
  return String(value || "").replace(/[\0\r\n]/g, " ").trim().slice(0, max);
}

function relationshipPath(projectDir) {
  return path.join(projectDir, RELATIONSHIPS_REL);
}

function readRelationshipState(projectDir) {
  const empty = { items: {}, updatedAt: "", error: "" };
  const root = path.join(projectDir, "artifacts");
  try {
    if (!fs.existsSync(root)) return empty;
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { ...empty, error: "Pasta de artefatos inválida." };
    }
    const abs = relationshipPath(projectDir);
    if (!fs.existsSync(abs)) return empty;
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) {
      return { ...empty, error: "Arquivo de vínculos inválido." };
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, ""));
    if (raw?.version !== 1 || !raw.items || typeof raw.items !== "object" || Array.isArray(raw.items)) {
      return { ...empty, error: "Arquivo de vínculos inválido." };
    }
    const entries = Object.entries(raw.items);
    if (entries.length > MAX_ARTIFACTS) return { ...empty, error: "Limite de vínculos excedido." };

    const items = {};
    for (const [rawKey, rawLinks] of entries) {
      const artifactKey = normalizeArtifactKey(rawKey);
      if (!artifactKey || artifactKey !== rawKey || !Array.isArray(rawLinks)) continue;
      const links = [];
      for (const rawLink of rawLinks) {
        const targetKey = normalizeTargetKey(rawLink);
        if (targetKey && !links.includes(targetKey)) links.push(targetKey);
        if (links.length >= MAX_LINKS) break;
      }
      if (links.length) items[artifactKey] = links;
    }
    const updatedAt = Number.isFinite(Date.parse(String(raw.updatedAt || "")))
      ? new Date(raw.updatedAt).toISOString()
      : "";
    return { items, updatedAt, error: "" };
  } catch {
    return { ...empty, error: "Arquivo de vínculos inválido." };
  }
}

function saveRelationshipState(projectDir, items) {
  const root = path.join(projectDir, "artifacts");
  try {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("root");
    const abs = relationshipPath(projectDir);
    if (fs.existsSync(abs)) {
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("file");
    }
    const temp = path.join(root, `.relationships.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    const body = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2);
    fs.writeFileSync(temp, body, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      fs.renameSync(temp, abs);
    } catch {
      fs.copyFileSync(temp, abs);
      fs.rmSync(temp, { force: true });
    }
  } catch {
    throw fail(500, "Falha ao gravar os vínculos do artefato.");
  }
}

function collectRelationshipTargets(screens) {
  const targets = [];
  const byKey = new Map();
  const list = Array.isArray(screens) ? screens : [];
  for (const screen of list) {
    const screenId = safeLabel(screen?.id, 80);
    const route = safeLabel(screen?.route || screen?.id, 240);
    const screenTitle = safeLabel(screen?.title || screen?.short || route, 160);
    const fields = Array.isArray(screen?.fields) ? screen.fields : [];
    for (const field of fields) {
      const fieldId = safeLabel(field?.id, 80);
      if (!screenId || !fieldId) continue;
      const key = screenFieldKey(route, screenId, fieldId);
      if (!key || byKey.has(key)) continue;
      const target = {
        key,
        screenId,
        screenTitle,
        route,
        fieldId,
        fieldLabel: safeLabel(field?.label || field?.rotulo || fieldId, 160),
      };
      byKey.set(key, target);
      targets.push(target);
      if (targets.length >= MAX_TARGETS) return { targets, byKey };
    }
  }
  targets.sort((a, b) => a.screenTitle.localeCompare(b.screenTitle, "pt-BR") || a.fieldLabel.localeCompare(b.fieldLabel, "pt-BR"));
  return { targets, byKey };
}

function buildRelationshipReport(projectDir, targetInfo, allowedArtifactKeys) {
  const state = readRelationshipState(projectDir);
  const allowed = allowedArtifactKeys instanceof Set ? allowedArtifactKeys : new Set();
  const items = {};
  const unresolved = [];
  let links = 0;
  let artifactsWithLinks = 0;

  for (const [artifactKey, storedLinks] of Object.entries(state.items)) {
    if (!allowed.has(artifactKey)) continue;
    const resolved = [];
    for (const targetKey of storedLinks) {
      const target = targetInfo.byKey.get(targetKey);
      if (target) resolved.push(target);
      else unresolved.push({ artifactKey, targetKey });
    }
    if (resolved.length) items[artifactKey] = resolved;
    if (resolved.length || storedLinks.length) artifactsWithLinks += 1;
    links += resolved.length;
  }

  return {
    ok: true,
    version: 1,
    updatedAt: state.updatedAt,
    targets: targetInfo.targets,
    items,
    unresolved,
    totals: { artifactsWithLinks, links, unresolved: unresolved.length },
    warnings: state.error ? [state.error] : [],
  };
}

function setArtifactRelationship(projectDir, input, targetInfo, allowedArtifactKeys) {
  const action = String(input?.action || "");
  if (!ACTIONS.has(action)) throw fail(400, "Ação de vínculo inválida.");
  const artifactKey = normalizeArtifactKey(input?.artifactKey);
  if (!artifactKey || !(allowedArtifactKeys instanceof Set) || !allowedArtifactKeys.has(artifactKey)) {
    throw fail(400, "Artefato não encontrado no inventário.");
  }
  const targetKey = normalizeTargetKey(input?.targetKey);
  const target = targetKey ? targetInfo.byKey.get(targetKey) : null;
  if (!targetKey) throw fail(400, "Tela ou campo do Mapa em Camadas não encontrado.");
  if (action === "add" && !target) throw fail(400, "Tela ou campo do Mapa em Camadas não encontrado.");

  const state = readRelationshipState(projectDir);
  if (state.error) throw fail(500, state.error);
  const current = state.items[artifactKey] ? [...state.items[artifactKey]] : [];
  let changed = false;

  if (action === "add") {
    if (!current.includes(targetKey)) {
      if (current.length >= MAX_LINKS) throw fail(409, "Limite de vínculos por artefato atingido.");
      current.push(targetKey);
      changed = true;
    }
  } else {
    const next = current.filter((key) => key !== targetKey);
    changed = next.length !== current.length;
    current.length = 0;
    current.push(...next);
  }

  if (current.length) state.items[artifactKey] = current;
  else delete state.items[artifactKey];
  if (Object.keys(state.items).length > MAX_ARTIFACTS) throw fail(409, "Limite de artefatos com vínculos atingido.");
  if (changed) saveRelationshipState(projectDir, state.items);

  return {
    ...buildRelationshipReport(projectDir, targetInfo, allowedArtifactKeys),
    changed,
    artifactKey,
    targetKey,
  };
}

module.exports = {
  RELATIONSHIPS_REL,
  MAX_LINKS,
  screenFieldKey,
  normalizeArtifactKey,
  normalizeTargetKey,
  readRelationshipState,
  collectRelationshipTargets,
  buildRelationshipReport,
  setArtifactRelationship,
};
