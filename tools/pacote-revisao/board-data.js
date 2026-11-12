// @ts-check
// Dados do quadro de revisao: historias do snapshot local, vinculos com tela e campo, arquivos que estao no pacote.
// So leitura. O Jira nao e consultado: o status vem do snapshot, com os ajustes declarados em `statusForcado`.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { ROOT } = require("./config");
const { readStoryFeatures } = require(path.join(ROOT, "ui", "server", "services", "story-features.service.js"));

/** @param {string} slug @param {string[]} args */
function scrum(slug, args) {
  const out = execFileSync("node", [path.join(ROOT, "tools", "scrum.js"), "--project", slug, ...args], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out);
}

/** @param {string} dir @param {string} base */
function walk(dir, base) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out.sort();
}

/** Titulo da historia sem snapshot: primeiro titulo do user-story.md, sem a chave. */
function headingOf(file) {
  try {
    const m = fs.readFileSync(file, "utf8").match(/^#\s+(.+)$/m);
    return m ? m[1].replace(/^[A-Z]+-\d+\s*[-:–]?\s*/i, "").trim() : "";
  } catch { return ""; }
}

/** @param {any} story */
function relationsOf(story) {
  return (story.relationships || []).map((r) => ({
    relation: r.relation, direction: r.direction,
    key: (r.issue && r.issue.key) || "", title: (r.issue && r.issue.title) || "", status: (r.issue && r.issue.status && r.issue.status.name) || "",
  }));
}

/**
 * @param {{ slug: string, repo: string, outDir: string, config: any, screens: any[] }} p
 * @returns {{ geradoEm: string, stories: any[] }}
 */
function collectBoard({ slug, repo, outDir, config, screens }) {
  const sprints = Object.fromEntries(scrum(slug, ["sprint", "list"]).sprints.map((s) => [s.id, s.name]));
  const links = readStoryFeatures(repo, screens).stories;
  const forced = Object.fromEntries(config.statusForcado.map((s) => [s.key, s.status]));
  const stories = config.historias.map((key) => {
    let story = null;
    try { story = scrum(slug, ["story", "get", key]); } catch { story = null; }
    const f = links[key] || { dona: [], relacionada: [], campos: { dona: [], relacionada: [] } };
    const files = walk(path.join(outDir, "doc", "scrum", key), outDir);
    const pick = (x) => ({ grupo: x.grupo, rotulo: x.rotulo, screenId: x.screenId, fieldId: x.fieldId });
    return {
      key,
      inSnapshot: Boolean(story),
      title: story ? story.title : headingOf(path.join(outDir, "doc", "scrum", key, "user-story.md")) || key,
      sprint: story && story.sprintId ? sprints[story.sprintId] || story.sprintId : null,
      status: forced[key] || (story && story.sourceStatus ? story.sourceStatus.name : null),
      statusDoSnapshot: story && story.sourceStatus ? story.sourceStatus.name : null,
      type: story ? (story.issueType && story.issueType.name) || null : null,
      epic: story ? story.epicId : null,
      priority: story ? story.priority : null,
      points: story ? story.points : null,
      assignee: story ? story.assignee : null,
      description: story ? story.description || "" : "",
      relationships: story ? relationsOf(story) : [],
      files,
      features: {
        dona: f.dona.map((x) => ({ slug: x.slug, title: x.title })),
        relacionada: f.relacionada.map((x) => ({ slug: x.slug, title: x.title, papel: x.papel })),
      },
      fields: { dona: f.campos.dona.map(pick), relacionada: f.campos.relacionada.map(pick) },
    };
  });
  return { geradoEm: new Date().toISOString(), stories };
}

module.exports = { collectBoard, walk };
