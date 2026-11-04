// Contract between the legacy shell (ui/public/js/shared/island-loader.js) and every React island.
// Islands talk to legacy code only through the router and `harness:*` window events, never shared modules.
import { type ComponentType, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";

export interface IslandProps {
  slug: string;
  params: string[];
  /** True when mounted inside a legacy workspace (Design) instead of the full-screen island host. */
  embedded?: boolean;
}

export interface IslandHandle {
  unmount(): void;
}

export type MountIsland = (el: HTMLElement, props: IslandProps) => IslandHandle;

/** Wraps a component into the `mount` function the loader calls. */
export function createIsland(Component: ComponentType<IslandProps>): MountIsland {
  return (el, props) => {
    const root = createRoot(el);
    root.render(createElement(StrictMode, null, createElement(Component, props)));
    return { unmount: () => root.unmount() };
  };
}
