// @ts-check
// Leitura de skills de um projeto: listagem e detalhe.
const fs = require("fs");
const path = require("path");
const { cleanBOM, parseFrontmatter } = require("./frontmatter");
const { findProjectTargets } = require("./targets");

/**
 * Lista todas as skills de um projeto em todos os alvos detectados.
 * @param {string} slug
 */
function listProjectSkills(slug) {
  const targets = findProjectTargets(slug);
  const allSkills = [];

  for (const t of targets) {
    // Procura por .agents/skills ou skills
    let skillsDir = path.join(t.path, ".agents", "skills");
    if (!fs.existsSync(skillsDir) && fs.existsSync(path.join(t.path, "skills"))) {
      skillsDir = path.join(t.path, "skills");
    }

    if (!fs.existsSync(skillsDir)) continue;

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
        const skillFolder = path.join(skillsDir, ent.name);
        const skillMdCandidates = ["SKILL.md", "SKILL.MD", "skill.md", "Skill.md"];
        let skillMdFile = null;
        for (const cand of skillMdCandidates) {
          const p = path.join(skillFolder, cand);
          if (fs.existsSync(p)) {
            skillMdFile = p;
            break;
          }
        }

        let title = ent.name;
        let description = "";
        let version = "1.0.0";
        let hasSkillMd = false;
        let mtime = "";

        if (skillMdFile) {
          hasSkillMd = true;
          try {
            const stat = fs.statSync(skillMdFile);
            mtime = stat.mtime.toISOString().slice(0, 10);
            const content = cleanBOM(fs.readFileSync(skillMdFile, "utf8"));
            const parsed = parseFrontmatter(content);
            if (parsed.attributes.name) title = parsed.attributes.name;
            if (parsed.attributes.description) description = parsed.attributes.description;
            if (parsed.attributes.version) version = parsed.attributes.version;

            if (!description) {
              const bodyLines = parsed.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              for (const l of bodyLines) {
                if (l.startsWith("#")) {
                  if (title === ent.name) title = l.replace(/^#+\s*/, "");
                } else if (!description && !l.startsWith("---") && !l.startsWith("!")) {
                  description = l;
                  break;
                }
              }
            }
          } catch {}
        } else {
          try {
            const stat = fs.statSync(skillFolder);
            mtime = stat.mtime.toISOString().slice(0, 10);
          } catch {}
          description = "Pendente de conteúdo / Pasta criada sem SKILL.md";
        }

        // Lê referências se houver
        const refDir = path.join(skillFolder, "references");
        const references = [];
        if (fs.existsSync(refDir)) {
          try {
            const refEntries = fs.readdirSync(refDir, { withFileTypes: true });
            for (const r of refEntries) {
              if (r.isFile() && r.name.endsWith(".md")) {
                const rfPath = path.join(refDir, r.name);
                const rstat = fs.statSync(rfPath);
                references.push({
                  name: r.name,
                  size: rstat.size,
                });
              }
            }
          } catch {}
        }

        allSkills.push({
          id: `${t.id}:${ent.name}`,
          name: ent.name,
          targetId: t.id,
          targetLabel: t.label,
          targetPath: t.path,
          targetType: t.type,
          skillDir: skillFolder,
          skillMdFile,
          hasSkillMd,
          title,
          description,
          version,
          references,
          mtime,
        });
      }
    } catch {}
  }

  return {
    targets,
    skills: allSkills,
  };
}

/**
 * Lê o detalhe completo de uma skill específica
 */
function getSkillDetail(slug, targetId, skillName) {
  const targets = findProjectTargets(slug);
  const target = targets.find((t) => t.id === targetId);
  if (!target) return null;

  let skillsDir = path.join(target.path, ".agents", "skills");
  if (!fs.existsSync(skillsDir) && fs.existsSync(path.join(target.path, "skills"))) {
    skillsDir = path.join(target.path, "skills");
  }
  const skillFolder = path.join(skillsDir, skillName);
  if (!fs.existsSync(skillFolder)) return null;

  const skillMdCandidates = ["SKILL.md", "SKILL.MD", "skill.md"];
  let skillMdFile = null;
  for (const cand of skillMdCandidates) {
    const p = path.join(skillFolder, cand);
    if (fs.existsSync(p)) {
      skillMdFile = p;
      break;
    }
  }

  let content = "";
  let frontmatter = {};
  let body = "";
  if (skillMdFile) {
    content = cleanBOM(fs.readFileSync(skillMdFile, "utf8"));
    const parsed = parseFrontmatter(content);
    frontmatter = parsed.attributes;
    body = parsed.body;
  }

  const refDir = path.join(skillFolder, "references");
  const references = [];
  if (fs.existsSync(refDir)) {
    try {
      const refFiles = fs.readdirSync(refDir, { withFileTypes: true });
      for (const rf of refFiles) {
        if (rf.isFile()) {
          const filePath = path.join(refDir, rf.name);
          const rstat = fs.statSync(filePath);
          let preview = "";
          let refContent = "";
          try {
            refContent = cleanBOM(fs.readFileSync(filePath, "utf8"));
            preview = refContent.slice(0, 1000);
          } catch {}
          references.push({
            name: rf.name,
            size: rstat.size,
            preview,
            content: refContent,
          });
        }
      }
    } catch {}
  }

  return {
    name: skillName,
    targetId: target.id,
    targetLabel: target.label,
    targetPath: target.path,
    skillFolder,
    hasSkillMd: !!skillMdFile,
    content,
    frontmatter,
    body,
    references,
  };
}

module.exports = { listProjectSkills, getSkillDetail };
