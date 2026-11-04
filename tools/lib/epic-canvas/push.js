'use strict';
// Creates or updates the epic's mind-map board through the Canvas REST API (rev-checked).
async function call(base, route, init) {
  const res = await fetch(`${base}${route}`, { headers: { 'content-type': 'application/json' }, ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route}: HTTP ${res.status} ${json.code || json.error || ''}`.trim());
  return json;
}

async function pushBoard({ base, project, title, data }) {
  const q = `project=${encodeURIComponent(project)}`;
  const list = await call(base, `/api/canvas/boards?${q}`);
  const found = (list.boards || list).find?.((b) => b.title === title && b.kind === 'mindmap');
  if (!found) {
    const created = await call(base, `/api/canvas/boards?${q}`, { method: 'POST', body: JSON.stringify({ kind: 'mindmap', title, data }) });
    return { action: 'created', id: created.board.id };
  }
  const current = await call(base, `/api/canvas/boards/${found.id}?${q}`);
  await call(base, `/api/canvas/boards/${found.id}?${q}`, { method: 'PUT', body: JSON.stringify({ rev: current.board.rev, title, data }) });
  return { action: 'updated', id: found.id };
}

module.exports = { pushBoard };
