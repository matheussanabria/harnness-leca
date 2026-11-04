// Shared types of the Canvas board feature (story 19.04). Kept free of Excalidraw imports so helpers run under node:test.

export type Primitive = string | number | boolean | null;

/** One drawing element. Only the fields the helpers read are typed; the rest is opaque Excalidraw data. */
export type SceneElement = { id: string; type: string; isDeleted?: boolean; fileId?: string | null } & Record<
  string,
  unknown
>;

/** Reference to an uploaded asset: content-addressed file name `<sha256>.<ext>` plus image metadata. */
export interface FileRef {
  ref: string;
  mimeType: string;
  created: number;
}

export type FileManifest = Record<string, FileRef>;

export const BOARD_SCHEMA = "excalidraw@1";

/** The opaque `data` payload stored in a board of kind "board". */
export interface BoardData {
  schema: typeof BOARD_SCHEMA;
  elements: SceneElement[];
  appState: Record<string, Primitive>;
  files: FileManifest;
}

export interface BoardSummary {
  id: string;
  kind: string;
  title: string;
  rev: number;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  v: number;
  createdAt: string;
  data: unknown;
}

export interface AssetInfo {
  hash: string;
  ext: string;
  size: number;
  mime: string;
  name: string;
  url: string;
  inline: boolean;
}

/** A binary file as Excalidraw keeps it in memory. */
export interface SceneFile {
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
}

export type SceneFiles = Record<string, SceneFile>;
