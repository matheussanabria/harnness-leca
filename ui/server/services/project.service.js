// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, read } = require("../config");

const S = require("../../../tools/lib/state");
const MR = require("../../../tools/lib/memory-review");
const skillsLib = require("../../../tools/lib/skills");
const procManager = require("../../../tools/lib/proc-manager");

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name !== ".gitkeep")
      .map((f) => {
        const st = fs.statSync(path.join(dir, f.name));
        const head = read(path.join(dir, f.name)).slice(0, 600);
        const t = head.match(/^titulo: "(.*)"$/m);
        const ag = head.match(/^agente: "(.*)"$/m);
        return { name: f.name, title: t ? t[1] : "", agent: ag ? ag[1] : "", size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

function reviewSummary(slug) {
  try {
    return { pendentes: MR.pending(slug).length };
  } catch {
    return { pendentes: 0 };
  }
}

function readProjectGroups(slug) {
  try {
    const file = path.join(getProjects(), slug, "groups.json");
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      return {
        groups: Array.isArray(data.groups) ? data.groups : [],
        assignments: typeof data.assignments === "object" && data.assignments !== null ? data.assignments : {},
      };
    }
  } catch (err) {
    console.error("[readProjectGroups]", err);
  }
  return { groups: [], assignments: {} };
}

function project(slug) {
  const dir = path.join(getProjects(), slug);
  let extraction = { total: 0, ok: 0, nova: 0, alterada: 0, rows: [] };
  let scanMap = new Map();
  try {
    const rows = S.scan(slug);
    extraction = {
      total: rows.length,
      ok: rows.filter((r) => r.status === "ok").length,
      nova: rows.filter((r) => r.status === "nova").length,
      alterada: rows.filter((r) => r.status === "alterada").length,
      rows: rows.map((r) => ({
        name: r.name,
        titulo: r.titulo,
        data: r.data,
        turnos: r.turnos,
        turnosAntes: r.antes ? r.antes.turnos : null,
        status: r.status,
        por: r.antes ? r.antes.por : null,
        analisadoEm: r.antes && r.antes.analisadoEm ? r.antes.analisadoEm.slice(0, 10) : null,
      })),
    };
    scanMap = new Map(rows.map((r) => [r.name, r]));
  } catch {}

  const groupsData = readProjectGroups(slug);
  const rawChats = listDir(path.join(dir, "chats"));
  const chats = rawChats.map((c) => {
    const sc = scanMap.get(c.name);
    const assign = groupsData.assignments && groupsData.assignments[c.name] ? groupsData.assignments[c.name] : null;
    return {
      ...c,
      status: sc ? sc.status : "nova",
      analyzedBy: sc && sc.antes ? sc.antes.por : null,
      analyzedAt: sc && sc.antes && sc.antes.analisadoEm ? sc.antes.analisadoEm.slice(0, 10) : null,
      turns: sc ? sc.turnos : 0,
      group: assign ? (assign.group || assign.groupId || "") : "",
      groupId: assign ? (assign.groupId || "") : "",
      subgroup: assign ? (assign.subgroup || "") : "",
    };
  });

  let appConfig = null;
  const appJsonFile = path.join(dir, "app.json");
  if (fs.existsSync(appJsonFile)) {
    try {
      appConfig = JSON.parse(fs.readFileSync(appJsonFile, "utf8").replace(/^\uFEFF/, ""));
    } catch {}
  } else {
    const mcpJsonFile = path.join(dir, "mcp.json");
    if (fs.existsSync(mcpJsonFile)) {
      try {
        const mcpCfg = JSON.parse(fs.readFileSync(mcpJsonFile, "utf8").replace(/^\uFEFF/, ""));
        if (mcpCfg && mcpCfg.app) appConfig = mcpCfg.app;
      } catch {}
    }
  }

  // Completa/sincroniza com as instruções e memórias do projeto
  const docsAppConfig = procManager.extractAppConfigFromDocs(slug);
  if (!appConfig) {
    appConfig = {
      name: slug,
      url: docsAppConfig.url,
      command: docsAppConfig.command,
      cwd: docsAppConfig.cwd,
      routes: [{ label: "Início", path: "/" }],
    };
  } else {
    if ((!appConfig.url || appConfig.url.includes("4200")) && docsAppConfig.url && !docsAppConfig.url.includes("4200")) {
      appConfig.url = docsAppConfig.url;
    }
    if (!appConfig.command && docsAppConfig.command) {
      appConfig.command = docsAppConfig.command;
    }
    if (!appConfig.cwd && docsAppConfig.cwd) {
      appConfig.cwd = docsAppConfig.cwd;
    }
  }

  return {
    slug,
    instructions: read(path.join(dir, "instructions.md")),
    memory: read(path.join(dir, "memory.md")),
    context: listDir(path.join(dir, "context")),
    chats,
    scheduled: listDir(path.join(dir, "scheduled")),
    extraction,
    review: reviewSummary(slug),
    app: appConfig,
    groups: groupsData,
    skills: skillsLib.listProjectSkills(slug),
    services: procManager.listProjectServices(slug),
    commandsSuggested: procManager.extractCommandsFromDocs(slug),
  };
}

function activityMs(slug) {
  try {
    const dir = path.join(getProjects(), slug, "chats");
    let max = 0;
    for (const f of fs.readdirSync(dir)) max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs);
    return max;
  } catch {
    return 0;
  }
}

function overviewProject(slug) {
  const dir = path.join(getProjects(), slug);
  let rows = null;
  try {
    rows = S.scan(slug);
  } catch {
    /* chats ilegíveis: cai para a contagem de arquivos abaixo */
  }
  const list = rows || [];
  return {
    slug,
    chats: rows ? rows.length : listDir(path.join(dir, "chats")).filter((c) => c.name.endsWith(".md")).length,
    lastChat: list.length && list[0].fim ? list[0].fim.slice(0, 10) : null,
    extraction: {
      total: list.length,
      ok: list.filter((r) => r.status === "ok").length,
      nova: list.filter((r) => r.status === "nova").length,
      alterada: list.filter((r) => r.status === "alterada").length,
    },
    review: reviewSummary(slug),
    context: listDir(path.join(dir, "context")).length,
    scheduled: listDir(path.join(dir, "scheduled")).length,
    memoryBytes: Buffer.byteLength(read(path.join(dir, "memory.md"))),
    instructionsBytes: Buffer.byteLength(read(path.join(dir, "instructions.md"))),
  };
}

const OV_CACHE = new Map();
const fpFile = (p) => {
  try {
    const st = fs.statSync(p);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "";
  }
};
const fpDir = (dir) => {
  try {
    const files = fs.readdirSync(dir);
    let sum = 0,
      max = 0;
    for (const f of files) {
      try {
        const st = fs.statSync(path.join(dir, f));
        sum += st.size;
        max = Math.max(max, st.mtimeMs);
      } catch {
        /* arquivo sumiu no meio */
      }
    }
    return `${files.length}:${max}:${sum}`;
  } catch {
    return "";
  }
};

function overviewCached(slug, isActive) {
  const dir = path.join(getProjects(), slug);
  const fp = [
    fpDir(path.join(dir, "chats")),
    fpFile(path.join(dir, "extraction-state.json")),
    fpFile(path.join(dir, "memory.md")),
    fpFile(path.join(dir, "instructions.md")),
    fpFile(path.join(dir, "memory-review.json")),
    fpFile(path.join(dir, "groups.json")),
    fpDir(path.join(dir, "context")),
    fpDir(path.join(dir, "scheduled")),
  ].join("|");
  const hit = OV_CACHE.get(slug);
  const summary = hit && hit.fp === fp ? hit.value : overviewProject(slug);
  if (!hit || hit.fp !== fp) OV_CACHE.set(slug, { fp, value: summary });
  return { ...summary, active: isActive };
}

module.exports = {
  listDir,
  reviewSummary,
  readProjectGroups,
  project,
  activityMs,
  overviewProject,
  overviewCached,
};
