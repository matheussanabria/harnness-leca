// @ts-check
// Per-prototype screen map: screens, links, missing targets and orphan screens.
//
// Pure: takes already-read data (proto.json manifest + screen HTML) and returns plain objects. No fs, no network.
// Link targets are classified by `resolveScreenTarget` (ui/public/js/modules/prototype-nav-resolve.js), the same
// resolver the preview, the canvas and the exporter use, so the map never disagrees with what a click does.
// The resolver is an ES module, so it is injected (`buildScreenMapWith`) or lazily imported (`buildScreenMap`).
const path = require("path");
const { pathToFileURL } = require("url");

const RESOLVER_PATH = path.resolve(__dirname, "..", "..", "public", "js", "modules", "prototype-nav-resolve.js");

/** @typedef {{ id: string, html: string }} ScreenInput */
/** @typedef {{ from: string, to: string, via: "action" | "href", raw: string }} Link */
/** @typedef {(target: unknown, ids: Iterable<string>) => { kind: string, screen: string }} Resolver */

/**
 * Raw navigation targets of one screen, in document order (duplicates kept so counts stay honest).
 * `data-action="goto:x"` -> via "action"; `<a href="...">` -> via "href". Plain "#" anchors are returned too and
 * dropped later by the resolver (kind "none").
 * @param {string} html
 * @returns {Array<{ raw: string, via: "action" | "href" }>}
 */
function extractRawLinks(html) {
  const text = String(html || "");
  /** @type {Array<{ raw: string, via: "action" | "href", at: number }>} */
  const found = [];
  for (const m of text.matchAll(/data-action\s*=\s*["']\s*(goto:[^"']*)["']/gi)) {
    found.push({ raw: m[1].trim(), via: "action", at: m.index || 0 });
  }
  for (const m of text.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
    found.push({ raw: m[1].trim(), via: "href", at: m.index || 0 });
  }
  return found.sort((a, b) => a.at - b.at).map(({ raw, via }) => ({ raw, via }));
}

/**
 * Screen list = proto.json screens (registered) plus .html files on disk, registered order first.
 * @param {{ screens?: Array<{ id?: string }> } | null | undefined} manifest
 * @param {ScreenInput[]} files
 */
function collectScreens(manifest, files) {
  const registered = (manifest && Array.isArray(manifest.screens) ? manifest.screens : [])
    .map((s) => (s && typeof s.id === "string" ? s.id : ""))
    .filter(Boolean);
  const onDisk = new Map(files.map((f) => [f.id, f.html]));
  const ids = [...new Set([...registered, ...[...onDisk.keys()].sort()])];
  return {
    ids,
    registered,
    htmlOf: (/** @type {string} */ id) => onDisk.get(id) ?? "",
    missingFiles: registered.filter((id) => !onDisk.has(id)),
    unregistered: [...onDisk.keys()].filter((id) => !registered.includes(id)).sort(),
  };
}

/**
 * @param {Resolver} resolve resolveScreenTarget from prototype-nav-resolve.js
 * @param {{ protoId?: string, manifest?: { screens?: Array<{ id?: string }>, entry?: string } | null, files: ScreenInput[] }} input
 */
function buildScreenMapWith(resolve, input) {
  const { ids, registered, htmlOf, missingFiles, unregistered } = collectScreens(input.manifest, input.files || []);
  const entry = input.manifest && typeof input.manifest.entry === "string" && ids.includes(input.manifest.entry) ? input.manifest.entry : ids[0] || "";

  /** @type {Link[]} */
  const links = [];
  /** @type {Link[]} */
  const external = [];
  for (const id of ids) {
    for (const { raw, via } of extractRawLinks(htmlOf(id))) {
      const r = resolve(raw, ids);
      if (r.kind === "screen" || r.kind === "planned") links.push({ from: id, to: r.screen, via, raw });
      else if (r.kind === "external") external.push({ from: id, to: raw, via, raw });
    }
  }

  const known = new Set(ids);
  const missingTargets = links.filter((l) => !known.has(l.to));
  const inbound = new Set(links.filter((l) => known.has(l.to) && l.to !== l.from).map((l) => l.to));
  const orphans = ids.filter((id) => id !== entry && !inbound.has(id));

  const screens = ids.map((id) => ({
    id,
    registered: registered.includes(id),
    onDisk: !missingFiles.includes(id),
    entry: id === entry,
    out: [...new Set(links.filter((l) => l.from === id).map((l) => l.to))],
    inCount: links.filter((l) => l.to === id && l.from !== id).length,
  }));

  return {
    protoId: input.protoId || "",
    entry,
    screens,
    links,
    external,
    missingTargets,
    orphans,
    missingFiles,
    unregistered,
    ok: !missingTargets.length && !orphans.length && !missingFiles.length && !unregistered.length,
  };
}

/** Same as buildScreenMapWith, loading the shared ES-module resolver on first use. */
async function buildScreenMap(/** @type {Parameters<typeof buildScreenMapWith>[1]} */ input) {
  const { resolveScreenTarget } = await import(pathToFileURL(RESOLVER_PATH).href);
  return buildScreenMapWith(resolveScreenTarget, input);
}

module.exports = { extractRawLinks, collectScreens, buildScreenMapWith, buildScreenMap };
