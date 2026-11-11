// rastreio/adapters/postman: set of request names found in *.postman_collection.json files.
// `ids.postmanPrefixo` (regex source) strips a story key from the request name, e.g. "DIS-12 | Create foo" -> "Create foo".
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BOM, lerTexto } from '../util.mjs';

export function indexaPostman(cfg) {
  const requests = new Set();
  if (!cfg.docs.postman) return requests;
  const prefixo = cfg.ids.postmanPrefixo ? new RegExp(cfg.ids.postmanPrefixo) : null;
  const nome = (n) => (prefixo ? n.replace(prefixo, '') : n).trim();
  (function varre(dir) {
    for (const n of existsSync(dir) ? readdirSync(dir) : []) {
      const f = join(dir, n);
      if (statSync(f).isDirectory()) { varre(f); continue; }
      if (!n.endsWith('.postman_collection.json')) continue;
      try {
        (function w(it) { for (const i of it || []) { if (i.item) w(i.item); else requests.add(nome(i.name)); } })(JSON.parse(lerTexto(f).replace(BOM, '')).item);
      } catch { /* unreadable collection: ignored */ }
    }
  })(cfg.docs.postman);
  return requests;
}
