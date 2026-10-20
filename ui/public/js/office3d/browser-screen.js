// @ts-check
// DAI HQ — Módulo do Monitor Interativo Ultrawide e Navegador CSS3D

import { MonitorScreenRenderer } from "../office-screen.js";
import { officeState } from "../office-state.js";
import { playClickSound } from "../office-audio.js";

export class BrowserScreenManager {
  /**
   * @param {any} scene
   * @param {any} cssScene
   * @param {Function} onSetViewMode
   */
  constructor(scene, cssScene, onSetViewMode) {
    this.scene = scene;
    this.cssScene = cssScene;
    this.onSetViewMode = onSetViewMode;

    this.screenRenderer = new MonitorScreenRenderer();
    this.monitorTexture = null;
    this.screenMesh = null;
    this.cssScreenObject = null;
    this.monitorIframe = null;
    this.monitorUrlInput = null;
    this.currentUrl = "/diario";
  }

  /**
   * Constrói a estrutura física e a textura WebGL de fallback do monitor
   * @param {any} THREE
   * @returns {any} screenMesh para interação
   */
  buildPhysicalMonitor(THREE) {
    const screenW = 1.62;
    const screenH = 0.92;

    // Suporte / Haste de metal do monitor
    const standGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.45, 16);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, metalness: 0.8, roughness: 0.3 });
    const stand = new THREE.Mesh(standGeo, metalMat);
    stand.position.set(0, 1.15, -0.22);
    stand.castShadow = true;
    this.scene.add(stand);

    // Base da haste na mesa
    const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.02, 24);
    const baseMesh = new THREE.Mesh(baseGeo, metalMat);
    baseMesh.position.set(0, 1.0, -0.22);
    this.scene.add(baseMesh);

    // Moldura traseira do monitor
    const frameGeo = new THREE.BoxGeometry(screenW + 0.04, screenH + 0.04, 0.05);
    const frame = new THREE.Mesh(frameGeo, metalMat);
    frame.position.set(0, 1.38, -0.2);
    frame.castShadow = true;
    this.scene.add(frame);

    // Renderiza a textura da tela inicial (Fallback WebGL)
    this.screenRenderer.render(officeState.projectData);
    this.monitorTexture = new THREE.CanvasTexture(this.screenRenderer.getCanvas());
    this.monitorTexture.minFilter = THREE.LinearFilter;
    this.monitorTexture.magFilter = THREE.LinearFilter;
    this.monitorTexture.anisotropy = 16;

    // A Tela Plana Emissiva 16:9
    const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.monitorTexture });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 1.38, -0.174);
    this.screenMesh.userData = { id: "monitor_screen", name: "Tela do Monitor Principal" };
    this.scene.add(this.screenMesh);

    // Barra de luz LED sobre o monitor (Screenbar)
    const barGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 12);
    barGeo.rotateZ(Math.PI / 2);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const screenBar = new THREE.Mesh(barGeo, barMat);
    screenBar.position.set(0, 1.38 + screenH / 2 + 0.03, -0.15);
    this.scene.add(screenBar);

    return this.screenMesh;
  }

  /**
   * Constrói o container CSS3D com o iframe navegável
   */
  buildInteractiveBrowser() {
    if (!this.cssScene || !window.THREE.CSS3DObject) return;

    // Container DOM com proporção de 16:9 de alta definição
    const browserWrapper = document.createElement("div");
    browserWrapper.className = "monitor-3d-screen";
    browserWrapper.style.pointerEvents = "auto";

    // Barra de navegação com URL e atalhos rápidos
    const navBar = document.createElement("div");
    navBar.className = "monitor-browser-bar";

    navBar.innerHTML = `
      <div class="browser-window-dots">
        <span class="browser-dot red" title="Recarregar tela"></span>
        <span class="browser-dot yellow" title="Visão em 1ª Pessoa"></span>
        <span class="browser-dot green" title="Foco / Zoom Total na Tela"></span>
      </div>
      <button class="browser-nav-btn" id="btnBrowserReload" title="Recarregar página"><i class="fa-solid fa-rotate-right"></i></button>
      <div class="browser-url-bar">
        <span class="browser-url-icon"><i class="fa-solid fa-lock"></i></span>
        <input class="browser-url-input" id="monitorBrowserUrl" type="text" value="${this.currentUrl}" placeholder="Digite uma URL (ex: http://localhost:4200, /diario, /preview)...">
        <button class="browser-go-btn" id="btnBrowserGo">Ir <i class="fa-solid fa-arrow-right"></i></button>
      </div>
      <div class="browser-shortcuts">
        <button class="browser-shortcut-chip" data-action="diario" title="Abrir Diário do Projeto">Diário</button>
        <button class="browser-shortcut-chip" data-action="prototype" title="Abrir Protótipo do Projeto Ativo">Protótipo</button>
        <button class="browser-shortcut-chip" data-url="/" title="Abrir Central Harness">Harness</button>
      </div>
      <button class="browser-focus-zoom-btn" id="btnBrowserZoom" title="Dar Zoom ou Voltar">Zoom</button>
    `;

    // Viewport com o iframe real navegável
    const viewportDiv = document.createElement("div");
    viewportDiv.className = "monitor-browser-viewport";

    const iframe = document.createElement("iframe");
    iframe.id = "officeMonitorIframe";
    iframe.src = this.currentUrl;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    viewportDiv.appendChild(iframe);

    browserWrapper.appendChild(navBar);
    browserWrapper.appendChild(viewportDiv);

    this.monitorIframe = iframe;
    this.monitorUrlInput = /** @type {HTMLInputElement} */ (navBar.querySelector("#monitorBrowserUrl"));

    // Eventos dos botões
    const btnGo = navBar.querySelector("#btnBrowserGo");
    const btnReload = navBar.querySelector("#btnBrowserReload");
    const btnZoom = navBar.querySelector("#btnBrowserZoom");
    const dotRed = navBar.querySelector(".browser-dot.red");
    const dotYellow = navBar.querySelector(".browser-dot.yellow");
    const dotGreen = navBar.querySelector(".browser-dot.green");

    btnGo?.addEventListener("click", () => this.navigateTo(this.monitorUrlInput?.value));
    this.monitorUrlInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.navigateTo(this.monitorUrlInput?.value);
    });

    btnReload?.addEventListener("click", () => this.reloadIframe());
    dotRed?.addEventListener("click", () => this.reloadIframe());
    dotYellow?.addEventListener("click", () => this.onSetViewMode("first_person"));
    dotGreen?.addEventListener("click", () => this.onSetViewMode("screen_focus"));
    btnZoom?.addEventListener("click", () => {
      this.onSetViewMode("toggle_screen_focus");
    });

    // Atalhos rápidos
    navBar.querySelectorAll(".browser-shortcut-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const action = chip.getAttribute("data-action");
        const url = chip.getAttribute("data-url");
        const activeProj = officeState.activeProject || "";
        let target = url;
        if (action === "diario") {
          target = activeProj ? `/diario?p=${encodeURIComponent(activeProj)}` : "/diario";
        } else if (action === "prototype") {
          target = activeProj ? `/api/project/${encodeURIComponent(activeProj)}/design/prototype` : "/";
        }
        if (target) {
          navBar.querySelectorAll(".browser-shortcut-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          this.navigateTo(target);
        }
      });
    });

    // Cria o objeto CSS3D e ajusta escala e posicionamento no monitor
    this.cssScreenObject = new window.THREE.CSS3DObject(browserWrapper);
    this.cssScreenObject.scale.set(0.001125, 0.001125, 0.001125);
    this.cssScreenObject.position.set(0, 1.38, -0.170);
    this.cssScene.add(this.cssScreenObject);
  }

  navigateTo(url) {
    if (!url) return;
    let target = url.trim();
    if (!target.startsWith("http://") && !target.startsWith("https://") && !target.startsWith("/")) {
      target = "http://" + target;
    }
    this.currentUrl = target;
    if (this.monitorIframe) {
      this.monitorIframe.src = target;
    }
    if (this.monitorUrlInput) {
      this.monitorUrlInput.value = target;
    }
    playClickSound();
  }

  reloadIframe() {
    if (this.monitorIframe) {
      this.monitorIframe.src = this.currentUrl;
      playClickSound();
    }
  }

  updateFallbackTexture(projectData) {
    if (this.monitorTexture) {
      this.screenRenderer.render(projectData);
      this.monitorTexture.needsUpdate = true;
    }
  }

  onProjectChanged(activeProject, projectData) {
    this.updateFallbackTexture(projectData);
    if (this.currentUrl.includes("/design/prototype") || this.currentUrl.includes("/diario")) {
      const target = this.currentUrl.includes("/diario")
        ? `/diario?p=${encodeURIComponent(activeProject)}`
        : `/api/project/${encodeURIComponent(activeProject)}/design/prototype`;
      this.navigateTo(target);
    }
  }
}
