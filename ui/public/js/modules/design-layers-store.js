// @ts-check
// Estado compartilhado de design-layers (mutável, importado pelos módulos).

export const dls = {
  currentScreensData: null,
  activeScreenId: null,
  activeLayer: "ui", // 'ui' | 'rules' | 'api' | 'data' | 'tests' | 'legacy'
  focusedFieldId: null,
  filterOnlyFocused: false,
};
