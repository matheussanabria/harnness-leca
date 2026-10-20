// @ts-check
// Liga o chat do Studio ao Ateliê: instrui o modelo sobre o protótipo aberto e grava a resposta nele.
import { showToast } from "../shared/dom.js";

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

/**
 * Prefixa o pedido do usuário com as regras e o código atual da tela.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function wrapAtelierPrompt(text) {
  if (!active) return text;
  const { slug, protoId } = active;
  const screen = active.getScreen();
  const mcpRule = active.mcpServer
    ? `\n\nAntes de criar ou alterar markup, consulte o MCP ${active.mcpServer}. Use plan_screen para planejar e get_component_kit/get_boilerplate para reutilizar os componentes existentes; não invente componentes equivalentes.`
    : "";
  let current = "";
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}`);
    const data = await res.json();
    const f = data.files || {};
    current = `\n\nProtótipo: ${protoId} (tela ativa: ${screen})\nCódigo atual:\n<arquivo caminho="screens/${screen}.html">\n${f[`screens/${screen}.html`] || ""}\n</arquivo>\n<arquivo caminho="styles/proto.css">\n${f["styles/proto.css"] || ""}\n</arquivo>`;
  } catch {}
  return `${RULES}${mcpRule}${current}\n\nPedido do usuário:\n${text}`;
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
    showToast(`Arquivo ${filePath} aplicado com sucesso (v${data.version})`);
    active.reload();
  } catch (err) {
    showToast("Falha ao aplicar arquivo: " + (err.message || err));
  }
}
