// @ts-check
// Inline text editor for one catalog file. Saving sends the revision that was read; a 409 means it changed meanwhile.
import { esc } from "./catalogo-view.js";

/**
 * @param {HTMLElement} box viewer element
 * @param {{name:string, content:string, revision:string}} file
 * @param {{target:{kind:string,source:string,ref:string,path:string}, onSaved:(r:{revision:string,size:number,content:string})=>void, onCancel:()=>void}} ctx
 */
export function renderEditor(box, file, ctx) {
  box.innerHTML = `<div class="k-vhead"><b>${esc(file.name)}</b><span class="k-tag">editando</span>
    <span class="k-actions"><button type="button" class="btn-row" id="kEdCancel">Cancelar</button>
    <button type="button" class="btn-row is-on" id="kEdSave"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar</button></span></div>
    <p class="k-edmsg" id="kEdMsg" role="status"></p>
    <textarea id="kEdText" class="k-editor" spellcheck="false" aria-label="Conteúdo de ${esc(file.name)}">${esc(file.content)}</textarea>`;
  const text = /** @type {HTMLTextAreaElement} */ (box.querySelector("#kEdText"));
  const msg = /** @type {HTMLElement} */ (box.querySelector("#kEdMsg"));
  const saveBtn = /** @type {HTMLButtonElement} */ (box.querySelector("#kEdSave"));
  let revision = file.revision;
  text.focus();

  box.querySelector("#kEdCancel").addEventListener("click", () => {
    if (text.value === file.content || confirm("Descartar as alterações?")) ctx.onCancel();
  });
  saveBtn.addEventListener("click", async () => {
    if (!confirm(`Salvar alterações em ${file.name}?`)) return;
    saveBtn.disabled = true;
    msg.textContent = "Salvando...";
    try {
      const res = await fetch("/api/catalog/file/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ctx.target, content: text.value, revision }),
      });
      const data = await res.json();
      if (res.ok) return ctx.onSaved({ revision: data.revision, size: data.size, content: text.value });
      if (res.status === 409) {
        // keep the user's text; accepting the new revision makes the next save an explicit overwrite
        msg.innerHTML = `${esc(data.error)} <button type="button" class="btn-row" id="kEdForce">Sobrescrever mesmo assim</button>`;
        msg.querySelector("#kEdForce").addEventListener("click", () => { revision = data.currentRevision; msg.textContent = "Revisão atualizada. Salve novamente para sobrescrever."; });
      } else {
        msg.textContent = data.error || `HTTP ${res.status}`;
      }
    } catch (err) {
      msg.textContent = err.message;
    }
    saveBtn.disabled = false;
  });
}
