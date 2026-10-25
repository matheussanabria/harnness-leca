// @ts-check
// Motor 2: opencode (REST HTTP no servidor local que já está rodando).
const { PublicError, safeModel, getProjectContext } = require("./common");
const { loadEnv } = require("../env");
const { detectOpenCodeUrl } = require("../opencode-detect");

const DEFAULT_URL = "http://localhost:63186";
let cachedUrl = null;
let cachedAt = 0;

// Lido a cada uso: aceita OPENCODE_URL customizada, mas auto-detecta porta ativa se o padrão 63186 não responder.
const baseUrl = () => {
  loadEnv();
  if (process.env.HARNESS_ROOT) return DEFAULT_URL; // isolamento em testes de unidade
  if (cachedUrl && Date.now() - cachedAt < 10000) return cachedUrl;

  // 1. Tenta auto-detectar porta ativa do OpenCode (qualquer porta)
  const detected = detectOpenCodeUrl();
  if (detected) {
    cachedUrl = detected;
    cachedAt = Date.now();
    return detected;
  }

  // 2. Se não detectou outro processo ativo, usa OPENCODE_URL configurado ou o padrão
  if (process.env.OPENCODE_URL && process.env.OPENCODE_URL !== DEFAULT_URL) {
    return process.env.OPENCODE_URL;
  }
  return DEFAULT_URL;
};

/** @param {import("../types").EngineRequest} req */
async function streamOpenCode({ prompt, slug, sessionId, model, effort, daiAgent, signal, onChunk, onDone, onError }) {
  const base = baseUrl();
  try {
    let sId = sessionId;
    model = safeModel(model);
    // O id vai no caminho da URL: só o formato do opencode (ses_ + alfanumérico) é aceito.
    const isValidOpencodeSession = typeof sId === "string" && /^ses_[A-Za-z0-9]{1,64}$/.test(sId);

    // Se não há sessão válida, cria uma no opencode
    if (!isValidOpencodeSession) {
      const sRes = await fetch(`${base}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sRes.ok) throw new Error(`Falha ao criar sessão no OpenCode: HTTP ${sRes.status}`);
      const sData = await sRes.json();
      sId = sData.id;
    }

    let fullPrompt = prompt;
    if (effort === "low") {
      fullPrompt = `[Instrução de esforço: Low. Seja extremamente direto e conciso no raciocínio preliminar (< 500 tokens). Priorize gerar imediatamente o código final completo nos blocos solicitados sem devaneios teóricos extensos]\n\n${fullPrompt}`;
    } else if (effort === "high") {
      fullPrompt = `[Esforço de raciocínio: High / Alto. Raciocine passo a passo em profundidade antes da resposta final]\n\n${fullPrompt}`;
    }
    if (!isValidOpencodeSession) {
      const ctx = getProjectContext(slug, { daiAgent });
      if (ctx) fullPrompt = `${ctx}\nPergunta do usuário:\n${fullPrompt}`;
    }

    // Registra mensagens existentes antes do prompt para isolar apenas o novo turno
    let initialMsgCount = 0;
    try {
      const initRes = await fetch(`${base}/session/${sId}/message`);
      if (initRes.ok) {
        const initMsgs = await initRes.json();
        if (Array.isArray(initMsgs)) initialMsgCount = initMsgs.length;
      }
    } catch {}

    const buildPromptBody = () => {
      const pb = { parts: [{ type: "text", text: fullPrompt }] };
      if (model) {
        pb.model = { providerID: "opencode", modelID: model };
      }
      // O modo "plan" desativa ferramentas de terminal/disco (bash, write, glob) que prendem o modelo em loop
      pb.agent = "plan";
      return pb;
    };

    // Dispara o prompt assíncrono
    let pRes = await fetch(`${base}/session/${sId}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPromptBody()),
    });

    // Se a sessão foi rejeitada (ex.: sessão antiga/inválida), cria nova e retenta
    if (!pRes.ok) {
      const sResNew = await fetch(`${base}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (sResNew.ok) {
        const sDataNew = await sResNew.json();
        sId = sDataNew.id;
        initialMsgCount = 0;
        pRes = await fetch(`${base}/session/${sId}/prompt_async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPromptBody()),
        });
      }
    }

    if (!pRes.ok) throw new Error(`OpenCode prompt_async retornou HTTP ${pRes.status}`);

    // Polling ágil de mensagens (200ms) até a resposta do assistente ser concluída
    let accumulatedText = "";
    let accumulatedThinking = "";
    let completed = false;
    const startTime = Date.now();
    let lastActivity = Date.now();

    // Modelos com raciocínio profundo (ex.: DeepSeek, Qwen) podem pensar por vários minutos.
    // O timeout só dispara se houver inatividade completa (sem novos tokens de texto ou raciocínio) por 3 minutos,
    // ou se o tempo total absoluto ultrapassar 15 minutos (teto de segurança).
    const IDLE_TIMEOUT_MS = 180_000; // 3 minutos de tolerância sem atividade
    const MAX_TOTAL_TIMEOUT_MS = 900_000; // 15 minutos de teto global

    while (!completed) {
      await new Promise((r) => setTimeout(r, 200));
      // Cliente saiu: para de consultar e pede ao opencode para interromper a geração (melhor esforço).
      if (signal && signal.aborted) {
        fetch(`${base}/session/${sId}/abort`, { method: "POST" }).catch(() => {});
        return;
      }

      const now = Date.now();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        throw new PublicError("Tempo limite de inatividade excedido (OpenCode sem novos dados por mais de 3 minutos)");
      }
      if (now - startTime > MAX_TOTAL_TIMEOUT_MS) {
        throw new PublicError("Tempo limite total excedido aguardando resposta do OpenCode (15 minutos)");
      }

      const mRes = await fetch(`${base}/session/${sId}/message`);
      if (!mRes.ok) continue;
      const msgs = await mRes.json();
      if (!Array.isArray(msgs)) continue;

      // Procura a última mensagem do assistente criada após o início do prompt
      const candidateMsgs = msgs.slice(initialMsgCount);
      const lastAss = [...candidateMsgs].reverse().find((m) => m.info && m.info.role === "assistant");
      if (lastAss) {
        if (lastAss.info && lastAss.info.error) {
          const errMsg = lastAss.info.error.message || lastAss.info.error.name || "Erro na geração do OpenCode";
          throw new PublicError(`OpenCode erro: ${errMsg}`);
        }

        if (Array.isArray(lastAss.parts)) {
          let totalReasoning = "";
          let totalText = "";

          for (const part of lastAss.parts) {
            if (part.type === "reasoning" && part.text) totalReasoning += part.text;
            else if (part.type === "text" && part.text) totalText += part.text;
          }

          if (totalReasoning.length > accumulatedThinking.length) {
            const delta = totalReasoning.slice(accumulatedThinking.length);
            accumulatedThinking = totalReasoning;
            lastActivity = Date.now();
            onChunk({ type: "thinking", text: delta, sessionId: sId });
          }
          if (totalText.length > accumulatedText.length) {
            const delta = totalText.slice(accumulatedText.length);
            accumulatedText = totalText;
            lastActivity = Date.now();
            onChunk({ type: "text", text: delta, sessionId: sId });
          }

          if (lastAss.info.time && lastAss.info.time.completed) {
            completed = true;
          }

          // Detecta término por estouro de cota de tokens (ex: 32k tokens em raciocínio) sem texto de saída
          const stepFinish = lastAss.parts.find((p) => p.type === "step-finish");
          const finishReason = stepFinish?.reason || lastAss.info.finish;
          if (finishReason === "length" && !totalText.trim()) {
            throw new PublicError("O modelo esgotou a cota máxima de tokens (32k) em raciocínio interno antes de produzir o código. Tente simplificar o pedido inicial ou pedir uma tela por vez.");
          }
        }
      }
    }

    onDone({ sessionId: sId, fullText: accumulatedText });
  } catch (err) {
    onError(err);
  }
}

// Modelos que o servidor do opencode oferece, com os conhecidos (os do catálogo) primeiro, na ordem do catálogo.
async function fetchModels(base, knownIds) {
  try {
    const res = await fetch(`${base}/api/model`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body.data) || !body.data.length) return null;
    const models = body.data.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      desc: m.id.endsWith("-free") ? "Modelo Gratuito" : (m.providerID || ""),
    }));
    return models.sort((a, b) => {
      const ai = knownIds.indexOf(a.id), bi = knownIds.indexOf(b.id);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return null; // sem a lista do servidor, vale a do catálogo
  }
}

/** @param {import("../types").EngineCatalogEntry} catalog */
async function status(catalog) {
  const base = baseUrl();
  let available = false;
  try {
    available = (await fetch(`${base}/session`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch { /* servidor do opencode fora do ar: o motor aparece como indisponível */ }

  const models = (available && await fetchModels(base, catalog.models.map((m) => m.id))) || catalog.models;
  const port = new URL(base).port || (base.startsWith("https") ? "443" : "80");
  return { available, url: base, auth: `Servidor local (Porta ${port})`, defaultModel: models[0]?.id || catalog.defaultModel, models };
}

/** @type {import("../types").Engine} */
const engine = { id: "opencode", stream: streamOpenCode, status };

module.exports = engine;
