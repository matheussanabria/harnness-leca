// @ts-check
// Motor 2: opencode (REST HTTP no servidor local que já está rodando).
const { PublicError, safeModel, getProjectContext } = require("./common");
const { loadEnv } = require("../env");
const { DEFAULT_URL, resolveOpenCodeUrl, invalidateOpenCodeUrl, ocFetch } = require("../opencode-detect");

// Lido a cada uso. Em testes de unidade (HARNESS_ROOT) devolve o padrão sem sondar; fora deles, devolve a URL
// que respondeu a GET /session (OPENCODE_URL, portas do processo, padrão) ou lança PublicError explicando o que foi tentado.
const resolveBase = async () => {
  loadEnv();
  if (process.env.HARNESS_ROOT) return DEFAULT_URL;
  return resolveOpenCodeUrl();
};

/** @param {import("../types").EngineRequest} req */
async function streamOpenCode({ prompt, slug, sessionId, model, effort, daiAgent, signal, onChunk, onDone, onError }) {
  try {
    const base = await resolveBase();
    let sId = sessionId;
    model = safeModel(model);
    // O id vai no caminho da URL: só o formato do opencode (ses_ + alfanumérico) é aceito.
    const isValidOpencodeSession = typeof sId === "string" && /^ses_[A-Za-z0-9]{1,64}$/.test(sId);

    // Se não há sessão válida, cria uma no opencode
    if (!isValidOpencodeSession) {
      const sRes = await ocFetch(`${base}/session`, {
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
      const initRes = await ocFetch(`${base}/session/${sId}/message`);
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
    let pRes = await ocFetch(`${base}/session/${sId}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPromptBody()),
    });

    // Se a sessão foi rejeitada (ex.: sessão antiga/inválida), cria nova e retenta
    if (!pRes.ok) {
      const sResNew = await ocFetch(`${base}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (sResNew.ok) {
        const sDataNew = await sResNew.json();
        sId = sDataNew.id;
        initialMsgCount = 0;
        pRes = await ocFetch(`${base}/session/${sId}/prompt_async`, {
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
        ocFetch(`${base}/session/${sId}/abort`, { method: "POST" }).catch(() => {});
        return;
      }

      const now = Date.now();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        throw new PublicError("Tempo limite de inatividade excedido (OpenCode sem novos dados por mais de 3 minutos)");
      }
      if (now - startTime > MAX_TOTAL_TIMEOUT_MS) {
        throw new PublicError("Tempo limite total excedido aguardando resposta do OpenCode (15 minutos)");
      }

      const mRes = await ocFetch(`${base}/session/${sId}/message`);
      if (!mRes.ok) continue;
      const msgs = await mRes.json();
      if (!Array.isArray(msgs)) continue;

      // Candidatos: apenas mensagens criadas após o início do turno atual
      const candidateMsgs = msgs.slice(initialMsgCount);

      // Procura a última mensagem do assistente criada após o início do prompt
      let totalReasoning = "";
      let totalText = "";
      let isAnyActive = false;
      let hasError = null;

      for (const m of candidateMsgs) {
        if (m.info?.role !== "assistant") continue;
        if (m.info?.error) {
          hasError = m.info.error.message || m.info.error.name || "Erro no OpenCode";
        }
        if (!m.info?.time?.completed) isAnyActive = true;

        if (Array.isArray(m.parts)) {
          for (const part of m.parts) {
            if (part.type === "reasoning" && part.text) totalReasoning += part.text;
            else if (part.type === "text" && part.text) totalText += part.text;
            else if (part.type === "tool") lastActivity = Date.now(); // modelo chamando tool mantém atividade viva
          }
        }
      }

      if (hasError) throw new PublicError(`OpenCode erro: ${hasError}`);

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

      const lastAss = [...candidateMsgs].reverse().find((m) => m.info && m.info.role === "assistant");
      if (lastAss && lastAss.info?.time?.completed && !isAnyActive) {
        completed = true;

        // Detecta término por estouro de cota de tokens (ex: 32k tokens em raciocínio) sem texto de saída
        if (Array.isArray(lastAss.parts)) {
          const stepFinish = lastAss.parts.find((p) => p.type === "step-finish");
          const finishReason = stepFinish?.reason || lastAss.info?.finish;
          if (finishReason === "length" && !totalText.trim()) {
            throw new PublicError("O modelo esgotou a cota máxima de tokens (32k) em raciocínio interno antes de produzir o código. Tente simplificar o pedido inicial ou pedir uma tela por vez.");
          }
        }
      }
    } // fim while

    onDone({ sessionId: sId, fullText: accumulatedText });
  } catch (err) {
    if (err && err.message === "fetch failed") invalidateOpenCodeUrl(); // servidor caiu: revalida na próxima chamada
    onError(err);
  }
}

// Modelos que o servidor do opencode oferece, com os conhecidos (os do catálogo) primeiro, na ordem do catálogo.
async function fetchModels(base, knownIds) {
  try {
    const res = await ocFetch(`${base}/api/model`, { signal: AbortSignal.timeout(2000) });
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
  let base = DEFAULT_URL;
  let available = false;
  let reason;
  try {
    base = await resolveBase();
    const res = await ocFetch(`${base}/session`, { signal: AbortSignal.timeout(2000) });
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

  const models = (available && await fetchModels(base, catalog.models.map((m) => m.id))) || catalog.models;
  const port = new URL(base).port || (base.startsWith("https") ? "443" : "80");
  return { available, url: base, auth: `Servidor local (Porta ${port})`, defaultModel: models[0]?.id || catalog.defaultModel, models, ...(reason ? { reason } : {}) };
}

/** @type {import("../types").Engine} */
const engine = { id: "opencode", stream: streamOpenCode, status };

module.exports = engine;
