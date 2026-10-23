// @ts-check
/**
 * Chamada única ao endpoint de edição direta (`edit/apply`) usada pelo painel de propriedades,
 * pelo arrastar do canvas e pela árvore de camadas. As gravações vão em fila para não se atropelarem.
 */
import { logAtelierAction } from "./prototype-atelier-state.js";

let chain = Promise.resolve();

/**
 * @param {{ slug: string, protoId: string, screenId: string, pid: string, op: object }} input
 * @returns {Promise<{ ok: boolean, error?: string, rule?: string, cls?: string }>}
 */
export function applyEdit({ slug, protoId, screenId, pid, op }) {
  const run = async () => {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid, op }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) void logAtelierAction("aplicar edição", `${protoId}/${screenId}/${pid}`.slice(0, 120));
      return res.ok ? { ok: true, ...data } : { ok: false, error: data.error || `Falha HTTP ${res.status}` };
    } catch {
      return { ok: false, error: "Falha de rede ao gravar a edição." };
    }
  };
  const next = chain.then(run, run);
  chain = next.then(() => undefined, () => undefined);
  return next;
}
