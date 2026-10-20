// @ts-check
// Listagem de serviços do projeto e gravação da configuração do app.
const fs = require("fs");
const path = require("path");
const { PROJECTS, runningServices } = require("./proc-manager-store");
const { getProjectRepoDir, extractAppConfigFromDocs } = require("./proc-manager-config");

/**
 * Retorna os serviços configurados ou detectados para um projeto
 * @param {string} slug
 * @returns {Array<{ id: string, name: string, command: string, cwd: string, url: string, status: string, pid?: number, uptimeMs?: number }>}
 */
function listProjectServices(slug) {
  const projectDir = path.join(PROJECTS, slug);
  const appJsonFile = path.join(projectDir, "app.json");
  const repoDir = getProjectRepoDir(slug);
  const docsConfig = extractAppConfigFromDocs(slug);
  const services = [];

  let appConfig = null;
  if (fs.existsSync(appJsonFile)) {
    try {
      appConfig = JSON.parse(fs.readFileSync(appJsonFile, "utf8").replace(/^\uFEFF/, ""));
    } catch {}
  }

  if (appConfig) {
    // Se a URL no app.json for o default 4200 mas as instruções explicitarem outra porta (ex: 8081)
    if ((!appConfig.url || appConfig.url.includes("4200")) && docsConfig.url && !docsConfig.url.includes("4200")) {
      appConfig.url = docsConfig.url;
    }

    if (Array.isArray(appConfig.services) && appConfig.services.length > 0) {
      for (let i = 0; i < appConfig.services.length; i++) {
        const s = appConfig.services[i];
        const id = s.id || `srv-${i + 1}`;
        const srvCwd = s.cwd ? (repoDir ? path.resolve(repoDir, s.cwd) : path.resolve(projectDir, s.cwd)) : (repoDir || projectDir);
        services.push({
          id,
          name: s.name || `Serviço ${i + 1}`,
          command: s.command || "npm start",
          cwd: srvCwd,
          url: s.url || appConfig.url || docsConfig.url || "http://localhost:4200",
        });
      }
    } else if (appConfig.command) {
      const srvCwd = appConfig.cwd ? (repoDir ? path.resolve(repoDir, appConfig.cwd) : path.resolve(projectDir, appConfig.cwd)) : (repoDir || projectDir);
      services.push({
        id: "default",
        name: appConfig.name || "Servidor Dev",
        command: appConfig.command,
        cwd: srvCwd,
        url: appConfig.url || docsConfig.url || "http://localhost:4200",
      });
    }
  }

  // Se nada foi declarado no app.json ou faltam serviços, usa os detectados nas instruções/memória
  if (services.length === 0 && docsConfig.services.length > 0) {
    services.push(...docsConfig.services);
  }

  // Se nada foi declarado, tenta descobrir pelo repo
  if (services.length === 0 && repoDir) {
    try {
      const subdirs = fs.readdirSync(repoDir, { withFileTypes: true });
      for (const sub of subdirs) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(repoDir, sub.name);
        const hasPkg = fs.existsSync(path.join(subPath, "package.json"));
        const hasPom = fs.existsSync(path.join(subPath, "pom.xml"));

        if (hasPkg) {
          services.push({
            id: `web-${sub.name}`,
            name: `${sub.name} (Frontend)`,
            command: "npm start",
            cwd: subPath,
            url: docsConfig.url || "http://localhost:4200",
          });
        } else if (hasPom) {
          services.push({
            id: `api-${sub.name}`,
            name: `${sub.name} (API Spring Boot)`,
            command: "mvn spring-boot:run",
            cwd: subPath,
            url: docsConfig.apiUrl || "http://localhost:8080",
          });
        }
      }
    } catch {}
  }

  // Se ainda estiver vazio, define um padrão amigável com a URL dos docs se houver
  if (services.length === 0) {
    services.push({
      id: "default",
      name: "Aplicação Web",
      command: docsConfig.command || "npm start",
      cwd: repoDir || projectDir,
      url: docsConfig.url || "http://localhost:4200",
    });
  }

  // Adiciona o status atual em tempo de execução
  return services.map((s) => {
    const key = `${slug}:${s.id}`;
    const running = runningServices.get(key);
    let status = "stopped";
    let pid = undefined;
    let uptimeMs = undefined;

    if (running && running.child && running.child.exitCode === null) {
      status = running.status;
      pid = running.pid;
      uptimeMs = Date.now() - running.startedAt;
    }

    return {
      ...s,
      status,
      pid,
      uptimeMs,
    };
  });
}

/**
 * Salva a configuração de comandos de execução no app.json do projeto
 * @param {string} slug
 * @param {{ command?: string, cwd?: string, url?: string, name?: string, services?: any[] }} config
 */
function saveProjectAppConfig(slug, config) {
  const projectDir = path.join(PROJECTS, slug);
  const appJsonFile = path.join(projectDir, "app.json");
  let existing = {};
  if (fs.existsSync(appJsonFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(appJsonFile, "utf8").replace(/^\uFEFF/, ""));
    } catch {}
  }
  const merged = { ...existing, ...config };
  fs.writeFileSync(appJsonFile, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

module.exports = { listProjectServices, saveProjectAppConfig };
