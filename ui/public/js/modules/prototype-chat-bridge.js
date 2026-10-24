// @ts-check
// Liga o chat do Studio ao Ateliê: instrui o modelo sobre o protótipo aberto e grava a resposta nele.
import { showToast } from "../shared/dom.js";
import { logAtelierAction } from "./prototype-atelier-state.js";
import { buildQualityRules, directionsReminder, loadQualityContext, parseQualityCommand } from "./prototype-prompt-quality.js";

/** @type {{ slug: string, protoId: string, getScreen: () => string, reload: () => void, mcpServer?: string } | null} */
let active = null;

/** Ativa (ou desativa, com null) o modo Ateliê para o chat. */
export function setAtelierChatContext(ctx) {
  active = ctx;
}

export function isAtelierChatActive() {
  return !!active;
}

const RULES = `Você está no Ateliê de Protótipos do harness. Gere/edite o protótipo respondendo com blocos de arquivo neste formato exato (sem usar ferramentas de arquivo):
<arquivo caminho="screens/home.html">
...HTML (apenas o fragmento do corpo, sem <html>/<head>/<script>/handlers on*)...
</arquivo>
<arquivo caminho="styles/proto.css">
...CSS...
</arquivo>
Caminhos permitidos: screens/<id>.html, styles/proto.css, data/*.json. Reescreva o arquivo inteiro quando alterá-lo. Depois dos blocos, explique em 1-2 frases o que mudou.`;

/** Último contexto enviado ao motor: evita repetir regras e código a cada mensagem de uma sessão retomada. */
let sent = null;

/** Hash curto (djb2) para saber se o código do protótipo mudou desde o último envio. */
function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h);
}

/** Esquece o que já foi enviado (próxima mensagem leva regras e código completos). */
export function resetAtelierPromptState() {
  sent = null;
}

/**
 * Monta o prompt do Ateliê. Sessão nova (ou outro protótipo): regras + código atual da tela.
 * Sessão retomada: só o pedido, e o código apenas se a tela ou o arquivo mudou desde o último envio.
 * @param {string} text
 * @param {{ resumed?: boolean }} [opts] resumed = o motor retoma uma sessão que já recebeu as regras
 * @returns {Promise<string>}
 */
export async function wrapAtelierPrompt(text, opts = {}) {
  if (!active) return text;
  const { slug, protoId } = active;
  const screen = active.getScreen();
  let html = "";
  let css = "";
  let loaded = false;
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}`);
    const data = await res.json();
    const f = data.files || {};
    html = f[`screens/${screen}.html`] || "";
    css = f["styles/proto.css"] || "";
    loaded = true;
  } catch {}
  const hash = hashText(`${html}\u0000${css}`);
  const fresh = !opts.resumed || !sent || sent.protoId !== protoId;
  const changed = loaded && (fresh || sent.screen !== screen || sent.hash !== hash);
  if (loaded) sent = { protoId, screen, hash };
  else if (fresh) sent = null;
  // Opt-in quality prompt (project profile flag). Off keeps the legacy prompt below exactly as before.
  const cmd = parseQualityCommand(text);
  const quality = fresh || cmd.mode === "directions" ? await loadQualityContext(slug) : { enabled: false };
  if (quality.reason === "design-system-missing") showToast("Quality prompt is on but the Design System is not imported for this project. Using the standard prompt.");
  const q = quality.enabled;
  const directions = q && cmd.mode === "directions";
  const request = q ? cmd.text : text;
  if (!fresh && !changed) return directions ? `${directionsReminder()}\n\nUser request:\n${request}` : text;

  const blocks = `<arquivo caminho="screens/${screen}.html">\n${html}\n</arquivo>\n<arquivo caminho="styles/proto.css">\n${css}\n</arquivo>`;
  const code = q
    ? `Prototype: ${protoId} (active screen: ${screen})\nCurrent code:\n${blocks}`
    : `Protótipo: ${protoId} (tela ativa: ${screen})\nCódigo atual:\n${blocks}`;
  if (!fresh) {
    if (!q) return `O protótipo mudou desde a última mensagem.\n${code}\n\nPedido do usuário:\n${text}`;
    return `The prototype changed since the last message.\n${code}${directions ? `\n\n${directionsReminder()}` : ""}\n\nUser request:\n${request}`;
  }
  const mcpRule = active.mcpServer
    ? `\n\nAntes de criar ou alterar markup, consulte o MCP ${active.mcpServer}. Use plan_screen para planejar e get_component_kit/get_boilerplate para reutilizar os componentes existentes; não invente componentes equivalentes.`
    : "";
  if (q) return `${buildQualityRules(quality, directions ? "directions" : "compose")}${mcpRule}${loaded ? `\n\n${code}` : ""}\n\nUser request:\n${request}`;
  return `${RULES}${mcpRule}${loaded ? `\n\n${code}` : ""}\n\nPedido do usuário:\n${text}`;
}

/** Lista curta dos caminhos gravados, usada como alvo da ação registrada. */
function prototypeFilesTarget(fullText) {
  const paths = [...String(fullText || "").matchAll(/caminho="([^"]+)"/g)].map((match) => match[1]);
  return (paths.join(", ") || "protótipo").slice(0, 120);
}

/**
 * Grava no protótipo os blocos <arquivo> da resposta e recarrega o canvas.
 * @param {string} fullText
 */
export async function applyAtelierReply(fullText) {
  if (!active || !/<\s*arquivo\s+caminho/i.test(fullText || "")) return;
  const { slug, protoId } = active;
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawResponse: fullText, engine: "chat", message: "Atualização via chat do Ateliê" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    void logAtelierAction("salvar arquivo", prototypeFilesTarget(fullText));
    showToast(`Protótipo atualizado (v${data.version})`);
    active.reload();
  } catch (err) {
    showToast("Falha ao gravar o protótipo: " + (err.message || err));
  }
}

/** Retorna o contexto ativo do Ateliê se houver. */
export function getAtelierChatContext() {
  return active;
}

/**
 * Grava um único arquivo no protótipo ativo e recarrega o canvas.
 * @param {string} filePath
 * @param {string} content
 */
export async function applySingleFileToAtelier(filePath, content) {
  if (!active) {
    showToast("Nenhum protótipo ativo no Ateliê para aplicar este arquivo.");
    return;
  }
  const { slug, protoId } = active;
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: filePath, content }],
        engine: "chat",
        message: `Atualização individual de ${filePath}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    void logAtelierAction("salvar arquivo", filePath);
    showToast(`Arquivo ${filePath} aplicado com sucesso (v${data.version})`);
    active.reload();
  } catch (err) {
    showToast("Falha ao aplicar arquivo: " + (err.message || err));
  }
}
