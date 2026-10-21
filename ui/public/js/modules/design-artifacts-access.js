// @ts-check
import { showToast } from "../shared/dom.js";

async function updateAccess(slug, file, access) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/artifacts/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, access }),
  });
  if (!res.ok) {
    let message = "Falha ao atualizar o acesso.";
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

export function setupArtifactAccess(container, slug, onChanged) {
  container.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-artifact-access]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const file = button.dataset.artifactFile || "";
    const access = button.dataset.artifactAccess || "";
    if (!file || !access) return;

    button.disabled = true;
    try {
      await updateAccess(slug, file, access);
      showToast(access === "local" ? "Artefato visível somente no computador local." : "Artefato liberado para o projeto.");
      await onChanged?.();
    } catch (err) {
      button.disabled = false;
      showToast(err.message || "Falha ao atualizar o acesso.");
    }
  });
}
