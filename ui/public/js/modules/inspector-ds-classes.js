// @ts-check

/**
 * Catálogo e sugestão de classes do Design System Procempa (ds.css)
 */

let cachedClasses = [];
let currentLoadedSlug = "";

/**
 * Carrega a lista de classes do design system do backend.
 * @param {string} slug
 * @returns {Promise<string[]>}
 */
export async function loadDsClasses(slug) {
  if (currentLoadedSlug === slug && cachedClasses.length > 0) {
    return cachedClasses;
  }
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/inspect/ds-classes`);
    const data = await res.json();
    if (data.classes && Array.isArray(data.classes)) {
      cachedClasses = data.classes;
      currentLoadedSlug = slug;
    }
  } catch (err) {
    console.warn("[inspector/ds-classes]", err);
  }
  return cachedClasses;
}

/**
 * Retorna as classes cacheadas.
 * @returns {string[]}
 */
export function getDsClasses() {
  return cachedClasses;
}

/**
 * Filtra classes por prefixo ou termo digitado.
 * @param {string} query
 * @param {number} [limit]
 * @returns {string[]}
 */
export function filterDsClasses(query, limit = 15) {
  if (!query || !query.trim()) return cachedClasses.slice(0, limit);
  const q = query.trim().toLowerCase();
  return cachedClasses.filter((c) => c.toLowerCase().includes(q)).slice(0, limit);
}
