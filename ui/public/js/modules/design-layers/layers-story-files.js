// @ts-check
// Painel "Histórias e arquivos" do Mapa em Camadas: arquivos tocados por cada história, a partir do histórico git.
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";

const GENERATE_HINT = "node tools/rastreio-historias.js --repo api=<pasta> --repo web=<pasta> --out doc/scrum/_historias-arquivos.json";

/**
 * Loads the story -> files history of the project into the shared layers store. Never throws: the panel is optional.
 * @param {string} slug
 */
export async function loadStoryFiles(slug) {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/story-files`);
    dls.storyFiles = res.ok ? await res.json() : null;
  } catch {
    dls.storyFiles = null;
  }
}

/** @param {string|undefined} iso */
function fmtDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : "";
}

/** @param {Record<string, any>} historias */
export function sortStories(historias) {
  const num = (k) => (/-XXX$/.test(k) ? Number.MAX_SAFE_INTEGER : Number(k.split("-")[1]));
  return Object.entries(historias || {}).sort((a, b) => b[1].commits - a[1].commits || num(a[0]) - num(b[0]));
}

/** @param {string} repo @param {{path:string, commits:number}[]} files */
function renderRepoGroup(repo, files) {
  if (!files.length) return "";
  const rows = files
    .map((f) => `<li><code>${esc(f.path)}</code>${f.commits > 1 ? `<span class="lsf-n" title="commits que tocaram o arquivo">${f.commits}</span>` : ""}</li>`)
    .join("");
  return `<div class="lsf-repo"><h5><i class="fa-solid fa-folder-tree" aria-hidden="true"></i> ${esc(repo)} <small>${files.length}</small></h5><ul>${rows}</ul></div>`;
}

/** @param {string} key @param {any} h */
function renderStory(key, h) {
  const total = Object.values(h.repos || {}).reduce((n, list) => n + list.length, 0);
  const title = (h.titulos && h.titulos[0]) || "";
  const groups = Object.entries(h.repos || {}).map(([repo, list]) => renderRepoGroup(repo, list)).join("");
  return `
    <details class="lsf-story">
      <summary>
        <span class="lsf-key">${esc(key)}</span>
        <span class="lsf-title">${esc(title)}</span>
        <span class="lsf-meta">${h.commits} commits &middot; ${total} arquivos</span>
      </summary>
      <div class="lsf-body">${groups || '<p class="lsf-empty">Nenhum arquivo.</p>'}</div>
    </details>`;
}

/**
 * @param {any} data resposta de GET /design/story-files
 * @returns {string}
 */
export function renderStoryFilesPanel(data) {
  if (!data) return "";
  if (!data.found) {
    return `<section class="layers-story-files" aria-label="Histórias e arquivos">
      <h4><i class="fa-solid fa-code-branch" aria-hidden="true"></i> Histórias e arquivos</h4>
      <p class="lsf-empty">Ainda não há histórico gerado${data.error ? ` (${esc(data.error)})` : ""}. Gere com <code>${esc(GENERATE_HINT)}</code>.</p>
    </section>`;
  }
  const stories = sortStories(data.historias);
  const when = fmtDate(data.geradoEm);
  return `<section class="layers-story-files" aria-label="Histórias e arquivos">
    <h4><i class="fa-solid fa-code-branch" aria-hidden="true"></i> Histórias e arquivos <small>${stories.length} histórias${when ? ` &middot; gerado em ${esc(when)}` : ""}</small></h4>
    <p class="lsf-note">Arquivos alterados nos commits de cada história (chave no assunto do commit). ${data.semChave || 0} commits sem chave ficaram de fora.</p>
    ${stories.map(([k, h]) => renderStory(k, h)).join("")}
  </section>`;
}
