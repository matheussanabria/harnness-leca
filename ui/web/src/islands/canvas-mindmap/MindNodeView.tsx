// Custom React Flow node: label, inline editor and collapse indicator. Selection lives in the editor state.
import { Handle, type Node, type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { MAX_NODE_H, MAX_NODE_W, MIN_NODE_H, MIN_NODE_W } from "../../features/mindmap/types.ts";

export interface MindNodeData extends Record<string, unknown> {
  text: string;
  selected: boolean;
  editing: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  isRoot: boolean;
  onCommit(id: string, text: string): void;
  onCancel(): void;
  onToggle(id: string): void;
  onResize(id: string, w: number, h: number): void;
}

export type MindFlowNode = Node<MindNodeData, "mind">;

export function MindNodeView({ id, data }: NodeProps<MindFlowNode>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (data.editing) input.current?.select();
  }, [data.editing]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") data.onCommit(id, event.currentTarget.value);
    if (event.key === "Escape") data.onCancel();
  };

  const label = data.text || "Empty node";
  return (
    <div
      className={`mm-node${data.selected ? " mm-node--selected" : ""}${data.isRoot ? " mm-node--root" : ""}`}
      role="treeitem"
      aria-selected={data.selected}
      aria-expanded={data.hasChildren ? !data.collapsed : undefined}
      aria-label={label}
      tabIndex={-1}
    >
      <NodeResizer
        isVisible={data.selected && !data.editing}
        minWidth={MIN_NODE_W}
        maxWidth={MAX_NODE_W}
        minHeight={MIN_NODE_H}
        maxHeight={MAX_NODE_H}
        handleClassName="mm-resize-handle nodrag"
        lineClassName="mm-resize-line"
        onResizeEnd={(_, params) => data.onResize(id, params.width, params.height)}
      />
      <Handle type="target" position={Position.Left} isConnectable={false} className="mm-handle" />
      {data.editing ? (
        <input
          ref={input}
          className="mm-node__input"
          aria-label="Node text"
          defaultValue={data.text}
          // biome-ignore lint/a11y/noAutofocus: the editor opens on an explicit user action (Enter, Tab or F2)
          autoFocus
          onKeyDown={onKeyDown}
          onBlur={(event) => data.onCommit(id, event.currentTarget.value)}
        />
      ) : (
        <span className={`mm-node__text${data.text ? "" : " mm-node__text--empty"}`}>{label}</span>
      )}
      {data.hasChildren ? (
        <button
          type="button"
          className="mm-node__toggle nodrag"
          aria-label={data.collapsed ? "Expand branch" : "Collapse branch"}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(id);
          }}
        >
          <i className={`fa-solid ${data.collapsed ? "fa-chevron-right" : "fa-chevron-left"}`} aria-hidden="true" />
        </button>
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} className="mm-handle" />
    </div>
  );
}
