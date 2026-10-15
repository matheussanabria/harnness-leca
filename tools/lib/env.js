// @ts-check
// Variáveis de ambiente locais (global/.env ou .env), carregadas sob demanda por quem precisa delas.
// Não roda ao carregar o módulo e não sobrescreve o que já veio do ambiente do sistema: o valor do sistema
// vence o do arquivo. Mudanças no arquivo valem na próxima chamada (só para as chaves que o arquivo trouxe).
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./root");

const fromFile = new Set(); // chaves que fomos nós a definir (podem ser atualizadas se o arquivo mudar)

function loadEnv() {
  const files = [path.join(ROOT, "global", ".env"), path.join(ROOT, "global", ".ENV"), path.join(ROOT, ".env")];
  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; } // arquivo opcional: sem ele, nada a carregar
    for (const line of content.replace(/^﻿/, "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && (!(key in process.env) || fromFile.has(key))) {
        process.env[key] = value;
        fromFile.add(key);
      }
    }
  }
}

module.exports = { loadEnv };
