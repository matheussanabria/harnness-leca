// @ts-check
import { esc, showToast } from "../shared/dom.js";

/**
 * Renderizador de diff unificado e gerenciamento de banner de Desfazer (Undo).
 */

/**
 * Converte texto de diff unificado em HTML estilizado com cores.
 * @param {string} diffText
 * @returns {string}
 */
export function renderDiffHtml(diffText) {
  if (!diffText) return "";

  const lines = diffText.split("\n");
  const htmlLines = lines.map((l) => {
    if (l.startsWith("+") && !l.startsWith("+++")) {
      return `<span class="inspector-diff-line added">${esc(l)}</span>`;
    }
    if (l.startsWith("-") && !l.startsWith("---")) {
      return `<span class="inspector-diff-line removed">${esc(l)}</span>`;
    }
    if (l.startsWith("@@") || l.startsWith("---") || l.startsWith("+++")) {
      return `<span class="inspector-diff-line header">${esc(l)}</span>`;
    }
    return `<span class="inspector-diff-line">${esc(l)}</span>`;
  });

  return `<div class="inspector-diff-container">${htmlLines.join("")}</div>`;
}

/**
 * Exibe um banner temporário para permitir que o usuário desfaça a alteração recém-aplicada.
 * @param {string} undoToken
 * @param {string} slug
 * @param {() => void} [onRestored]
 */
export function showUndoBanner(undoToken, slug, onRestored) {
  let banner = document.getElementById("inspectorUndoBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "inspectorUndoBanner";
    banner.className = "inspector-undo-banner";
    const container = document.getElementById("studioViewportContainer") || document.body;
    container.appendChild(banner);
  }

  let seconds = 15;
  banner.innerHTML = `
    <span>✅ Alteração aplicada! O app está recarregando via Hot Reload. (<b id="inspectorUndoCountdown">${seconds}s</b>)</span>
    <button type="button" class="inspector-undo-btn" id="btnInspectorUndo">↺ Desfazer</button>
  `;
  banner.style.display = "flex";

  const countdownTimer = setInterval(() => {
    seconds--;
    const el = document.getElementById("inspectorUndoCountdown");
    if (el) el.textContent = `${seconds}s`;
    if (seconds <= 0) {
      clearInterval(countdownTimer);
      if (banner) banner.style.display = "none";
    }
  }, 1000);

  const btnUndo = document.getElementById("btnInspectorUndo");
  if (btnUndo) {
    btnUndo.onclick = async () => {
      clearInterval(countdownTimer);
      btnUndo.textContent = "Desfazendo...";
      // @ts-ignore
      btnUndo.disabled = true;

      try {
        const res = await fetch(`/api/project/${encodeURIComponent(slug)}/inspect/edit/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ undoToken }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast("↺ Alteração desfeita com sucesso!");
          if (banner) banner.style.display = "none";
          if (onRestored) onRestored();
        } else {
          showToast(`Erro ao desfazer: ${data.error}`);
        }
      } catch (err) {
        showToast("Falha na comunicação ao desfazer.");
      }
    };
  }
}
