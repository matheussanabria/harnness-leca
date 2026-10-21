// @ts-check
// Catálogo canônico de rotinas de workflow (EP-08.05).
// Rotina = gatilho + workflow + política de aprovação. Somente dados, sem I/O.
const { getWorkflow, isValidWorkflow } = require("./workflow-definitions");

const TRIGGER_TYPES = new Set(["manual", "daily", "weekly"]);
const MAX_IDEMPOTENCY_WINDOW_HOURS = 24;

const ROUTINE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "rotina-feature-delivery",
    label: "Entrega de feature (diária)",
    description: "Dispara o fluxo completo de entrega uma vez por dia, no primeiro horário útil.",
    workflowId: "feature-delivery",
    trigger: Object.freeze({ type: "daily", hour: 9, minute: 0, weekday: -1 }),
    laneId: "",
    sensitive: true,
    approvalPolicy: Object.freeze({ mode: "stages", approver: "", note: "Aprovação herdada das etapas sensíveis do workflow." }),
  }),
  Object.freeze({
    id: "rotina-entrega-manual",
    label: "Entrega de feature (manual)",
    description: "Mesmo fluxo completo, disparado sob demanda com a raia escolhida no momento.",
    workflowId: "feature-delivery",
    trigger: Object.freeze({ type: "manual", hour: -1, minute: -1, weekday: -1 }),
    laneId: "",
    sensitive: true,
    approvalPolicy: Object.freeze({ mode: "stages", approver: "", note: "Aprovação herdada das etapas sensíveis do workflow." }),
  }),
  Object.freeze({
    id: "rotina-hotfix",
    label: "Hotfix (manual)",
    description: "Correção pontual sem protótipo, com as etapas sensíveis mantidas.",
    workflowId: "hotfix",
    trigger: Object.freeze({ type: "manual", hour: -1, minute: -1, weekday: -1 }),
    laneId: "",
    sensitive: true,
    approvalPolicy: Object.freeze({ mode: "stages", approver: "", note: "Aprovação herdada das etapas sensíveis do workflow." }),
  }),
]);

const ROUTINE_INDEX = new Map(ROUTINE_DEFINITIONS.map((routine) => [routine.id, routine]));

/**
 * Janela de idempotência de uma rotina agendada, em horas.
 * @param {string} routineId
 * @returns {number}
 */
function idempotencyWindowHours(routineId) {
  const routine = ROUTINE_INDEX.get(String(routineId || "").trim());
  if (!routine) return 0;
  if (routine.trigger.type === "daily") return 24;
  if (routine.trigger.type === "weekly") return 24 * 7;
  return MAX_IDEMPOTENCY_WINDOW_HOURS;
}

/**
 * Data local no formato AAAA-MM-DD, usada na chave de idempotência.
 * @param {Date} now
 * @returns {string}
 */
function localDateStamp(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Chave determinística de idempotência de uma execução de rotina.
 * @param {string} routineId
 * @param {string} slug
 * @param {Date} [now]
 * @returns {string}
 */
function routineIdempotencyKey(routineId, slug, now = new Date()) {
  const routine = ROUTINE_INDEX.get(String(routineId || "").trim());
  if (!routine) return "";
  const project = String(slug || "").trim();
  const stamp = localDateStamp(now);
  if (routine.trigger.type === "daily" || routine.trigger.type === "weekly") {
    return `routine:${routine.id}:${project}:${stamp}`;
  }
  return `routine:${routine.id}:${project}:${now.getTime()}`;
}

/**
 * @param {any} routine
 * @returns {boolean}
 */
function isScheduled(routine) {
  return Boolean(routine) && TRIGGER_TYPES.has(routine.trigger.type) && routine.trigger.type !== "manual";
}

/**
 * Detecta se a rotina agendada já venceu no dia corrente.
 * @param {any} routine
 * @param {Date} [now]
 * @returns {boolean}
 */
function isDue(routine, now = new Date()) {
  if (!isScheduled(routine)) return false;
  const trigger = routine.trigger;
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (trigger.type === "daily") {
    return hour > trigger.hour || (hour === trigger.hour && minute >= trigger.minute);
  }
  if (trigger.type === "weekly") {
    if (now.getDay() !== trigger.weekday) return false;
    return hour > trigger.hour || (hour === trigger.hour && minute >= trigger.minute);
  }
  return false;
}

/**
 * @param {any} routine
 * @returns {Object}
 */
function routineDetail(routine) {
  const workflow = getWorkflow(routine.workflowId);
  const approvalStages = workflow ? workflow.stages.filter((stage) => stage.requiresApproval).map((stage) => stage.id) : [];
  return {
    id: routine.id,
    label: routine.label,
    description: routine.description,
    workflowId: routine.workflowId,
    workflowLabel: workflow ? workflow.label : routine.workflowId,
    trigger: { ...routine.trigger },
    scheduled: isScheduled(routine),
    laneId: routine.laneId,
    sensitive: routine.sensitive,
    approvalPolicy: { ...routine.approvalPolicy },
    approvalStages,
    idempotencyWindowHours: idempotencyWindowHours(routine.id),
  };
}

/**
 * @returns {Object[]}
 */
function listRoutines() {
  return ROUTINE_DEFINITIONS.map(routineDetail);
}

/**
 * @param {string} routineId
 * @returns {Object | null}
 */
function getRoutine(routineId) {
  const routine = ROUTINE_INDEX.get(String(routineId || "").trim());
  return routine ? routineDetail(routine) : null;
}

/**
 * @param {string} routineId
 * @returns {boolean}
 */
function isValidRoutine(routineId) {
  return ROUTINE_INDEX.has(String(routineId || "").trim());
}

/**
 * @param {string} routineId
 * @returns {boolean}
 */
function routineWorkflowExists(routineId) {
  const routine = ROUTINE_INDEX.get(String(routineId || "").trim());
  return Boolean(routine) && isValidWorkflow(routine.workflowId);
}

module.exports = {
  TRIGGER_TYPES,
  ROUTINE_DEFINITIONS,
  ROUTINE_INDEX,
  localDateStamp,
  idempotencyWindowHours,
  routineIdempotencyKey,
  isScheduled,
  isDue,
  routineDetail,
  listRoutines,
  getRoutine,
  isValidRoutine,
  routineWorkflowExists,
};
