// gates/hash: content hashing for the packed harness-gates copy (lock file). Line endings are normalized to LF
// before hashing, because Git on Windows may rewrite them (autocrlf) and the lock must hold on every machine.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const LOCK = 'harness-gates.lock';

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// Text files get CRLF -> LF; anything else is hashed as is.
const TEXTO = /\.(mjs|js|json|md|yml|yaml|txt|license)$|^VERSION$|LICENSE$/i;
export function hashArquivo(arquivo) {
  const buf = readFileSync(arquivo);
  if (!TEXTO.test(arquivo.split(/[\\/]/).pop())) return sha256(buf);
  return sha256(Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'));
}

// Every file under `dir` except the lock itself, as { "relative/posix/path": sha256 }, sorted by path.
export function hashDir(dir) {
  const out = {};
  const anda = (d) => {
    for (const nome of readdirSync(d).sort()) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) { anda(p); continue; }
      const rel = relative(dir, p).split(sep).join('/');
      if (rel === LOCK) continue;
      out[rel] = hashArquivo(p);
    }
  };
  anda(dir);
  return out;
}

// One short id for a whole file set: same files and content give the same version on any machine.
export function versaoDe(arquivos) {
  const linhas = Object.keys(arquivos).sort().map((k) => `${k}\t${arquivos[k]}`).join('\n');
  return `gates-${sha256(Buffer.from(linhas, 'utf8')).slice(0, 12)}`;
}
