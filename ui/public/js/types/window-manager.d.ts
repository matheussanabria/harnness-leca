/**
 * Tipagens do Window Manager Híbrido (Harness Leca)
 * Zero dependências externas — interpretado nativamente pela IDE e tsc.
 */

export type WindowPresentation = 'sidebar' | 'floating' | 'docked' | 'maximized';
export type WindowVisibility = 'visible' | 'minimized';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModuleDescriptor {
  id: string;
  title: string;
  icon: string; // Exclusivamente FontAwesome (ex: "fa-solid fa-robot")
  defaultPresentation?: WindowPresentation;
  isSingleton?: boolean;
  defaultBounds?: WindowBounds;
  minBounds?: { width: number; height: number };
}

export interface WindowInstance {
  id: string;
  moduleId: string;
  projectId?: string;
  resourceId?: string;
  title: string;
  icon: string;
  presentation: WindowPresentation;
  previousPresentation?: WindowPresentation;
  visibility: WindowVisibility;
  bounds: WindowBounds;
  previousBounds?: WindowBounds;
  zIndex: number;
  isFocused: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WindowManagerState {
  windows: WindowInstance[];
  activeWindowId: string | null;
  baseZIndex: number;
  highestZIndex: number;
}

export interface WindowOpenOptions {
  projectId?: string;
  resourceId?: string;
  title?: string;
  icon?: string;
  presentation?: WindowPresentation;
  bounds?: Partial<WindowBounds>;
}

export interface WindowManagerListener {
  (state: WindowManagerState): void;
}
