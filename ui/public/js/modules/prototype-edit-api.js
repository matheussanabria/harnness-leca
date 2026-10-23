// @ts-check
/**
 * Chamada única ao endpoint de edição direta (`edit/apply`) usada pelo painel de propriedades,
 * pelo arrastar do canvas e pela árvore de camadas. As gravações vão em fila para não se atropelarem.
 */
import { showToast } from "../shared/dom.js";
import { refreshHistorySoon } from "./prototype-history-panel.js";

/** Avisa de HTML quebrado (tag sem par, data-pid repetido) criado pela alteração; o histórico permite desfazer. */
function warn(data) {
  if (data && Array.isArray(data.warnings) && data.warnings.length) showToast(`Atenção: ${data.warnings.slice(0, 3).join("; ")}. Ctrl+Z desfaz.`);
}

let chain = Promise.resolve();

/**
 * @param {{ slug: string, protoId: string, screenId: string, pid: string, op: object }} input
 * @returns {Promise<{ ok: boolean, error?: string, rule?: string, cls?: string }>}
 */
export function applyStructural({ slug, protoId, screenId, pid, op }) {
  const run = async () => {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/structural`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid, op }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { refreshHistorySoon(); warn(data); }
      return res.ok ? { ok: true, ...data } : { ok: false, error: data.error || `Falha HTTP ${res.status}` };
    } catch {
      return { ok: false, error: "Falha de rede ao gravar a alteração." };
    }
  };
  const next = chain.then(run, run);
  chain = next.then(() => undefined, () => undefined);
  return next;
}

export function applyEdit({ slug, protoId, screenId, pid, op }) {
  const run = async () => {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid, op }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { refreshHistorySoon(); warn(data); }
      return res.ok ? { ok: true, ...data } : { ok: false, error: data.error || `Falha HTTP ${res.status}` };
    } catch {
      return { ok: false, error: "Falha de rede ao gravar a edição." };
    }
  };
  const next = chain.then(run, run);
  chain = next.then(() => undefined, () => undefined);
  return next;
}
