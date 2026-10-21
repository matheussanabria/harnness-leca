// @ts-check
// DAI HQ — Módulo de Registro e Gerenciamento de Interações Contextuais & Tooltip 3D

export class InteractionManager {
  /**
   * @param {HTMLElement} [promptEl]
   * @param {HTMLElement} [promptTextEl]
   * @param {HTMLElement} [tooltipEl]
   */
  constructor(promptEl, promptTextEl, tooltipEl) {
    this.promptEl = promptEl;
    this.promptTextEl = promptTextEl;
    this.tooltipEl = tooltipEl;

    this.registry = [];
    this.currentInteractive = null;
    this.hoverItem = null;
    this.interactiveObjects = [];

    this.raycaster = new window.THREE.Raycaster();
    this.mouse = new window.THREE.Vector2();
    this._projVec = new window.THREE.Vector3();
  }

  /**
   * Registra um objeto interativo
   * @param {Object} item
   * @param {string} item.id
   * @param {string} item.label
   * @param {string} [item.name]
   * @param {string} [item.badge]
   * @param {string} [item.badgeColor]
   * @param {string} [item.sub]
   * @param {string} [item.keyHint]
   * @param {number} [item.offsetY]
   * @param {any} item.position
   * @param {number} item.distance
   * @param {Function} item.onInteract
   * @param {any} [item.mesh]
   */
  register(item) {
    this.registry.push(item);
    if (item.mesh) {
      if (!item.mesh.userData) item.mesh.userData = {};
      if (!item.mesh.userData.id) item.mesh.userData.id = item.id;
      this.interactiveObjects.push(item.mesh);
    }
  }

  addInteractiveMesh(mesh, extraData = null) {
    if (mesh && !this.interactiveObjects.includes(mesh)) {
      if (extraData && mesh.userData) {
        Object.assign(mesh.userData, extraData);
      }
      this.interactiveObjects.push(mesh);
    }
  }

  showPrompt(text) {
    if (this.promptEl && this.promptTextEl) {
      this.promptTextEl.textContent = text;
      this.promptEl.style.display = "flex";
    }
  }

  hidePrompt() {
    if (this.promptEl) {
      this.promptEl.style.display = "none";
    }
  }

  /**
   * Avalia a proximidade do avatar com os objetos registrados
   * @param {any} avatarPos
   */
  updateProximity(avatarPos) {
    if (!avatarPos) return;

    let nearest = null;
    let minDist = Infinity;

    for (const item of this.registry) {
      const dist = avatarPos.distanceTo(item.position);
      if (dist <= item.distance && dist < minDist) {
        minDist = dist;
        nearest = item;
      }
    }

    if (nearest) {
      this.currentInteractive = nearest;
      this.showPrompt(nearest.label);
    } else {
      this.currentInteractive = null;
      this.hidePrompt();
    }
  }

  triggerCurrent() {
    const target = this.hoverItem || this.currentInteractive;
    if (target && typeof target.onInteract === "function") {
      target.onInteract();
      return true;
    }
    return false;
  }

  /**
   * Aciona uma interação registrada pelo ID (cliques em objetos sem atalho dedicado).
   * @param {string} id
   * @returns {boolean}
   */
  interactById(id) {
    const target = this.registry.find((item) => item.id === id);
    if (target && typeof target.onInteract === "function") {
      target.onInteract();
      return true;
    }
    return false;
  }

  /**
   * Raycasting para cliques
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLElement} domElement
   * @param {any} camera
   * @returns {string|null} ID do objeto atingido
   */
  raycastClick(clientX, clientY, domElement, camera, useCenter = false) {
    if (useCenter || document.pointerLockElement === domElement) {
      this.mouse.x = 0;
      this.mouse.y = 0;
    } else {
      const rect = domElement.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    this.raycaster.setFromCamera(this.mouse, camera);
    const hits = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (hits.length > 0) {
      const hit = hits[0];
      const targetId = hit.object.userData.id || (hit.object.parent && hit.object.parent.userData.id);
      return targetId || null;
    }
    return null;
  }

  /**
   * Raycasting para cursor pointer e identificação do hover
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLElement} domElement
   * @param {any} camera
   * @param {boolean} [useCenter]
   * @returns {boolean} true se estiver sobre objeto clicável
   */
  raycastHover(clientX, clientY, domElement, camera, useCenter = false) {
    if (useCenter || document.pointerLockElement === domElement) {
      this.mouse.x = 0;
      this.mouse.y = 0;
    } else {
      const rect = domElement.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    this.raycaster.setFromCamera(this.mouse, camera);
    let hits = this.raycaster.intersectObjects(this.interactiveObjects, true);

    // Fallback para mira central se o cursor lateral não atingir nada
    if (hits.length === 0 && !useCenter && !document.pointerLockElement) {
      const prevX = this.mouse.x;
      const prevY = this.mouse.y;
      this.mouse.x = 0;
      this.mouse.y = 0;
      this.raycaster.setFromCamera(this.mouse, camera);
      const centerHits = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (centerHits.length > 0) {
        hits = centerHits;
      } else {
        this.mouse.x = prevX;
        this.mouse.y = prevY;
      }
    }

    if (hits.length > 0) {
      const hit = hits[0];
      const targetId = hit.object.userData.id || (hit.object.parent && hit.object.parent.userData.id);
      const found = this.registry.find(r => r.id === targetId);
      if (found) {
        this.hoverItem = found;
      } else if (targetId) {
        this.hoverItem = {
          id: targetId,
          name: hit.object.userData.name || targetId,
          label: `[E] ${hit.object.userData.name || targetId}`,
          sub: "Clique para interagir",
          keyHint: "E",
          mesh: hit.object,
          offsetY: 1.6,
          position: hit.object.position
        };
      }
      return true;
    }

    this.hoverItem = null;
    return false;
  }

  /**
   * Atualiza a posição do Tooltip flutuante 3D na tela acima do objeto ou agente
   * @param {any} camera
   * @param {number} width
   * @param {number} height
   */
  updateTooltip(camera, width, height) {
    if (!this.tooltipEl) return;

    // Prioridade: item sob o cursor do mouse (hover) > item dentro do raio de interação do avatar
    const target = this.hoverItem || this.currentInteractive;

    if (!target) {
      this.tooltipEl.style.display = "none";
      return;
    }

    const v = this._projVec;
    if (target.mesh && typeof target.mesh.getWorldPosition === "function") {
      target.mesh.getWorldPosition(v);
    } else if (target.position) {
      v.copy(target.position);
    } else {
      this.tooltipEl.style.display = "none";
      return;
    }

    const offsetY = target.offsetY != null ? target.offsetY : 1.7;
    v.y += offsetY;

    v.project(camera);

    // O objeto precisa estar na frente da câmera (z < 1) e dentro da viewport visível
    if (v.z < 1 && v.x >= -1.1 && v.x <= 1.1 && v.y >= -1.1 && v.y <= 1.1) {
      const px = (v.x * 0.5 + 0.5) * width;
      const py = (-(v.y * 0.5) + 0.5) * height;

      const badgeHtml = target.badge
        ? `<span class="tooltip-badge" style="background:${target.badgeColor || '#0284c7'}33;color:${target.badgeColor || '#38bdf8'};border:1px solid ${target.badgeColor || '#38bdf8'}66">${target.badge}</span>`
        : "";
      const title = target.name || (target.label ? target.label.replace(/^\[E\]\s*/, "") : "Objeto");
      const sub = target.sub || (target.label || "Interagir");
      const keyHint = target.keyHint || "E";

      this.tooltipEl.innerHTML = `
        <div class="tooltip-header">
          ${badgeHtml}
          <span>${title}</span>
        </div>
        <div class="tooltip-sub">
          <span class="tooltip-key">${keyHint}</span>
          <span>${sub}</span>
        </div>
      `;

      this.tooltipEl.style.left = `${Math.round(px)}px`;
      this.tooltipEl.style.top = `${Math.round(py)}px`;
      this.tooltipEl.style.display = "block";
    } else {
      this.tooltipEl.style.display = "none";
    }
  }
}
