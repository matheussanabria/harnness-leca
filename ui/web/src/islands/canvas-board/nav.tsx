// Navigation between the board list and one board. Standalone it uses hash links; embedded in the Design workspace the
// hash must stay untouched (it would remount the island), so the same links become buttons with internal navigation.
import { createContext, type ReactNode, useContext } from "react";

export interface BoardNav {
  embedded: boolean;
  open(id: string): void;
  close(): void;
}

const noop = () => undefined;
export const BoardNavContext = createContext<BoardNav>({ embedded: false, open: noop, close: noop });
export const useBoardNav = () => useContext(BoardNavContext);

interface NavLinkProps {
  /** Board to open; omitted means "back to the list". */
  boardId?: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}

export function NavLink({ boardId, className, onClick, children }: NavLinkProps) {
  const nav = useBoardNav();
  if (!nav.embedded) {
    return (
      <a className={className} href={boardId ? `#/canvas-board/${boardId}` : "#/canvas-board"} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onClick?.();
        if (boardId) nav.open(boardId);
        else nav.close();
      }}
    >
      {children}
    </button>
  );
}
