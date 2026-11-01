// @ts-check
/**
 * Resolvedor puro de destinos de navegação do Ateliê (EP-16.01).
 *
 * Converte o destino bruto emitido pelo gerador (`goto:orbit`, `screens/orbit.html`, `./screens/orbit.html`,
 * `orbit.html`, `orbit`) no ID da tela e informa se ela existe. Fragmento e query são descartados.
 * Sem DOM, sem rede e sem leitura de arquivos.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const EXTERNAL_PATTERN = /^(?:https?:\/\/|mailto:|tel:)/i;
const JAVASCRIPT_PATTERN = /^javascript:/i;

/**
 * @param {"screen" | "planned" | "external" | "none"} kind
 * @param {string} screen
 */
function result(kind, screen = "") {
  return { kind, screen };
}

/**
 * Resolve um destino bruto para um ID de tela.
 * @param {unknown} target Destino cru vindo do protótipo.
 * @param {Iterable<string> | null | undefined} screenIds IDs de tela existentes (não é alterado).
 * @returns {{ kind: "screen" | "planned" | "external" | "none", screen: string }}
 */
export function resolveScreenTarget(target, screenIds) {
  const raw = typeof target === "string" ? target.trim() : "";
  if (!raw) return result("none");
  if (raw.startsWith("#") || JAVASCRIPT_PATTERN.test(raw)) return result("none");
  if (EXTERNAL_PATTERN.test(raw)) return result("external");

  const path = raw.split(/[?#]/)[0].trim();
  if (!path) return result("none");

  const screen = path
    .replace(/^goto:/i, "")
    .replace(/^\.\/+/, "")
    .replace(/^screens\//i, "")
    .replace(/\.html$/i, "")
    .trim();

  if (!ID_PATTERN.test(screen)) return result("none");

  const known = new Set(screenIds || []);
  return known.has(screen) ? result("screen", screen) : result("planned", screen);
}
