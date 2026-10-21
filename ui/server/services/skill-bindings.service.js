// @ts-check
// Vínculo de skills de um projeto com as raias do Scrum (EP-08.03).
// Manifesto: projects/<slug>/skill-bindings.json (version 1, items: laneId -> [targetId:skillName]).
const fs = require("fs");
const path = require("path");

const BINDINGS_REL = "skill-bindings.json";
const MAX_BYTES = 256 * 1024;
const MAX_LANES = 12;
const MAX_SKILLS_PER_LANE = 20;
const SKILL_KEY = /^[A-Za-z0-9._-]{1,64}:[A-Za-z0-9._-]{1,64}$/;
const ACTIONS = new Set(["add", "remove"]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function bindingsPath(projectDir) {
  return path.join(projectDir, BINDINGS_REL);
}

function normalizeSkillKey(value) {
  const key = String(value || "").trim();
  return SKILL_KEY.test(key) ? key : "";
}

function normalizeLaneId(value, laneIds) {
  const id = String(value || "").trim();
  return laneIds instanceof Set && laneIds.has(id) ? id : "";
}

function readBindingState(projectDir) {
  const empty = { items: {}, updatedAt: "", error: "" };
  const abs = bindingsPath(projectDir);
  try {
    if (!fs.existsSync(abs)) return empty;
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) {
      return { ...empty, error: "Arquivo de vínculos de skills inválido." };
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, ""));
    if (raw?.version !== 1 || !raw.items || typeof raw.items !== "object" || Array.isArray(raw.items)) {
      return { ...empty, error: "Arquivo de vínculos de skills inválido." };
    }
    const entries = Object.entries(raw.items);
    if (entries.length > MAX_LANES) return { ...empty, error: "Limite de raias com vínculos excedido." };

    const items = {};
    for (const [rawLane, rawSkills] of entries) {
      const laneId = String(rawLane || "").trim();
      if (!laneId || laneId !== rawLane || !Array.isArray(rawSkills)) continue;
      const skills = [];
      for (const rawSkill of rawSkills) {
        const skillKey = normalizeSkillKey(rawSkill);
        if (skillKey && !skills.includes(skillKey)) skills.push(skillKey);
        if (skills.length >= MAX_SKILLS_PER_LANE) break;
      }
      if (skills.length) items[laneId] = skills;
    }
    const updatedAt = Number.isFinite(Date.parse(String(raw.updatedAt || "")))
      ? new Date(raw.updatedAt).toISOString()
      : "";
    return { items, updatedAt, error: "" };
  } catch {
    return { ...empty, error: "Arquivo de vínculos de skills inválido." };
  }
}

function saveBindingState(projectDir, items) {
  try {
    const abs = bindingsPath(projectDir);
    if (fs.existsSync(abs)) {
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("file");
    }
    const temp = path.join(projectDir, `.skill-bindings.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    const body = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2);
    fs.writeFileSync(temp, body, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      fs.renameSync(temp, abs);
    } catch {
      fs.copyFileSync(temp, abs);
      fs.rmSync(temp, { force: true });
    }
  } catch {
    throw fail(500, "Falha ao gravar os vínculos de skills.");
  }
}

function buildBindingReport(projectDir, lanes, skillKeys) {
  const state = readBindingState(projectDir);
  const known = skillKeys instanceof Set ? skillKeys : new Set();
  const items = {};
  const unresolved = [];
  let bindings = 0;
  let lanesWithBindings = 0;

  for (const [laneId, storedSkills] of Object.entries(state.items)) {
    const resolved = [];
    for (const skillKey of storedSkills) {
      if (known.has(skillKey)) resolved.push(skillKey);
      else unresolved.push({ laneId, skillKey });
    }
    if (resolved.length) items[laneId] = resolved;
    if (resolved.length || storedSkills.length) lanesWithBindings += 1;
    bindings += resolved.length;
  }

  return {
    ok: true,
    version: 1,
    updatedAt: state.updatedAt,
    lanes,
    skills: [...known],
    items,
    unresolved,
    totals: { lanesWithBindings, bindings, unresolved: unresolved.length },
    warnings: state.error ? [state.error] : [],
  };
}

function setSkillBinding(projectDir, input, lanes, skillKeys) {
  const action = String(input?.action || "");
  if (!ACTIONS.has(action)) throw fail(400, "Ação de vínculo inválida.");
  const laneIds = new Set((Array.isArray(lanes) ? lanes : []).map((lane) => lane.id));
  const laneId = normalizeLaneId(input?.laneId, laneIds);
  if (!laneId) throw fail(400, "Raia do Scrum não encontrada.");
  const known = skillKeys instanceof Set ? skillKeys : new Set();
  const skillKey = normalizeSkillKey(input?.skillKey);
  if (!skillKey || !known.has(skillKey)) throw fail(400, "Skill do projeto não encontrada.");

  const state = readBindingState(projectDir);
  if (state.error) throw fail(500, state.error);
  const current = state.items[laneId] ? [...state.items[laneId]] : [];
  let changed = false;

  if (action === "add") {
    if (!current.includes(skillKey)) {
      if (current.length >= MAX_SKILLS_PER_LANE) throw fail(409, "Limite de skills por raia atingido.");
      current.push(skillKey);
      changed = true;
    }
  } else {
    const next = current.filter((key) => key !== skillKey);
    changed = next.length !== current.length;
    current.length = 0;
    current.push(...next);
  }

  if (current.length) state.items[laneId] = current;
  else delete state.items[laneId];
  if (Object.keys(state.items).length > MAX_LANES) throw fail(409, "Limite de raias com vínculos atingido.");
  if (changed) saveBindingState(projectDir, state.items);

  return { ...buildBindingReport(projectDir, lanes, known), changed, laneId, skillKey };
}

module.exports = {
  BINDINGS_REL,
  MAX_SKILLS_PER_LANE,
  normalizeSkillKey,
  readBindingState,
  buildBindingReport,
  setSkillBinding,
};
