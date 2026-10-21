// @ts-check
// Porta de descoberta das conversas materializadas em Markdown (EP-09.01).
// Somente leitura: nenhuma escrita, renomeação ou reordenação nas fontes.

const fs = require("fs");
const path = require("path");
const { readMeta, hashBody } = require("../../../../../tools/lib/chat-format");

/**
 * @param {string} projectDir
 * @returns {string}
 */
function chatsDir(projectDir) {
  return path.join(projectDir, "chats");
}

/**
 * Lê as conversas de um projeto e devolve as sessões nativas que elas representam.
 * @param {string} projectDir - pasta do projeto
 * @param {string} [provider="markdown"]
 * @returns {{ providerSessions: object[], artifacts: object[], warnings: string[] }}
 */
function discoverMarkdownSessions(projectDir, provider = "markdown") {
  const providerSessions = [];
  const artifacts = [];
  const warnings = [];
  const dir = chatsDir(projectDir);
  if (!fs.existsSync(dir)) return { providerSessions, artifacts, warnings };

  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith(".md") && !name.startsWith(".")).sort();
  } catch {
    return { providerSessions, artifacts, warnings: ["Pasta de conversas ilegível."] };
  }

  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        warnings.push(`${name}: ignorado (não é arquivo comum).`);
        continue;
      }
      const raw = fs.readFileSync(file, "utf8");
      const meta = readMeta(raw);
      const nativeSessionId = String(meta("sessao") || "").trim() || path.parse(name).name;
      const providerSession = {
        provider,
        nativeSessionId,
        sourceKind: "markdown",
        sourceLocator: `chats/${name}`,
        resumeMode: "context_replay",
        capabilities: [],
      };
      providerSessions.push(providerSession);
      artifacts.push({
        path: `chats/${name}`,
        hash: hashBody(raw),
        declaredSession: String(meta("sessao") || "").trim(),
        declaredAgent: String(meta("agente") || meta("motor") || "").trim(),
        title: String(meta("titulo") || "").trim(),
        lastSyncedAt: new Date(stat.mtimeMs).toISOString(),
      });
    } catch {
      warnings.push(`${name}: leitura falhou.`);
    }
  }

  return { providerSessions, artifacts, warnings };
}

module.exports = { chatsDir, discoverMarkdownSessions };
