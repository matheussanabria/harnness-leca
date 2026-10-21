// @ts-check
import { showToast } from "../shared/dom.js";

const MAX_BYTES = 25 * 1024 * 1024;

function folderOf(file) {
  const relative = String(file.webkitRelativePath || "");
  const parts = relative.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

async function sendFile(slug, file, source) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: maior que 25 MB.`);
  const query = new URLSearchParams({ name: file.name, source });
  const folder = folderOf(file);
  if (folder) query.set("folder", folder);
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/artifacts/import?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    let message = "Falha na importação.";
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(`${file.name}: ${message}`);
  }
  return res.json();
}

export function setupArtifactImport(container, slug, onImported) {
  const filesInput = /** @type {HTMLInputElement} */ (container.querySelector("#artifactFileInput"));
  const folderInput = /** @type {HTMLInputElement} */ (container.querySelector("#artifactFolderInput"));
  const filesButton = /** @type {HTMLButtonElement} */ (container.querySelector("#artifactImportFiles"));
  const folderButton = /** @type {HTMLButtonElement} */ (container.querySelector("#artifactImportFolder"));
  const status = /** @type {HTMLElement} */ (container.querySelector("#artifactImportStatus"));
  if (!filesInput || !folderInput || !filesButton || !folderButton || !status) return;

  let busy = false;
  const run = async (fileList, source) => {
    const files = Array.from(fileList || []);
    if (!files.length || busy) return;
    busy = true;
    filesButton.disabled = true;
    folderButton.disabled = true;
    let ok = 0;
    let failed = 0;
    let firstError = "";
    for (let index = 0; index < files.length; index += 1) {
      status.textContent = `Importando ${index + 1} de ${files.length}: ${files[index].name}`;
      try {
        await sendFile(slug, files[index], source);
        ok += 1;
      } catch (err) {
        failed += 1;
        if (!firstError) firstError = err.message;
      }
    }
    filesInput.value = "";
    folderInput.value = "";
    busy = false;
    filesButton.disabled = false;
    folderButton.disabled = false;
    status.textContent = `${ok} arquivo(s) importado(s)${failed ? `; ${failed} falha(s)` : ""}.`;
    if (failed) showToast(firstError || "Alguns arquivos não puderam ser importados.");
    else showToast(`${ok} arquivo(s) importado(s) para o projeto.`);
    await onImported?.();
  };

  filesButton.addEventListener("click", () => filesInput.click());
  folderButton.addEventListener("click", () => folderInput.click());
  filesInput.addEventListener("change", () => run(filesInput.files, "files"));
  folderInput.addEventListener("change", () => run(folderInput.files, "folder"));
}
