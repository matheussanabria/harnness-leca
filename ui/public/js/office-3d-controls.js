// @ts-check
// Renderizadores, modos de visão, sentar/levantar e painéis (mixin de Office3D).
import { clampPixelRatio } from "./office/scene-preferences.js";

export const office3dControlsMethods = {
  initRenderers(w, h, THREE) {
    const profile = this.performanceProfile || { maxPixelRatio: 2, shadows: true };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio, profile.maxPixelRatio));
    this.renderer.shadowMap.enabled = profile.shadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE.CSS3DRenderer) {
      this.cssScene = new THREE.Scene();
      this.cssRenderer = new window.THREE.CSS3DRenderer();
      this.cssRenderer.setSize(w, h);
      this.cssRenderer.domElement.style.position = "absolute";
      this.cssRenderer.domElement.style.top = "0";
      this.cssRenderer.domElement.style.left = "0";
      this.cssRenderer.domElement.style.width = "100%";
      this.cssRenderer.domElement.style.height = "100%";
      this.cssRenderer.domElement.style.pointerEvents = "none";
      this.container.appendChild(this.cssRenderer.domElement);
    }

    if (window.THREE.OrbitControls) {
      this.orbitControls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.dampingFactor = 0.06;
      this.orbitControls.maxPolarAngle = Math.PI / 2.05;
      this.orbitControls.minDistance = 0.8;
      this.orbitControls.maxDistance = 18;
      this.orbitControls.target.set(0, 1.25, 0.5);
      this.orbitControls.enableDamping = !this.reducedMotion;
      this.orbitControls.enabled = false;
    }
  },

  applyRendererQuality(profile) {
    if (!this.renderer) return;
    const active = profile || this.performanceProfile || { maxPixelRatio: 2, shadows: true };
    this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio, active.maxPixelRatio));
    const shadows = active.shadows !== false;
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.onWindowResize();
  },

  setViewMode(mode) {
    this.seatManager?.setViewMode(mode);
  },

  updateActiveButton() {
    this.seatManager?.updateActiveButton();
  },

  sitAtWorkstation() {
    this.seatManager?.sitAtWorkstation();
  },

  sitAtWarRoom() {
    this.seatManager?.sitAtWarRoom();
  },

  standUp() {
    this.seatManager?.standUp();
  },

  openWarRoomDrawer(tab = "workflows") {
    this.seatManager?.openWarRoomDrawer(tab);
  },

  openAgentDossier(agentKey) {
    this.seatManager?.openAgentDossier(agentKey);
  },

  setMouseSensitivity(level) {
    this.cameraController?.setSensitivity(level);
  },

  getMouseSensitivity() {
    return this.cameraController ? this.cameraController.getSensitivity() : 5;
  },

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.cssRenderer) this.cssRenderer.setSize(w, h);
  },
};
