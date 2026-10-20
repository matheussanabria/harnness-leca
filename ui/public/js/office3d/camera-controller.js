// @ts-check
// DAI HQ — Módulo de Controle de Câmera 3D (3ª Pessoa, 1ª Pessoa, Estação e Damping)

export class CameraController {
  /**
   * @param {any} camera
   */
  constructor(camera) {
    this.camera = camera;

    // Modos: "third_person", "first_person", "workstation", "screen_focus", "war_room_seated", "orbit"
    this.viewMode = "third_person";

    // Ângulos de rotação orbital e elevação
    this.camYaw = 0;
    this.camPitch = 0.20;
    this.camDist = 2.8;
    this.targetYaw = 0;
    this.targetPitch = 0.20;

    // Sensibilidade calibrada para resposta rápida e natural (níveis 1 a 10)
    this.sensitivityLevel = 5;
    this.sensitivity = 0.0028;

    // Vetores de interpolação suave
    this.currentCamPos = camera.position.clone();
    this.currentCamLookAt = new window.THREE.Vector3(0, 1.4, 2.0);

    this.isMouseDown = false;
    this.hasMouseMoved = false;
    this.mousePrev = { x: 0, y: 0 };
  }

  setMode(mode) {
    this.viewMode = mode;
  }

  setSensitivity(level) {
    const num = Math.max(1, Math.min(10, Math.round(Number(level) || 5)));
    this.sensitivityLevel = num;
    this.sensitivity = 0.0010 + (num - 1) * 0.00045;
  }

  getSensitivity() {
    return this.sensitivityLevel || 5;
  }

  handlePointerDown(clientX, clientY) {
    this.isMouseDown = true;
    this.mousePrev = { x: clientX, y: clientY };
  }

  handlePointerUp() {
    this.isMouseDown = false;
  }

  handlePointerLeave() {
    this.hasMouseMoved = false;
  }

  handlePointerMove(clientX, clientY, movementX = 0, movementY = 0, isLocked = false) {
    let dx = 0;
    let dy = 0;

    if (isLocked) {
      // Quando travado em Pointer Lock: Rotação contínua 360° sem limites de borda
      dx = (movementX || 0) * this.sensitivity;
      dy = (movementY || 0) * this.sensitivity;
    } else {
      // Fallback sem Pointer Lock: prefere movementX/Y nativo se o navegador enviar
      if (movementX !== 0 || movementY !== 0) {
        dx = (movementX || 0) * this.sensitivity;
        dy = (movementY || 0) * this.sensitivity;
      } else {
        if (!this.hasMouseMoved) {
          this.mousePrev = { x: clientX, y: clientY };
          this.hasMouseMoved = true;
          return;
        }
        dx = (clientX - this.mousePrev.x) * (this.sensitivity * 1.15);
        dy = (clientY - this.mousePrev.y) * (this.sensitivity * 1.15);
        this.mousePrev = { x: clientX, y: clientY };
      }
    }

    if (this.viewMode === "third_person" || this.viewMode === "first_person") {
      this.targetYaw -= dx;
      this.targetPitch += dy;

      // Limites verticais de inclinação da cabeça/olhar
      this.targetPitch = Math.max(-0.55, Math.min(0.72, this.targetPitch));
    }
  }

  handleWheel(deltaY) {
    if (this.viewMode === "third_person") {
      this.camDist += deltaY * 0.003;
      this.camDist = Math.max(1.6, Math.min(4.8, this.camDist));
    }
  }

  /**
   * Atualiza a posição e rotação da câmera com amortecimento suave
   * @param {any} avatar
   * @param {boolean} isSeated
   * @param {string} seatedType
   */
  update(avatar, isSeated, seatedType) {
    const THREE = window.THREE;
    if (!THREE || !this.camera) return;

    if (this.viewMode === "orbit") {
      return;
    }

    // Suavização do mouse look ágil (0.65 elimina o lag elástico e responde na hora)
    this.camYaw += (this.targetYaw - this.camYaw) * 0.65;
    this.camPitch += (this.targetPitch - this.camPitch) * 0.65;

    const targetCam = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    // Vetor direcional da visão gerado pelo movimento do mouse
    const forwardX = Math.sin(this.camYaw) * Math.cos(this.camPitch);
    const forwardY = -Math.sin(this.camPitch);
    const forwardZ = Math.cos(this.camYaw) * Math.cos(this.camPitch);

    // Vetor lateral perpendicular para visualização over-the-shoulder
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    if (this.viewMode === "third_person" && avatar) {
      // 3ª Pessoa: Posição orbita suavemente atrás do avatar com shoulder offset
      const dist = this.camDist;
      const pivotY = avatar.position.y + 1.45;
      const shoulder = 0.36;

      targetCam.x = avatar.position.x - forwardX * dist + rightX * shoulder;
      targetCam.y = pivotY - forwardY * dist + 0.12;
      targetCam.z = avatar.position.z - forwardZ * dist + rightZ * shoulder;

      // Ponto focal rigorosamente paralelo ao vetor do mouse (alinhamento 1:1)
      const lookDist = 16.0;
      targetLook.x = targetCam.x + forwardX * lookDist;
      targetLook.y = targetCam.y + forwardY * lookDist;
      targetLook.z = targetCam.z + forwardZ * lookDist;
    } else if (this.viewMode === "first_person" && avatar) {
      // 1ª Pessoa: Câmera na cabeça do avatar mirando no centro
      const eyePos = avatar.getEyePosition();
      targetCam.copy(eyePos);

      const lookDist = 16.0;
      targetLook.x = eyePos.x + forwardX * lookDist;
      targetLook.y = eyePos.y + forwardY * lookDist;
      targetLook.z = eyePos.z + forwardZ * lookDist;
    } else if (this.viewMode === "screen_focus") {
      targetCam.set(0, 1.38, 0.95);
      targetLook.set(0, 1.38, -0.17);
    } else if (this.viewMode === "workstation" || (isSeated && seatedType === "workstation")) {
      targetCam.set(0, 1.42, 0.75);
      targetLook.set(0, 1.38, -0.15);
    } else if (this.viewMode === "war_room_seated" || (isSeated && seatedType === "war_room")) {
      targetCam.set(-13.0, 1.48, 1.35);
      targetLook.set(-13.0, 1.95, -4.5);
    }

    // Amortecimento: posição orbita com suavidade (0.22); o olhar acompanha instantaneamente
    this.currentCamPos.lerp(targetCam, 0.22);
    this.currentCamLookAt.copy(targetLook);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamLookAt);
  }
}
