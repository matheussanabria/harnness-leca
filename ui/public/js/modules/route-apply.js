// @ts-check
// Opens the screen a route points to. Used once at boot (deep link / F5) and again on Back/Forward.
import { VIEW_SCREENS, ISLAND_SCREENS } from "../shared/router.js";

const domDesignOpen = () => {
  const workspace = typeof document !== "undefined" ? document.getElementById("designWorkspace") : null;
  return Boolean(workspace && workspace.style.display === "flex");
};
const domStudioOpen = () => typeof document !== "undefined" && document.body.classList.contains("studio-active");

/**
 * @param {{
 *   designMod: { toggleDesignMode: (force?: boolean, view?: string) => Promise<void> | void, setDesignView: (view: string) => void },
 *   studioMod: { toggleStudioMode: (force?: boolean) => Promise<void> | void },
 *   prepareAtelier?: (protoId: string, screen: string) => Promise<unknown> | unknown,
 *   isDesignOpen?: () => boolean,
 *   isStudioOpen?: () => boolean,
 *   islands?: { mount: (name: string, props: { slug: string, params: string[] }) => Promise<boolean>, unmount: () => void },
 *   getSlug?: () => string,
 * }} deps
 */
export function createRouteApplier(deps) {
  const isDesignOpen = deps.isDesignOpen || domDesignOpen;
  const isStudioOpen = deps.isStudioOpen || domStudioOpen;

  /** @param {{ screen: string, params: string[] }} route */
  return async function applyRoute(route) {
    const { screen, params } = route;
    if (ISLAND_SCREENS.includes(screen)) {
      if (isStudioOpen()) await deps.studioMod.toggleStudioMode(false);
      if (isDesignOpen()) await deps.designMod.toggleDesignMode(false);
      if (deps.islands) await deps.islands.mount(screen, { slug: deps.getSlug ? deps.getSlug() : "", params });
      return;
    }
    // Leaving an island screen releases its React root before the legacy screen opens.
    deps.islands?.unmount();
    if (screen === "chats") {
      if (isStudioOpen()) await deps.studioMod.toggleStudioMode(false);
      if (isDesignOpen()) await deps.designMod.toggleDesignMode(false);
      return;
    }
    if (screen === "studio") {
      if (!isStudioOpen()) await deps.studioMod.toggleStudioMode(true);
      return;
    }
    if (!VIEW_SCREENS.includes(screen)) return;
    // A prototype in the address becomes the "active" one, so the Atelier restores exactly it.
    if (screen === "prototypes" && params[0] && deps.prepareAtelier) await deps.prepareAtelier(params[0], params[1] || "");
    if (isDesignOpen()) deps.designMod.setDesignView(screen);
    else await deps.designMod.toggleDesignMode(true, screen);
  };
}
