// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send, readJsonBody } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { previewEdit, applyEdit, undoEdit } = require("../services/component-editor.service");

/**
 * POST /api/project/:slug/inspect/edit/preview
 * @param {any} ctx
 */
async function apiProjectInspectEditPreview({ req, res, params: [slug] }) {
  const { repo, cwd } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 400, { error: `Projeto '${slug}' não possui repositório configurado.` });
  }

  const body = await readJsonBody(req);
  if (!body || !body.file || !body.target || !body.change) {
    return send(res, 400, { error: "Campos obrigatórios: file, target, change" });
  }

  try {
    const result = previewEdit(repo, {
      file: body.file,
      componentName: body.componentName,
      target: body.target,
      change: body.change,
      appCwd: cwd,
    });

    if (!result.ok) {
      return send(res, 422, result);
    }
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/inspect/edit/apply
 * @param {any} ctx
 */
async function apiProjectInspectEditApply({ req, res, params: [slug] }) {
  const { repo, cwd } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 400, { error: `Projeto '${slug}' não possui repositório configurado.` });
  }

  const projectDir = path.join(getProjects(), slug);
  const body = await readJsonBody(req);
  if (!body || !body.file || !body.target || !body.change) {
    return send(res, 400, { error: "Campos obrigatórios: file, target, change" });
  }

  try {
    const result = applyEdit(repo, projectDir, {
      file: body.file,
      componentName: body.componentName,
      target: body.target,
      change: body.change,
      fingerprint: body.fingerprint,
      appCwd: cwd,
    });

    if (!result.ok) {
      return send(res, 422, result);
    }
    return send(res, 200, result);
  } catch (err) {
    // @ts-ignore
    const status = err.code === "CONFLICT_409" ? 409 : 400;
    return send(res, status, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/inspect/edit/undo
 * @param {any} ctx
 */
async function apiProjectInspectEditUndo({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  const body = await readJsonBody(req);
  if (!body || !body.undoToken) {
    return send(res, 400, { error: "Parâmetro 'undoToken' é obrigatório." });
  }

  try {
    const result = undoEdit(projectDir, body.undoToken);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * GET /api/project/:slug/inspect/ds-classes
 * Extrai classes do design system Procempa encontradas em ds.css ou styles.css
 * @param {any} ctx
 */
async function apiProjectInspectDsClasses({ req, res, params: [slug] }) {
  const { repo } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 200, { classes: [] });
  }

  const classes = new Set();
  const candidates = [
    path.join(repo, "dispensacao-novo", "dispensacao-web", "src", "ds.css"),
    path.join(repo, "src", "ds.css"),
    path.join(repo, "src", "styles", "ds.css"),
  ];

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const css = fs.readFileSync(f, "utf8");
        // Identificadores de classe CSS válidos iniciam com letra ou underscore (opcionalmente precedido por hífen), nunca dígitos
        const matches = css.matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g);
        for (const m of matches) {
          const cls = m[1];
          if (!cls.startsWith("ng-") && cls.length > 2) {
            classes.add(cls);
          }
        }
      } catch {}
    }
  }

  return send(res, 200, { classes: Array.from(classes).sort() });
}

module.exports = {
  apiProjectInspectEditPreview,
  apiProjectInspectEditApply,
  apiProjectInspectEditUndo,
  apiProjectInspectDsClasses,
};
