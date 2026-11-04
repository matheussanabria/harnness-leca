// Asset reference mapping: images live on the server as content-addressed files, `data` only keeps references.
import type { AssetInfo, FileManifest, FileRef, SceneElement, SceneFiles } from "./types";

export const ASSET_REF_RE = /^[a-f0-9]{64}\.[a-z0-9]{1,5}$/;
/** Types the asset endpoint accepts for images (SVG is rejected by the server and never uploaded). */
export const UPLOADABLE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function isFileRef(value: unknown): value is FileRef {
  if (!value || typeof value !== "object") return false;
  const { ref, mimeType, created } = value as Record<string, unknown>;
  return (
    typeof ref === "string" &&
    ASSET_REF_RE.test(ref) &&
    typeof mimeType === "string" &&
    mimeType.startsWith("image/") &&
    typeof created === "number" &&
    Number.isFinite(created)
  );
}

/** File ids used by live (non-deleted) image elements. */
export function referencedFileIds(elements: readonly SceneElement[]): Set<string> {
  const ids = new Set<string>();
  for (const element of elements) {
    if (element.type === "image" && !element.isDeleted && typeof element.fileId === "string") ids.add(element.fileId);
  }
  return ids;
}

export interface UploadPlan {
  /** Files that still need uploading: referenced, not in the manifest, and of an accepted type. */
  upload: string[];
  /** Referenced files that can never be stored (unsupported type). */
  unsupported: string[];
}

export function planUploads(elements: readonly SceneElement[], files: SceneFiles, manifest: FileManifest): UploadPlan {
  const plan: UploadPlan = { upload: [], unsupported: [] };
  for (const id of referencedFileIds(elements)) {
    if (manifest[id]) continue;
    const file = files[id];
    if (!file) continue; // not loaded yet: nothing to upload, nothing to drop
    if (UPLOADABLE_IMAGE_TYPES.has(file.mimeType)) plan.upload.push(id);
    else plan.unsupported.push(id);
  }
  return plan;
}

/** Manifest entry for an uploaded file. */
export function refFromAsset(asset: Pick<AssetInfo, "hash" | "ext">, mimeType: string, created: number): FileRef {
  return { ref: `${asset.hash}.${asset.ext}`, mimeType, created };
}

/** Keeps only manifest entries still referenced by a live image element. */
export function pruneManifest(manifest: FileManifest, elements: readonly SceneElement[]): FileManifest {
  const used = referencedFileIds(elements);
  return Object.fromEntries(Object.entries(manifest).filter(([id]) => used.has(id)));
}

/** Decodes a `data:<mime>;base64,<payload>` URL. Returns null for anything else. */
export function decodeDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match?.[1] || match[2] === undefined) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mimeType: match[1], bytes };
}

export function extensionForMime(mimeType: string): string {
  return { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[mimeType] ?? "bin";
}
