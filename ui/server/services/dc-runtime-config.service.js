// @ts-check
// Configuração do runtime Claude Design (.dc.html) aceito pelo Ateliê e verificação dos arquivos vendorizados.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ADAPTER_ID = "dc-artifact-adapter@1";
const INSPECTION_FORMAT = 3;

/** Hash do support.js vendorizado em ui/public/js/vendor/dc-runtime. Outro hash é recusado. */
const SUPPORT_SHA256 = "8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe";
const REACT_SRI = "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z";
const REACT_DOM_SRI = "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1";

/** URL pública dos arquivos vendorizados (servidos pela pasta ui/public). */
const VENDOR_URL = "/js/vendor/dc-runtime";
const VENDOR_FILES = {
  react: "react.production.min.js",
  reactDom: "react-dom.production.min.js",
  support: "support.js",
};

/** URLs que o support.js usa por padrão; o sandbox redireciona para as cópias vendorizadas. */
const DC_REACT_URL = "https://unpkg.com/react@18.3.1/umd/react.production.min.js";
const DC_REACT_DOM_URL = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js";

/** Tamanho máximo de um asset embutido no protótipo (data URI). */
const MAX_ASSET_BYTES = 512 * 1024;

/** @param {string} value */
function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Confere se o runtime vendorizado é o que o adaptador conhece.
 * @param {string} vendorDir Pasta física de ui/public/js/vendor/dc-runtime.
 */
function verifyVendoredRuntime(vendorDir) {
  /** @type {string[]} */
  const problems = [];
  const read = (name) => {
    try {
      return fs.readFileSync(path.join(vendorDir, name));
    } catch {
      problems.push(`Arquivo ausente: ${name}`);
      return null;
    }
  };
  const support = read(VENDOR_FILES.support);
  if (support && crypto.createHash("sha256").update(support).digest("hex") !== SUPPORT_SHA256) {
    problems.push("support.js não corresponde ao runtime aceito.");
  }
  const react = read(VENDOR_FILES.react);
  if (react && `sha384-${crypto.createHash("sha384").update(react).digest("base64")}` !== REACT_SRI) {
    problems.push("react.production.min.js não corresponde ao SRI esperado.");
  }
  const reactDom = read(VENDOR_FILES.reactDom);
  if (reactDom && `sha384-${crypto.createHash("sha384").update(reactDom).digest("base64")}` !== REACT_DOM_SRI) {
    problems.push("react-dom.production.min.js não corresponde ao SRI esperado.");
  }
  return { ok: problems.length === 0, problems };
}

module.exports = {
  ADAPTER_ID,
  INSPECTION_FORMAT,
  SUPPORT_SHA256,
  REACT_SRI,
  REACT_DOM_SRI,
  VENDOR_URL,
  VENDOR_FILES,
  DC_REACT_URL,
  DC_REACT_DOM_URL,
  MAX_ASSET_BYTES,
  sha256,
  verifyVendoredRuntime,
};
