// @ts-check
// Botao "Gerar pacote de revisao" da aba Scrum: quadro de historias e mapa em camadas autonomos (HTML e zip) para
// quem nao tem o Harness. Aparece so em projeto com pacote-revisao.json e avisa quando o pacote esta defasado.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";

const LABEL = "Gerar pacote de revisão";
const ID = "scrumReviewPackageBtn";

export function reviewPackageButtonHtml() {
  return `<button type="button" id="${ID}" class="scrum-nav-tab scrum-review-package" onclick="buildReviewPackage()" hidden>
    <i class="fa-solid fa-box-archive" aria-hidden="true"></i> <span class="review-package-label">${LABEL}</span><span class="review-package-dot" aria-hidden="true"></span></button>`;
}

/**
 * Texto de ajuda do botao a partir do estado devolvido pelo servidor.
 * @param {{ geradoEm?: string|null, defasado?: string[], pasta?: string, error?: string }} status
 */
export function reviewPackageTitle(status) {
  if (status.error) return `Pacote indisponível: ${status.error}`;
  const where = status.pasta ? ` Pasta: ${status.pasta}.` : "";
  if (!status.geradoEm) return `Ainda não gerado.${where}`;
  const when = new Date(status.geradoEm).toLocaleString("pt-BR");
  const stale = status.defasado || [];
  return stale.length
    ? `Gerado em ${when}. Defasado, mudou: ${stale.join(", ")}.${where}`
    : `Gerado em ${when}. Em dia com as fontes.${where}`;
}

/**
 * Mensagem do aviso depois de gerar.
 * @param {{ historias: number, telas: number, zip?: string|null, pasta?: string, avisos?: any[] }} r
 */
export function reviewPackageDoneMessage(r) {
  const avisos = (r.avisos || []).length;
  const zip = r.zip ? ` Zip: ${r.zip}.` : ` Pasta: ${r.pasta}.`;
  return `Pacote gerado: ${r.historias} histórias e ${r.telas} telas.${zip}${avisos ? ` ${avisos} aviso(s); rode o check para ver.` : ""}`;
}

/** Mostra o botao se o projeto tem pacote e marca quando esta defasado. @param {string} slug */
export async function hydrateReviewPackageButton(slug) {
  const button = document.getElementById(ID);
  if (!button || !slug) return;
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/pacote-revisao`);
    const status = await response.json();
    if (!response.ok || !status.configured) return;
    button.hidden = false;
    button.title = reviewPackageTitle(status);
    button.classList.toggle("is-stale", Boolean(status.geradoEm) && (status.defasado || []).length > 0 || !status.geradoEm);
  } catch {
    /* sem servidor ou sem rota: o botao fica escondido */
  }
}

export function registerReviewPackage() {
  window.buildReviewPackage = async () => {
    const slug = state.P?.name || state.S?.active;
    const button = document.getElementById(ID);
    const label = button?.querySelector(".review-package-label");
    if (button) { button.disabled = true; button.classList.add("is-syncing"); }
    if (label) label.textContent = "Gerando...";
    try {
      const response = await fetch(`/api/project/${encodeURIComponent(slug)}/pacote-revisao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao gerar o pacote.");
      showToast(reviewPackageDoneMessage(data), 9000);
    } catch (error) {
      showToast(error.message);
    } finally {
      if (button) { button.disabled = false; button.classList.remove("is-syncing"); }
      if (label) label.textContent = LABEL;
      await hydrateReviewPackageButton(slug);
    }
  };
}
