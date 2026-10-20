// @ts-check
// Monta e renderiza a árvore recolhível do explorador de código do Studio.
import { esc } from "../shared/dom.js";

const expandedFolders = new Set(["src", "src/app"]);
let lastActivePath = "";

function fileKind(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "file";
  if (["ts", "tsx"].includes(ext)) return "ts";
  if (["js", "jsx", "mjs"].includes(ext)) return "js";
  if (["html", "xml", "vue", "svelte"].includes(ext)) return "html";
  if (["css", "scss", "sass", "less"].includes(ext)) return "css";
  if (["json", "yaml", "yml"].includes(ext)) return "data";
  if (["java", "kt"].includes(ext)) return "java";
  if (ext === "md") return "markdown";
  return "file";
}

export function buildSourceTree(files) {
  const root = { dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    parts.slice(0, -1).forEach((name, index) => {
      if (!node.dirs.has(name)) {
        node.dirs.set(name, {
          name,
          path: parts.slice(0, index + 1).join("/"),
          dirs: new Map(),
          files: [],
        });
      }
      node = node.dirs.get(name);
    });
    node.files.push(file);
  }
  return root;
}

function revealParents(filePath) {
  const parts = filePath.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    expandedFolders.add(parts.slice(0, index).join("/"));
  }
}

function folderHtml(folder, depth, query) {
  const open = query || expandedFolders.has(folder.path);
  const directories = [...folder.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...folder.files].sort((a, b) => a.name.localeCompare(b.name));
  const children = [
    ...directories.map((entry) => folderHtml(entry, depth + 1, query)),
    ...files.map((file) => fileHtml(file, depth + 1)),
  ].join("");
  return `<div class="source-tree-folder ${open ? "open" : ""}">
    <button type="button" class="source-tree-row source-folder" data-source-folder="${esc(folder.path)}" style="--tree-depth:${depth}" aria-expanded="${open}">
      <i class="fa-solid fa-chevron-right source-folder-chevron"></i>
      <i class="fa-${open ? "solid fa-folder-open" : "regular fa-folder"} source-folder-icon"></i>
      <span>${esc(folder.name)}</span>
    </button>
    <div class="source-tree-children" ${open ? "" : "hidden"}>${children}</div>
  </div>`;
}

function fileHtml(file, depth) {
  const kind = fileKind(file.path);
  return `<button type="button" class="source-tree-row source-file source-kind-${kind}" data-source-path="${esc(file.path)}" style="--tree-depth:${depth}" title="${esc(file.path)}">
    <i class="fa-regular fa-file-code source-file-icon"></i><span>${esc(file.name)}</span>
  </button>`;
}

export function renderSourceTree({ host, files, activePath, filter, onOpen }) {
  const query = String(filter || "").trim().toLowerCase();
  const visible = files.filter((file) => !query || file.path.toLowerCase().includes(query));
  if (!activePath) lastActivePath = "";
  if (activePath && activePath !== lastActivePath) {
    revealParents(activePath);
    lastActivePath = activePath;
  }
  if (!visible.length) {
    host.innerHTML = '<div class="source-files-empty">Nenhum arquivo encontrado.</div>';
    return;
  }
  const root = buildSourceTree(visible);
  const directories = [...root.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  host.innerHTML = [
    ...directories.map((folder) => folderHtml(folder, 0, query)),
    ...root.files.sort((a, b) => a.name.localeCompare(b.name)).map((file) => fileHtml(file, 0)),
  ].join("");

  host.querySelector(`[data-source-path="${CSS.escape(activePath || "")}"]`)?.classList.add("active");
  host.querySelectorAll("[data-source-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderPath = /** @type {HTMLElement} */ (button).dataset.sourceFolder || "";
      if (expandedFolders.has(folderPath)) expandedFolders.delete(folderPath);
      else expandedFolders.add(folderPath);
      renderSourceTree({ host, files, activePath, filter, onOpen });
    });
  });
  host.querySelectorAll("[data-source-path]").forEach((button) => {
    button.addEventListener("click", () => onOpen(/** @type {HTMLElement} */ (button).dataset.sourcePath || ""));
  });
}
