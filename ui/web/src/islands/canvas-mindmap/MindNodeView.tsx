// Custom React Flow node: label, inline editor and collapse indicator. Selection lives in the editor state.
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { type KeyboardEvent, useEffect, useRef } from "react";

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
