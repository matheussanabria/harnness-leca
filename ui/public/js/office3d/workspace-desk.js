// @ts-check
// Estação de trabalho e periféricos (mixin de MainWorkspaceBuilder).

export const workspaceDeskMethods = {
  buildWorkstation(THREE) {
    const deskW = 2.4;
    const deskD = 1.1;
    const deskH = 0.74;

    const topGeo = new THREE.BoxGeometry(deskW, 0.055, deskD);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x33261d, roughness: 0.35, metalness: 0.08 });
    const deskTop = new THREE.Mesh(topGeo, woodMat);
    deskTop.position.set(0, 0.96, 0);
    deskTop.receiveShadow = true;
    deskTop.castShadow = true;
    this.scene.add(deskTop);

    const legGeo = new THREE.BoxGeometry(0.07, 0.94, deskD - 0.15);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, metalness: 0.85, roughness: 0.2 });
    const legL = new THREE.Mesh(legGeo, metalMat);
    legL.position.set(-deskW / 2 + 0.1, 0.47, 0);
    const legR = new THREE.Mesh(legGeo, metalMat);
    legR.position.set(deskW / 2 - 0.1, 0.47, 0);
    this.scene.add(legL, legR);

    // Periféricos
    this.buildKeyboard(THREE);
    this.buildMouse(THREE);
    this.buildHeadset(THREE);
    this.buildCoffeeCup(THREE);
    this.buildPlant(THREE);
    this.buildChair(THREE);
  },

  buildKeyboard(THREE) {
    const kbW = 0.48;
    const kbD = 0.18;
    const kb = new THREE.Mesh(new THREE.BoxGeometry(kbW, 0.022, kbD), new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.6, metalness: 0.4 }));
    kb.position.set(-0.12, 1.01, 0.35);
    kb.rotation.x = 0.05;
    this.scene.add(kb);

    const keyMatDark = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.7 });
    const keyMatAccent = new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.5 });

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 12; c++) {
        const isWASD = (r === 1 && (c === 2 || c === 3 || c === 4)) || (r === 0 && c === 3);
        const kMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.01, 0.026), isWASD ? keyMatAccent : keyMatDark);
        kMesh.position.set(-0.12 - kbW / 2 + 0.04 + c * 0.036, 1.022, 0.35 - kbD / 2 + 0.035 + r * 0.036);
        this.scene.add(kMesh);
      }
    }
  },

  buildMouse(THREE) {
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.034, 0.13), new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.4, metalness: 0.3 }));
    mouse.position.set(0.35, 1.015, 0.35);
    this.scene.add(mouse);

    const scrollGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.025, 8);
    scrollGeo.rotateZ(Math.PI / 2);
    const scroll = new THREE.Mesh(scrollGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    scroll.position.set(0.35, 1.032, 0.31);
    this.scene.add(scroll);
  },

  buildHeadset(THREE) {
    const group = new THREE.Group();
    group.position.set(-0.85, 0.99, 0.0);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
    pole.position.y = 0.16;
    group.add(pole);

    const arcGeo = new THREE.TorusGeometry(0.09, 0.014, 8, 24, Math.PI);
    const arc = new THREE.Mesh(arcGeo, new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 }));
    arc.position.set(0, 0.28, 0);
    arc.rotation.z = Math.PI;
    group.add(arc);

    this.scene.add(group);
  },

  buildCoffeeCup(THREE) {
    const group = new THREE.Group();
    group.position.set(0.72, 0.99, 0.15);

    const cupMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.11, 20), cupMat);
    cup.position.y = 0.055;
    group.add(cup);

    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.01, 16), new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.1 }));
    coffee.position.y = 0.098;
    group.add(coffee);

    group.userData = { id: "coffee_bar", name: "Caneca de Café Quente" };
    this.scene.add(group);
    this.interactionManager.addInteractiveMesh(cup);
  },

  buildPlant(THREE) {
    const group = new THREE.Group();
    group.position.set(0.85, 0.99, -0.15);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }));
    pot.position.y = 0.05;
    group.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.SphereGeometry(0.03, 6, 6);
      leafGeo.scale(0.8, 1.4, 0.5);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(i) * 0.02, 0.11, Math.sin(i) * 0.02);
      leaf.rotation.set(0.3, i, 0.3);
      group.add(leaf);
    }
    this.scene.add(group);
  },

  buildChair(THREE) {
    const group = new THREE.Group();
    group.position.set(this.chairPos.x, this.chairPos.y, this.chairPos.z);

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.04, 16), metalMat);
    base.position.y = 0.06;
    group.add(base);

    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), metalMat);
    piston.position.y = 0.28;
    group.add(piston);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.54), seatMat);
    seat.position.y = 0.55;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.08), seatMat);
    back.position.set(0, 0.95, 0.25);
    back.rotation.x = -0.08;
    group.add(back);

    group.userData = { id: "workstation_chair", name: "Cadeira da Estação" };
    this.scene.add(group);
    this.interactionManager.addInteractiveMesh(seat);
  },
};
