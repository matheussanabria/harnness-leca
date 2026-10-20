// @ts-check
// Parse das SCREENS de um Mapa em camadas HTML.
const fs = require("fs");
const vm = require("vm");

/**
 * Faz parse seguro das SCREENS contidas em um arquivo Mapa em camadas DIS.html.
 * @param {string} htmlPath
 * @returns {any[] | null}
 */
function parseScreensFromCanvasHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return null;

  try {
    const content = fs.readFileSync(htmlPath, "utf8");
    const startIdx = content.indexOf("const SCREENS = [];");
    const endIdx = content.indexOf("var REPLICAS =");

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      let code = content.substring(startIdx, endIdx);
      code = code
        .replace(/const\s+SCREENS\s*=/, "var SCREENS =")
        .replace(/const\s+LEGACY\s*=/, "var LEGACY =")
        .replace(/const\s+TESTS\s*=/, "var TESTS =");

      const sandbox = {};
      vm.createContext(sandbox);
      vm.runInContext(code, sandbox, { timeout: 2000 });

      if (Array.isArray(sandbox.SCREENS) && sandbox.SCREENS.length > 0) {
        sandbox.SCREENS.forEach((s) => {
          if (sandbox.TESTS && sandbox.TESTS[s.id]) {
            s.tests = sandbox.TESTS[s.id];
          }
          if (sandbox.LEGACY && sandbox.LEGACY[s.id]) {
            s.legacy = sandbox.LEGACY[s.id];
          }
        });
        return sandbox.SCREENS;
      }
    }

    // Fallback: busca por pushes individuais
    const matches = content.match(/SCREENS\.push\([\s\S]*?\n\}\);/g);
    if (!matches || matches.length === 0) return null;

    const sandbox = { SCREENS: [] };
    vm.createContext(sandbox);

    for (const statement of matches) {
      try {
        vm.runInContext(statement, sandbox, { timeout: 1000 });
      } catch (err) {}
    }

    if (Array.isArray(sandbox.SCREENS) && sandbox.SCREENS.length > 0) {
      return sandbox.SCREENS;
    }
  } catch (err) {
    console.error("[project-screens] Erro ao parsear SCREENS do Canvas HTML:", err.message);
  }

  return null;
}

module.exports = { parseScreensFromCanvasHtml };
