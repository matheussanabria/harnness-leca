// @ts-check
// Varredura de telas nos docs de lógica.
const fs = require("fs");
const path = require("path");

/**
 * Extrai telas e camadas a partir de pastas docs/logic/ (comum no saude-prontuario).
 * @param {string} repoRoot
 * @returns {any[]}
 */
function scanLogicDocsScreens(repoRoot) {
  const logicDir = path.resolve(repoRoot, "docs", "logic");
  if (!fs.existsSync(logicDir)) return [];

  const screens = [];
  try {
    const entries = fs.readdirSync(logicDir, { withFileTypes: true });
    let idx = 1;

    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      const slug = ent.name; // ex: pron-169, pron-170
      const featureDir = path.join(logicDir, slug);

      let title = slug.toUpperCase();
      let resumo = `Funcionalidade ${slug.toUpperCase()} documentada na pasta de lógica.`;
      const fields = [];
      const rules = [];
      const endpoints = [];
      const entities = [];
      const diffs = [];
      const legacy = [];

      // 1. Título e resumo de story.md ou user-story
      const storyFile = path.join(featureDir, "story.md");
      const storyFile2 = path.join(featureDir, "story", "01-user-story.md");
      const targetStory = fs.existsSync(storyFile) ? storyFile : (fs.existsSync(storyFile2) ? storyFile2 : null);

      if (targetStory) {
        try {
          const raw = fs.readFileSync(targetStory, "utf8");
          const firstH1 = raw.match(/^#\s+(.+)$/m);
          if (firstH1) title = `${slug.toUpperCase()} · ${firstH1[1].trim()}`;
          const lead = raw.match(/(?:Como|Sendo|Para|Objetivo)[\s\S]{10,200}?\n\n/i);
          if (lead) resumo = lead[0].replace(/\r?\n/g, " ").trim();
        } catch {}
      }

      // 2. Critérios de aceite como regras de negócio
      const critFile = path.join(featureDir, "story", "04-criteria-acceptance.md");
      if (fs.existsSync(critFile)) {
        try {
          const raw = fs.readFileSync(critFile, "utf8");
          const critMatches = raw.match(/^(?:###|\*\*|-)\s*(?:Cenário|Critério|Regra)?\s*[:\d.]*\s*(.+)$/gim);
          if (critMatches) {
            critMatches.slice(0, 10).forEach((c, cIdx) => {
              const ruleTitle = c.replace(/^(?:###|\*\*|-)\s*/, "").replace(/\*\*/g, "").trim();
              if (ruleTitle.length > 5) {
                rules.push({
                  title: ruleTitle,
                  st: "ok",
                  t: `Critério de aceite testável mapeado no dossiê de ${slug}.`,
                  refs: [`f0${cIdx + 1}`],
                  src: `docs/logic/${slug}/story/04-criteria-acceptance.md`,
                });
              }
            });
          }
        } catch {}
      }

      // 3. Controllers Java para endpoints
      const backendDir = path.join(featureDir, "backend");
      if (fs.existsSync(backendDir)) {
        try {
          const findJavaFiles = (dir) => {
            let res = [];
            const files = fs.readdirSync(dir, { withFileTypes: true });
            for (const f of files) {
              const full = path.join(dir, f.name);
              if (f.isDirectory()) res = res.concat(findJavaFiles(full));
              else if (f.name.endsWith(".java") || f.name.endsWith(".md")) res.push({ name: f.name, path: full });
            }
            return res;
          };

          const jFiles = findJavaFiles(backendDir);
          for (const jf of jFiles) {
            if (jf.name.toLowerCase().includes("controller")) {
              endpoints.push({
                m: "GET/POST",
                r: `/api/v1/${slug.replace(/^pron-/, "")}`,
                st: "ok",
                p: "DTO de entrada da funcionalidade",
                resp: "DTO de resposta ou ProblemDetail",
                svc: jf.name.replace(/\.md$/, ""),
                refs: ["f01"],
              });
            } else if (jf.name.toLowerCase().includes("dto") || jf.name.toLowerCase().includes("jpa") || jf.name.toLowerCase().includes("entity")) {
              entities.push({
                name: jf.name.replace(/\.java(?:\.md)?$/, ""),
                kind: jf.name.toLowerCase().includes("dto") ? "dto" : "tabela",
                st: "ok",
                src: `docs/logic/${slug}/backend`,
                cols: [["id", "Long", "PK"], ["data_registro", "LocalDateTime", "Auditoria"]],
                refs: ["f01"],
              });
            }
          }
        } catch {}
      }

      // Cria ao menos 1 campo base se nenhum foi extraído
      if (fields.length === 0) {
        fields.push({
          id: "f01",
          n: "01",
          label: `Ação Principal - ${slug.toUpperCase()}`,
          ui: { st: "ok", t: "Componente ou fluxo de interação da funcionalidade.", c: `${slug}-section` },
          rule: rules[0]?.title || "Regra de negócio da funcionalidade",
          api: endpoints[0]?.r || `/api/${slug}`,
          data: entities[0]?.name || "Entidade Principal",
        });
      }

      screens.push({
        id: `s${idx}`,
        short: `${idx} · ${slug.toUpperCase()}`,
        title: title,
        route: `prontuario/${slug}`,
        comp: `${slug.toUpperCase()}Component`,
        resumo: resumo,
        fields,
        rules: rules.length > 0 ? rules : [{
          title: `Regra de operação ${slug.toUpperCase()}`,
          st: "ok",
          t: "Operação validada pelo backend em conformidade com as regras de negócio.",
          refs: ["f01"],
          src: `docs/logic/${slug}/story.md`,
        }],
        endpoints: endpoints.length > 0 ? endpoints : [{
          m: "GET",
          r: `/api/${slug}`,
          st: "ok",
          p: "Filtros de consulta",
          resp: "Objeto de domínio",
          svc: `${slug}Service`,
          refs: ["f01"],
        }],
        entities: entities.length > 0 ? entities : [{
          name: `${slug}_registro`,
          kind: "tabela",
          st: "ok",
          src: `backend/core/model`,
          cols: [["id", "Long", "PK"], ["status", "String", "Estado do fluxo"]],
          refs: ["f01"],
        }],
        flow: [
          { k: "start", t: "Usuário acessa a tela" },
          { k: "act", t: "Submete ação ou consulta" },
          { k: "end", t: "Resposta renderizada na interface" },
        ],
        states: [["Carregando", "Spinner de carregamento"], ["Sucesso", "Dados apresentados"], ["Erro", "Mensagem padronizada"]],
        diffs,
        legacy,
      });

      idx++;
    }
  } catch (err) {
    console.error("[project-screens] Erro ao escanear logic docs:", err.message);
  }

  return screens;
}

module.exports = { scanLogicDocsScreens };
