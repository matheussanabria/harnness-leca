// tools/lib/engines.js
// Abstração unificada dos 3 motores de IA para o Harness Leca:
// 1. Claude Code CLI (executa no terminal usando o plano Claude Pro/Team do usuário, sem API Key)
// 2. OpenCode (conecta via HTTP/REST na porta local do opencode que já está rodando)
// 3. Gemini / Antigravity (Google AI Studio API gratuita ou Bridge local)

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");
const state = require("./state");
const { redact } = require("./redact");
const { resolveClaudeBin } = require("./claude-bin");
const { loadProjectConfig } = require("./project-mcp");

const ROOT = path.resolve(__dirname, "../..");
const OPENCODE_DEFAULT_URL = process.env.OPENCODE_URL || "http://localhost:63186";

// Valores que chegam do navegador e viram argumento de linha de comando: só formatos conhecidos passam.
const MODEL_RE = /^[a-z0-9][a-z0-9._:\/-]{0,63}$/i;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const safeModel = (m) => (typeof m === "string" && MODEL_RE.test(m) ? m : "");
const safeEffort = (e) => (EFFORTS.has(e) ? e : "medium");

// Carrega variáveis de ambiente de global/.env ou .env sob demanda
function loadEnv() {
  const envFiles = [
    path.join(ROOT, "global", ".env"),
    path.join(ROOT, "global", ".ENV"),
    path.join(ROOT, ".env"),
  ];
  for (const ef of envFiles) {
    if (fs.existsSync(ef)) {
      try {
        const content = fs.readFileSync(ef, "utf8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
            if (key) process.env[key] = val;
          }
        }
      } catch {}
    }
  }
}
loadEnv();

// Carrega instruções e memórias de um projeto para enriquecer o contexto
function getProjectContext(slug) {
  const p = state.paths(slug);
  const read = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : "");
  const globalIns = read(path.join(ROOT, "global", "instructions.md"));
  const globalMem = read(path.join(ROOT, "global", "memory.md"));
  const projIns = read(path.join(p.proj, "instructions.md"));
  const projMem = read(path.join(p.proj, "memory.md"));

  const parts = [];
  if (globalIns) parts.push(`### Instruções Globais\n${globalIns}`);
  if (globalMem) parts.push(`### Memória Global\n${globalMem}`);
  if (projIns) parts.push(`### Instruções do Projeto (${slug})\n${projIns}`);
  if (projMem) parts.push(`### Memória do Projeto (${slug})\n${projMem}`);

  return parts.length ? `\n\n<contexto_do_harness>\n${parts.join("\n\n")}\n</contexto_do_harness>\n` : "";
}

// ----------------------------------------------------
// MOTOR 1: CLAUDE CODE (via CLI com streaming)
// ----------------------------------------------------
function streamClaude({ prompt, slug, sessionId, model, effort, onChunk, onDone, onError }) {
  const projDir = path.join(ROOT, "projects", slug);
  const args = ["-p", "-", "--output-format", "stream-json", "--verbose"];
  const isClaudeUuid = sessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
  if (isClaudeUuid) {
    args.push("--resume", sessionId);
  }
  model = safeModel(model);
  if (model && model !== "default") {
    args.push("--model", model);
  }
  args.push("--effort", safeEffort(effort));
  let cwd;
  try {
    const session = claudeSession(projDir);
    cwd = session.cwd;
    args.push(...session.args);
  } catch (err) {
    return onError(err);
  }

  let fullPrompt = prompt;
  // Se for início de sessão, injeta o contexto do projeto junto ao primeiro prompt
  if (!isClaudeUuid) {
    const ctx = getProjectContext(slug);
    if (ctx) fullPrompt = `${ctx}\nPergunta do usuário:\n${fullPrompt}`;
  }

  const bin = resolveClaudeBin();
  if (!bin) return onError(new Error("Claude Code não encontrado no PATH (defina CLAUDE_BIN em global/.env)."));
  // shell:false com caminho absoluto: os argumentos não passam pelo cmd.exe e nada é buscado na pasta atual.
  const child = cp.spawn(bin, args, {
    shell: false,
    windowsHide: true,
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const parser = createClaudeStreamParser(onChunk, sessionId);
  let buffer = "";

  child.stdin.write(fullPrompt);
  child.stdin.end();

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // guarda linha incompleta
    lines.forEach(parser.line);
  });

  let errBuf = "";
  child.stderr.on("data", (d) => { errBuf += d.toString(); });

  child.on("close", (code) => {
    if (buffer) parser.line(buffer);
    if (code !== 0 && !parser.text) {
      return onError(new Error(errBuf.trim() || `Claude Code finalizou com código ${code}`));
    }
    onDone({ sessionId: parser.sessionId, fullText: parser.text });
  });

  child.on("error", onError);
}

const READ_TOOLS = ["Read", "Glob", "Grep"];
const EDIT_TOOLS = ["Edit", "Write", "NotebookEdit"];
const COMMAND_TOOLS = ["Bash", "PowerShell"];

// Onde e com que permissões o Claude roda no chat da interface (ver tools/lib/project-mcp.js).
// - Pasta de trabalho: o repo do projeto (com projects/<slug> junto, para chats e contexto) ou só projects/<slug>.
// - --restricted: ferramentas de arquivo presas às pastas de trabalho, settings do usuário e do repo ignorados,
//   bypassPermissions recusado, e escrita em configs/git/ferramentas nunca aprovada sozinha.
// - Modo "completo" (padrão): edita (acceptEdits) e roda comandos. Modo "leitura": só Read/Glob/Grep.
// - --strict-mcp-config: só os MCPs declarados no mcp.json do projeto; os do usuário e de outros ficam de fora.
function claudeSession(projDir) {
  const cfg = loadProjectConfig(projDir);
  const full = cfg.modo === "completo";
  const tools = [...READ_TOOLS, ...(full ? [...EDIT_TOOLS, ...COMMAND_TOOLS] : [])];
  const args = ["--restricted", "--tools", tools.join(","), "--strict-mcp-config"];
  if (cfg.repo) args.push("--add-dir", projDir);
  if (full) args.push("--permission-mode", "acceptEdits");

  // No -p ninguém responde a pedidos de permissão: o que não estiver liberado aqui é negado.
  const allowed = [...(full ? COMMAND_TOOLS : []), ...cfg.names.map((n) => `mcp__${n}`)];
  if (cfg.names.length) args.push("--mcp-config", JSON.stringify({ mcpServers: cfg.mcpServers }));
  if (allowed.length) args.push("--allowedTools", allowed.join(","));
  return { cwd: cfg.repo || projDir, args };
}

// Interpreta as linhas do `claude --output-format stream-json` e repassa só o trecho novo de cada bloco.
// Cada bloco (id da mensagem + índice) é acompanhado à parte: um texto novo depois de uma ferramenta
// começa do zero e não pode ser cortado pelo tamanho do texto anterior.
function createClaudeStreamParser(onChunk, initialSessionId) {
  let sessionId = initialSessionId || null;
  let text = "";
  let events = 0;
  const seen = new Map();
  const deltaOf = (key, full) => {
    const before = seen.get(key);
    seen.set(key, full.length);
    return before === undefined ? { delta: full, fresh: true } : { delta: full.slice(before), fresh: false };
  };

  function line(raw) {
    if (!raw.trim()) return;
    let d;
    try { d = JSON.parse(raw); } catch { return; } // ignora linhas que não são JSON
    if (d.session_id) sessionId = d.session_id;
    events++;

    if (d.type === "assistant" && d.message && Array.isArray(d.message.content)) {
      const msgId = d.message.id || `evt${events}`;
      d.message.content.forEach((c, i) => {
        const key = `${msgId}:${i}`;
        if (c.type === "text" && c.text) {
          let { delta, fresh } = deltaOf(key, c.text);
          if (fresh && text) delta = "\n\n" + delta;
          if (delta) {
            text += delta;
            onChunk({ type: "text", text: delta, sessionId });
          }
        } else if (c.type === "thinking" && c.thinking) {
          const { delta } = deltaOf(key, c.thinking);
          if (delta) onChunk({ type: "thinking", text: delta, sessionId });
        }
      });
    }

    if (d.type === "result" && d.result && !text) {
      text = d.result;
      onChunk({ type: "text", text: d.result, sessionId });
    }
  }

  return { line, get text() { return text; }, get sessionId() { return sessionId; } };
}

// ----------------------------------------------------
// MOTOR 2: OPENCODE (via REST HTTP local na porta 63186)
// ----------------------------------------------------
async function streamOpenCode({ prompt, slug, sessionId, model, effort, onChunk, onDone, onError }) {
  try {
    let sId = sessionId;
    model = safeModel(model);
    // O id vai no caminho da URL: só o formato do opencode (ses_ + alfanumérico) é aceito.
    const isValidOpencodeSession = typeof sId === "string" && /^ses_[A-Za-z0-9]{1,64}$/.test(sId);

    // Se não há sessão válida, cria uma no opencode
    if (!isValidOpencodeSession) {
      const sRes = await fetch(`${OPENCODE_DEFAULT_URL}/session`, {
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
      const initRes = await fetch(`${OPENCODE_DEFAULT_URL}/session/${sId}/message`);
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
    let pRes = await fetch(`${OPENCODE_DEFAULT_URL}/session/${sId}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPromptBody()),
    });

    // Se a sessão foi rejeitada (ex.: sessão antiga/inválida), cria nova e retenta
    if (!pRes.ok) {
      const sResNew = await fetch(`${OPENCODE_DEFAULT_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (sResNew.ok) {
        const sDataNew = await sResNew.json();
        sId = sDataNew.id;
        initialMsgCount = 0;
        pRes = await fetch(`${OPENCODE_DEFAULT_URL}/session/${sId}/prompt_async`, {
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
      if (Date.now() - startTime > 120000) throw new Error("Tempo limite excedido aguardando resposta do OpenCode");

      const mRes = await fetch(`${OPENCODE_DEFAULT_URL}/session/${sId}/message`);
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

// ----------------------------------------------------
// MOTOR 3: GEMINI (Google AI Studio ou Bridge)
// ----------------------------------------------------
async function streamGemini({ prompt, slug, sessionId, history, model, effort, onChunk, onDone, onError }) {
  loadEnv();
  // A chave vem só do .env: aceitá-la da requisição deixaria uma página forjada mandar o contexto do projeto para outra conta.
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  // A API do Gemini não guarda sessão: cada conversa ganha um id próprio, mantido pelo navegador entre os turnos.
  const sid = typeof sessionId === "string" && /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : crypto.randomUUID();

  if (!key) {
    // Se não tiver chave de API, grava na fila da Bridge local do Antigravity
    const bridgeDir = path.join(ROOT, "bridge");
    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });
    const item = {
      id: sid,
      data: new Date().toISOString(),
      slug,
      prompt,
      status: "recebido",
    };
    fs.appendFileSync(path.join(bridgeDir, "gemini-inbox.jsonl"), JSON.stringify(item) + "\n", "utf8");

    const note = `[✦ Modo Bridge Gemini/Antigravity]\n\nMensagem registrada na fila de processamento local (\`bridge/gemini-inbox.jsonl\`).\n\n💡 **Dica**: Para respostas instantâneas na tela do Gemini, adicione a chave do Google AI Studio em \`global/.env\` (\`GEMINI_API_KEY=...\`).`;
    onChunk({ type: "text", text: note, sessionId: item.id });
    return onDone({ sessionId: item.id, fullText: note });
  }

  try {
    const ctx = getProjectContext(slug);
    const targetModel = safeModel(model) || "gemini-3.8-flash";
    // A chave vai no header, não na URL (URLs aparecem em logs e mensagens de erro).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`;

    // Turnos anteriores da conversa (o navegador envia), para o Gemini não esquecer o que já foi dito.
    const past = (Array.isArray(history) ? history : [])
      .filter((t) => t && typeof t.text === "string" && t.text.trim())
      .slice(-40)
      .map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] }));

    const tempVal = effort === "low" ? 0.2 : effort === "high" ? 1.0 : 0.7;
    const body = {
      contents: [...past, { role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: tempVal,
        maxOutputTokens: 8192,
      },
    };
    if (ctx) {
      body.system_instruction = { parts: [{ text: `Você é o assistente Gemini do Harness Leca.\n${ctx}` }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = (await res.text()).split(key).join("[REDIGIDO]");
      throw new Error(`Google Gemini API retornou HTTP ${res.status}: ${errText}`);
    }

    let accumulatedText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const cand = parsed.candidates && parsed.candidates[0];
          if (cand && cand.content && Array.isArray(cand.content.parts)) {
            for (const part of cand.content.parts) {
              if (part.text) {
                accumulatedText += part.text;
                onChunk({ type: "text", text: part.text, sessionId: sid });
              }
            }
          }
        } catch {}
      }
    }

    onDone({ sessionId: sid, fullText: accumulatedText });
  } catch (err) {
    onError(err);
  }
}

// Salva a conversa gerada dentro de projects/<slug>/chats/ no formato padrão do Harness
function saveChatToProject({ slug, engine, title, turns, sessionId }) {
  const p = state.paths(slug);
  if (!fs.existsSync(p.chats)) fs.mkdirSync(p.chats, { recursive: true });

  // Título numa linha só: uma quebra de linha forjaria campos no cabeçalho (ex.: outro `sessao:`).
  title = String(title || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  // Como nos importadores: ":::" no início da linha fecharia o bloco antes da hora.
  const safe = (s) => String(s == null ? "" : s).replace(/^:::/gm, "::​:");

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanTitle = (title || "Conversa via Interface")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "chat";

  // Igual aos importadores: o nome leva o início do id da sessão. Salvar de novo a mesma conversa
  // regrava o mesmo arquivo; duas conversas com o mesmo título no mesmo dia não se sobrescrevem.
  const sid = typeof sessionId === "string" && /^[\w-]{1,80}$/.test(sessionId) ? sessionId : crypto.randomUUID();
  const shortId = sid.replace(/^ses_/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toLowerCase();
  const previous = fs.readdirSync(p.chats).find((f) => f.endsWith(`-${shortId}.md`) &&
    fs.readFileSync(path.join(p.chats, f), "utf8").includes(`sessao: "${sid}"`));
  const fileName = previous || `${dateStr}-${cleanTitle}-${shortId}.md`;
  const fullPath = path.join(p.chats, fileName);

  const nameOf = (e) => (e === "gemini" ? "Gemini" : e === "opencode" ? "opencode" : "Claude");
  const engineName = nameOf(engine);
  const agentTag = engine === "gemini" ? "gemini" : engine === "opencode" ? "opencode" : "claude";

  const lines = [
    "---",
    `titulo: "${(title || "Conversa via Interface").replace(/"/g, '\\"')}"`,
    `sessao: "${sid}"`,
    `agente: "${agentTag}"`,
    `inicio: "${new Date().toISOString()}"`,
    `fim: "${new Date().toISOString()}"`,
    "---",
    "",
    `# ${title || "Conversa com " + engineName}`,
    "",
  ];

  for (const t of turns) {
    // Cada resposta leva o motor que a gerou (o usuário pode trocar de motor no meio da conversa).
    lines.push(`## ${t.role === "user" ? "Você" : nameOf(t.engine || engine)}`);
    if (t.thinking) {
      lines.push(":::thinking");
      lines.push(safe(t.thinking));
      lines.push(":::");
      lines.push("");
    }
    lines.push(safe(t.text));
    lines.push("");
  }

  // Mesma redação de segredos dos importadores (o que for digitado na UI também vai para chats/).
  fs.writeFileSync(fullPath, redact(lines.join("\n")), "utf8");

  // Atualiza automaticamente o mapa e a tabela Markdown
  try {
    state.generateTableMarkdown(slug);
  } catch {}

  return { fileName, path: fullPath };
}

// Verifica disponibilidade dos 3 motores e lista modelos e parâmetros de temperatura
async function getEnginesStatus() {
  loadEnv();
  let claudeOk = false;
  try {
    const bin = resolveClaudeBin();
    const res = bin ? cp.spawnSync(bin, ["-v"], { shell: false, windowsHide: true, timeout: 3000 }) : { status: 1 };
    claudeOk = res.status === 0;
  } catch {}

  let opencodeOk = false;
  try {
    const r = await fetch(`${OPENCODE_DEFAULT_URL}/session`, { signal: AbortSignal.timeout(2000) });
    opencodeOk = r.ok;
  } catch {}

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

  let opencodeModels = [
    { id: "qwen3.6-plus-free", name: "Qwen 3.6 Plus (Rápido)", desc: "Alta velocidade e código excelente" },
    { id: "mimo-v2.6-flash-free", name: "MiMo V2.6 Flash (Thinking)", desc: "Raciocínio analítico profundo" },
    { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash", desc: "Focado em programação e lógica" },
    { id: "glm-5-free", name: "GLM 5", desc: "Equilibrado para tarefas gerais" },
    { id: "kimi-k2.5-free", name: "Kimi K2.5", desc: "Contexto longo e redação fluida" },
    { id: "cat-jam-free", name: "Cat Jam Free", desc: "Leve e sem limites de taxa" },
    { id: "grok-code", name: "Grok Code Fast 1", desc: "Especializado em engenharia de software" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning", desc: "Respostas concisas e diretas" },
  ];

  if (opencodeOk) {
    try {
      const mRes = await fetch(`${OPENCODE_DEFAULT_URL}/api/model`, { signal: AbortSignal.timeout(2000) });
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData.data) && mData.data.length > 0) {
          const priority = ["qwen3.6-plus-free", "mimo-v2.6-flash-free", "deepseek-v4-flash-free", "glm-5-free", "kimi-k2.5-free", "cat-jam-free", "grok-code", "nemotron-3.5-lightning-free"];
          const apiModels = mData.data.map(m => ({
            id: m.id,
            name: m.name || m.id,
            desc: m.id.endsWith("-free") ? "Modelo Gratuito" : (m.providerID || ""),
          }));
          apiModels.sort((a, b) => {
            const ai = priority.indexOf(a.id), bi = priority.indexOf(b.id);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.name.localeCompare(b.name);
          });
          opencodeModels = apiModels;
        }
      }
    } catch {}
  }

  return {
    claude: {
      id: "claude",
      name: "Claude Code",
      icon: "✱",
      color: "#d97757",
      available: claudeOk,
      auth: "Plano Claude Pro / Max (CLI local)",
      description: "Executa nativamente o Claude Code CLI com streaming no terminal sem custo de API",
      defaultModel: "sonnet",
      defaultEffort: "medium",
      effortLevels: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
        { id: "xhigh", label: "Extra High" },
        { id: "max", label: "Max" },
      ],
      models: [
        { id: "sonnet", name: "Sonnet 5.5 (Recomendado)", desc: "Eficiente para tarefas rotineiras e código" },
        { id: "opus", name: "Opus 5.5", desc: "Trabalhos complexos e tarefas cotidianas" },
        { id: "fable", name: "Fable 5.1", desc: "Para os desafios mais difíceis" },
        { id: "haiku", name: "Haiku 5.5", desc: "Respostas mais rápidas" },
        { id: "haiku-4.5", name: "Haiku 4.5", desc: "Respostas rápidas legado" },
        { id: "sonnet-5", name: "Sonnet 5", desc: "Eficiente para tarefas de rotina" },
      ],
    },
    opencode: {
      id: "opencode",
      name: "OpenCode",
      icon: "◆",
      color: "#7de2a3",
      available: opencodeOk,
      url: OPENCODE_DEFAULT_URL,
      auth: "Servidor local (Porta 63186)",
      description: "Conecta na porta HTTP local do OpenCode já em execução com multi-modelos",
      defaultModel: opencodeModels[0]?.id || "qwen3.6-plus-free",
      defaultEffort: "medium",
      effortLevels: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
      ],
      models: opencodeModels,
    },
    gemini: {
      id: "gemini",
      name: "Gemini / Antigravity",
      icon: "✦",
      color: "#7ca5f5",
      available: true,
      hasKey: hasGeminiKey,
      auth: hasGeminiKey ? "Google AI Studio (Gemini 3.8 / Flash)" : "Bridge Local / AI Studio Free",
      description: "Responde via Google AI Studio gratuito ou grava na fila local do Antigravity",
      defaultModel: "gemini-3.8-flash",
      defaultEffort: "medium",
      effortLevels: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
      ],
      models: [
        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Recomendado)", desc: "Geração de ponta com velocidade extrema" },
        { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", desc: "Alta performance e consistência" },
        { id: "gemini-flash-latest", name: "Gemini Flash Latest", desc: "Versão Flash mais recente do AI Studio" },
        { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", desc: "Raciocínio profundo e multimodalidade complexa" },
        { id: "gemini-pro-latest", name: "Gemini Pro Latest", desc: "Versão Pro mais recente do AI Studio" },
      ],
    },
  };
}

module.exports = {
  streamClaude,
  streamOpenCode,
  streamGemini,
  saveChatToProject,
  getEnginesStatus,
  safeModel,
  safeEffort,
  createClaudeStreamParser,
  claudeSession,
};
