// @ts-check
import { esc } from "./dom.js";

/**
 * Mapeia extensoes de arquivo para linguagem e icones FontAwesome.
 * @param {string} filePath
 * @returns {{ lang: string, icon: string }}
 */
export function getFileInfo(filePath) {
  const p = (filePath || "").toLowerCase();
  if (p.endsWith(".html") || p.endsWith(".htm")) {
    return { lang: "HTML", icon: "fa-solid fa-code" };
  }
  if (p.endsWith(".css")) {
    return { lang: "CSS", icon: "fa-solid fa-palette" };
  }
  if (p.endsWith(".js") || p.endsWith(".mjs")) {
    return { lang: "JavaScript", icon: "fa-brands fa-js" };
  }
  if (p.endsWith(".ts")) {
    return { lang: "TypeScript", icon: "fa-solid fa-file-code" };
  }
  if (p.endsWith(".json")) {
    return { lang: "JSON", icon: "fa-solid fa-database" };
  }
  if (p.endsWith(".md")) {
    return { lang: "Markdown", icon: "fa-solid fa-file-lines" };
  }
  return { lang: "", icon: "fa-solid fa-file-code" };
}

/**
 * Renderiza um card dedicado para diagramas Mermaid com preview e alternancia de codigo.
 * @param {{ content: string }} item
 * @returns {string}
 */
export function renderMermaidCard(item) {
  const content = item.content || "";
  return (
    `<div class="code-block-card mermaid-card" data-diagram="mermaid">` +
      `<div class="code-block-header">` +
        `<div class="code-block-info">` +
          `<i class="fa-solid fa-diagram-project"></i>` +
          `<span class="code-block-path">Diagrama</span>` +
          `<span class="code-block-badge">mermaid</span>` +
        `</div>` +
        `<div class="code-block-actions">` +
          `<button type="button" class="btn-code-action" onclick="toggleMermaidSource(this)" title="Alternar entre visualizacao e codigo">` +
            `<i class="fa-solid fa-code"></i><span>Codigo</span>` +
          `</button>` +
          `<button type="button" class="btn-code-action" onclick="copyCodeFromContainer(this)" title="Copiar codigo">` +
            `<i class="fa-regular fa-copy"></i><span>Copiar</span>` +
          `</button>` +
        `</div>` +
      `</div>` +
      `<div class="mermaid-diagram-wrap">` +
        `<pre class="mermaid" data-source="${esc(content)}">${esc(content)}</pre>` +
      `</div>` +
      `<pre class="code-block-content mermaid-raw-source" style="display:none;"><code>${esc(content)}</code></pre>` +
    `</div>`
  );
}

/**
 * Registra helper de toggle para alternar entre diagrama renderizado e codigo fonte Mermaid.
 */
if (typeof window !== "undefined" && !window.toggleMermaidSource) {
  window.toggleMermaidSource = function (btn) {
    const card = btn.closest(".mermaid-card");
    if (!card) return;
    const diagramWrap = card.querySelector(".mermaid-diagram-wrap");
    const rawSource = card.querySelector(".mermaid-raw-source");
    if (!diagramWrap || !rawSource) return;
    const isShowingSource = rawSource.style.display !== "none";
    if (isShowingSource) {
      rawSource.style.display = "none";
      diagramWrap.style.display = "";
      btn.innerHTML = '<i class="fa-solid fa-code"></i><span>Codigo</span>';
    } else {
      rawSource.style.display = "";
      diagramWrap.style.display = "none";
      btn.innerHTML = '<i class="fa-solid fa-diagram-project"></i><span>Diagrama</span>';
    }
  };
}

/**
 * Registra helper de copia para containers caso chat-code-actions nao esteja presente na pagina.
 */
if (typeof window !== "undefined" && !window.copyCodeFromContainer) {
  window.copyCodeFromContainer = async function (btn) {
    if (!btn) return;
    const card = btn.closest(".code-block-card");
    if (!card) return;
    const codeEl = card.querySelector(".code-block-content code") || card.querySelector("pre");
    const text = (codeEl ? codeEl.textContent : "") || "";
    try {
      await navigator.clipboard.writeText(text);
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Copiado!</span>';
      setTimeout(() => { btn.innerHTML = originalHtml; }, 1800);
    } catch {
      // clipboard fallback
    }
  };
}

/**
 * Renderiza um card de codigo moderno, elegante e acionavel.
 * @param {{ filePath?: string, lang?: string, content: string }} item
 * @returns {string}
 */
export function renderCodeCard(item) {
  if ((item.lang || "").toLowerCase() === "mermaid") {
    return renderMermaidCard(item);
  }

  const info = getFileInfo(item.filePath || "");
  const lang = item.lang || info.lang || "";
  const icon = info.icon;
  const displayTitle = item.filePath || (lang ? lang.toUpperCase() : "Codigo");
  const hasFile = Boolean(item.filePath);

  return (
    `<div class="code-block-card" data-filepath="${esc(item.filePath || "")}">` +
      `<div class="code-block-header">` +
        `<div class="code-block-info">` +
          `<i class="${icon}"></i>` +
          `<span class="code-block-path" title="${esc(item.filePath || "")}">${esc(displayTitle)}</span>` +
          (lang ? `<span class="code-block-badge">${esc(lang)}</span>` : "") +
        `</div>` +
        `<div class="code-block-actions">` +
          `<button type="button" class="btn-code-action" onclick="copyCodeFromContainer(this)" title="Copiar codigo">` +
            `<i class="fa-regular fa-copy"></i><span>Copiar</span>` +
          `</button>` +
          (hasFile
            ? `<button type="button" class="btn-code-action btn-code-apply" onclick="applySingleAtelierFile(this)" data-filepath="${esc(item.filePath || "")}" title="Aplicar ao Prototipo">` +
                `<i class="fa-solid fa-play"></i><span>Aplicar</span>` +
              `</button>`
            : "") +
        `</div>` +
      `</div>` +
      `<pre class="code-block-content"><code>${esc(item.content)}</code></pre>` +
    `</div>`
  );
}

/**
 * Extrai blocos <arquivo caminho="..."> e blocos de crases triplas.
 * Substitui cada bloco por um token nulo \u0000INDEX\u0000.
 * @param {string} text
 * @param {Array<{ filePath?: string, lang?: string, content: string }>} codeStore
 * @returns {string}
 */
export function stashCodeBlocks(text, codeStore) {
  if (!text) return "";

  // 1. Tags de arquivo: <arquivo caminho="screens/home.html">...</arquivo>
  let processed = text.replace(/<\s*arquivo\s+caminho=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/\s*arquivo\s*>|$)/gi, (_, path, content) => {
    codeStore.push({
      filePath: path.trim(),
      content: content.replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
    });
    return `\n\u0000${codeStore.length - 1}\u0000\n`;
  });

  // 2. Blocos de crases triplas: ```lang:path ou ```lang
  processed = processed.replace(/```([^\n]*)\n([\s\S]*?)(?:```|$)/g, (_, header, content) => {
    const rawHead = (header || "").trim();
    let lang = "";
    let filePath = "";

    if (rawHead.includes(":") || rawHead.includes(" ")) {
      const parts = rawHead.split(/[:\s]+/);
      if (parts.length >= 2) {
        lang = parts[0];
        filePath = parts.slice(1).join(" ");
      }
    } else if (rawHead.includes("/") || rawHead.includes(".")) {
      filePath = rawHead;
    } else {
      lang = rawHead;
    }

    codeStore.push({
      lang,
      filePath,
      content: content.replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
    });
    return `\n\u0000${codeStore.length - 1}\u0000\n`;
  });

  return processed;
}
