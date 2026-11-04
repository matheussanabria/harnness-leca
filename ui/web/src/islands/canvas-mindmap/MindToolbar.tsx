// Floating action bar over the mind-map canvas. Every edit reuses the same commands as the keyboard.
import { toolbarState } from "../../features/mindmap/toolbarState.ts";
import type { useMindEditor } from "../../features/mindmap/useMindEditor.ts";
import type { ViewActions } from "../../features/mindmap/useViewActions.ts";
import { AgentGroup } from "./AgentGroup.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

export interface MindToolbarProps {
  editor: ReturnType<typeof useMindEditor>;
  view: ViewActions;
  /** Title of the board being edited; used as the context-pack heading. */
  boardTitle: string;
  /** Called after an edit so keyboard focus returns to the canvas frame. */
  onStructureAction(): void;
}

function Separator() {
  return <hr className="mm-actionbar__sep" aria-orientation="vertical" />;
}

export function MindToolbar({ editor, view, boardTitle, onStructureAction }: MindToolbarProps) {
  const { doc, selectedId, commands } = editor;
  const state = toolbarState(doc, selectedId, editor.history);
  const node = doc.nodes[selectedId];
  const collapsed = node?.collapsed ?? false;
  const run = (action: () => void) => () => {
    action();
    onStructureAction();
  };

  return (
    <div className="mm-actionbar" role="toolbar" aria-label="Mind map actions" aria-orientation="horizontal">
      <ToolbarButton
        icon="fa-turn-down"
        label="Add child"
        shortcut="Tab"
        disabled={!state.addChild}
        onClick={run(commands.child)}
      />
      <ToolbarButton
        icon="fa-arrows-up-down"
        label="Add sibling"
        shortcut="Enter"
        disabled={!state.addSibling}
        onClick={run(commands.sibling)}
      />
      <ToolbarButton
        icon="fa-outdent"
        label="Outdent"
        shortcut="Shift+Tab"
        disabled={!state.outdent}
        onClick={run(commands.outdent)}
      />
      <ToolbarButton icon="fa-pen" label="Rename" shortcut="F2" disabled={!state.rename} onClick={run(commands.edit)} />
      <ToolbarButton
        icon={collapsed ? "fa-expand" : "fa-compress"}
        label={collapsed ? "Expand branch" : "Collapse branch"}
        shortcut="Space"
        disabled={!state.toggleCollapse}
        pressed={collapsed}
        onClick={run(commands.toggle)}
      />
      <ToolbarButton
        icon="fa-trash"
        label="Delete"
        shortcut="Delete"
        danger
        disabled={!state.remove}
        onClick={run(commands.remove)}
      />
      <Separator />
      <ToolbarButton
        icon="fa-rotate-left"
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!state.undo}
        onClick={commands.undo}
      />
      <ToolbarButton
        icon="fa-rotate-right"
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!state.redo}
        onClick={commands.redo}
      />
      <Separator />
      <ToolbarButton icon="fa-magnifying-glass-minus" label="Zoom out" onClick={view.zoomOut} />
      <ToolbarButton icon="fa-magnifying-glass-plus" label="Zoom in" onClick={view.zoomIn} />
      <ToolbarButton icon="fa-maximize" label="Fit whole map" onClick={view.fit} />
      <ToolbarButton
        icon="fa-crosshairs"
        label="Center on selected node"
        disabled={!view.canCenter}
        onClick={view.center}
      />
      <Separator />
      <ToolbarButton
        icon="fa-arrows-to-dot"
        label="Reset positions"
        disabled={!state.resetOffsets}
        onClick={run(commands.resetOffsets)}
      />
      <Separator />
      <AgentGroup doc={doc} selectedId={selectedId} boardTitle={boardTitle} state={state} />
    </div>
  );
}
