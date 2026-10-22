// @ts-check
/** Regras puras da exclusão de protótipos (sem DOM), para testar em Node. */

/**
 * Texto do diálogo de confirmação.
 * @param {{ id: string, title?: string, kind?: string }} item
 */
export function deleteConfirmText(item) {
  const name = item.title || item.id;
  const atelier = item.kind === "atelier";
  return {
    title: `Excluir "${name}"?`,
    body: atelier
      ? "A pasta do protótipo (telas, estilos e componentes extraídos) sai do catálogo e vai para a lixeira do projeto, em design/prototypes/.trash. Dá para recuperar movendo a pasta de volta."
      : "A entrada sai do catálogo (design/design.json). O arquivo HTML original não é apagado.",
    confirmLabel: "Excluir protótipo",
  };
}

/**
 * Próximo item a abrir depois de excluir. Mantém o ativo se não foi o excluído; senão, o vizinho mais próximo.
 * @param {Array<{ id: string, kind: string }>} catalog catálogo antes da exclusão
 * @param {string} deletedId
 * @param {string} activeId
 * @returns {{ id: string, kind: string } | null}
 */
export function pickAfterDelete(catalog, deletedId, activeId) {
  const rest = catalog.filter((item) => item.id !== deletedId);
  if (!rest.length) return null;
  if (activeId && activeId !== deletedId) {
    const keep = rest.find((item) => item.id === activeId);
    if (keep) return { id: keep.id, kind: keep.kind };
  }
  const index = catalog.findIndex((item) => item.id === deletedId);
  const next = rest[Math.min(Math.max(index, 0), rest.length - 1)];
  return { id: next.id, kind: next.kind };
}

/** @param {string} slug @param {string} protoId */
export function deleteUrl(slug, protoId) {
  return `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/delete`;
}
