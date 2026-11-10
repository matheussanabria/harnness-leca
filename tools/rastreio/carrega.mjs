// rastreio/carrega: builds the context every gate receives (config + test/request indexes + cross-feature lookups).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from './vendor/js-yaml.mjs';
import { indexaJunit } from './adapters/junit.mjs';
import { indexaKarma } from './adapters/karma.mjs';
import { indexaPostman } from './adapters/postman.mjs';
import { lerTexto } from './util.mjs';

export const carregaYaml = (arquivo) => yaml.load(lerTexto(arquivo));

export function criaContexto(cfg) {
  const features = cfg.docs.features;
  const arqRastreio = (slug) => join(features, slug, cfg.arquivos.rastreio);

  // ids of entries of another feature (to check 'slug/id' references in cobertos_por)
  const idsCache = new Map();
  function idsDe(slug) {
    if (idsCache.has(slug)) return idsCache.get(slug);
    const arq = arqRastreio(slug);
    let ids = null;
    if (existsSync(arq)) {
      try {
        const d = carregaYaml(arq);
        ids = new Set([...Object.keys(d.cenarios || {}), ...Object.keys(d.requisitos || {}), ...Object.keys(d.derivados || {})]);
      } catch { ids = null; }
    }
    idsCache.set(slug, ids);
    return ids;
  }

  // rules defined in each feature (G7: the same id cannot live in two features)
  const rnPorSlug = new Map();
  for (const n of readdirSync(features)) {
    const arq = arqRastreio(n);
    if (!existsSync(arq)) continue;
    try { rnPorSlug.set(n, new Set(Object.keys(carregaYaml(arq).regras || {}))); } catch { /* invalid YAML: reported at verification */ }
  }

  return {
    cfg,
    junit: indexaJunit(cfg),
    specs: indexaKarma(cfg),
    requests: indexaPostman(cfg),
    idsDe,
    rnPorSlug,
    arqRastreio,
  };
}
