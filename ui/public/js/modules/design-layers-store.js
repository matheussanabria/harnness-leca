// @ts-check
// Estado compartilhado de design-layers (mutável, importado pelos módulos).

export const dls = {
  currentScreensData: null,
  storyFiles: null, // resposta de GET /design/story-files (historia -> arquivos do git)
  docsRefs: null, // GET /docs/refs: reference index of doc/ (null when the project has no doc/)
  activeScreenId: null,
  activeAudience: "all", // 'all' | 'user' | 'product' | 'dev' | 'qa'
  activeLayer: "ui", // 'ui' | 'rules' | 'api' | 'data' | 'tests' | 'legacy'
  focusedFieldId: null,
  filterOnlyFocused: false,
};
