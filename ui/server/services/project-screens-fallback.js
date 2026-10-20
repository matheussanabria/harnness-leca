// @ts-check
// Telas de fallback e consolidação por projeto.
const fs = require("fs");
const path = require("path");
const { parseScreensFromCanvasHtml } = require("./project-screens-canvas");
const { scanLogicDocsScreens } = require("./project-screens-logic");
const { scanSistemaFeaturesScreens } = require("./project-screens-sistema");

/**
 * Cria telas sintéticas a partir de regras.md e memory.md do projeto.
 * @param {string} slug
 * @param {string} projectDir
 * @returns {any[]}
 */
function buildFallbackProjectScreens(slug, projectDir) {
  const rules = [];
  const regrasFile = path.join(projectDir, "regras.md");
  const memoryFile = path.join(projectDir, "memory.md");

  const readLines = (file) => {
    if (!fs.existsSync(file)) return [];
    try {
      const raw = fs.readFileSync(file, "utf8");
      return raw.split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- ") || l.startsWith("* "))
        .map((l) => l.replace(/^[-*]\s+(\[[^\]]+\]\s*)?/, "").trim());
    } catch {
      return [];
    }
  };

  const lines = [...readLines(regrasFile), ...readLines(memoryFile)];
  const screenRules = lines.slice(0, 12).map((l, idx) => ({
    title: l.length > 60 ? l.slice(0, 57) + "..." : l,
    st: "ok",
    t: l,
    refs: ["f01"],
    src: fs.existsSync(regrasFile) ? "regras.md" : "memory.md",
  }));

  return [
    {
      id: "s1",
      short: `1 · Visão Geral · ${slug}`,
      title: `Visão Geral e Arquitetura · ${slug}`,
      route: `${slug}/principal`,
      comp: `${slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Module`,
      resumo: `Mapa de funcionalidades e regras do projeto ${slug} mantido pelo Harness Leca.`,
      fields: [
        {
          id: "f01",
          n: "01",
          label: "Painel Principal",
          ui: { st: "ok", t: "Estrutura central do módulo da aplicação.", c: "AppContainer" },
          rule: screenRules[0]?.title || "Regras de negócio do projeto",
          api: `/api/${slug}`,
          data: "Banco de Dados Local",
        },
        {
          id: "f02",
          n: "02",
          label: "Serviço de Processamento",
          ui: { st: "ok", t: "Lógica de execução e orquestração do módulo.", c: "CoreProcessor" },
          rule: screenRules[1]?.title || "Regras de processamento",
          api: `/api/${slug}/process`,
          data: "Armazenamento",
        },
      ],
      rules: screenRules.length > 0 ? screenRules : [
        {
          title: `Regra de integridade do ${slug}`,
          st: "ok",
          t: "Execução contínua dentro dos parâmetros estabelecidos.",
          refs: ["f01"],
          src: "projects/.active",
        },
      ],
      endpoints: [
        {
          m: "GET",
          r: `/api/${slug}/status`,
          st: "ok",
          p: "Nenhum",
          resp: "JSON de status do projeto",
          svc: "AppController",
          refs: ["f01"],
        },
      ],
      entities: [
        {
          name: `${slug.replace(/-/g, "_")}_config`,
          kind: "dto",
          st: "ok",
          src: "config/schema",
          cols: [["chave", "String", "Identificador"], ["valor", "String", "Conteúdo"]],
          refs: ["f01"],
        },
      ],
      flow: [
        { k: "start", t: "Inicialização do projeto" },
        { k: "act", t: "Execução das tarefas ativas" },
        { k: "end", t: "Persistência e resposta" },
      ],
      states: [["Operacional", "Todos os serviços sincronizados"]],
      diffs: [],
      legacy: [],
    },
  ];
}

/**
 * Retorna o mapa de telas completo para o projeto.
 * @param {string} slug
 * @param {string} repoRoot
 * @param {string} projectDir
 */
function getProjectScreens(slug, repoRoot, projectDir) {
  // 1. Tenta carregar do Mapa em camadas DIS.html se for dispensacao ou se existir
  const canvasHtmlCandidates = [
    path.resolve(repoRoot, "doc", "sistema", "features", "Mapa em camadas DIS.html"),
    path.resolve(repoRoot, "doc", "sistema", "features", "mapa-camadas.html"),
    path.resolve(projectDir, "design", "mapa-camadas.html"),
  ];

  for (const candidate of canvasHtmlCandidates) {
    if (fs.existsSync(candidate)) {
      const parsedScreens = parseScreensFromCanvasHtml(candidate);
      if (parsedScreens && parsedScreens.length > 0) {
        return {
          ok: true,
          slug,
          hasNativeCanvas: true,
          nativeCanvasUrl: `/api/project/${encodeURIComponent(slug)}/design/prototype/dis-mapa-camadas/`,
          canvasFile: path.relative(repoRoot, candidate).replace(/\\/g, "/"),
          screens: parsedScreens,
        };
      }
    }
  }

  // 2. Se for projeto com docs/logic/ (ex: saude-prontuario)
  const logicScreens = scanLogicDocsScreens(repoRoot);
  if (logicScreens.length > 0) {
    return {
      ok: true,
      slug,
      hasNativeCanvas: false,
      screens: logicScreens,
    };
  }

  // 3. Se for projeto com doc/sistema/features/
  const featScreens = scanSistemaFeaturesScreens(repoRoot);
  if (featScreens.length > 0) {
    return {
      ok: true,
      slug,
      hasNativeCanvas: false,
      screens: featScreens,
    };
  }

  // 4. Fallback sintético a partir de regras.md e memory.md
  const fallbackScreens = buildFallbackProjectScreens(slug, projectDir);
  return {
    ok: true,
    slug,
    hasNativeCanvas: false,
    screens: fallbackScreens,
  };
}

module.exports = { buildFallbackProjectScreens, getProjectScreens };
