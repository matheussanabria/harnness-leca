// @ts-check
// DAI HQ — Avatar Humano Estilizado do Desenvolvedor DAI (Three.js Procedural Articulado)
// Identidade visual techwear: jaqueta escura com detalhes laranja Harness, calça cargo e sneakers.
import { buildAvatarMesh } from "./office3d/avatar-mesh-builder.js";

export class Avatar3D {
  /**
   * @param {any} THREE
   * @param {Object} [options]
   * @param {number} [options.accentColor]
   * @param {number} [options.jacketColor]
   * @param {number} [options.hairColor]
   * @param {number} [options.pantsColor]
   * @param {string} [options.name]
   */
  constructor(THREE, options = {}) {
    this.THREE = THREE;
    this.options = options;
    this.root = new THREE.Group();
    this.root.name = options.name || "DAI_Avatar";

    // Posição no mundo e orientação
    this.position = new THREE.Vector3(0, 0, 2.0);
    this.rotation = 0; // ângulo yaw em radianos
    this.targetRotation = 0;

    // Estado da animação: "idle", "walk", "run", "sit", "typing"
    this.state = "idle";
    this.animTime = 0;
    this.speed = 0;
    this.reducedMotion = false;

    // Nós articulados (populados pelo construtor da malha)
    this.hips = null;
    this.torso = null;
    this.chest = null;
    this.head = null;
    this.leftUpperLeg = null;
    this.leftLowerLeg = null;
    this.leftFoot = null;
    this.rightUpperLeg = null;
    this.rightLowerLeg = null;
    this.rightFoot = null;
    this.leftUpperArm = null;
    this.leftForearm = null;
    this.leftHand = null;
    this.rightUpperArm = null;
    this.rightForearm = null;
    this.rightHand = null;

    this.materials = {};

    buildAvatarMesh(this, this.THREE, this.options);
    this.updatePosition();
  }

  updatePosition() {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.rotation;
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    this.animTime = 0;
  }

  /**
   * Atualiza a animação procedural do personagem conforme o estado
   * @param {number} dt Delta time em segundos
   */
  update(dt) {
    const decorative = this.state === "idle" || this.state === "sit" || this.state === "typing";
    this.animTime += this.reducedMotion && decorative ? 0 : dt;
    this.updatePosition();

    // Interpolação suave da rotação do personagem
    const diff = this.targetRotation - this.rotation;
    const shortestDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.rotation += shortestDiff * Math.min(dt * 12, 1.0);
    this.root.rotation.y = this.rotation;

    switch (this.state) {
      case "walk":
        this.animateWalk(dt, 1.0);
        break;
      case "run":
        this.animateWalk(dt, 1.6);
        break;
      case "sit":
        this.animateSit(dt);
        break;
      case "typing":
        this.animateTyping(dt);
        break;
      case "idle":
      default:
        this.animateIdle(dt);
        break;
    }
  }

  animateIdle(dt) {
    const t = this.animTime;
    const breath = Math.sin(t * 2.2) * 0.02;
    this.hips.position.y = 0.90 + breath * 0.5;
    this.torso.rotation.x = breath * 0.5;
    this.torso.rotation.z = 0;
    this.head.rotation.x = -breath * 0.3;
    this.head.rotation.y = Math.sin(t * 0.8) * 0.06;

    this.leftUpperArm.rotation.x = Math.sin(t * 1.5) * 0.05;
    this.leftUpperArm.rotation.z = 0.08;
    this.leftForearm.rotation.x = -0.15;

    this.rightUpperArm.rotation.x = -Math.sin(t * 1.5) * 0.05;
    this.rightUpperArm.rotation.z = -0.08;
    this.rightForearm.rotation.x = -0.15;

    this.leftUpperLeg.rotation.set(0, 0, 0);
    this.leftLowerLeg.rotation.set(0, 0, 0);
    this.rightUpperLeg.rotation.set(0, 0, 0);
    this.rightLowerLeg.rotation.set(0, 0, 0);
  }

  animateWalk(dt, speedMultiplier = 1.0) {
    const freq = 7.5 * speedMultiplier;
    const t = this.animTime * freq;

    const bounce = Math.abs(Math.sin(t)) * 0.045;
    this.hips.position.y = 0.90 + bounce;

    this.torso.rotation.x = 0.08 * speedMultiplier;
    this.torso.rotation.y = Math.sin(t) * 0.05;
    this.torso.rotation.z = Math.sin(t) * 0.02;

    const legAngle = Math.sin(t) * 0.55 * speedMultiplier;
    this.leftUpperLeg.rotation.x = legAngle;
    this.rightUpperLeg.rotation.x = -legAngle;

    this.leftLowerLeg.rotation.x = legAngle < 0 ? Math.abs(legAngle) * 0.85 : 0.05;
    this.rightLowerLeg.rotation.x = legAngle > 0 ? Math.abs(legAngle) * 0.85 : 0.05;

    const armAngle = -legAngle * 0.65;
    this.leftUpperArm.rotation.x = armAngle;
    this.leftUpperArm.rotation.z = 0.10;
    this.leftForearm.rotation.x = -0.25 - Math.abs(armAngle) * 0.3;

    this.rightUpperArm.rotation.x = -armAngle;
    this.rightUpperArm.rotation.z = -0.10;
    this.rightForearm.rotation.x = -0.25 - Math.abs(armAngle) * 0.3;

    this.head.rotation.x = 0;
    this.head.rotation.y = -this.torso.rotation.y * 0.5;
  }

  animateSit(dt) {
    this.hips.position.y = 0.65;
    this.torso.rotation.set(-0.04, 0, 0);
    this.head.rotation.set(0.06, 0, 0);

    this.leftUpperLeg.rotation.set(-Math.PI / 2 + 0.1, 0, -0.06);
    this.rightUpperLeg.rotation.set(-Math.PI / 2 + 0.1, 0, 0.06);

    this.leftLowerLeg.rotation.set(Math.PI / 2 - 0.1, 0, 0);
    this.rightLowerLeg.rotation.set(Math.PI / 2 - 0.1, 0, 0);

    this.leftUpperArm.rotation.set(-0.55, 0, 0.2);
    this.leftForearm.rotation.set(-0.65, 0, 0);
    this.rightUpperArm.rotation.set(-0.55, 0, -0.2);
    this.rightForearm.rotation.set(-0.65, 0, 0);
  }

  animateTyping(dt) {
    this.animateSit(dt);
    const t = this.animTime * 14;

    this.leftForearm.rotation.x = -0.65 + Math.sin(t) * 0.04;
    this.rightForearm.rotation.x = -0.65 + Math.cos(t) * 0.04;
    this.head.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.02;
  }

  /**
   * Oculta seletivamente partes que possam clipar na câmera em primeira pessoa
   * @param {boolean} isFirstPerson
   */
  setFirstPersonMode(isFirstPerson) {
    if (this.head) {
      this.head.visible = !isFirstPerson;
    }
  }

  /**
   * Define visibilidade geral do avatar
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.root.visible = visible;
  }

  /**
   * Obtém a posição dos olhos do avatar no mundo
   */
  getEyePosition() {
    const eyePos = new this.THREE.Vector3();
    if (this.head) {
      this.head.getWorldPosition(eyePos);
      eyePos.y += 0.12;
    } else {
      eyePos.copy(this.position);
      eyePos.y += 1.62;
    }
    return eyePos;
  }
}
