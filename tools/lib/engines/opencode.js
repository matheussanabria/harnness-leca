// @ts-check
// Motor 2: opencode (API HTTP v2 do servidor local que já está rodando; ver tools/lib/opencode-v2.js).
const { PublicError, safeModel, getProjectContext } = require("./common");
const { loadEnv } = require("../env");
const V2 = require("../opencode-v2");
const { runTurn, TurnError } = require("../opencode-v2-turn");
const { resolveOpenCodeUrl, invalidateOpenCodeUrl, ocFetch, DEFAULT_URL } = require("../opencode-detect");
const { checkAnswer } = require("../hia/quality-gate");
const { recordExecution } = require("../hia/telemetry");

// Telemetry must never break a chat turn; unit tests (HARNESS_ROOT) skip the disk write.
function recordGate(/** @type {string} */ model, /** @type {{ok: boolean, code: string}} */ gate) {
  if (process.env.HARNESS_ROOT) return;
  try {
    recordExecution({
      executionId: `exec-${Date.now()}`, executorType: "opencode", executorId: model || "default",
      status: gate.ok ? "succeeded" : "flagged", durationMs: 0, tokensPrompt: 0, tokensCompletion: 0, tokensTotal: 0, tokensSaved: 0,
      qualityGate: gate.code,
    });
  } catch {}
}

// Lido a cada uso. Em testes de unidade (HARNESS_ROOT) devolve o padrão sem sondar; fora deles, devolve a URL
// que respondeu a GET /api/info (OPENCODE_URL, portas do processo, padrão) ou lança PublicError explicando o que foi tentado.
const resolveBase = async () => {
  loadEnv();
  if (process.env.HARNESS_ROOT) return DEFAULT_URL;
  return resolveOpenCodeUrl();
};

// O id vai no caminho da URL: só o formato do opencode (ses_ + alfanumérico) é aceito.
const isOpencodeSession = (id) => typeof id === "string" && /^ses_[A-Za-z0-9]{1,64}$/.test(id);

/** @param {import("../types").EngineRequest} req */
async function streamOpenCode({ prompt, slug, sessionId, model, effort, daiAgent, signal, onChunk, onDone, onError }) {
  try {
    const base = await resolveBase();
    let sId = sessionId;
    model = safeModel(model);
    const resumed = isOpencodeSession(sId);

    let fullPrompt = prompt;
    if (effort === "low") {
      fullPrompt = `[Instrução de esforço: Low. Seja extremamente direto e conciso no raciocínio preliminar (< 500 tokens). Priorize gerar imediatamente o código final completo nos blocos solicitados sem devaneios teóricos extensos]\n\n${fullPrompt}`;
    } else if (effort === "high") {
      fullPrompt = `[Esforço de raciocínio: High / Alto. Raciocine passo a passo em profundidade antes da resposta final]\n\n${fullPrompt}`;
    }
    if (!resumed) {
      const ctx = getProjectContext(slug, { daiAgent });
      if (ctx) fullPrompt = `${ctx}\nPergunta do usuário:\n${fullPrompt}`;
    }

    // O modo "plan" desativa ferramentas de terminal/disco (bash, write, glob) que prendem o modelo em loop.
    const newSession = async () => V2.createSession(base, { model, agent: "plan" });
    if (!resumed) sId = await newSession();

    // Sessão reaproveitada com outro modelo escolhido na interface; se o servidor não a conhece mais, cria outra.
    if (resumed) {
      try {
        if (model) await V2.setSessionModel(base, sId, model);
        await V2.readTurn(base, sId, Number.MAX_SAFE_INTEGER); // confere que a sessão ainda existe no servidor
      } catch {
        sId = await newSession();
        fullPrompt = `${getProjectContext(slug, { daiAgent }) || ""}\nPergunta do usuário:\n${fullPrompt}`;
      }
    }

    let accumulatedText = "";
    const turn = await runTurn(base, sId, fullPrompt, {
      signal,
      onReasoning: (text) => onChunk({ type: "thinking", text, sessionId: sId }),
      onText: (text) => { accumulatedText += text; onChunk({ type: "text", text, sessionId: sId }); },
    });
    if (turn.aborted) return;

    // 9Router returns HTTP 200 for empty, cut-off and fake tool-call answers: flag them instead of passing them as good.
    const qualityGate = checkAnswer({ text: accumulatedText, finish: turn.finish });
    if (!qualityGate.ok) onChunk({ type: "thinking", text: `\n[Quality gate] ${qualityGate.reason} Model: ${model || "default"}.\n`, sessionId: sId });
    recordGate(model, qualityGate);
    onDone({ sessionId: sId, fullText: accumulatedText, qualityGate });
  } catch (err) {
    if (err && err.message === "fetch failed") invalidateOpenCodeUrl(); // servidor caiu: revalida na próxima chamada
    onError(err instanceof TurnError ? new PublicError(err.message) : err);
  }
}

// Modelos que o servidor do opencode oferece, com os conhecidos (os do catálogo) primeiro, na ordem do catálogo.
async function fetchModels(base, knownIds, catalogModels) {
  let models;
  try {
    models = await V2.listModels(base, { signal: AbortSignal.timeout(3000) });
  } catch {
    return null; // sem a lista do servidor, vale o catálogo
  }
  if (!models.length) return null;
  const catalogById = new Map(catalogModels.map((m) => [m.id, m]));
  models = models.map((m) => catalogById.get(m.id) || m); // nome amigável do catálogo vence quando o id é o mesmo
  return models.sort((a, b) => {
    const ai = knownIds.indexOf(a.id), bi = knownIds.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** @param {import("../types").EngineCatalogEntry} catalog */
async function status(catalog) {
  let base = DEFAULT_URL;
  let available = false;
  let reason;
  try {
    base = await resolveBase();
    const res = await ocFetch(`${base}/api/info`, { signal: AbortSignal.timeout(2000) });
    available = res.ok;
    if (!available) reason = res.status === 401
      ? "O servidor do OpenCode pediu senha (HTTP 401). Defina OPENCODE_SERVER_PASSWORD com a senha do servidor."
      : `O servidor respondeu HTTP ${res.status} em ${base}.`;
  } catch (err) {
    // Sem servidor: o motor aparece como indisponível, com o motivo (só a mensagem pública, nunca detalhes internos).
    if (err instanceof PublicError) {
      reason = err.message;
      base = /** @type {any} */ (err).tried?.[0]?.url || base;
    } else invalidateOpenCodeUrl();
  }

  const live = available ? await fetchModels(base, catalog.models.map((m) => m.id), catalog.models) : null;
  const models = live || catalog.models;
  const port = new URL(base).port || (base.startsWith("https") ? "443" : "80");
  // O padrão do catálogo vale enquanto o servidor ainda oferecer esse modelo; senão, o primeiro da lista.
  const defaultModel = models.some((m) => m.id === catalog.defaultModel) ? catalog.defaultModel : models[0]?.id || catalog.defaultModel;
  return { available, url: base, auth: `Servidor local (Porta ${port})`, defaultModel, models, ...(reason ? { reason } : {}), ...(available && !live ? { modelsFromCatalog: true } : {}) };
}

/** @type {import("../types").Engine} */
const engine = { id: "opencode", stream: streamOpenCode, status };

module.exports = engine;
