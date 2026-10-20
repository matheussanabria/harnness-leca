// @ts-check
// Descoberta do repositório e extração de comandos/configuração dos docs.
const fs = require("fs");
const path = require("path");
const { PROJECTS } = require("./proc-manager-store");

/**
 * Lê o caminho raiz do repositório configurado no mcp.json do projeto
 * @param {string} slug
 * @returns {string|null}
 */
function getProjectRepoDir(slug) {
  const mcpFile = path.join(PROJECTS, slug, "mcp.json");
  if (fs.existsSync(mcpFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(mcpFile, "utf8").replace(/^\uFEFF/, ""));
      if (data && data.repo && fs.existsSync(data.repo)) {
        return path.resolve(data.repo);
      }
    } catch {}
  }
  return null;
}

/**
 * Extrai comandos sugeridos ou declarados nas instruções e memória do projeto
 * @param {string} slug
 * @returns {Array<{ command: string, cwdHint: string, label: string }>}
 */
function extractCommandsFromDocs(slug) {
  const suggestions = [];
  const projectDir = path.join(PROJECTS, slug);
  const docs = [
    path.join(projectDir, "instructions.md"),
    path.join(projectDir, "memory.md"),
  ];

  for (const file of docs) {
    if (!fs.existsSync(file)) continue;
    try {
      const content = fs.readFileSync(file, "utf8");
      // Procura padrões como "via 'npm run dev'", "via 'mvn spring-boot:run'", "execute npm start"
      const matches = content.matchAll(/(?:via|rodar com|execute|comando:?)\s+['"`]([^'"`]+)['"`]/gi);
      for (const m of matches) {
        const cmd = m[1].trim();
        if (cmd && (cmd.startsWith("npm ") || cmd.startsWith("yarn ") || cmd.startsWith("mvn ") || cmd.startsWith("pnpm ") || cmd.startsWith("ng "))) {
          suggestions.push({
            command: cmd,
            cwdHint: cmd.includes("spring") ? "api" : "web",
            label: `Detectado em ${path.basename(file)}: ${cmd}`,
          });
        }
      }
    } catch {}
  }
  return suggestions;
}

/**
 * Extrai configurações de URL, porta, comandos e serviços declarados nas instruções e memórias do projeto
 * @param {string} slug
 * @returns {{ url: string, apiUrl: string|null, command: string, cwd: string|null, services: Array<{ id: string, name: string, command: string, cwd: string, url: string }> }}
 */
function extractAppConfigFromDocs(slug) {
  const projectDir = path.join(PROJECTS, slug);
  const repoDir = getProjectRepoDir(slug);
  const docs = [
    path.join(projectDir, "instructions.md"),
    path.join(projectDir, "memory.md"),
  ];

  let webUrl = null;
  let apiUrl = null;
  let webCmd = null;
  let webCwd = null;
  let apiCmd = null;
  let apiCwd = null;

  const cleanVal = (str) => {
    if (!str) return null;
    return str.replace(/^[\*:`\s]+/, "").replace(/[\*:`\s]+$/, "").trim();
  };

  for (const file of docs) {
    if (!fs.existsSync(file)) continue;
    try {
      const content = fs.readFileSync(file, "utf8");

      // 1. Procura blocos markdown formatados:
      // ### Frontend Web (React / Vite)
      // - **Diretório:** `57multimarcas-web`
      // - **Comando:** `npm run dev`
      // - **URL Local:** `http://localhost:8081`
      const frontSec = content.match(/###\s*(?:Frontend|Front|Web|Aplicação Web)[^#]*?(?=###|$)/i);
      if (frontSec) {
        const sec = frontSec[0];
        const u = sec.match(/(?:URL Local|URL padrão|URL|Link)\s*[:\*]*\s*`?(https?:\/\/[^\s`\)\*]+)/i);
        if (u && !webUrl) webUrl = cleanVal(u[1]);
        const c = sec.match(/(?:Comando|Rodar)\s*[:\*]*\s*`?([^`\r\n]+)`?/i);
        if (c && !webCmd) webCmd = cleanVal(c[1]);
        const d = sec.match(/(?:Diretório|Pasta|Cwd)\s*[:\*]*\s*`?([^`\r\n]+)`?/i);
        if (d && !webCwd) webCwd = cleanVal(d[1]);
      }

      const apiSec = content.match(/###\s*(?:Backend|API|Servidor API|Spring Boot)[^#]*?(?=###|$)/i);
      if (apiSec) {
        const sec = apiSec[0];
        const u = sec.match(/(?:URL Local|URL padrão|URL|Link)\s*[:\*]*\s*`?(https?:\/\/[^\s`\)\*]+)/i);
        if (u && !apiUrl) apiUrl = cleanVal(u[1]);
        const c = sec.match(/(?:Comando|Rodar)\s*[:\*]*\s*`?([^`\r\n]+)`?/i);
        if (c && !apiCmd) apiCmd = cleanVal(c[1]);
        const d = sec.match(/(?:Diretório|Pasta|Cwd)\s*[:\*]*\s*`?([^`\r\n]+)`?/i);
        if (d && !apiCwd) apiCwd = cleanVal(d[1]);
      }

      // 2. Procura linhas no estilo memória:
      // ex: "A aplicação web roda localmente na URL padrão http://localhost:8081 (React/Vite em 57multimarcas-web via 'npm run dev')"
      if (!webUrl) {
        const mWeb = content.match(/(?:aplicação web|frontend|front|web)[^.\r\n]*?(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)[^.\r\n]*?(?:\((?:[^)]*?em\s+([a-zA-Z0-9_\-\.\/]+))?(?:[^)]*?via\s+['"`]([^'"`]+)['"`])?)?/i);
        if (mWeb) {
          webUrl = cleanVal(mWeb[1]);
          if (!webCwd && mWeb[2]) webCwd = cleanVal(mWeb[2]);
          if (!webCmd && mWeb[3]) webCmd = cleanVal(mWeb[3]);
        }
      }

      if (!apiUrl) {
        const mApi = content.match(/(?:backend|api)[^.\r\n]*?(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)[^.\r\n]*?(?:\((?:[^)]*?em\s+([a-zA-Z0-9_\-\.\/]+))?(?:[^)]*?via\s+['"`]([^'"`]+)['"`])?)?/i);
        if (mApi) {
          apiUrl = mApi[1].replace(/\/+$/, "");
          if (!apiCwd && mApi[2]) apiCwd = mApi[2].trim();
          if (!apiCmd && mApi[3]) apiCmd = mApi[3].trim();
        }
      }

      // 3. Fallback genérico para URLs na porta localhost:XXXX
      if (!webUrl) {
        const allUrls = [...content.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/gi)];
        for (const m of allUrls) {
          const u = m[0].replace(/\/+$/, "");
          const port = m[1];
          if (port === "8080") {
            if (!apiUrl) apiUrl = u;
          } else {
            if (!webUrl) webUrl = u;
          }
        }
      }
    } catch {}
  }

  const resolvePath = (sub) => {
    if (!sub) return repoDir || projectDir;
    if (repoDir && fs.existsSync(path.resolve(repoDir, sub))) return path.resolve(repoDir, sub);
    if (fs.existsSync(path.resolve(projectDir, sub))) return path.resolve(projectDir, sub);
    return repoDir ? path.resolve(repoDir, sub) : path.resolve(projectDir, sub);
  };

  const services = [];
  if (webCmd || webUrl) {
    services.push({
      id: "web",
      name: webCwd ? `Frontend (${webCwd})` : "Frontend Web",
      command: webCmd || "npm run dev",
      cwd: resolvePath(webCwd),
      url: webUrl || "http://localhost:4200",
    });
  }
  if (apiCmd || apiUrl) {
    services.push({
      id: "api",
      name: apiCwd ? `API (${apiCwd})` : "API Backend",
      command: apiCmd || "mvn spring-boot:run",
      cwd: resolvePath(apiCwd),
      url: apiUrl || "http://localhost:8080",
    });
  }

  return {
    url: webUrl || "http://localhost:4200",
    apiUrl: apiUrl || null,
    command: webCmd || (services[0]?.command) || "npm start",
    cwd: webCwd || null,
    services,
  };
}

module.exports = { getProjectRepoDir, extractCommandsFromDocs, extractAppConfigFromDocs };
