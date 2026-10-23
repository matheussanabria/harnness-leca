// @ts-check
"use strict";
/**
 * Configuração do Design System de cada projeto: `projects/<slug>/design/ds/ds-config.json`.
 *   { "schema": 1, "namespace": "dis", "vitrine": "dis-ds-vitrine" }
 * Sem o arquivo, valem os padrões (namespace "ds", sem vitrine). Assim as ferramentas servem a qualquer projeto.
 */
const fs = require("fs");
const path = require("path");

const CONFIG_REL = path.join("design", "ds", "ds-config.json");
const NAMESPACE_RE = /^[a-z][a-z0-9-]*$/;

/**
 * @param {string} projectDir  pasta do projeto (projects/<slug>)
 * @param {{ fs: typeof fs, path: typeof path }} [deps]
 * @returns {{ namespace: string, vitrine: string, configured: boolean }}
 */
function loadDsConfig(projectDir, deps = { fs, path }) {
  const file = deps.path.join(projectDir, CONFIG_REL);
  if (!deps.fs.existsSync(file)) return { namespace: "ds", vitrine: "", configured: false };
  const raw = JSON.parse(deps.fs.readFileSync(file, "utf8"));
  const namespace = String(raw.namespace || "ds");
  if (!NAMESPACE_RE.test(namespace)) throw new Error(`ds-config.json: namespace inválido "${namespace}" (use letras minúsculas, números e hífen).`);
  return { namespace, vitrine: String(raw.vitrine || ""), configured: true };
}

module.exports = { loadDsConfig, CONFIG_REL };
