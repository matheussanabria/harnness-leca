// Redação simples de segredos comuns (heurística: não garante cobertura total; revise os .md antes de compartilhar).
// Compartilhada pelo importador e pelo extrator de artefatos.
const SECRET_RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[REDIGIDO:chave-privada]"],
  [/\b(sk-ant-|sk-|ghp_|gho_|ghs_|github_pat_|glpat-|xox[abprs]-|AIza|AKIA|ASIA)[A-Za-z0-9_\-]{16,}/g, "[REDIGIDO:chave-api]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[REDIGIDO:jwt]"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{12,}/gi, "$1 [REDIGIDO]"],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:\/@]+:)[^\s@\/]+@/gi, "$1[REDIGIDO]@"],
  [/((?:password|passwd|pwd|senha|secret|token|api[_-]?key|access[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi, "$1[REDIGIDO]"],
];

const redact = (s) => SECRET_RULES.reduce((t, [re, to]) => t.replace(re, to), s);

module.exports = { SECRET_RULES, redact };
