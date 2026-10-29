// @ts-check
// Referência de modelo do opencode: "provedor/modelo" (ex.: 9router/Harness) aponta para um provedor do opencode.json;
// um id sem provedor continua indo para o provedor embutido "opencode".

/** @param {string} model */
function toModelRef(model) {
  const i = model.indexOf("/");
  if (i > 0 && i < model.length - 1) return { providerID: model.slice(0, i), modelID: model.slice(i + 1) };
  return { providerID: "opencode", modelID: model };
}

module.exports = { toModelRef };
