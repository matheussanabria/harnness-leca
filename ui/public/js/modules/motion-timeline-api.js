// @ts-check
// Timeline API of the keyframe panel (EP-24.06): read and save screens/<id>.motion.json with the rev check.
// Saves go through the Atelier history on the server, so Ctrl+Z / Ctrl+Y undo and redo them.

/** @param {{ slug: string, protoId: string, screen: string }} where */
const url = (where) => `/api/project/${encodeURIComponent(where.slug)}/design/prototypes/${encodeURIComponent(where.protoId)}/motion/${encodeURIComponent(where.screen)}`;

/** @param {{ slug: string, protoId: string, screen: string }} where @returns {Promise<{ doc: any, rev: string | null }>} */
export async function loadTimeline(where) {
  const res = await fetch(url(where));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return { doc: body.doc, rev: body.rev };
}

/**
 * @param {{ slug: string, protoId: string, screen: string }} where @param {any} doc @param {string | null} rev @param {string} label
 * @returns {Promise<{ ok: true, doc: any, rev: string } | { ok: false, status: number, error: string, rev?: string | null }>}
 */
export async function saveTimeline(where, doc, rev, label) {
  const res = await fetch(url(where), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, rev, label }) });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, doc: body.doc, rev: body.rev };
  const first = Array.isArray(body.errors) && body.errors[0] ? `${body.errors[0].path}: ${body.errors[0].message}` : "";
  return { ok: false, status: res.status, error: first || body.error || res.statusText, rev: body.rev };
}
