// React Flow rendering of the mind map plus keyboard handling. All state comes from useMindEditor.
import "@xyflow/react/dist/style.css";
import { Background, Controls, type Edge, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { handleKey } from "../../features/mindmap/keymap.ts";
import { layoutTree } from "../../features/mindmap/layout.ts";
import type { useMindEditor } from "../../features/mindmap/useMindEditor.ts";
import { type MindFlowNode, MindNodeView } from "./MindNodeView.tsx";

const nodeTypes = { mind: MindNodeView };

export function MindmapCanvas({ editor }: { editor: ReturnType<typeof useMindEditor> }) {
  const { doc, selectedId, editingId, commands, setSelectedId } = editor;
  const frame = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    // Give the keyboard back to the tree once the inline editor closes.
    if (wasEditing.current && !editingId) frame.current?.focus();
    wasEditing.current = editingId !== null;
  }, [editingId]);

  const { nodes, edges } = useMemo(() => {
    const placed = layoutTree(doc);
    const flowNodes: MindFlowNode[] = placed.map((item) => ({
      id: item.id,
      type: "mind",
      position: { x: item.x, y: item.y },
      draggable: false,
      connectable: false,
      data: {
        text: doc.nodes[item.id]?.text ?? "",
        selected: item.id === selectedId,
        editing: item.id === editingId,
        hasChildren: item.hasChildren,
        collapsed: item.collapsed,
        isRoot: item.parentId === null,
        onCommit: commands.commitText,
        onCancel: commands.cancelEdit,
        onToggle: (id: string) => {
          setSelectedId(id);
          commands.toggleNode(id);
        },
      },
    }));
    const flowEdges: Edge[] = placed
      .filter((item) => item.parentId !== null)
      .map((item) => ({
        id: `${item.parentId}-${item.id}`,
        source: item.parentId as string,
        target: item.id,
        type: "default",
      }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [doc, selectedId, editingId, commands, setSelectedId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editingId) return;
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
          nodesDraggable={false}
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
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
