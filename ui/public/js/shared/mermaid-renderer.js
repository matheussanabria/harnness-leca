// @ts-check
// Mermaid Dynamic Renderer with Dark Theme and Safe Strict Execution (ADR-014)

let mermaidLoadingPromise = null;

/**
 * Garante que a biblioteca Mermaid esteja carregada no navegador.
 * Carrega dinamicamente /js/vendor/mermaid.min.js sob demanda.
 * @returns {Promise<any>}
 */
export function ensureMermaid() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (mermaidLoadingPromise) return mermaidLoadingPromise;

  mermaidLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="mermaid"]');
    if (existing && window.mermaid) {
      resolve(window.mermaid);
      return;
    }
    const script = document.createElement("script");
    script.src = "/js/vendor/mermaid.min.js";
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        try {
          window.mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "strict",
            fontFamily: "system-ui, -apple-system, sans-serif",
            themeVariables: {
              darkMode: true,
              background: "#14171f",
              primaryColor: "#1e293b",
              primaryTextColor: "#f1f5f9",
              primaryBorderColor: "#3b82f6",
              lineColor: "#64748b",
              secondaryColor: "#0f172a",
              tertiaryColor: "#1e1e2e",
            },
          });
        } catch {
          // ignore already initialized
        }
        resolve(window.mermaid);
      } else {
        reject(new Error("Mermaid library failed to initialize"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load /js/vendor/mermaid.min.js"));
    document.head.appendChild(script);
  });

  return mermaidLoadingPromise;
}

/**
 * Renderiza todos os nos .mermaid encontrados dentro de um elemento raiz.
 * @param {HTMLElement} root
 * @returns {Promise<number>} Quantidade de diagramas processados
 */
export async function renderMermaidInContainer(root) {
  if (!root) return 0;
  const nodes = root.querySelectorAll(".mermaid:not([data-processed='true'])");
  if (!nodes.length) return 0;

  try {
    const mermaid = await ensureMermaid();
    if (!mermaid) return 0;

    let processedCount = 0;
    for (const node of nodes) {
      const el = /** @type {HTMLElement} */ (node);
      const rawText = (el.dataset.source || el.textContent || "").trim();
      if (!rawText) continue;

      el.setAttribute("data-processed", "true");
      el.dataset.source = rawText;
      const id = "m-" + Math.random().toString(36).slice(2, 9);

      try {
        const result = await mermaid.render(id, rawText);
        el.innerHTML = result.svg || result;
        processedCount++;
      } catch (err) {
        el.innerHTML =
          `<div class="mermaid-error"><i class="fa-solid fa-triangle-exclamation"></i> ` +
          `<span>Erro ao renderizar diagrama: ${(err && err.message) || "Sintaxe invalida"}</span></div>` +
          `<pre class="code-block-content"><code>${rawText}</code></pre>`;
      }
    }
    return processedCount;
  } catch (err) {
    console.warn("Mermaid execution error:", err);
    return 0;
  }
}
