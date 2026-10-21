// @ts-check
/**
 * Ligações da iluminação funcional ao estado dos agentes e ao rig 3D (EP-03.06).
 */
import { officeAgentState } from "./office-agent-state.js";
import { officeLighting } from "./office-lighting.js";
import { createLightingDomTarget } from "./office-lighting-dom.js";

/**
 * Liga o alvo DOM ao estado canônico dos agentes.
 * @param {Document | { documentElement?: any } | null} [doc]
 * @returns {() => void} desinscrição completa
 */
export function bindOfficeLightingDom(doc = typeof document !== "undefined" ? document : null) {
  const detach = officeLighting.attach(createLightingDomTarget(doc));
  officeLighting.refreshFromAgents(officeAgentState.getAllStates());
  const unsubscribe = officeAgentState.subscribe((states) => {
    officeLighting.refreshFromAgents(states);
  });
  return () => {
    unsubscribe();
    detach();
  };
}

/**
 * Registra o rig 3D como alvo de apresentação.
 * @param {{ apply: (preset: any) => void, reset?: () => void }} rig
 * @returns {() => void} desinscrição
 */
export function bindOfficeLightingRig(rig) {
  return officeLighting.attach(rig);
}
