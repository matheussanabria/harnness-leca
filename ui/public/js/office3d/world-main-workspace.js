import { workspaceFurnitureMethods } from "./workspace-furniture.js";
import { workspaceDeskMethods } from "./workspace-desk.js";
// @ts-check
// DAI HQ — Construtor Procedural do Main Workspace (Sala Principal, Mesa de Trabalho e Periféricos)

export class MainWorkspaceBuilder {
  /**
   * @param {any} scene
   * @param {any} chairPos
   * @param {any} interactionManager
   */
  constructor(scene, chairPos, interactionManager) {
    this.scene = scene;
    this.chairPos = chairPos;
    this.interactionManager = interactionManager;
  }

  build(THREE) {
    const roomW = 10.4;
    const roomD = 9.4;
    const roomH = 3.8;

    // 1. Piso em Madeira Nobre Escura
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181512,
      roughness: 0.45,
      metalness: 0.12
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Tapete Acústico da Estação de Trabalho
    const rugGeo = new THREE.PlaneGeometry(3.4, 2.8);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.9,
      metalness: 0.05
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0.6);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // Borda ciano sutil no tapete
    const rugBorderGeo = new THREE.PlaneGeometry(3.44, 2.84);
    const rugBorderMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const rugBorder = new THREE.Mesh(rugBorderGeo, rugBorderMat);
    rugBorder.rotation.x = -Math.PI / 2;
    rugBorder.position.set(0, 0.003, 0.6);
    this.scene.add(rugBorder);

    // 3. Paredes Arquitetônicas da Sala
    const wallMatDark = new THREE.MeshStandardMaterial({ color: 0x111624, roughness: 0.8 });
    const woodSlatMat = new THREE.MeshStandardMaterial({ color: 0x271e18, roughness: 0.6 });

    // Parede de Fundo (Norte, Z = -roomD/2)
    const backWallGeo = new THREE.BoxGeometry(roomW, roomH, 0.2);
    const backWall = new THREE.Mesh(backWallGeo, wallMatDark);
    backWall.position.set(0, roomH / 2, -roomD / 2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Painéis acústicos ripados de madeira
    const slatGroup = new THREE.Group();
    slatGroup.position.set(0, roomH / 2, -roomD / 2 + 0.11);
    for (let i = -7; i <= 7; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, roomH - 0.4, 0.03), woodSlatMat);
      slat.position.x = i * 0.26;
      slatGroup.add(slat);
    }
    this.scene.add(slatGroup);

    // Parede Oeste (X = -roomW/2 = -5.2) COM PORTAL ABERTO PARA A SALA DE GUERRA
    const wallWestNorth = new THREE.Mesh(new THREE.BoxGeometry(0.2, roomH, 2.8), wallMatDark);
    wallWestNorth.position.set(-roomW / 2, roomH / 2, -3.3);
    wallWestNorth.receiveShadow = true;
    this.scene.add(wallWestNorth);

    const wallWestSouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, roomH, 4.8), wallMatDark);
    wallWestSouth.position.set(-roomW / 2, roomH / 2, 2.3);
    wallWestSouth.receiveShadow = true;
    this.scene.add(wallWestSouth);

    const wallWestLintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 1.8), wallMatDark);
    wallWestLintel.position.set(-roomW / 2, 3.3, -1.0);
    this.scene.add(wallWestLintel);

    // Portal tecnológico iluminado
    const portalFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 2.8, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 })
    );
    portalFrame.position.set(-roomW / 2, 1.4, -1.0);
    this.scene.add(portalFrame);

    const ledLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.8, 0.05), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    ledLeft.position.set(-roomW / 2 + 0.11, 1.4, -1.85);
    const ledRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.8, 0.05), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    ledRight.position.set(-roomW / 2 + 0.11, 1.4, -0.15);
    this.scene.add(ledLeft, ledRight);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 1.2), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    signBoard.position.set(-roomW / 2 + 0.11, 2.7, -1.0);
    this.scene.add(signBoard);

    // Parede Leste com Janela Panorâmica
    const rightWallGeo = new THREE.BoxGeometry(0.2, roomH, roomD);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMatDark);
    rightWall.position.set(roomW / 2, roomH / 2, 0);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const winGeo = new THREE.PlaneGeometry(6.2, 2.6);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x08101e });
    const win = new THREE.Mesh(winGeo, winMat);
    win.rotation.y = -Math.PI / 2;
    win.position.set(roomW / 2 - 0.09, 2.1, 0);
    this.scene.add(win);

    // Skyline noturno
    for (let i = 0; i < 11; i++) {
      const bh = 0.8 + Math.random() * 1.8;
      const bGeo = new THREE.PlaneGeometry(0.45 + Math.random() * 0.3, bh);
      const bMat = new THREE.MeshBasicMaterial({ color: (i % 2 === 0) ? 0x1e293b : 0x0f1d33 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.rotation.y = -Math.PI / 2;
      bMesh.position.set(roomW / 2 - 0.07, 0.8 + bh / 2, -2.4 + i * 0.5);
      this.scene.add(bMesh);
    }

    const winFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 6.4), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 }));
    winFrameTop.position.set(roomW / 2 - 0.08, 3.4, 0);
    const winFrameBot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 6.4), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 }));
    winFrameBot.position.set(roomW / 2 - 0.08, 0.8, 0);
    this.scene.add(winFrameTop, winFrameBot);

    // Rodapés
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, metalness: 0.8 });
    const bbNorth = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.12, 0.06), baseboardMat);
    bbNorth.position.set(0, 0.06, -roomD / 2 + 0.03);
    const bbWest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, roomD), baseboardMat);
    bbWest.position.set(-roomW / 2 + 0.03, 0.06, 0);
    const bbEast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, roomD), baseboardMat);
    bbEast.position.set(roomW / 2 - 0.03, 0.06, 0);
    this.scene.add(bbNorth, bbWest, bbEast);

    // Móveis complementares
    this.buildServerRack(THREE, 3.6, -2.8);
    this.buildLoungeArea(THREE, -3.4, 2.2);
    this.buildTallPlant(THREE, -4.0, -2.8);

    // Estação de trabalho principal
    this.buildWorkstation(THREE);
  }

}

Object.assign(MainWorkspaceBuilder.prototype, workspaceFurnitureMethods, workspaceDeskMethods);
