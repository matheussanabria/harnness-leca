// One icon-only, accessible button of the floating mind-map action bar.
import type { MouseEvent } from "react";

export interface ToolbarButtonProps {
  icon: string;
  label: string;
  onClick(): void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  pressed?: boolean;
}

export function ToolbarButton({
  icon,
  label,
  onClick,
  shortcut,
  disabled = false,
  danger = false,
  pressed,
}: ToolbarButtonProps) {
  const hint = shortcut ? `${label} (${shortcut})` : label;
  const className = `mm-tool${danger ? " mm-tool--danger" : ""}${pressed ? " mm-tool--on" : ""}`;
  return (
    <button
      type="button"
      className={className}
      title={hint}
      aria-label={hint}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
    </button>
  );
}
