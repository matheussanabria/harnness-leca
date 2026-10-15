// @ts-check
// Caminho absoluto de um executável (claude, opencode...), para rodar com shell:false.
// Com shell:true (ou com o nome solto), o Windows procura o programa primeiro na pasta atual: um claude.cmd deixado em
// projects/<slug>/ rodaria no lugar do verdadeiro. Aqui só valem a variável de ambiente e as pastas ABSOLUTAS do PATH.
//
// Ordem: variável (global/.env ou ambiente) > <nome>.exe no PATH > o .exe do pacote npm que o <nome>.cmd chama
// (o .cmd do npm só repassa para node_modules/<pacote>/<caminho>).
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./env");

const WIN = process.platform === "win32";

/** @param {string} p */
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// Pastas do PATH, só absolutas: uma entrada relativa (ou vazia) equivaleria a procurar na pasta atual.
const pathDirs = () => String(process.env.PATH || "").split(path.delimiter).map((d) => d.replace(/^"|"$/g, "")).filter((d) => d && path.isAbsolute(d));

/**
 * @param {{ name: string, envVar: string, npmExe: string[] }} spec
 *   name: nome do programa (sem extensão); envVar: variável com o caminho absoluto; npmExe: caminho do .exe dentro de node_modules
 * @returns {{ resolve: () => string | null, reset: () => void }}
 */
function makeResolver({ name, envVar, npmExe }) {
  /** @type {string | null | undefined} */
  let cached;
  return {
    resolve() {
      if (cached !== undefined) return cached;
      loadEnv(); // a variável pode estar em global/.env
      const fromEnv = process.env[envVar];
      if (fromEnv && path.isAbsolute(fromEnv) && isFile(fromEnv)) return (cached = fromEnv);

      const dirs = pathDirs();
      const exe = WIN ? `${name}.exe` : name;
      for (const d of dirs) if (isFile(path.join(d, exe))) return (cached = path.join(d, exe));
      if (WIN) for (const d of dirs) {
        const inPackage = path.join(d, "node_modules", ...npmExe);
        if (isFile(path.join(d, `${name}.cmd`)) && isFile(inPackage)) return (cached = inPackage);
      }
      return (cached = null);
    },
    // Para testes e para quando o programa é instalado com o servidor já aberto.
    reset() { cached = undefined; },
  };
}

module.exports = { makeResolver };
