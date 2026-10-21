// @ts-check
// DAI HQ — Fachada Orquestradora do Escritório 3D (Refatorada sob princípios SOLID)
import { Avatar3D } from "./office-avatar.js";
import { officeState } from "./office-state.js";

import { PhysicsEngine } from "./office3d/physics-engine.js";
import { CameraController } from "./office3d/camera-controller.js";
import { InteractionManager } from "./office3d/interaction-manager.js";
import { BrowserScreenManager } from "./office3d/browser-screen.js";
import { MainWorkspaceBuilder } from "./office3d/world-main-workspace.js";
import { WarRoomBuilder } from "./office3d/world-war-room.js";
import { setupOfficeLights } from "./office3d/scene-lighting.js";
import { bindOfficeLightingRig } from "./office/office-lighting-bootstrap.js";
import { setupOfficeInteractions } from "./office3d/interactions-setup.js";
import { SeatAndModeManager } from "./office3d/seat-and-mode-manager.js";
import { AvatarMovementController } from "./office3d/avatar-movement.js";
import { OfficePointerController } from "./office3d/pointer-controller.js";
import { office3dControlsMethods } from "./office-3d-controls.js";
import { FrameLoop } from "./office/frame-loop.js";

export class Office3D {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} tooltipEl
   * @param {Object} [options]
   * @param {Document | any} [options.doc]
   */
  constructor(container, tooltipEl, options = {}) {
    this.container = container;
    this.tooltip = tooltipEl;
    this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cssScene = null;
    this.cssRenderer = null;
    this.orbitControls = null;
    this.isLoaded = false;
    this.reducedMotion = false;
    this.performanceProfile = null;

    // Coordenadas das Estações
    this.positions = {
      chairPos: { x: 0, y: 0, z: 0.82 },
      standUpPos: { x: 0, y: 0, z: 1.45 },
      warChairPos: { x: -13.0, y: 0, z: 1.35 },
      warStandUpPos: { x: -13.0, y: 0, z: 2.2 }
    };

    this.avatar = null;

    // Submódulos especializados (SOLID / SRP)
    this.physics = new PhysicsEngine();
    this.cameraController = null;
    this.interactionManager = null;
    this.browserScreen = null;
    this.mainWorkspaceBuilder = null;
    this.warRoomBuilder = null;
    this.lightingRig = null;
    this.seatManager = null;
    this.movementController = null;
    this.pointerController = null;

    this.onWindowResize = this.onWindowResize.bind(this);
    this.loop = new FrameLoop({
      doc: this.doc,
      onFrame: (_time, dt) => this.renderFrame(dt)
    });
  }

  get viewMode() {
    return this.seatManager?.viewMode || "third_person";
  }

  get isSeated() {
    return this.seatManager?.isSeated || false;
  }

  get chairPos() {
    return this.positions.chairPos;
  }

  get warChairPos() {
    return this.positions.warChairPos;
  }

  async init() {
    if (this.isLoaded) return true;

    const THREE = window.THREE;
    if (!THREE) {
      console.error("[Office3D] Three.js não encontrado no escopo global.");
      return false;
    }

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    // 1. Cena, Câmera e Controles
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.028);

    this.camera = new THREE.PerspectiveCamera(54, w / h, 0.05, 100);
    this.camera.position.set(0, 2.2, 5.0);
    this.scene.add(this.camera);

    this.cameraController = new CameraController(this.camera);
    try {
      const savedSens = localStorage.getItem("dai_mouse_sensitivity");
      if (savedSens) this.cameraController.setSensitivity(Number(savedSens));
    } catch (_) {}

    // 2. Renderers (WebGL + CSS3D)
    this.initRenderers(w, h, THREE);

    // 3. Luzes Cenográficas
    this.lightingRig = setupOfficeLights(this.scene, THREE);
    bindOfficeLightingRig(this.lightingRig);

    // 4. Inicialização dos Gerenciadores Submódulos
    const promptEl = document.getElementById("interactionPrompt");
    const promptTextEl = document.getElementById("interactionPromptText");
    this.interactionManager = new InteractionManager(promptEl, promptTextEl, this.tooltip);

    this.browserScreen = new BrowserScreenManager(this.scene, this.cssScene, (mode) => {
      if (mode === "toggle_screen_focus") {
        this.setViewMode(this.viewMode === "screen_focus" ? "workstation" : "screen_focus");
      } else {
        this.setViewMode(mode);
      }
    });

    // 5. Construção do Mundo
    this.mainWorkspaceBuilder = new MainWorkspaceBuilder(this.scene, this.positions.chairPos, this.interactionManager);
    this.mainWorkspaceBuilder.build(THREE);

    const screenMesh = this.browserScreen.buildPhysicalMonitor(THREE);
    this.interactionManager.addInteractiveMesh(screenMesh);
    this.browserScreen.buildInteractiveBrowser();

    this.warRoomBuilder = new WarRoomBuilder(this.scene, this.interactionManager);
    this.warRoomBuilder.build(THREE);

    // 6. Avatar Humano Jogável
    this.avatar = new Avatar3D(THREE);
    this.avatar.reducedMotion = this.reducedMotion;
    this.avatar.position.set(0, 0, 2.2);
    this.avatar.rotation = Math.PI;
    this.avatar.targetRotation = Math.PI;
    this.scene.add(this.avatar.root);

    // 7. Gerenciador de Assentos e Modos
    const crosshair = document.getElementById("officeCrosshair");
    const pointerLockHint = document.getElementById("officePointerLockHint");
    this.seatManager = new SeatAndModeManager({
      cameraController: this.cameraController,
      avatar: this.avatar,
      orbitControls: this.orbitControls,
      interactionManager: this.interactionManager,
      cssRenderer: this.cssRenderer,
      crosshair,
      positions: this.positions
    });

    // 8. Registro de Ações dos Objetos Interativos
    setupOfficeInteractions(this.interactionManager, THREE, {
      chairPos: this.positions.chairPos,
      warChairPos: this.positions.warChairPos,
      sitAtWorkstation: () => this.sitAtWorkstation(),
      sitAtWarRoom: () => this.sitAtWarRoom(),
      openWarRoomDrawer: (tab) => this.openWarRoomDrawer(tab),
      openAgentDossier: (key) => this.openAgentDossier(key),
      toggleScreenFocus: () => {
        if (!this.isSeated) this.sitAtWorkstation();
        else this.setViewMode(this.viewMode === "screen_focus" ? "workstation" : "screen_focus");
      }
    });

    // 9. Controladores de Input
    this.movementController = new AvatarMovementController({
      avatar: this.avatar,
      physics: this.physics,
      cameraController: this.cameraController,
      interactionManager: this.interactionManager,
      seatManager: this.seatManager
    });
    this.movementController.attachListeners();

    this.pointerController = new OfficePointerController({
      container: this.container,
      renderer: this.renderer,
      camera: this.camera,
      cameraController: this.cameraController,
      interactionManager: this.interactionManager,
      seatManager: this.seatManager,
      crosshair,
      pointerLockHint
    });
    this.pointerController.attachListeners();

    window.addEventListener("resize", this.onWindowResize);

    this.isLoaded = true;
    return true;
  }

  update(dt) {
    if (!window.THREE) return;
    this.warRoomBuilder?.update(dt);

    if (this.viewMode === "orbit") {
      if (this.orbitControls) this.orbitControls.update();
      if (this.avatar) this.avatar.update(dt);
      return;
    }

    this.movementController?.update(dt);
    this.cameraController?.update(this.avatar, this.isSeated, this.seatManager?.seatedType);

    if (Math.random() < 0.04) {
      this.browserScreen?.updateFallbackTexture(officeState.projectData);
    }
  }

  renderFrame(dt) {
    this.update(dt);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.interactionManager?.updateTooltip(this.camera, w, h);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.cssRenderer && this.cssScene && this.camera) {
      this.cssRenderer.render(this.cssScene, this.camera);
    }
  }

  start() {
    this.container.style.display = "block";
    if (this.cssRenderer) this.cssRenderer.domElement.style.display = "block";
    this.onWindowResize();
    this.loop.start();
  }

  applyPerformanceProfile(profile) {
    if (profile) this.performanceProfile = profile;
    this.applyRendererQuality?.(profile);
  }

  setReducedMotion(reduced) {
    this.reducedMotion = Boolean(reduced);
    if (this.avatar) this.avatar.reducedMotion = this.reducedMotion;
    if (this.orbitControls) this.orbitControls.enableDamping = !this.reducedMotion;
  }

  onProjectChanged(state) {
    if (this.warRoomBuilder) {
      this.warRoomBuilder.refreshScreen();
    }
    if (this.browserScreen) {
      this.browserScreen.onProjectChanged(state.activeProject, state.projectData);
    }
  }

  stop() {
    this.container.style.display = "none";
    if (this.cssRenderer) this.cssRenderer.domElement.style.display = "none";
    this.loop.stop();
    if (this.tooltip) this.tooltip.style.display = "none";
    this.interactionManager?.hidePrompt();
  }
}

Object.assign(Office3D.prototype, office3dControlsMethods);
