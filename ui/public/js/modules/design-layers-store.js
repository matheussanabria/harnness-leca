// @ts-check
// Estado compartilhado de design-layers (mutável, importado pelos módulos).

export const dls = {
  currentScreensData: null,
  activeScreenId: null,
  activeAudience: "all", // 'all' | 'user' | 'product' | 'dev' | 'qa'
  activeLayer: "ui", // 'ui' | 'rules' | 'api' | 'data' | 'tests' | 'legacy'
  focusedFieldId: null,
  filterOnlyFocused: false,
};
