// @ts-check
// Skills reconhecidas no ambiente (Gemini, harness, DAI, outros projetos) e importação.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { cleanBOM, parseFrontmatter } = require("./frontmatter");
const { findProjectTargets, PROJECTS } = require("./targets");
const { saveSkill } = require("./writer");

/**
 * Lista todas as skills reconhecidas disponíveis no ambiente
 * (Gemini/Antigravity global, workspace .agents, catálogo DAI e outros projetos do harness).
 * @param {string} [currentSlug] - Slug do projeto atual para evitar sugerir skills idênticas do próprio alvo
 */
function listRecognizedSkills(currentSlug) {
  const recognized = [];
  const seenPaths = new Set();

  function addSkillFolder(dirPath, source, sourceLabel, defaultCategory = "geral") {
    if (!fs.existsSync(dirPath)) return;
    const resolved = path.resolve(dirPath);
    if (seenPaths.has(resolved)) return;

    let skillMdFile = null;
    for (const cand of ["SKILL.md", "SKILL.MD", "skill.md"]) {
      const p = path.join(resolved, cand);
      if (fs.existsSync(p)) {
        skillMdFile = p;
        break;
      }
    }
    if (!skillMdFile) return;

    seenPaths.add(resolved);
    const folderName = path.basename(resolved);
    let content = "";
    let frontmatter = {};
    try {
      content = cleanBOM(fs.readFileSync(skillMdFile, "utf8"));
      frontmatter = parseFrontmatter(content).attributes;
    } catch {}

    const name = frontmatter.name || folderName;
    const title = frontmatter.title || name;
    const description = frontmatter.description || "";
    const version = frontmatter.version || "1.0.0";

    const refDir = path.join(resolved, "references");
    let referencesCount = 0;
    if (fs.existsSync(refDir)) {
      try {
        referencesCount = fs.readdirSync(refDir, { withFileTypes: true }).filter((e) => e.isFile()).length;
      } catch {}
    }

    recognized.push({
      id: `${source}:${name}`,
      name,
      title,
      description,
      version,
      source,
      sourceLabel,
      sourcePath: resolved,
      hasSkillMd: true,
      referencesCount,
      category: defaultCategory,
    });
  }

  // 1. Global Gemini / Antigravity (~/.gemini/config/skills)
  const userProfile = process.env.USERPROFILE || process.env.HOME || "";
  const geminiSkillsDir = path.join(userProfile, ".gemini", "config", "skills");
  if (fs.existsSync(geminiSkillsDir)) {
    try {
      for (const ent of fs.readdirSync(geminiSkillsDir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          addSkillFolder(path.join(geminiSkillsDir, ent.name), "gemini", "Global Antigravity / Gemini", "global");
        }
      }
    } catch {}
  }

  // 2. Workspace Harness (.agents/skills)
  const harnessAgentsDir = path.join(ROOT, ".agents", "skills");
  if (fs.existsSync(harnessAgentsDir)) {
    try {
      for (const ent of fs.readdirSync(harnessAgentsDir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          addSkillFolder(path.join(harnessAgentsDir, ent.name), "harness", "Harness Leca (.agents)", "harness");
        }
      }
    } catch {}
  }

  // 3. Catálogo DAI ST12 (git/DAI/skills)
  const daiSkillsDir = path.join(userProfile, "git", "DAI", "skills");
  if (fs.existsSync(daiSkillsDir)) {
    function scanDai(dir, depth = 1) {
      if (depth > 3) return;
      try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
          const full = path.join(dir, ent.name);
          if (fs.existsSync(path.join(full, "SKILL.md")) || fs.existsSync(path.join(full, "skill.md"))) {
            addSkillFolder(full, "dai", "Framework DAI ST12", path.basename(dir));
          } else {
            scanDai(full, depth + 1);
          }
        }
      } catch {}
    }
    scanDai(daiSkillsDir, 1);
  }

  // 4. Outros projetos no Harness Leca
  if (fs.existsSync(PROJECTS)) {
    try {
      for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
        if (!proj.isDirectory() || proj.name.startsWith(".") || proj.name.startsWith("_")) continue;
        if (currentSlug && proj.name === currentSlug) continue; // não repete o próprio projeto
        const projTargets = findProjectTargets(proj.name);
        for (const t of projTargets) {
          const skDir = path.join(t.path, ".agents", "skills");
          if (fs.existsSync(skDir)) {
            try {
              for (const sk of fs.readdirSync(skDir, { withFileTypes: true })) {
                if (sk.isDirectory()) {
                  addSkillFolder(path.join(skDir, sk.name), "project", `Projeto ${proj.name} (${t.label})`, "projeto");
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  // Ordena por nome alfabético
  recognized.sort((a, b) => a.name.localeCompare(b.name));
  return recognized;
}

/**
 * Importa uma skill reconhecida para um alvo de destino no projeto
 * @param {string} slug
 * @param {string} targetId
 * @param {string} skillName
 * @param {string} [sourcePath]
 */
function importRecognizedSkill(slug, targetId, skillName, sourcePath) {
  let resolvedSource = sourcePath;
  if (!resolvedSource || !fs.existsSync(resolvedSource)) {
    const all = listRecognizedSkills(slug);
    const found = all.find((s) => s.name === skillName || s.sourcePath === sourcePath);
    if (!found) {
      throw new Error(`Skill reconhecida "${skillName}" não foi localizada nas fontes do sistema.`);
    }
    resolvedSource = found.sourcePath;
  }

  let skillMdFile = null;
  for (const cand of ["SKILL.md", "SKILL.MD", "skill.md"]) {
    const p = path.join(resolvedSource, cand);
    if (fs.existsSync(p)) {
      skillMdFile = p;
      break;
    }
  }

  if (!skillMdFile) {
    throw new Error(`Arquivo SKILL.md não encontrado em ${resolvedSource}`);
  }

  const content = cleanBOM(fs.readFileSync(skillMdFile, "utf8"));
  const references = [];
  const refDir = path.join(resolvedSource, "references");
  if (fs.existsSync(refDir)) {
    try {
      const refFiles = fs.readdirSync(refDir, { withFileTypes: true });
      for (const rf of refFiles) {
        if (rf.isFile()) {
          const rPath = path.join(refDir, rf.name);
          const rstat = fs.statSync(rPath);
          let refContent = "";
          try {
            refContent = cleanBOM(fs.readFileSync(rPath, "utf8"));
          } catch {}
          references.push({
            name: rf.name,
            size: rstat.size,
            preview: refContent.slice(0, 1000),
            content: refContent,
          });
        }
      }
    } catch {}
  }

  const saved = saveSkill(slug, targetId, skillName, {
    content,
    references,
  });

  return { ok: true, skill: saved };
}

module.exports = { listRecognizedSkills, importRecognizedSkill };
