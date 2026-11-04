// Framework-free mind-map model types. Node ids are model ids, never graphic (React Flow) ids.
export interface MindNode {
  id: string;
  text: string;
  /** Ordered child ids. */
  children: string[];
  collapsed: boolean;
  /** Manual horizontal offset from the tidy layout position; absent means 0. */
  dx?: number;
  /** Manual vertical offset from the tidy layout position; absent means 0. */
  dy?: number;
}

export interface MindDoc {
  rootId: string;
  nodes: Record<string, MindNode>;
}

export const MINDMAP_SCHEMA = "mindmap@1";
export const MAX_NODES = 2000;
export const MAX_TEXT = 500;
/** Largest accepted manual offset, in layout units. */
export const MAX_OFFSET = 100000;

export interface MindmapData {
  schema: typeof MINDMAP_SCHEMA;
  rootId: string;
  nodes: MindNode[];
}
