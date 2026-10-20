import { WarRoomScreenRenderer } from "../office-war-screen.js";
import { officeState } from "../office-state.js";
import { officeAgentState } from "../office/office-agent-state.js";
import { avatarStateFor, padColorFor } from "../office/office-agent-telemetry.js";
import { warRoomCorridorMethods } from "./war-room-corridor.js";
import { warRoomTableMethods } from "./war-room-table.js";

export class WarRoomBuilder {
  /**
   * @param {any} scene
   * @param {any} interactionManager
   */
  constructor(scene, interactionManager) {
    this.scene = scene;
    this.interactionManager = interactionManager;

    this.screenRenderer = new WarRoomScreenRenderer();
    this.warRoomTexture = null;
    this.warRoomScreenMesh = null;
    this.holoCoreMesh = null;
    this.orchGraph = null;
    this.agents3D = {};
    this.agentPads = {};
    this.timer = 0;

    officeAgentState.subscribe(() => this.applyAgentVisualState());

    window.addEventListener("dai:orchestrationState", (e) => {
      // @ts-ignore
      if (this.orchGraph) this.orchGraph.updateState(e.detail);
      this.refreshScreen();
    });
  }

  build(THREE) {
    this.buildCorridor(THREE);
    this.buildWarRoom(THREE);
    this.applyAgentVisualState();
  }

  applyAgentVisualState() {
    for (const [key, avatar] of Object.entries(this.agents3D || {})) {
      const status = officeAgentState.getAgentState(key).status;
      avatar.setState(avatarStateFor(status));
      const pad = (this.agentPads || {})[key];
      if (pad?.material?.color) pad.material.color.set(padColorFor(status));
    }
  }

  update(dt) {
    if (this.holoCoreMesh) {
      this.holoCoreMesh.rotation.y += dt * 0.85;
      this.holoCoreMesh.rotation.x += dt * 0.45;
    }

    if (this.orchGraph) {
      this.orchGraph.animate(dt);
    }

    this.timer += dt;
    if (this.timer > 3.0) {
      this.refreshScreen();
      this.timer = 0;
    }

    if (this.agents3D) {
      for (const k of Object.keys(this.agents3D)) {
        this.agents3D[k].update(dt);
      }
    }
  }

  refreshScreen() {
    if (!this.screenRenderer || !this.warRoomTexture) return;
    this.screenRenderer.render({
      activeProject: officeState.activeProject || "",
      projectData: officeState.projectData,
      agentsData: officeState.activeAgents,
      orchestrationState: officeState.orchestrationState,
      journal: officeState.journal
    });
    this.warRoomTexture.needsUpdate = true;
  }
}

Object.assign(WarRoomBuilder.prototype, warRoomCorridorMethods, warRoomTableMethods);
