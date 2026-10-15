// Redação simples de segredos comuns (heurística: não garante cobertura total; revise os .md antes de compartilhar).
// Compartilhada pelo importador e pelo extrator de artefatos.
const SECRET_RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[REDIGIDO:chave-privada]"],
  [/\b(sk-ant-|sk-|sk_live_|sk_test_|rk_live_|ghp_|gho_|ghs_|github_pat_|glpat-|xox[abprs]-|AIza|AKIA|ASIA|ya29\.|GOCSPX-|npm_|hf_|pypi-)[A-Za-z0-9_\-]{16,}/g, "[REDIGIDO:chave-api]"],
  // Webhooks do Slack e do Discord: a URL inteira é a credencial.
  [/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]+|https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, "[REDIGIDO:webhook]"],
  // Azure: chaves de conta e assinaturas de acesso (SAS) em connection strings e URLs.
  [/\b(AccountKey|SharedAccessKey|SharedAccessSignature)=[^;&\s"']{8,}|([?&]sig=)[A-Za-z0-9%+\/=_-]{8,}/g, (m, k, q) => (k ? `${k}=[REDIGIDO]` : `${q}[REDIGIDO]`)],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[REDIGIDO:jwt]"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{12,}/gi, "$1 [REDIGIDO]"],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:\/@]+:)[^\s@\/]+@/gi, "$1[REDIGIDO]@"],
  [/((?:password|passwd|pwd|senha|secret|token|api[_-]?key|access[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi, "$1[REDIGIDO]"],
];

const redact = (s) => SECRET_RULES.reduce((t, [re, to]) => t.replace(re, to), s);

module.exports = { SECRET_RULES, redact };
