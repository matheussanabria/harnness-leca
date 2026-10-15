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
  const out = path.join(chatsDir, name);
  const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  const state = before === null ? "nova" : before === text ? "sem mudança" : "atualizada";
  const removed = [];
  if (dryRun || state === "sem mudança") return { state, removed };

  fs.mkdirSync(chatsDir, { recursive: true });
  for (const old of fs.readdirSync(chatsDir)) {
    if (old === name || !old.endsWith(`-${shortId}.md`)) continue;
    if (readMeta(fs.readFileSync(path.join(chatsDir, old), "utf8"))("sessao") !== sessionId) continue;
    fs.rmSync(path.join(chatsDir, old));
    removed.push(old);
  }
  fs.writeFileSync(out, text);
  if (mtime) fs.utimesSync(out, new Date(mtime), new Date(mtime));
  return { state, removed };
}

module.exports = { writeChat };
