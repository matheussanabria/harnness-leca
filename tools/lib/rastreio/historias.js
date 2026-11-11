'use strict';
// Story -> files traceability from git history. Commit subjects look like
// "DIS-443 Story title | type(scope): description". "DIS-XXX" is a placeholder key for stories not yet in Jira;
// it is resolved to the numeric key that other commits use with the same story title.
const { spawnSync } = require('node:child_process');

const RS = '\x1e';
const US = '\x1f';
const IGNORADOS = [/(^|\/)package-lock\.json$/, /(^|\/)pnpm-lock\.yaml$/, /(^|\/)yarn\.lock$/, /(^|\/)node_modules\//, /(^|\/)dist\//];

function subjectRegex(prefix) {
  // "KEY Title | desc" (current), or older "KEY Title" / "KEY - Title" without the description part.
  return new RegExp(`^(${prefix}-(?:\\d+|XXX))(?:\\s+-)?\\s+(.+?)(?:\\s+\\|\\s+(.+))?$`);
}

function parseSubject(subject, prefix = 'DIS') {
  const m = subjectRegex(prefix).exec(subject);
  if (!m || /^(index|untracked files) on /.test(subject)) return null;
  const title = m[2].trim();
  return { key: m[1], title, desc: (m[3] || title).trim() };
}

// Git hooks export GIT_DIR/GIT_INDEX_FILE/GIT_WORK_TREE; they would override -C and point us at the wrong repo.
function envLimpo(env = process.env) {
  const limpo = { ...env };
  for (const k of Object.keys(limpo)) if (/^GIT_(DIR|INDEX_FILE|WORK_TREE|COMMON_DIR|PREFIX)$/.test(k)) delete limpo[k];
  return limpo;
}

function lerCommits(repoDir, { git = 'git' } = {}) {
  const fmt = `${RS}%H${US}%s${US}%aI`;
  const r = spawnSync(git, ['-C', repoDir, 'log', '--all', '--no-merges', '--name-only', `--format=${fmt}`], {
    encoding: 'utf8',
    env: envLimpo(),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`git log failed in ${repoDir}: ${(r.stderr || '').trim()}`);
  return r.stdout.split(RS).filter(Boolean).map((bloco) => {
    const [cab, ...resto] = bloco.split('\n');
    const [hash, subject, date] = cab.split(US);
    const files = resto.map((l) => l.trim()).filter(Boolean).filter((f) => !IGNORADOS.some((re) => re.test(f)));
    return { hash, subject, date, files };
  });
}

// Same commit rewritten across branches keeps its description and files: collapse by that fingerprint.
function deduplicar(commits) {
  const vistos = new Map();
  for (const c of commits) {
    const id = `${c.desc}::${[...c.files].sort().join('|')}`;
    const atual = vistos.get(id);
    const numerico = !/-XXX$/.test(c.key);
    if (!atual || (numerico && /-XXX$/.test(atual.key))) vistos.set(id, c);
  }
  return [...vistos.values()];
}

function resolverPlaceholders(commits) {
  const porTitulo = new Map();
  for (const c of commits) {
    if (!/-XXX$/.test(c.key)) porTitulo.set(c.title, c.key);
  }
  return commits.map((c) => (/-XXX$/.test(c.key) && porTitulo.has(c.title) ? { ...c, key: porTitulo.get(c.title), resolvido: true } : c));
}

function agregar(porRepo, prefix = 'DIS') {
  const historias = {};
  let semChave = 0;
  for (const [repo, commits] of Object.entries(porRepo)) {
    const analisados = [];
    for (const c of commits) {
      const p = parseSubject(c.subject, prefix);
      if (!p) { semChave += 1; continue; }
      analisados.push({ ...c, ...p });
    }
    for (const c of resolverPlaceholders(deduplicar(analisados))) {
      const h = (historias[c.key] ||= { titulos: [], commits: 0, repos: {} });
      if (!h.titulos.includes(c.title)) h.titulos.push(c.title);
      h.commits += 1;
      const arquivos = (h.repos[repo] ||= {});
      for (const f of c.files) {
        const a = (arquivos[f] ||= { commits: 0, ultimo: c.date });
        a.commits += 1;
        if (c.date > a.ultimo) a.ultimo = c.date;
      }
    }
  }
  for (const h of Object.values(historias)) {
    for (const [repo, arquivos] of Object.entries(h.repos)) {
      h.repos[repo] = Object.entries(arquivos)
        .map(([path, v]) => ({ path, ...v }))
        .sort((a, b) => b.commits - a.commits || a.path.localeCompare(b.path));
    }
  }
  return { historias, semChave };
}

module.exports = { envLimpo, parseSubject, lerCommits, deduplicar, resolverPlaceholders, agregar };
