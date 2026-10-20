// @ts-check
import { dls } from "../design-layers-store.js";

/**
 * Status semânticos padronizados com rótulo, cor e classe.
 */
export const STATUS_MAP = {
  ok: { label: "Implementado", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", class: "status-ok" },
  mock: { label: "Mock / provisório", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", class: "status-mock" },
  div: { label: "Diverge", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", class: "status-div" },
  conf: { label: "A confirmar", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", class: "status-conf" },
  pend: { label: "A confirmar", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", class: "status-conf" },
  proto: { label: "Só no protótipo", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)", class: "status-proto" },
  cod: { label: "Só no código", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", class: "status-cod" },
  nao: { label: "Não implementado", color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", class: "status-nao" },
};

/**
 * Classificações de legado lado a lado.
 */
export const LEGACY_PARITY_MAP = {
  igual: { label: "Igual ao legado", color: "#10b981", badge: "IGUAL" },
  dif: { label: "Diferente de propósito", color: "#3b82f6", badge: "DIFERENTE" },
  falta: { label: "Falta implementar", color: "#ef4444", badge: "FALTA" },
  fora: { label: "Fora de escopo", color: "#64748b", badge: "FORA" },
};

/**
 * As 6 Camadas com título e subtítulo explicativo.
 */
export const LAYERS_NAV = [
  { id: "ui", num: "1", title: "UI e UX", subtitle: "Elementos da tela, componentes e estados" },
  { id: "rules", num: "2", title: "Regras de negócio", subtitle: "Validações, fontes e lógica de aplicação" },
  { id: "api", num: "3", title: "API e serviços", subtitle: "Endpoints REST, chamadas e contratos" },
  { id: "data", num: "4", title: "Dados", subtitle: "Entidades, DTOs e mapeamento até o banco" },
  { id: "tests", num: "5", title: "Testes e BDD", subtitle: "Cobertura de regras e cenários automatizados" },
  { id: "legacy", num: "6", title: "Legado", subtitle: "Comparação lado a lado com sistema anterior" },
];

/**
 * Calcula a contagem real de status para uma tela/etapa específica.
 * @param {any} sc
 * @returns {Array<{ key: string, label: string, count: number, pct: number, color: string }>}
 */
export function calculateStatusMetrics(sc) {
  if (!sc) return [];
  const counts = { ok: 0, mock: 0, div: 0, conf: 0, proto: 0, cod: 0, nao: 0 };
  let total = 0;

  // Soma campos
  (sc.fields || []).forEach((f) => {
    const st = f.ui?.st || "ok";
    if (st in counts) { counts[st]++; total++; }
    else if (st === "pend") { counts.conf++; total++; }
    else { counts.ok++; total++; }
  });

  // Soma regras
  (sc.rules || []).forEach((r) => {
    const st = r.st || "ok";
    if (st in counts) { counts[st]++; total++; }
    else { counts.ok++; total++; }
  });

  // Soma endpoints
  (sc.endpoints || []).forEach((e) => {
    const st = e.st || "ok";
    if (st in counts) { counts[st]++; total++; }
    else { counts.ok++; total++; }
  });

  if (total === 0) return [];

  const keys = ["ok", "mock", "div", "conf", "proto", "cod", "nao"];
  return keys
    .filter((k) => counts[k] > 0)
    .map((k) => ({
      key: k,
      label: STATUS_MAP[k]?.label || k,
      count: counts[k],
      pct: Math.round((counts[k] / total) * 100),
      color: STATUS_MAP[k]?.color || "#64748b",
    }));
}
