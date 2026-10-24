// @ts-check
// Rotas de design, protótipos e Design System (EP-11.01: extração para liberar o teto do router).
const {
  apiProjectDesignProfileGet,
  apiProjectDesignProfileDetect,
  apiProjectDesignProfileSave,
  apiProjectDesignIndex,
  apiProjectDesignLayers,
  apiProjectDesignFile,
  apiProjectDesignPrototype,
  apiProjectDesignScreens,
  apiProjectDesignAudit,
} = require("../controllers/design.controller");
const {
  apiRegistryList,
  apiRegistryGetComponent,
  apiRegistryPreviewComponent,
  apiRegistryExtractPilot,
} = require("../controllers/design-registry.controller");
const { apiRegistryComponentSource, apiPrototypeComponents } = require("../controllers/prototype-components.controller");
const {
  apiPrototypesList,
  apiPrototypesCreate,
  apiPrototypesImportArtifact,
  apiPrototypesGet,
  apiPrototypesRender,
  apiPrototypesSaveFiles,
  apiPrototypesVersionsGet,
  apiPrototypesVersionRestore,
  apiPrototypesEditPreview,
  apiPrototypesEditApply,
  apiPrototypesEditUndo,
  apiPrototypesEditStructural,
  apiPrototypesExtractComponent,
  apiPrototypesExportSingleHtml,
} = require("../controllers/prototype.controller");
const { apiPrototypeTraceability } = require("../controllers/prototype-traceability.controller");
const { apiAtelierQualityContext } = require("../controllers/atelier-quality.controller");
const { apiPrototypesUnextractComponent, apiPrototypesDelete } = require("../controllers/prototype-component.controller");
const {
  apiPrototypesHistoryList,
  apiPrototypesHistoryUndo,
  apiPrototypesHistoryRedo,
  apiPrototypesHistoryGoto,
  apiPrototypesHistoryCheckpoint,
} = require("../controllers/prototype-history.controller");

const designRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/profile$/, handler: apiProjectDesignProfileGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/profile\/detect$/, handler: apiProjectDesignProfileDetect },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/profile$/, handler: apiProjectDesignProfileSave },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/index$/, handler: apiProjectDesignIndex },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/screens$/, handler: apiProjectDesignScreens },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/audit$/, handler: apiProjectDesignAudit },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/layers$/, handler: apiProjectDesignLayers },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/file$/, handler: apiProjectDesignFile },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/registry$/, handler: apiRegistryList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/registry\/extract-pilot$/, handler: apiRegistryExtractPilot },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/registry\/([\w.-]+)\/preview$/, handler: apiRegistryPreviewComponent },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/registry\/([\w.-]+)\/source$/, handler: apiRegistryComponentSource },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/registry\/([\w.-]+)$/, handler: apiRegistryGetComponent },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes$/, handler: apiPrototypesList },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/atelier\/quality-context$/, handler: apiAtelierQualityContext },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes$/, handler: apiPrototypesCreate },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/import-artifact\/([\w-]+)$/, handler: apiPrototypesImportArtifact },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)$/, handler: apiPrototypesGet },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/components$/, handler: apiPrototypeComponents },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/render(?:\/([\w-]+))?$/, handler: apiPrototypesRender },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/files$/, handler: apiPrototypesSaveFiles },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/preview$/, handler: apiPrototypesEditPreview },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/apply$/, handler: apiPrototypesEditApply },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/undo$/, handler: apiPrototypesEditUndo },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/structural$/, handler: apiPrototypesEditStructural },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/extract-component$/, handler: apiPrototypesExtractComponent },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/export\/single-html$/, handler: apiPrototypesExportSingleHtml },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/traceability$/, handler: apiPrototypeTraceability },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/unextract-component$/, handler: apiPrototypesUnextractComponent },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/delete$/, handler: apiPrototypesDelete },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/versions$/, handler: apiPrototypesVersionsGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/versions\/(\d+)\/restore$/, handler: apiPrototypesVersionRestore },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/history$/, handler: apiPrototypesHistoryList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/history\/undo$/, handler: apiPrototypesHistoryUndo },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/history\/redo$/, handler: apiPrototypesHistoryRedo },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/history\/goto$/, handler: apiPrototypesHistoryGoto },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/history\/checkpoint$/, handler: apiPrototypesHistoryCheckpoint },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/design\/prototype(?:\/([\w-]+)(?:\/(.*))?)?$/, handler: apiProjectDesignPrototype },
];

module.exports = { designRoutes };
