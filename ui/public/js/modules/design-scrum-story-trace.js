// @ts-check
// Carrega maturidade, DoR e commits de uma historia no painel lateral. Somente leitura.
import { state } from "../shared/state.js";
import { traceBodyHtml, traceErrorHtml, traceLoadingHtml } from "./design-scrum-story-trace-view.js";

export const TRACE_BODY_ID = "storyTraceBody";

/** Identidade da ultima carga: respostas de uma historia antiga nao sobrescrevem a atual. */
let currentRequest = 0;

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

/** Markup da secao antes da carga. */
export function traceSectionPlaceholder() {
  return `<div id="${TRACE_BODY_ID}">${traceLoadingHtml()}</div>`;
}

/**
 * @param {ParentNode} root painel que contem o corpo da secao
 * @param {{ id: string }} story
 */
export async function loadStoryTrace(root, story) {
  const body = root.querySelector(`#${TRACE_BODY_ID}`);
  if (!body) return;
  const request = ++currentRequest;
  const slug = state.P?.name || state.S?.active;
  const base = `/api/project/${encodeURIComponent(slug)}/scrum/story/${encodeURIComponent(story.id)}`;
  try {
    const [dorData, commits] = await Promise.all([getJson(`${base}/dor`), getJson(`${base}/commits`)]);
    if (request !== currentRequest) return;
    body.innerHTML = traceBodyHtml({ maturity: dorData.maturity, dor: dorData.dor, commits });
  } catch (error) {
    if (request !== currentRequest) return;
    body.innerHTML = traceErrorHtml(error instanceof Error ? error.message : String(error));
  }
}
