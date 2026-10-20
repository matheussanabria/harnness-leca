// @ts-check
// Grava um chat em projects/<slug>/chats/ e arruma o que ficou para trás. Usado pelos 4 importadores.
const fs = require("fs");
const path = require("path");
const { readMeta } = require("./chat-format");

// Compara com o arquivo atual e grava só o que mudou. O nome do arquivo leva o título, que pode mudar quando a
// conversa cresce: nesse caso o arquivo novo é "nova" e o antigo da MESMA sessão (confirmada pelo cabeçalho, não só
// pelo sufixo do nome) é removido.
//
//   { chatsDir, name, sessionId, shortId, text, mtime?, dryRun? }
//   mtime: data da última mensagem (ISO ou ms); a interface ordena e data os chats pelo mtime do arquivo.
//   retorna { state: "nova" | "atualizada" | "sem mudança", removed: [nomes removidos] }
/** @param {import("./types").WriteChatOptions} opts @returns {{ state: import("./types").WriteState, removed: string[] }} */
function writeChat({ chatsDir, name, sessionId, shortId, text, mtime, dryRun = false }) {
  const incomingAgent = readMeta(text)("agente");
  const suffix = `-${shortId}.md`;
  const candidates = fs.existsSync(chatsDir)
    ? fs.readdirSync(chatsDir).filter((file) => file.endsWith(suffix))
    : [];
  const metadata = new Map(candidates.map((file) => {
    const get = readMeta(fs.readFileSync(path.join(chatsDir, file), "utf8"));
    return [file, { sessionId: get("sessao"), agent: get("agente") }];
  }));
  const sameIdentity = (file) => {
    const meta = metadata.get(file);
    return meta?.sessionId === sessionId && (!incomingAgent || !meta.agent || meta.agent === incomingAgent);
  };

  let outputName = name;
  if (metadata.has(outputName) && !sameIdentity(outputName)) {
    const safeAgent = String(incomingAgent || "source").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "source";
    const stem = name.endsWith(suffix) ? name.slice(0, -suffix.length) : name.replace(/\.md$/i, "");
    outputName = `${stem}-${safeAgent}${suffix}`;
    let sequence = 2;
    while (metadata.has(outputName) && !sameIdentity(outputName)) {
      outputName = `${stem}-${safeAgent}-${sequence++}${suffix}`;
    }
  }

  const out = path.join(chatsDir, outputName);
  const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  const state = before === null ? "nova" : before === text ? "sem mudança" : "atualizada";
  const removed = [];
  if (dryRun || state === "sem mudança") return { state, removed };

  fs.mkdirSync(chatsDir, { recursive: true });
  for (const old of candidates) {
    if (old === outputName || !sameIdentity(old)) continue;
    fs.rmSync(path.join(chatsDir, old));
    removed.push(old);
  }
  fs.writeFileSync(out, text);
  if (mtime) fs.utimesSync(out, new Date(mtime), new Date(mtime));
  return { state, removed };
}

module.exports = { writeChat };
