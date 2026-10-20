// @ts-check
// DAI HQ — Módulo de Física e Colisão AABB com Wall Sliding

export class PhysicsEngine {
  constructor() {
    this.colliders = [
      // Mesa da Estação de Trabalho Principal
      { type: "box", minX: -1.30, maxX: 1.30, minZ: -0.65, maxZ: 0.65 },
      // Cadeira da Estação (colisão ativa apenas quando NÃO estiver sentado nela)
      { type: "chair", minX: -0.38, maxX: 0.38, minZ: 0.58, maxZ: 1.08 },
      // Rack de Servidores Datacenter
      { type: "box", minX: 3.1, maxX: 4.5, minZ: -3.5, maxZ: -1.8 },
      // Sofá Lounge
      { type: "box", minX: -4.5, maxX: -2.3, minZ: 1.1, maxZ: 3.3 },
      // Mesinha de Centro do Sofá
      { type: "box", minX: -3.6, maxX: -2.4, minZ: 0.1, maxZ: 0.9 },

      // Sala de Guerra: Mesa Central de Reunião
      { type: "box", minX: -15.1, maxX: -10.9, minZ: -1.4, maxZ: 0.8 },
      // Sala de Guerra: Cadeira do Usuário
      { type: "war_chair", minX: -13.4, maxX: -12.6, minZ: 1.05, maxZ: 1.65 }
    ];
  }

  /**
   * Verifica se a coordenada (x, z) colide com paredes ou móveis
   * @param {number} x
   * @param {number} z
   * @param {boolean} isSeated
   * @param {string} seatedType
   * @returns {boolean} true se houver colisão
   */
  checkCollision(x, z, isSeated = false, seatedType = "none") {
    const radius = 0.35; // Raio de colisão do corpo do avatar

    // 1. Zonas Transitáveis Permitidas (Conectadas continuamente):
    // A) Main Workspace: X em [-4.6, 4.6] e Z em [-3.6, 4.5]
    const inMain = (x - radius >= -4.65 && x + radius <= 4.65 && z - radius >= -3.65 && z + radius <= 4.55);

    // B) Corredor Tecnológico: X em [-8.0, -4.5] e Z em [-1.8, -0.2]
    const inCorridor = (x - radius >= -8.05 && x + radius <= -4.45 && z - radius >= -1.85 && z + radius <= -0.15);

    // C) Sala de Guerra (War Room): X em [-17.9, -7.7] e Z em [-5.2, 4.5]
    const inWarRoom = (x - radius >= -17.95 && x + radius <= -7.65 && z - radius >= -5.25 && z + radius <= 4.55);

    // Passagens de transição contínua entre ambientes
    const inPortalMain = (x >= -5.4 && x <= -4.4 && z >= -1.85 && z <= -0.15);
    const inPortalWar = (x >= -8.1 && x <= -7.5 && z >= -1.85 && z <= -0.15);

    const isInsideWalkableArea = inMain || inCorridor || inWarRoom || inPortalMain || inPortalWar;

    // Se saiu das áreas caminháveis, colide com a parede externa
    if (!isInsideWalkableArea) {
      return true;
    }

    // 2. Obstáculos Sólidos Internos (Móveis e Estruturas)
    for (const c of this.colliders) {
      if (c.type === "box") {
        if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
          return true;
        }
      } else if (c.type === "chair" && !(isSeated && seatedType === "workstation")) {
        if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
          return true;
        }
      } else if (c.type === "war_chair" && !(isSeated && seatedType === "war_room")) {
        if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
          return true;
        }
      }
    }
    return false;
  }
}
