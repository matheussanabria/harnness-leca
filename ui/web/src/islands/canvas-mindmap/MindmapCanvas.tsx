// React Flow rendering of the mind map plus keyboard handling. All state comes from useMindEditor.
import "@xyflow/react/dist/style.css";
import { Background, Controls, type Edge, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { handleKey } from "../../features/mindmap/keymap.ts";
import { layoutTree, offsetFromPosition, offsetMap } from "../../features/mindmap/layout.ts";
import { subtreeIds } from "../../features/mindmap/tree.ts";
import type { useMindEditor } from "../../features/mindmap/useMindEditor.ts";
import { useViewActions } from "../../features/mindmap/useViewActions.ts";
import { FocusFollower } from "./FocusFollower.tsx";
import { type MindFlowNode, MindNodeView } from "./MindNodeView.tsx";
import { MindToolbar } from "./MindToolbar.tsx";
import { useReparentDrag } from "./useReparentDrag.ts";

const nodeTypes = { mind: MindNodeView };
const ZERO_OFFSET = { dx: 0, dy: 0 };

/** Live drag state: the whole dragged subtree is shifted together, so children follow the parent while dragging. */
interface DragShift {
  ids: ReadonlySet<string>;
  dx: number;
  dy: number;
}

export function MindmapCanvas({
  editor,
  boardTitle,
}: {
  editor: ReturnType<typeof useMindEditor>;
  boardTitle: string;
}) {
  const { doc, selectedId, editingId, commands, setSelectedId } = editor;
  const frame = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  const [drag, setDrag] = useState<DragShift | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const reparent = useReparentDrag(doc, commands.reparentNode);
  useEffect(() => {
    // Give the keyboard back to the tree once the inline editor closes.
    if (wasEditing.current && !editingId) frame.current?.focus();
    wasEditing.current = editingId !== null;
  }, [editingId]);

  const { nodes, edges } = useMemo(() => {
    const placed = layoutTree(doc);
    const offsets = offsetMap(doc);
    const flowNodes: MindFlowNode[] = placed.map((item) => {
      const offset = offsets.get(item.id) ?? ZERO_OFFSET;
      const live = drag?.ids.has(item.id) ? drag : null;
      return {
        id: item.id,
        type: "mind",
        // Rendered position = tidy layout position + the node's offset and every ancestor's offset.
        position: { x: item.x + offset.dx + (live?.dx ?? 0), y: item.y + offset.dy + (live?.dy ?? 0) },
        connectable: false,
        // Explicit size so React Flow, edges and the resizer all agree with the stored node size.
        width: item.w,
        height: item.h,
        data: {
          text: doc.nodes[item.id]?.text ?? "",
          selected: item.id === selectedId,
          dropTarget: item.id === reparent.dropTargetId,
          editing: item.id === editingId,
          hasChildren: item.hasChildren,
          collapsed: item.collapsed,
          isRoot: item.parentId === null,
          onCommit: commands.commitText,
          onCancel: commands.cancelEdit,
          onResize: commands.resizeNode,
          onToggle: (id: string) => {
            setSelectedId(id);
            commands.toggleNode(id);
          },
        },
      };
    });
    const flowEdges: Edge[] = placed
      .filter((item) => item.parentId !== null)
      .map((item) => ({
        id: `${item.parentId}-${item.id}`,
        source: item.parentId as string,
        target: item.id,
        type: "default",
      }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [doc, selectedId, editingId, commands, setSelectedId, drag, reparent.dropTargetId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editingId) return;
    // Inside the action bar, plain Tab/Enter/Space must keep their native button behaviour.
    const target = event.target;
    const inToolbar = target instanceof HTMLElement && target.closest(".mm-actionbar") !== null;
    if (inToolbar && !(event.ctrlKey || event.metaKey)) return;
    if (handleKey(event, commands)) event.preventDefault();
  };

  return (
    <div ref={frame} className="mm-canvas" role="tree" aria-label="Mind map" tabIndex={0} onKeyDown={onKeyDown}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDoubleClick={(_, node) => {
            setSelectedId(node.id);
            commands.editNode(node.id);
          }}
          onInit={reparent.onInit}
          onNodeDragStart={(event, node) => {
            reparent.onDragStart(event, node);
            dragStart.current = { x: node.position.x, y: node.position.y };
            setDrag({ ids: new Set(subtreeIds(doc, node.id)), dx: 0, dy: 0 });
          }}
          onNodeDrag={(event, node) => {
            reparent.onDrag(event, node);
            setDrag((current) =>
              current
                ? { ...current, dx: node.position.x - dragStart.current.x, dy: node.position.y - dragStart.current.y }
                : current,
            );
          }}
          onNodeDragStop={(event, node) => {
            setDrag(null);
            // Shift+drag reparents (or snaps back when dropped on nothing); the position is not saved.
            if (reparent.onDragStop(event, node)) return;
            // The dropped position is absolute: convert it back into an offset from layout + ancestors.
            const offset = offsetFromPosition(doc, node.id, node.position.x, node.position.y);
            commands.moveNode(node.id, offset.dx, offset.dy);
          }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
        <ToolbarHost
          editor={editor}
          nodes={nodes}
          boardTitle={boardTitle}
          onStructureAction={() => frame.current?.focus()}
        />
        <FocusFollower selectedId={selectedId} nodes={nodes} />
      </ReactFlowProvider>
    </div>
  );
}

/** Lives inside ReactFlowProvider so the view buttons can use the React Flow instance. */
function ToolbarHost({
  editor,
  nodes,
  boardTitle,
  onStructureAction,
}: {
  editor: ReturnType<typeof useMindEditor>;
  nodes: MindFlowNode[];
  boardTitle: string;
  onStructureAction(): void;
}) {
  const selected = nodes.find((node) => node.id === editor.selectedId);
  const view = useViewActions(selected ? selected.position : null);
  return <MindToolbar editor={editor} view={view} boardTitle={boardTitle} onStructureAction={onStructureAction} />;
}
