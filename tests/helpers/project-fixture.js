// @ts-check
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { writeJson } = require("./project-fixture-files");
const { writeDesignSystem } = require("./project-fixture-design-system");
const { writePrototype } = require("./project-fixture-prototype");
const { writeDesignIndex } = require("./project-fixture-design-index");

const DEFAULT_SLUG = "projeto-fixture";

function defaultProfile() {
  return {
    schema: 1,
    designSystem: {
      provider: "fs",
      prefix: "dis-",
      tokensCss: "design/ds/tokens.css",
      componentsDir: "design/ds/components",
      mcpServer: "dis-design-system",
      allowedRepoDirs: ["design/ds", "doc/features"],
    },
    framework: { adapter: "angular" },
    docs: { layers: { adapter: "markdown-folders", featuresGlob: "doc/features/*" } },
    stages: {
      enabled: ["prototype", "extracted", "design_system", "boilerplate", "implemented", "documented"],
    },
    agents: { source: "dai", map: {} },
    prototypes: { viewports: [{ id: "desktop", label: "Desktop", width: 1280 }] },
  };
}

/**
 * Cria um projeto temporário completo para testes, fora de projects/.
 * @param {{ slug?: string, profile?: object, designSystem?: boolean, prototype?: boolean, designIndex?: boolean }} [options]
 */
function createProjectFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-project-fixture-"));
  const projectsDir = path.join(root, "projects");
  const slug = options.slug || DEFAULT_SLUG;
  const dir = path.join(projectsDir, slug);

  fs.mkdirSync(path.join(dir, "design"), { recursive: true });
  writeJson(path.join(dir, "design", "profile.json"), options.profile || defaultProfile());
  if (options.designSystem !== false) writeDesignSystem(dir);
  if (options.prototype !== false) writePrototype(dir);
  if (options.designIndex !== false) writeDesignIndex(dir);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  };

  return {
    root,
    projectsDir,
    slug,
    dir,
    cleanup,
    activate() {
      process.env.HARNESS_PROJECTS_DIR = projectsDir;
      return projectsDir;
    },
  };
}

module.exports = { createProjectFixture, defaultProfile, DEFAULT_SLUG };
