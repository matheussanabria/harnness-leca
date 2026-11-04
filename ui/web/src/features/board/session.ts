// Save/load orchestration of one open board: uploads new images as assets, then PUTs the slim `data` with the rev.
// Pure with respect to the DOM: the API, the fetch used for rehydration and the Blob->dataURL step are injected.
import type { BoardApi, FetchLike } from "./api";
import { decodeDataUrl, extensionForMime, planUploads, refFromAsset } from "./assetRefs.ts";
import { assertWithinLimit, serializeScene } from "./serialize.ts";
import type { FileManifest, SceneElement, SceneFiles } from "./types";

export interface Snapshot {
  elements: readonly SceneElement[];
  appState: unknown;
  files: SceneFiles;
}

export interface BoardSession {
  save(snapshot: Snapshot): Promise<{ unsupported: string[] }>;
  rename(title: string): Promise<void>;
  rev(): number;
  manifest(): FileManifest;
}

export function createBoardSession(
  api: BoardApi,
  id: string,
  initial: { rev: number; manifest: FileManifest },
): BoardSession {
  let rev = initial.rev;
  const manifest: FileManifest = { ...initial.manifest };
  // Saves and renames share one rev counter, so they run one at a time.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task);
    tail = next.catch(() => undefined);
    return next;
  };

  async function saveNow(snapshot: Snapshot): Promise<{ unsupported: string[] }> {
    const plan = planUploads(snapshot.elements, snapshot.files, manifest);
    for (const fileId of plan.upload) {
      const file = snapshot.files[fileId];
      const decoded = file ? decodeDataUrl(file.dataURL) : null;
      if (!file || !decoded) {
        plan.unsupported.push(fileId);
        continue;
      }
      const name = `${fileId}.${extensionForMime(decoded.mimeType)}`;
      const asset = await api.uploadAsset(id, decoded.bytes, name);
      manifest[fileId] = refFromAsset(asset, decoded.mimeType, file.created);
    }
    const data = serializeScene(snapshot.elements, snapshot.appState, manifest);
    assertWithinLimit(data);
    const board = await api.update(id, { rev, data });
    rev = board.rev;
    return { unsupported: plan.unsupported };
  }

  return {
    rev: () => rev,
    manifest: () => manifest,
    save: (snapshot) => serial(() => saveNow(snapshot)),
    rename: (title) =>
      serial(async () => {
        rev = (await api.update(id, { rev, title })).rev;
      }),
  };
}

/** Fetches every referenced asset and returns the in-memory files Excalidraw needs. Missing assets are skipped. */
export async function rehydrateFiles(
  api: BoardApi,
  id: string,
  manifest: FileManifest,
  toDataUrl: (blob: Blob) => Promise<string>,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<{ files: SceneFiles; missing: string[] }> {
  const files: SceneFiles = {};
  const missing: string[] = [];
  await Promise.all(
    Object.entries(manifest).map(async ([fileId, entry]) => {
      try {
        const response = await fetchImpl(api.assetUrl(id, entry.ref));
        if (!response.ok) throw new Error(String(response.status));
        const dataURL = await toDataUrl(await response.blob());
        files[fileId] = { id: fileId, mimeType: entry.mimeType, dataURL, created: entry.created };
      } catch {
        missing.push(fileId);
      }
    }),
  );
  return { files, missing };
}
