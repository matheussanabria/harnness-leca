// @ts-check
// Motor 2: opencode (REST HTTP no servidor local que já está rodando).
const { PublicError, safeModel, getProjectContext } = require("./common");

const DEFAULT_URL = "http://localhost:63186";
// Lido a cada uso (e não ao carregar o módulo): assim OPENCODE_URL vindo de global/.env também vale.
const baseUrl = () => process.env.OPENCODE_URL || DEFAULT_URL;

/** @param {import("../types").EngineRequest} req */
async function streamOpenCode({ prompt, slug, sessionId, model, effort, signal, onChunk, onDone, onError }) {
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
      fullPrompt = `[Esforço de raciocínio: Low / Baixo. Responda diretamente, de forma concisa e rápida]\n\n${fullPrompt}`;
    } else if (effort === "high") {
      fullPrompt = `[Esforço de raciocínio: High / Alto. Raciocine passo a passo em profundidade antes da resposta final]\n\n${fullPrompt}`;
    }
    if (!isValidOpencodeSession) {
      const ctx = getProjectContext(slug);
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

    while (!completed) {
      await new Promise((r) => setTimeout(r, 200));
      // Cliente saiu: para de consultar e pede ao opencode para interromper a geração (melhor esforço).
      if (signal && signal.aborted) {
        fetch(`${base}/session/${sId}/abort`, { method: "POST" }).catch(() => {});
        return;
      }
      if (Date.now() - startTime > 120000) throw new PublicError("Tempo limite excedido aguardando resposta do OpenCode");

      const mRes = await fetch(`${base}/session/${sId}/message`);
      if (!mRes.ok) continue;
      const msgs = await mRes.json();
      if (!Array.isArray(msgs)) continue;

      // Procura a última mensagem do assistente criada após o início do prompt
      const candidateMsgs = msgs.slice(initialMsgCount);
      const lastAss = [...candidateMsgs].reverse().find((m) => m.info && m.info.role === "assistant");
      if (lastAss && Array.isArray(lastAss.parts)) {
        let totalReasoning = "";
        let totalText = "";

        for (const part of lastAss.parts) {
          if (part.type === "reasoning" && part.text) totalReasoning += part.text;
          else if (part.type === "text" && part.text) totalText += part.text;
        }

        if (totalReasoning.length > accumulatedThinking.length) {
          const delta = totalReasoning.slice(accumulatedThinking.length);
          accumulatedThinking = totalReasoning;
          onChunk({ type: "thinking", text: delta, sessionId: sId });
        }
        if (totalText.length > accumulatedText.length) {
          const delta = totalText.slice(accumulatedText.length);
          accumulatedText = totalText;
          onChunk({ type: "text", text: delta, sessionId: sId });
        }

        if (lastAss.info.time && lastAss.info.time.completed) {
          completed = true;
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
