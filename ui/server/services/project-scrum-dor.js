// @ts-check
// Checklist mecanico de Definition of Ready: so verifica o que um script consegue verificar.
const RULESET = "dor-mechanical-v1";

const VAGUE_TERMS = [
  "etc",
  "adequad",
  "amigavel",
  "rapid",
  "facil",
  "bom ",
  "melhor",
  "quando possivel",
  "entre outros",
  "e outros",
];

// "todo" sozinho e palavra comum em portugues ("todos os usuarios"): so conta o marcador "todo:".
const OPEN_QUESTION_MARKERS = [/\btodo\s*:/, /\btbd\b/, /a definir/, /\?\?\?/];

const OPEN_HEADING = /^#{1,6}\s*perguntas abertas\b/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VAGUE_PATTERNS = VAGUE_TERMS.map((term) => new RegExp(`(?:^|\\s)${escapeRegExp(term)}`));

// Normalizacao usada pelas checagens: minusculas, sem acentos, espacos colapsados.
function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readStory(story) {
  const source = story && typeof story === "object" ? story : {};
  const rawCriteria = Array.isArray(source.acceptanceCriteria) ? source.acceptanceCriteria : [];
  const criteriaTexts = rawCriteria.filter((item) => typeof item === "string");
  return {
    title: textField(source.title),
    description: textField(source.description),
    criteria: criteriaTexts.map((item) => item.trim()).filter(Boolean),
    criteriaTexts,
    points: source.points,
    priority: textField(source.priority),
    epicId: textField(source.epicId),
  };
}

function hasOpenHeading(text) {
  if (typeof text !== "string" || !text) return false;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!OPEN_HEADING.test(normalizeText(lines[index]))) continue;
    const followedByContent = lines.slice(index + 1).some((line) => line.trim().length > 0);
    if (followedByContent) return true;
  }
  return false;
}

function hasOpenQuestion(text) {
  const normalized = normalizeText(text);
  if (OPEN_QUESTION_MARKERS.some((marker) => marker.test(normalized))) return true;
  return hasOpenHeading(text);
}

function vagueIndexes(criteria) {
  return criteria.reduce((acc, item, index) => {
    const text = normalizeText(item);
    if (VAGUE_PATTERNS.some((pattern) => pattern.test(text))) acc.push(index + 1);
    return acc;
  }, []);
}

function shortIndexes(criteria) {
  return criteria.reduce((acc, item, index) => {
    if (item.length < 10) acc.push(index + 1);
    return acc;
  }, []);
}

function buildChecks(story) {
  const titleOk = story.title.length >= 5 && normalizeText(story.title) !== "sem titulo";
  const descriptionOk = story.description.length >= 20;
  const present = story.criteria.length > 0;
  const short = shortIndexes(story.criteria);
  const verifiableOk = present && short.length === 0;
  const vague = vagueIndexes(story.criteria);
  const estimateOk = Number.isInteger(story.points) && story.points > 0;
  const epicOk = story.epicId.length > 0;
  const priorityOk = story.priority.length > 0;
  const openQuestionOk = ![story.description, ...story.criteriaTexts].some(hasOpenQuestion);

  return [
    { id: "title", severity: "required", ok: titleOk, detail: titleOk ? "ok" : "Titulo ausente ou generico" },
    { id: "description", severity: "required", ok: descriptionOk, detail: descriptionOk ? "ok" : "Descricao com menos de 20 caracteres" },
    { id: "criteria-present", severity: "required", ok: present, detail: present ? "ok" : "Nenhum criterio de aceite" },
    {
      id: "criteria-verifiable",
      severity: "required",
      ok: verifiableOk,
      detail: verifiableOk ? "ok" : (present ? `Criterios muito curtos: ${short.join(", ")}` : "Nenhum criterio de aceite"),
    },
    {
      id: "criteria-clear",
      severity: "advisory",
      ok: vague.length === 0,
      detail: vague.length === 0 ? "ok" : `Termos vagos nos criterios: ${vague.join(", ")}`,
    },
    { id: "estimate", severity: "advisory", ok: estimateOk, detail: estimateOk ? "ok" : "Sem estimativa" },
    { id: "epic", severity: "advisory", ok: epicOk, detail: epicOk ? "ok" : "Sem epico" },
    { id: "priority", severity: "advisory", ok: priorityOk, detail: priorityOk ? "ok" : "Sem prioridade" },
    { id: "open-questions", severity: "advisory", ok: openQuestionOk, detail: openQuestionOk ? "ok" : "Pendencias abertas no texto" },
  ];
}

function evaluateDor(story) {
  const checks = buildChecks(readStory(story));
  const requiredFailed = checks.filter((item) => item.severity === "required" && !item.ok).map((item) => item.id);
  const advisoryFailed = checks.filter((item) => item.severity === "advisory" && !item.ok).map((item) => item.id);
  return {
    ruleset: RULESET,
    ready: requiredFailed.length === 0,
    requiredFailed,
    advisoryFailed,
    checks,
    humanReview: true,
  };
}

module.exports = { RULESET, evaluateDor };
