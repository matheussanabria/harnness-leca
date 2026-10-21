// @ts-check
// Corredor e sala de guerra (mixin de WarRoomBuilder).
import { officeState } from "../office-state.js";
import { officeScreenPresets } from "../office/office-screen-presets.js";
import { createWarScreenTabs } from "./war-screen/war-screen-tabs.js";
import { OrchestrationGraph } from "./orchestration-graph.js";

export const warRoomCorridorMethods = {
  buildCorridor(THREE) {
    const cW = 2.6;
    const cD = 1.8;
    const cH = 3.2;

    const group = new THREE.Group();
    group.name = "Transition_Corridor";

    // Piso metálico
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(cW, cD),
      new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.4, metalness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-6.5, 0.004, -1.0);
    floor.receiveShadow = true;
    group.add(floor);

    // Fitas de LED
    for (const offset of [-0.6, 0.6]) {
      const led = new THREE.Mesh(
        new THREE.PlaneGeometry(cW - 0.2, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x00d2ff })
      );
      led.rotation.x = -Math.PI / 2;
      led.position.set(-6.5, 0.008, -1.0 + offset);
      group.add(led);
    }

    // Paredes Norte e Sul
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f141f, roughness: 0.7, metalness: 0.3 });
    const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, 0.2), wallMat);
    wallNorth.position.set(-6.5, cH / 2, -1.9);
    wallNorth.receiveShadow = true;
    group.add(wallNorth);

    const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, 0.2), wallMat);
    wallSouth.position.set(-6.5, cH / 2, -0.1);
    wallSouth.receiveShadow = true;
    group.add(wallSouth);

    // Arcos estruturais
    for (let i = 0; i < 3; i++) {
      const archX = -5.7 - i * 0.8;
      const archFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, cD), new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.9 }));
      archFrame.position.set(archX, cH - 0.08, -1.0);
      group.add(archFrame);

      const archLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, cD - 0.2), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      archLight.position.set(archX, cH - 0.14, -1.0);
      group.add(archLight);
    }

    // Portal em X = -7.8
    const warPortalFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.85, roughness: 0.2 }));
    warPortalFrame.position.set(-7.8, 1.4, -1.0);
    group.add(warPortalFrame);

    const warSign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 1.3), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    warSign.position.set(-7.69, 2.7, -1.0);
    group.add(warSign);

    this.scene.add(group);
  },

  buildWarRoom(THREE) {
    const warGroup = new THREE.Group();
    warGroup.name = "War_Room_M1";

    const wW = 10.4;
    const wD = 10.3;
    const wH = 4.2;
    const centerX = -13.0;
    const centerZ = -0.35;

    // Piso em Ardósia Escura
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(wW, wD),
      new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: 0.55, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0.002, centerZ);
    floor.receiveShadow = true;
    warGroup.add(floor);

    // Tapete circular e anel de LED
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x161d2b, roughness: 0.85, metalness: 0.05 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(centerX, 0.005, -0.3);
    rug.receiveShadow = true;
    warGroup.add(rug);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 3.66, 48),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(centerX, 0.007, -0.3);
    warGroup.add(ring);

    // Paredes
    const wallDarkMat = new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.75, metalness: 0.15 });

    const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(wW, wH, 0.2), wallDarkMat);
    wallNorth.position.set(centerX, wH / 2, -5.5);
    wallNorth.receiveShadow = true;
    warGroup.add(wallNorth);

    const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(wW, wH, 0.2), wallDarkMat);
    wallSouth.position.set(centerX, wH / 2, 4.8);
    wallSouth.receiveShadow = true;
    warGroup.add(wallSouth);

    const wallWest = new THREE.Mesh(new THREE.BoxGeometry(0.2, wH, wD), wallDarkMat);
    wallWest.position.set(-18.2, wH / 2, centerZ);
    wallWest.receiveShadow = true;
    warGroup.add(wallWest);

    const wallEastNorth = new THREE.Mesh(new THREE.BoxGeometry(0.2, wH, 3.6), wallDarkMat);
    wallEastNorth.position.set(-7.8, wH / 2, -3.7);
    wallEastNorth.receiveShadow = true;
    warGroup.add(wallEastNorth);

    const wallEastSouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, wH, 4.9), wallDarkMat);
    wallEastSouth.position.set(-7.8, wH / 2, 2.35);
    wallEastSouth.receiveShadow = true;
    warGroup.add(wallEastSouth);

    const wallEastLintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.8), wallDarkMat);
    wallEastLintel.position.set(-7.8, 3.5, -1.0);
    warGroup.add(wallEastLintel);

    // Telão Tático de Parede
    const screenW = 6.6;
    const screenH = 2.85;

    const canvas = this.screenRenderer.render({
      activeProject: officeState.activeProject || "",
      projectData: officeState.projectData,
      agentsData: officeState.activeAgents,
      orchestrationState: officeState.orchestrationState,
      journal: officeState.journal,
      preset: officeScreenPresets.getPreset("war_room_main_panel"),
      scrumData: officeState.scrumData
    });

    this.warRoomTexture = new THREE.CanvasTexture(canvas);
    this.warRoomTexture.minFilter = THREE.LinearFilter;
    this.warRoomTexture.magFilter = THREE.LinearFilter;

    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(screenW + 0.16, screenH + 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 })
    );
    screenFrame.position.set(centerX, 2.4, -5.41);
    warGroup.add(screenFrame);

    this.warRoomScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW, screenH),
      new THREE.MeshBasicMaterial({ map: this.warRoomTexture })
    );
    this.warRoomScreenMesh.position.set(centerX, 2.4, -5.36);
    this.warRoomScreenMesh.userData = { id: "war_room_main_panel", type: "war_screen" };
    warGroup.add(this.warRoomScreenMesh);
    this.interactionManager.addInteractiveMesh(this.warRoomScreenMesh);

    this.screenTabs = createWarScreenTabs({
      THREE,
      group: warGroup,
      interactionManager: this.interactionManager,
      screenCenterX: centerX,
      screenCenterY: 2.4,
      screenWidth: screenW,
      screenZ: -5.36,
      onSelect: () => this.refreshScreen()
    });

    // Mesa Central de Coordenação
    this.buildWarRoomTable(THREE, warGroup, centerX, -0.3);

    // Centro de Orquestração M2 — Grafo Espacial Holográfico
    this.orchGraph = new OrchestrationGraph(warGroup, THREE, this.interactionManager);
    if (officeState.orchestrationState) {
      this.orchGraph.updateState(officeState.orchestrationState);
    }

    this.scene.add(warGroup);
  },
};
