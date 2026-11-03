// @ts-check
// Streaming executor for the native Antigravity CLI (agy / agy.exe).
// Uses the user's active Google Antigravity subscription, streams NDJSON responses,
// and preserves multi-turn session continuity via --conversation <uuid>.
const path = require("path");
const cp = require("child_process");
const { ROOT } = require("../root");
const { killTree } = require("../proc-manager-core");
const { PublicError, safeModel, safeEffort, getProjectContext } = require("./common");
const { describeError, errorEvent } = require("./errors");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id) => typeof id === "string" && UUID_RE.test(id);

/**
 * Creates a streaming NDJSON parser for Antigravity events.
 * @param {{ onChunk: Function, onToolUse?: Function, onToolResult?: Function }} sinks
 * @param {string} [initialSessionId]
 */
function createAntigravityStreamParser(sinks, initialSessionId) {
  const state = {
    sessionId: isUuid(initialSessionId) ? initialSessionId : "",
    text: "",
    thinking: "",
    error: "",
    usage: null,
  };

  /** @param {string} rawLine */
  function line(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed || !trimmed.startsWith("{") || !trimmed.endsWith("}")) return;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (event.conversation_id && !state.sessionId) {
      state.sessionId = event.conversation_id;
    }

    if (event.event === "init" && event.conversation_id) {
      state.sessionId = event.conversation_id;
    }

    if (event.event === "step_update" && event.step_update) {
      const step = event.step_update;
      if (step.conversation_id && !state.sessionId) {
        state.sessionId = step.conversation_id;
      }

      if (step.step_type === "agent_response") {
        if (typeof step.text_delta === "string" && step.text_delta) {
          state.text += step.text_delta;
          sinks.onChunk({ type: "text", text: step.text_delta, sessionId: state.sessionId });
        }
        if (step.usage) state.usage = step.usage;
      } else if (step.step_type === "thinking") {
        if (typeof step.text_delta === "string" && step.text_delta) {
          state.thinking += step.text_delta;
          sinks.onChunk({ type: "thinking", text: step.text_delta, sessionId: state.sessionId });
        }
      } else if (step.step_type === "tool") {
        if (step.state === "ACTIVE" && sinks.onToolUse) {
          sinks.onToolUse({
            id: String(step.step_index),
            name: step.tool_name || "tool",
            input: step.tool_info?.parameters || {},
          });
        } else if (step.state === "DONE" && sinks.onToolResult) {
          sinks.onToolResult({
            id: String(step.step_index),
            name: step.tool_name || "tool",
            output: step.tool_info?.output,
          });
        }
      }
    }

    if (event.event === "result" && event.result) {
      const res = event.result;
      if (res.conversation_id && !state.sessionId) state.sessionId = res.conversation_id;
      if (res.status === "ERROR") {
        state.error = res.error || "Antigravity reportou falha na execução.";
      }
      if (res.response && !state.text) {
        state.text = res.response;
        sinks.onChunk({ type: "text", text: res.response, sessionId: state.sessionId });
      }
      if (res.usage) state.usage = res.usage;
    }
  }

  return { line, getState: () => state };
}

/**
 * Executes a streaming prompt turn via Antigravity CLI.
 * @param {string} bin
 * @param {import("../types").EngineRequest} req
 */
function streamAntigravity(bin, req) {
  const { prompt, slug, sessionId, model, effort, daiAgent, signal, onChunk, onDone, onError, onToolUse, onToolResult } = req;

  const validSession = isUuid(sessionId);
  const args = ["-p", "-", "--output-format", "stream-json", "--dangerously-skip-permissions"];

  if (validSession) {
    args.push("--conversation", sessionId);
  }

  const chosenModel = safeModel(model);
  if (chosenModel && chosenModel !== "default") {
    args.push("--model", chosenModel);
  }

  if (effort) {
    args.push("--effort", safeEffort(effort));
  }

  const projDir = path.join(ROOT, "projects", slug);
  const cwd = path.resolve(projDir);

  let fullPrompt = prompt;
  if (!validSession) {
    const ctx = getProjectContext(slug, { daiAgent });
    if (ctx) fullPrompt = `${ctx}\nPergunta do usuário:\n${prompt}`;
  }

  const child = cp.spawn(bin, args, {
    cwd,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (signal) {
    if (signal.aborted) killTree(child);
    else signal.addEventListener("abort", () => killTree(child), { once: true });
  }

  const parser = createAntigravityStreamParser({ onChunk, onToolUse, onToolResult }, sessionId);
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdin.write(fullPrompt);
  child.stdin.end();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";
    for (const l of lines) parser.line(l);
  });

  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
  });

  child.on("error", (err) => {
    onError(new PublicError(`Falha ao iniciar Antigravity CLI: ${err.message}`));
  });

  child.on("close", (code) => {
    if (stdoutBuffer) parser.line(stdoutBuffer);
    const state = parser.getState();

    if ((code !== 0 || state.error) && !state.text) {
      const errDetail = state.error || stderrBuffer.trim() || `Antigravity finalizou com código ${code}`;
      const info = describeError(errDetail, { engine: "gemini" });
      return onError(new PublicError(info.message || errDetail));
    }

    if (code !== 0 && stderrBuffer.trim()) {
      onChunk(errorEvent(describeError(stderrBuffer.trim(), { engine: "gemini" })));
    }

    onDone({
      sessionId: state.sessionId || sessionId,
      fullText: state.text,
      thinking: state.thinking,
      usage: state.usage,
    });
  });
}

module.exports = {
  createAntigravityStreamParser,
  streamAntigravity,
  isUuid,
};
