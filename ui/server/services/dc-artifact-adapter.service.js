// @ts-check
// Fachada do adaptador de artefatos Claude Design (.dc.html). A lógica está separada em:
// dc-runtime-config (constantes e runtime), dc-artifact-parser (leitura e validação) e
// dc-inspection-writer (gravação das partes e do manifesto).
const {
  ADAPTER_ID,
  INSPECTION_FORMAT,
  SUPPORT_SHA256,
  REACT_SRI,
  REACT_DOM_SRI,
  VENDOR_URL,
  VENDOR_FILES,
  MAX_ASSET_BYTES,
  sha256,
  verifyVendoredRuntime,
} = require("./dc-runtime-config.service");
const {
  isDcArtifact,
  decodeAttr,
  encodeAttr,
  splitDcArtifact,
  validateDcParts,
  findRelativeAssets,
} = require("./dc-artifact-parser.service");
const { readManifest, screensFromProps, writeDcInspection } = require("./dc-inspection-writer.service");

module.exports = {
  ADAPTER_ID,
  INSPECTION_FORMAT,
  SUPPORT_SHA256,
  REACT_SRI,
  REACT_DOM_SRI,
  VENDOR_URL,
  VENDOR_FILES,
  MAX_ASSET_BYTES,
  sha256,
  verifyVendoredRuntime,
  isDcArtifact,
  decodeAttr,
  encodeAttr,
  splitDcArtifact,
  validateDcParts,
  findRelativeAssets,
  readManifest,
  screensFromProps,
  writeDcInspection,
};
