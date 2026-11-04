// Links between the board list and one board. Standalone they are hash links; embedded in the Design workspace the side
// catalog owns navigation between boards, so the links render nothing.
import { createContext, type ReactNode, useContext } from "react";

export interface BoardNav {
  embedded: boolean;
}

export const BoardNavContext = createContext<BoardNav>({ embedded: false });
export const useBoardNav = () => useContext(BoardNavContext);

interface NavLinkProps {
  /** Board to open; omitted means "back to the list". */
  boardId?: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}

export function NavLink({ boardId, className, onClick, children }: NavLinkProps) {
  if (useBoardNav().embedded) return null;
  return (
    <a className={className} href={boardId ? `#/canvas-board/${boardId}` : "#/canvas-board"} onClick={onClick}>
      {children}
    </a>
  );
}
