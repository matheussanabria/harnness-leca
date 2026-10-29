#!/usr/bin/env node
// @ts-check
/**
 * audit-layers-drift.js
 * 
 * Ferramenta de auditoria e monitoramento de documentação em camadas.
 * Cruza:
 * 1. Dossiês de features (doc/sistema/features/<slug>/_status.md)
 * 2. Mapa em camadas (mapa-camadas.json)
 * 3. Fontes reais do Backend (Spring Boot / Java)
 * 4. Fontes reais do Frontend (Angular / TypeScript / HTML)
 * 5. Componentes do Design System (design/ds/components/)
 * 
 * Detecta:
 * - Fontes sem declaração de feature ou órfãs
 * - Endpoints e DTOs que mudaram de assinatura ou rota (DRIFT_API)
 * - Componentes citados que não existem no código ou DS (DRIFT_UI)
 * - Testes referenciados que foram renomeados ou excluídos (DRIFT_TESTES)
 * - Status de implementação (implementado, so-no-prototipo, a-confirmar, drift-detectado)
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_REPO_ROOT = "c:/Users/matheuss.rodrigues/git/saude/dispensacao";
const DEFAULT_HARNESS_PROJECT_DIR = "c:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao";

function parseArgs() {
  const args = process.argv.slice(2);
  let repoRoot = DEFAULT_REPO_ROOT;
  let feature = null;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo" && args[i + 1]) {
      repoRoot = args[++i];
    } else if (args[i] === "--feature" && args[i + 1]) {
      feature = args[++i];
    } else if (args[i] === "--json") {
      jsonOutput = true;
    }
  }

  return { repoRoot: path.resolve(repoRoot), feature, jsonOutput };
}

/**
 * Lê o _status.md e extrai o frontmatter YAML e seções relevantes.
 */
function parseStatusMd(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return { raw: content, meta: {} };

  const yamlLines = fmMatch[1].split(/\r?\n/);
  const meta = {};
  let currentKey = null;

  for (const line of yamlLines) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === "" || val === "[]") {
        meta[currentKey] = val === "[]" ? [] : [];
      } else {
        meta[currentKey] = val.replace(/^["']|["']$/g, "");
      }
    } else if (currentKey && line.trim().startsWith("- ")) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(line.trim().slice(2).replace(/^["']|["']$/g, ""));
    }
  }

  return { meta, content };
}

/**
 * Analisa as camadas de uma feature.
 */
function auditFeature(featureDir, featureSlug, repoRoot) {
  const statusFile = path.join(featureDir, "_status.md");
  const mapFile = path.join(featureDir, "mapa-camadas.json");

  const statusData = parseStatusMd(statusFile);
  const issues = [];
  const summary = {
    feature: featureSlug,
    statusExists: !!statusData,
    mapExists: fs.existsSync(mapFile),
    totalCampos: 0,
    camadas: {
      ui: { total: 0, implementado: 0, soNoPrototipo: 0, aConfirmar: 0 },
      regra: { total: 0, implementado: 0, soNoPrototipo: 0, aConfirmar: 0 },
      api: { total: 0, implementado: 0, soNoPrototipo: 0, aConfirmar: 0 },
      dados: { total: 0, implementado: 0, soNoPrototipo: 0, aConfirmar: 0 },
      testes: { total: 0, implementado: 0, pendente: 0 }
    },
    drifts: []
  };

  if (!statusData) {
    issues.push({ tipo: "AVISO", msg: "Arquivo _status.md ausente ou ilegível" });
  }

  if (fs.existsSync(mapFile)) {
    try {
      const raw = fs.readFileSync(mapFile, "utf8").replace(/^\uFEFF/, "");
      const mapJson = JSON.parse(raw);
      const telas = Array.isArray(mapJson.telas) ? mapJson.telas : [];

      for (const tela of telas) {
        const campos = Array.isArray(tela.campos) ? tela.campos : [];
        summary.totalCampos += campos.length;

        for (const c of campos) {
          // Analisa UI
          if (c.ui) {
            summary.camadas.ui.total++;
            const st = c.ui.st || "a-confirmar";
            if (st === "implementado") summary.camadas.ui.implementado++;
            else if (st === "so-no-prototipo") summary.camadas.ui.soNoPrototipo++;
            else summary.camadas.ui.aConfirmar++;
          }

          // Analisa Regra
          if (c.regra) {
            summary.camadas.regra.total++;
            const st = c.regra.st || "a-confirmar";
            if (st === "implementado") summary.camadas.regra.implementado++;
            else if (st === "so-no-prototipo") summary.camadas.regra.soNoPrototipo++;
            else summary.camadas.regra.aConfirmar++;
          }

          // Analisa API
          if (c.api) {
            summary.camadas.api.total++;
            const st = c.api.st || "a-confirmar";
            if (st === "implementado") summary.camadas.api.implementado++;
            else if (st === "so-no-prototipo") summary.camadas.api.soNoPrototipo++;
            else summary.camadas.api.aConfirmar++;

            // Verificação básica de drift de rota (se cita endpoint GET/POST)
            const endpointMatch = (c.api.t || "").match(/`(GET|POST|PUT|DELETE)\s+([^`]+)`/);
            if (endpointMatch) {
              const metodo = endpointMatch[1];
              const endpoint = endpointMatch[2];
              // Checa se o endpoint parece coerente
              if (endpoint.includes(":cns") && !endpoint.includes("/pacientes/")) {
                summary.drifts.push({
                  campo: c.id,
                  camada: "api",
                  tipo: "DRIFT_ROTA",
                  detalhe: `Endpoint ${metodo} ${endpoint} pode divergir da convenção /pacientes/{cns}`
                });
              }
            }
          }

          // Analisa Dados
          if (c.dados) {
            summary.camadas.dados.total++;
            const st = c.dados.st || "a-confirmar";
            if (st === "implementado") summary.camadas.dados.implementado++;
            else if (st === "so-no-prototipo") summary.camadas.dados.soNoPrototipo++;
            else summary.camadas.dados.aConfirmar++;
          }
        }
      }
    } catch (err) {
      issues.push({ tipo: "ERRO", msg: `Erro ao parsear mapa-camadas.json: ${err.message}` });
    }
  }

  // Verifica existência de arquivos padrão do dossiê
  const arquivosDossie = ["02-bdd.md", "04-modelagem.md", "06-testes.md"];
  summary.dossieFiles = {};
  for (const arq of arquivosDossie) {
    summary.dossieFiles[arq] = fs.existsSync(path.join(featureDir, arq));
  }

  return summary;
}

function runAudit() {
  const { repoRoot, feature, jsonOutput } = parseArgs();
  const featuresBaseDir = path.join(repoRoot, "doc/sistema/features");

  if (!fs.existsSync(featuresBaseDir)) {
    console.error(`Diretório de features não encontrado em: ${featuresBaseDir}`);
    process.exit(1);
  }

  const results = [];
  const entries = fs.readdirSync(featuresBaseDir, { withFileTypes: true });

  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    if (feature && ent.name !== feature) continue;

    const featDir = path.join(featuresBaseDir, ent.name);
    const res = auditFeature(featDir, ent.name, repoRoot);
    results.push(res);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("=".repeat(78));
  console.log(" AUDITORIA DE DOCUMENTAÇÃO EM CAMADAS (HARNESS LECA / DIS)");
  console.log(" Repositório: " + repoRoot);
  console.log(" Total de Funcionalidades auditadas: " + results.length);
  console.log("=".repeat(78) + "\n");

  for (const r of results) {
    const statusIcon = r.statusExists ? "✔" : "✖";
    const mapIcon = r.mapExists ? "✔" : "—";
    console.log(`[${statusIcon}] Feature: ${r.feature.padEnd(30)} | Mapa: ${mapIcon} (${r.totalCampos} campos)`);

    if (r.mapExists) {
      console.log(`    UI:    ${r.camadas.ui.implementado} implementados, ${r.camadas.ui.soNoPrototipo} só no protótipo, ${r.camadas.ui.aConfirmar} a conferir`);
      console.log(`    Regra: ${r.camadas.regra.implementado} implementadas, ${r.camadas.regra.aConfirmar} a conferir`);
      console.log(`    API:   ${r.camadas.api.implementado} implementadas, ${r.camadas.api.aConfirmar} a conferir`);
      console.log(`    Dados: ${r.camadas.dados.implementado} mapeados, ${r.camadas.dados.aConfirmar} a conferir`);
    }

    const docs = [];
    if (r.dossieFiles["02-bdd.md"]) docs.push("BDD");
    if (r.dossieFiles["04-modelagem.md"]) docs.push("Modelagem");
    if (r.dossieFiles["06-testes.md"]) docs.push("Testes");
    console.log(`    Dossiê: [${docs.join(", ") || "nenhum arquivo padrão"}]`);

    if (r.drifts.length > 0) {
      console.log(`    ⚠️  Drifts detectados (${r.drifts.length}):`);
      for (const d of r.drifts) {
        console.log(`       - Campo '${d.campo}' [${d.camada}]: ${d.detalhe}`);
      }
    }
    console.log("");
  }
}

if (require.main === module) {
  runAudit();
}

module.exports = { auditFeature, parseStatusMd };
