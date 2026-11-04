// The only module that imports Excalidraw statically. It is loaded through React.lazy, so it lives in a lazy chunk.
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Scene } from "../../features/board/serialize.ts";
import type { SceneElement, SceneFiles } from "../../features/board/types";
import type { ShellTheme } from "./useShellTheme";

export interface ExcalidrawCanvasProps {
  scene: Scene;
  files: SceneFiles;
  theme: ShellTheme;
  onApi: (api: ExcalidrawImperativeAPI) => void;
  onChange: (elements: readonly SceneElement[], appState: unknown, files: SceneFiles) => void;
}

export default function ExcalidrawCanvas({ scene, files, theme, onApi, onChange }: ExcalidrawCanvasProps) {
  return (
    <Excalidraw
      excalidrawAPI={onApi}
      theme={theme}
      initialData={{
        elements: scene.elements as unknown as ExcalidrawElement[],
        appState: scene.appState,
        files: files as unknown as BinaryFiles,
        scrollToContent: true,
      }}
      onChange={(elements, appState, binaryFiles) =>
        onChange(elements as unknown as SceneElement[], appState, binaryFiles as unknown as SceneFiles)
      }
    />
  );
}
