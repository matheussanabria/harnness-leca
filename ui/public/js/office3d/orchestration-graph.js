// @ts-check
// DAI HQ — Centro de Orquestração M2: Camada Visual Espacial (Grafo 3D de Execuções e Agentes)

export class OrchestrationGraph {
  /**
   * @param {any} scene
   * @param {any} THREE
   * @param {any} interactionManager
   */
  constructor(scene, THREE, interactionManager) {
    this.scene = scene;
    this.THREE = THREE;
    this.interactionManager = interactionManager;

    this.group = new THREE.Group();
    this.group.name = "OrchestrationGraph_Group";
    // Posiciona o grafo flutuando acima da mesa holográfica da Sala de Guerra (X = -13.0, Z = -0.3)
    this.group.position.set(-13.0, 1.15, -0.3);
    this.scene.add(this.group);

    this.nodes = new Map(); // id -> mesh
    this.lines = []; // array de THREE.Line
    this.pulseTime = 0;
    this.coreMesh = null;
    this.rings = [];

    this.initCore();
  }

  initCore() {
    const THREE = this.THREE;

    // Núcleo Central de Orquestração
    const coreGeo = new THREE.IcosahedronGeometry(0.22, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      wireframe: true,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x0088cc,
      emissiveIntensity: 0.6
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.userData = {
      id: "orch_core",
      type: "orchestration_node",
      category: "core",
      title: "Centro de Orquestração DAI",
      confidence: "explicit"
    };
    this.group.add(this.coreMesh);
    this.interactionManager.addInteractiveMesh(this.coreMesh);

    // Anéis orbitais de energia
    for (let i = 0; i < 2; i++) {
      const ringGeo = new THREE.RingGeometry(0.35 + i * 0.18, 0.36 + i * 0.18, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x00d2ff : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / (2 + i);
      this.group.add(ringMesh);
      this.rings.push(ringMesh);
    }
  }

  /**
   * Atualiza o grafo 3D a partir do estado consolidado recebido do backend
   * @param {Object} state Estado retornado por /api/orchestration/state
   */
  updateState(state) {
    if (!state) return;
    const THREE = this.THREE;

    // 1. Limpa nós e linhas dinâmicas antigas (preservando o núcleo central)
    for (const [id, mesh] of this.nodes.entries()) {
      this.group.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    this.nodes.clear();

    for (const line of this.lines) {
      this.group.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
    this.lines = [];

    // 2. Renderiza Nós dos Agentes principais em disposição triangular
    const agentConfigs = [
      { id: "claude", angle: (Math.PI * 2 / 3) * 0, color: 0xd97757, radius: 1.2, name: "Claude Code" },
      { id: "gemini", angle: (Math.PI * 2 / 3) * 1, color: 0x5c87f2, radius: 1.2, name: "Gemini" },
      { id: "opencode", angle: (Math.PI * 2 / 3) * 2, color: 0x3cb371, radius: 1.2, name: "OpenCode" }
    ];

    const agentPositions = new Map();

    for (const cfg of agentConfigs) {
      const agentState = (state.agents || []).find((/** @type {{ id: string; }} */ a) => a.id === cfg.id) || { status: "unknown", confidence: "unknown" };
      const isActive = agentState.status === "running" || agentState.status === "active";

      const x = Math.cos(cfg.angle) * cfg.radius;
      const z = Math.sin(cfg.angle) * cfg.radius;
      const y = 0.15;
      agentPositions.set(cfg.id, new THREE.Vector3(x, y, z));

      const nodeGeo = new THREE.OctahedronGeometry(isActive ? 0.16 : 0.12, 0);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.2,
        metalness: 0.8,
        emissive: cfg.color,
        emissiveIntensity: isActive ? 0.8 : 0.2,
        wireframe: !isActive
      });

      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = {
        id: `agent_${cfg.id}`,
        type: "orchestration_node",
        category: "agent",
        entityId: cfg.id,
        title: `${cfg.name} (${agentState.status.toUpperCase()})`,
        confidence: agentState.confidence || "observed",
        payload: agentState
      };

      this.group.add(nodeMesh);
      this.nodes.set(`agent_${cfg.id}`, nodeMesh);
      this.interactionManager.addInteractiveMesh(nodeMesh);

      // Conexão Agente -> Núcleo Central
      this.createConnectionLine(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(x, y, z),
        cfg.color,
        isActive ? "explicit" : "observed"
      );
    }

    // 3. Renderiza Execuções reais conhecidas ao redor dos seus respectivos agentes
    const executions = (state.executions || []).slice(-8); // Limita às 8 mais recentes para alta performance
    let execIdx = 0;

    for (const ex of executions) {
      const parentAgentPos = agentPositions.get(ex.agentId) || new THREE.Vector3(0, 0.4, 0);
      const offsetAngle = (execIdx * 0.78);
      const dist = 0.65;
      const exX = parentAgentPos.x + Math.cos(offsetAngle) * dist;
      const exZ = parentAgentPos.z + Math.sin(offsetAngle) * dist;
      const exY = parentAgentPos.y + 0.25;
      const exPos = new THREE.Vector3(exX, exY, exZ);

      const isRunning = ex.status === "running";
      const isFailed = ex.status === "failed";
      const color = isFailed ? 0xef4444 : isRunning ? 0x00d2ff : 0x10b981;

      const exGeo = new THREE.SphereGeometry(isRunning ? 0.08 : 0.06, 16, 16);
      const exMat = new THREE.MeshBasicMaterial({
        color,
        wireframe: !isRunning
      });

      const exMesh = new THREE.Mesh(exGeo, exMat);
      exMesh.position.copy(exPos);
      exMesh.userData = {
        id: `exec_${ex.id}`,
        type: "orchestration_node",
        category: "execution",
        entityId: ex.id,
        title: `Execução: ${ex.id.slice(0, 8)} (${ex.status})`,
        confidence: ex.confidence || "explicit",
        payload: ex
      };

      this.group.add(exMesh);
      this.nodes.set(`exec_${ex.id}`, exMesh);
      this.interactionManager.addInteractiveMesh(exMesh);

      // Linha de Execução comprovada
      this.createConnectionLine(parentAgentPos, exPos, color, ex.confidence || "explicit");

      // 4. Se for subagente comprovado (parentExecutionId), conecta ao pai
      if (ex.parentExecutionId) {
        const parentMesh = this.nodes.get(`exec_${ex.parentExecutionId}`);
        if (parentMesh) {
          this.createConnectionLine(parentMesh.position, exPos, 0xa855f7, "explicit");
        }
      }

      execIdx++;
    }
  }

  /**
   * Constrói feixe de conexão com diferenciação visual de confiança
   * @param {any} from
   * @param {any} to
   * @param {number} colorHex
   * @param {string} confidence 'explicit' | 'observed' | 'inferred'
   */
  createConnectionLine(from, to, colorHex, confidence) {
    const THREE = this.THREE;
    const points = [from, to];
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    let mat;
    if (confidence === "explicit") {
      mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        linewidth: 2
      });
    } else {
      mat = new THREE.LineDashedMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        dashSize: 0.08,
        gapSize: 0.05
      });
    }

    const line = new THREE.Line(geo, mat);
    if (confidence !== "explicit") {
      line.computeLineDistances();
    }

    this.group.add(line);
    this.lines.push(line);
  }

  /**
   * Ciclo de animação contínua (chamado pelo loop principal de renderização)
   * @param {number} delta Tempo em segundos desde o último frame
   */
  animate(delta) {
    this.pulseTime += delta;

    // Rotação suave do núcleo central
    if (this.coreMesh) {
      this.coreMesh.rotation.y += delta * 0.45;
      this.coreMesh.rotation.x += delta * 0.25;
      const s = 1.0 + Math.sin(this.pulseTime * 2.5) * 0.06;
      this.coreMesh.scale.set(s, s, s);
    }

    // Rotação dos anéis orbitais
    if (this.rings[0]) this.rings[0].rotation.z += delta * 0.35;
    if (this.rings[1]) this.rings[1].rotation.z -= delta * 0.25;

    // Pulso leve dos nós de execução
    for (const [id, mesh] of this.nodes.entries()) {
      if (id.startsWith("exec_") && mesh.userData.payload?.status === "running") {
        mesh.rotation.y += delta * 1.2;
      }
    }
  }
}
