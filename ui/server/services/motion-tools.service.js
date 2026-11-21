// @ts-check
"use strict";
/**
 * Atelier agent tools for motion timelines (ADR-018, EP-24.04). The agent edits data (motion@1), never animation code.
 * Every write goes through motion-store (validation, 64 KB cap, rev), so an invalid timeline never reaches the disk and
 * the validation errors go back to the model as the tool result.
 */
const { readMotion, writeMotion, MotionError } = require("./motion-store.service");
const { ALLOWED_PROPS, MAX_DURATION } = require("./motion-schema.service");

const DEFAULT_DURATION = 3000;
const DEFAULT_FPS = 30;
const MAX_REPORTED_ERRORS = 8;

/** Short rules for prompts (tag-based engines and the proto context). */
const MOTION_RULES = `Motion (animação): a timeline de uma tela é JSON motion@1 {"schema":"motion@1","duration":ms,"fps":24|30|60,"loop":bool,"tracks":[{"target":"<data-pid>","keys":[{"t":ms,"props":{...},"ease":"ease-out"}]}]}. "target" é SEMPRE um data-pid que existe na tela (ex.: "p-12"); "t" cresce dentro de cada faixa e fica entre 0 e duration; "ease" vale para o trecho que termina naquele key (linear, ease, ease-in, ease-out, ease-in-out ou cubic-bezier(x1,y1,x2,y2)). Props permitidas: ${[...ALLOWED_PROPS].join(", ")}. Valores numéricos ou CSS simples, sem url(). Para cascata, desloque o "t" de cada elemento.
- Timeline inteira: <tool name="motion_write_timeline">{"screen":"home","doc":{...motion@1...}}</tool>
- Uma faixa (cria ou substitui): <tool name="motion_set_keys">{"screen":"home","target":"p-12","keys":[{"t":0,"props":{"opacity":0}},{"t":600,"props":{"opacity":1},"ease":"ease-out"}]}</tool>
- Remover faixa: <tool name="motion_remove_track">{"screen":"home","target":"p-12"}</tool>`;

const screenParam = { type: "string", description: "ID da tela (ex.: 'home')" };
const keysParam = {
  type: "array",
  description: "Keyframes em ordem de tempo: { t (ms), props (objeto), ease? }",
  items: { type: "object", properties: { t: { type: "number" }, props: { type: "object" }, ease: { type: "string" } }, required: ["t", "props"] },
};

const MOTION_TOOL_DEFINITIONS = [
  {
    name: "motion_write_timeline",
    description: "Grava a timeline motion@1 inteira de uma tela (substitui a atual). Use para criar a animação do zero.",
    parameters: { type: "object", properties: { screen: screenParam, doc: { type: "object", description: `Documento motion@1 completo: { schema: "motion@1", duration (ms, até 60000), fps (24|30|60), loop?, tracks: [{ target: data-pid, keys: [{ t, props, ease? }] }] }. Props permitidas: ${[...ALLOWED_PROPS].join(", ")}.` } }, required: ["screen", "doc"] },
  },
  {
    name: "motion_set_keys",
    description: "Cria ou substitui os keyframes de uma faixa (um data-pid) na timeline da tela; cria a timeline se não existir.",
    parameters: {
      type: "object",
      properties: { screen: screenParam, target: { type: "string", description: "data-pid do elemento" }, keys: keysParam, duration: { type: "number", description: "Duração em ms, só ao criar a timeline" } },
      required: ["screen", "target", "keys"],
    },
  },
  {
    name: "motion_remove_track",
    description: "Remove a faixa de um data-pid da timeline da tela.",
    parameters: { type: "object", properties: { screen: screenParam, target: { type: "string" } }, required: ["screen", "target"] },
  },
];

/** @param {any} args */
const screenOf = (args) => String(args?.screen || args?.screenId || "");

/** Readable validation failure for the model: path and message per error, capped. */
function describeError(/** @type {unknown} */ err) {
  if (!(err instanceof MotionError)) return `Falha ao gravar a timeline: ${/** @type {Error} */ (err)?.message || String(err)}`;
  const errors = Array.isArray(/** @type {any} */ (err.details).errors) ? /** @type {any} */ (err.details).errors : [];
  if (!errors.length) return `${err.message} (${err.code})`;
  const lines = errors.slice(0, MAX_REPORTED_ERRORS).map((/** @type {any} */ e) => `${e.path || "(raiz)"}: ${e.message}`);
  const more = errors.length > MAX_REPORTED_ERRORS ? ` (+${errors.length - MAX_REPORTED_ERRORS} erros)` : "";
  return `Timeline inválida, nada foi gravado. Corrija e reenvie: ${lines.join("; ")}${more}`;
}

/**
 * Duration after motion_set_keys: an explicit `duration` wins; otherwise a new timeline ends at its last key
 * (the probe showed models skipping `duration`, which left a 3 s default) and an existing one grows to fit the keys.
 * @param {number} current 0 when the timeline is being created
 * @param {any} args
 */
function durationFor(current, args) {
  const explicit = Number(args?.duration);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const times = (Array.isArray(args?.keys) ? args.keys : []).map((/** @type {any} */ k) => Number(k?.t)).filter(Number.isFinite);
  const lastKey = Math.min(MAX_DURATION, Math.ceil(Math.max(0, ...times)));
  if (!current) return lastKey > 0 ? lastKey : DEFAULT_DURATION;
  return Math.max(current, lastKey);
}

/** @param {{ rev: string, warnings: any[], doc: any }} saved @param {string} screen @param {string} message */
function okResult(saved, screen, message) {
  const result = { message, screen, rev: saved.rev, tracks: saved.doc.tracks.length, duration: saved.doc.duration };
  if (saved.warnings.length) {
    return { ...result, warnings: saved.warnings.map((w) => `${w.path}: ${w.message} (use um data-pid que existe na tela)`) };
  }
  return result;
}

/**
 * @param {string} name
 * @param {any} args
 * @param {{ projectDir: string, protoId: string }} ctx
 * @returns {{ ok: boolean, result?: object, error?: string }}
 */
function executeMotionTool(name, args, ctx) {
  const screen = screenOf(args);
  if (!screen) return { ok: false, error: "screen é obrigatório (ID da tela, ex.: 'home')." };
  try {
    if (name === "motion_write_timeline") {
      const current = readMotion(ctx.projectDir, ctx.protoId, screen);
      const saved = writeMotion(ctx.projectDir, ctx.protoId, screen, args?.doc, { rev: current.rev });
      return { ok: true, result: okResult(saved, screen, `Timeline da tela '${screen}' gravada.`) };
    }
    const target = String(args?.target || "");
    if (!target) return { ok: false, error: "target é obrigatório (data-pid do elemento)." };
    const current = readMotion(ctx.projectDir, ctx.protoId, screen);
    if (name === "motion_set_keys") {
      const base = current.doc || { schema: "motion@1", duration: 0, fps: DEFAULT_FPS, loop: false, tracks: [] };
      const tracks = (Array.isArray(base.tracks) ? base.tracks : []).filter((/** @type {any} */ t) => t && t.target !== target);
      const doc = { ...base, duration: durationFor(base.duration, args), tracks: [...tracks, { target, keys: args?.keys }] };
      const saved = writeMotion(ctx.projectDir, ctx.protoId, screen, doc, { rev: current.rev });
      return { ok: true, result: okResult(saved, screen, `Faixa '${target}' gravada na tela '${screen}'.`) };
    }
    if (name === "motion_remove_track") {
      if (!current.doc) return { ok: false, error: `A tela '${screen}' não tem timeline.` };
      const tracks = current.doc.tracks.filter((/** @type {any} */ t) => t.target !== target);
      if (tracks.length === current.doc.tracks.length) return { ok: false, error: `A timeline da tela '${screen}' não tem faixa para '${target}'.` };
      const saved = writeMotion(ctx.projectDir, ctx.protoId, screen, { ...current.doc, tracks }, { rev: current.rev });
      return { ok: true, result: okResult(saved, screen, `Faixa '${target}' removida da tela '${screen}'.`) };
    }
    return { ok: false, error: `Ferramenta desconhecida: "${name}".` };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

/** @param {string} name */
const isMotionTool = (name) => MOTION_TOOL_DEFINITIONS.some((d) => d.name === name);

module.exports = { MOTION_TOOL_DEFINITIONS, MOTION_RULES, executeMotionTool, isMotionTool, describeError };
