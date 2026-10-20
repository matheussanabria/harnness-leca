// @ts-check
// Rack de servidores, lounge e plantas (mixin de MainWorkspaceBuilder).

export const workspaceFurnitureMethods = {
  buildServerRack(THREE, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const rH = 2.4;
    const rW = 1.0;
    const rD = 0.8;

    const rackGeo = new THREE.BoxGeometry(rW, rH, rD);
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x111620, metalness: 0.8, roughness: 0.3 });
    const rack = new THREE.Mesh(rackGeo, rackMat);
    rack.position.y = rH / 2;
    rack.castShadow = true;
    group.add(rack);

    const glassGeo = new THREE.BoxGeometry(rW - 0.08, rH - 0.15, 0.02);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.6, roughness: 0.1 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, rH / 2, rD / 2 + 0.01);
    group.add(glass);

    for (let u = 0; u < 8; u++) {
      const uY = 0.3 + u * 0.25;
      for (let l = 0; l < 4; l++) {
        const ledGeo = new THREE.PlaneGeometry(0.03, 0.015);
        const ledColor = (u === 2 && l === 1) ? 0xef4444 : ((l === 3) ? 0x22c55e : 0x00d2ff);
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        const ledMesh = new THREE.Mesh(ledGeo, ledMat);
        ledMesh.position.set(-0.35 + l * 0.07, uY, rD / 2 + 0.02);
        group.add(ledMesh);
      }
    }

    this.scene.add(group);
  },

  buildLoungeArea(THREE, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x1e2736, roughness: 0.8 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x263345, roughness: 0.7 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.9), fabricMat);
    base.position.y = 0.125;
    base.castShadow = true;
    group.add(base);

    const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.75), cushionMat);
    seatL.position.set(-0.48, 0.32, 0.05);
    const seatR = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.75), cushionMat);
    seatR.position.set(0.48, 0.32, 0.05);
    group.add(seatL, seatR);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 0.22), fabricMat);
    backrest.position.set(0, 0.55, -0.34);
    group.add(backrest);

    // Mesinha de centro
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.5 });
    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.55), tableMat);
    coffeeTable.position.set(0, 0.175, 0.95);
    group.add(coffeeTable);

    this.scene.add(group);
  },

  buildTallPlant(THREE, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const potGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.55, 16);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.4 });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.275;
    pot.castShadow = true;
    group.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const leafGeo = new THREE.SphereGeometry(0.18, 6, 6);
      leafGeo.scale(0.5, 1.8, 0.15);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.12, 0.6 + (i % 3) * 0.2, Math.sin(angle) * 0.12);
      leaf.rotation.set(0.4, angle, 0.4);
      group.add(leaf);
    }

    this.scene.add(group);
  },
};
