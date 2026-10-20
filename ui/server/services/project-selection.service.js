// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, slugs } = require("../config");

class ProjectSelectionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ProjectSelectionError";
    this.code = code;
  }
}

function canonicalProjectSlug(slug, available = slugs()) {
  if (!slug || typeof slug !== "string") return "";
  const wanted = slug.trim().toLowerCase();
  return available.find((candidate) => candidate.toLowerCase() === wanted) || "";
}

function setActiveProject(slug) {
  const canonical = canonicalProjectSlug(slug);
  if (!canonical) {
    throw new ProjectSelectionError("Projeto inválido ou não encontrado.", "INVALID_PROJECT");
  }

  const activeFile = path.join(getProjects(), ".active");
  const tempFile = path.join(getProjects(), `.active.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempFile, canonical + "\n", "utf8");
    fs.renameSync(tempFile, activeFile);
  } finally {
    if (fs.existsSync(tempFile)) fs.rmSync(tempFile, { force: true });
  }
  return canonical;
}

module.exports = { ProjectSelectionError, canonicalProjectSlug, setActiveProject };
