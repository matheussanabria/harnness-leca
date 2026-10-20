// Motor Codex: executa o CLI local em JSONL, preservando e retomando a sessão nativa.
const cp = require("child_process");
const path = require("path");
const { ROOT } = require("../root");
const { resolveCodexBin } = require("../codex-bin");
const { PublicError, safeEffort, safeModel, getProjectContext } = require("./common");

function validSession(id) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function parseLine(line, onChunk, state) {
  let event;
  try { event = JSON.parse(line); } catch { return; }
  const payload = event.payload || {};
  if (event.type === "error") state.error = event.message || "Falha de comunicação do Codex.";
  if (event.type === "turn.failed") state.error = event.error?.message || "O turno do Codex falhou.";
  if (event.type === "session_meta" && payload.session_id) state.sessionId = payload.session_id;
  if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
    state.text += event.item.text;
    onChunk({ type: "text", text: event.item.text, sessionId: state.sessionId });
  }
  if (event.type !== "response_item" || payload.type !== "message" || payload.role !== "assistant") return;
  for (const part of payload.content || []) {
    if (part.type !== "output_text" || !part.text) continue;
    state.text += part.text;
    onChunk({ type: "text", text: part.text, sessionId: state.sessionId });
  }
}

/** @param {import("../types").EngineRequest} req */
function stream({ prompt, slug, sessionId, model, effort, daiAgent, signal, onChunk, onDone, onError }) {
  const bin = resolveCodexBin();
  if (!bin) return onError(new PublicError("Codex CLI não encontrado. Defina CODEX_BIN em global/.env."));
  const cwd = path.join(ROOT, "projects", slug);
  const args = validSession(sessionId) ? ["exec", "resume", sessionId, "--json"] : ["exec", "--json", "-C", cwd];
  const selectedModel = safeModel(model);
  if (selectedModel) args.push("--model", selectedModel);
  args.push("-c", `model_reasoning_effort=${safeEffort(effort)}`);
  const context = validSession(sessionId) ? "" : getProjectContext(slug, { daiAgent });
  args.push(`${context}\nPergunta do usuário:\n${prompt}`);
  const child = cp.spawn(bin, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  if (signal) signal.addEventListener("abort", () => child.kill(), { once: true });
  const state = { sessionId: validSession(sessionId) ? sessionId : "", text: "", error: "" };
  let buffer = "";
  child.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach((line) => parseLine(line, onChunk, state));
  });
  let stderr = "";
  child.stderr.on("data", (data) => { stderr += data.toString(); });
  child.on("error", () => onError(new PublicError("Codex CLI não encontrado no PATH.")));
  child.on("close", (code) => {
    if (buffer) parseLine(buffer, onChunk, state);
    if ((code || state.error) && !state.text) return onError(new PublicError(state.error || stderr.trim() || `Codex finalizou com código ${code}.`));
    onDone({ sessionId: state.sessionId, fullText: state.text });
  });
}

function localModels() {
  try {
    const models = require(path.join(require("os").homedir(), ".codex", "models_cache.json")).models || [];
    return models.filter((model) => model.visibility !== "hide").map((model) => ({ id: model.slug, name: model.display_name || model.slug, desc: model.description || "" }));
  } catch { return null; }
}

const engine = { id: "codex", stream, status: async (catalog) => ({ available: true, auth: catalog.auth, models: localModels() || catalog.models }) };
module.exports = engine;
