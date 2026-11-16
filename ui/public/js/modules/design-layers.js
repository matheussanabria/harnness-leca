// @ts-check
// Fachada de design-layers: reexporta a API pública dos módulos (outros arquivos importam daqui).
import { refreshLayersWorkspace } from "./design-layers-workspace.js";
import { loadStoryFiles } from "./design-layers/layers-story-files.js";
import { loadDocsRefs } from "./design-layers/docs/docs-source.js";

export { renderLayersWorkspace, refreshLayersWorkspace } from "./design-layers-workspace.js";
export { loadStoryFiles, loadDocsRefs };

/**
 * Data the Layers map loads besides the screens. The story files are awaited; the docs index can take a moment
 * on a cold disk, so it loads in the background and the map redraws when it arrives.
 * @param {string} slug
 */
export async function loadLayersExtras(slug) {
  void loadDocsRefs(slug).then(refreshLayersWorkspace);
  await loadStoryFiles(slug);
}
