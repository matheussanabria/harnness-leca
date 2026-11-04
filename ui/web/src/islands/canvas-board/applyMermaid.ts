// Puts a Mermaid diagram on the Excalidraw board. The conversion libraries are imported lazily: they only load when the
// chat actually sends a diagram, and they already live in the lazy Excalidraw chunks.
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { placeBelow } from "../../features/board/chatBridge";
import type { SceneElement } from "../../features/board/types";

export type ApplyMode = "replace" | "append";

/**
 * Converts `source` (flowchart, sequence or class diagram) and shows it on the board as ONE undoable step.
 * "replace" swaps the whole drawing for the diagram; "append" puts it below what is already there.
 * Resolves with the number of elements added; rejects when the text is not valid Mermaid.
 */
export async function applyMermaid(api: ExcalidrawImperativeAPI, mode: ApplyMode, source: string): Promise<number> {
  const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements, CaptureUpdateAction }] = await Promise.all([
    import("@excalidraw/mermaid-to-excalidraw"),
    import("@excalidraw/excalidraw"),
  ]);
  const parsed = await parseMermaidToExcalidraw(source);
  const converted = convertToExcalidrawElements(parsed.elements, { regenerateIds: true });
  if (!converted.length) throw new Error("the diagram has no elements");
  const existing = api.getSceneElements();
  const added =
    mode === "replace"
      ? [...converted]
      : (placeBelow(
          existing as unknown as SceneElement[],
          converted as unknown as SceneElement[],
        ) as unknown as ExcalidrawElement[]);
  const files = Object.values(parsed.files ?? {}) as BinaryFileData[];
  if (files.length) api.addFiles(files);
  api.updateScene({
    elements: mode === "replace" ? added : [...existing, ...added],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(added, { fitToContent: true, animate: true });
  return added.length;
}
