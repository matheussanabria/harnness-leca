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

// Dados pessoais (LGPD): e-mail, CPF e telefone brasileiro. Os formatos exigem marcas de formatação (pontos, hífen,
// parênteses, +55) para não pegar números soltos como timestamps, ids ou intervalos de anos ("2025-2026").
// CPF sem formatação só vale quando vem rotulado ("CPF 12345678901").
const PII_RULES = [
  [/(?<![\w.%+-])[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, "[REDIGIDO:email]"],
  [/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g, "[REDIGIDO:cpf]"],
  [/(\bcpf\b[^\d\n]{0,12})\d{11}(?!\d)/gi, "$1[REDIGIDO:cpf]"],
  [/(?<![\w+])(?:\+55[\s.-]?)?\(\d{2}\)[\s.-]?9?\d{4}[-\s.]?\d{4}(?!\d)/g, "[REDIGIDO:telefone]"],
  [/(?<![\w+])\+55[\s.-]?\d{2}[\s.-]?9?\d{4}[-\s.]?\d{4}(?!\d)/g, "[REDIGIDO:telefone]"],
  [/(?<![\d.-])\d{2}\s9?\d{4}[-\s]\d{4}(?![\d-])/g, "[REDIGIDO:telefone]"],
  [/(?<![\d.\-+])9\d{4}-\d{4}(?![\d-])/g, "[REDIGIDO:telefone]"],
];

const apply = (rules, s) => rules.reduce((t, [re, to]) => t.replace(re, to), s);
const redact = (s) => apply(PII_RULES, apply(SECRET_RULES, s));

module.exports = { SECRET_RULES, PII_RULES, redact };
