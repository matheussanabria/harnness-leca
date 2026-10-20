// @ts-check
// DAI HQ — Construtor Procedural da Malha e Articulações do Avatar (Three.js)

export function buildAvatarMesh(avatar, THREE, options = {}) {
  // Paleta de cores techwear DAI personalizável
  const skinColor = 0xf8c291;
  const jacketDarkColor = options.jacketColor !== undefined ? options.jacketColor : 0x181e29;
  const harnessOrangeColor = options.accentColor !== undefined ? options.accentColor : 0xd97757;
  const pantsColor = options.pantsColor !== undefined ? options.pantsColor : 0x242b38;
  const shoesWhiteColor = 0xf1f5f9;
  const shoesAccentColor = harnessOrangeColor;
  const hairColor = options.hairColor !== undefined ? options.hairColor : 0x222831;

  // Materiais com sombreamento suave
  const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6, metalness: 0.05 });
  const matJacket = new THREE.MeshStandardMaterial({ color: jacketDarkColor, roughness: 0.5, metalness: 0.15 });
  const matAccent = new THREE.MeshStandardMaterial({ color: harnessOrangeColor, roughness: 0.4, metalness: 0.2 });
  const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7, metalness: 0.1 });
  const matShoesWhite = new THREE.MeshStandardMaterial({ color: shoesWhiteColor, roughness: 0.3, metalness: 0.1 });
  const matShoesAccent = new THREE.MeshStandardMaterial({ color: shoesAccentColor, roughness: 0.4, metalness: 0.2 });
  const matHair = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8, metalness: 0.1 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  avatar.materials = {
    skin: matSkin,
    jacket: matJacket,
    accent: matAccent,
    pants: matPants,
    shoesWhite: matShoesWhite,
    shoesAccent: matShoesAccent,
    hair: matHair,
    eyes: matEyes
  };

  // Sombra de chão (Blob shadow circular suave)
  const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.position.y = 0.015;
  avatar.root.add(blobShadow);

  // 1. Quadril / Hips
  avatar.hips = new THREE.Group();
  avatar.hips.position.y = 0.90;
  avatar.root.add(avatar.hips);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.22), matPants);
  pelvis.castShadow = true;
  avatar.hips.add(pelvis);

  // Cinto techwear com fivela
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.04, 0.23), matJacket);
  belt.position.y = 0.08;
  avatar.hips.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.24), matAccent);
  buckle.position.y = 0.08;
  avatar.hips.add(buckle);

  // 2. Tronco / Torso & Jaqueta Techwear
  avatar.torso = new THREE.Group();
  avatar.torso.position.y = 0.10;
  avatar.hips.add(avatar.torso);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.24), matJacket);
  torsoMesh.position.y = 0.18;
  torsoMesh.castShadow = true;
  avatar.torso.add(torsoMesh);

  const zipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.02), matAccent);
  zipMesh.position.set(0, 0.18, 0.125);
  avatar.torso.add(zipMesh);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.22), matJacket);
  collar.position.y = 0.39;
  avatar.torso.add(collar);

  // 3. Cabeça & Acessórios
  avatar.head = new THREE.Group();
  avatar.head.position.y = 0.44;
  avatar.torso.add(avatar.head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.08, 12), matSkin);
  neck.position.y = 0.04;
  avatar.head.add(neck);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), matSkin);
  headMesh.position.y = 0.18;
  headMesh.castShadow = true;
  avatar.head.add(headMesh);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.24), matHair);
  hair.position.set(0, 0.27, 0.01);
  avatar.head.add(hair);

  const hairFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.08), matHair);
  hairFront.position.set(0, 0.23, 0.10);
  avatar.head.add(hairFront);

  const eyeGeo = new THREE.BoxGeometry(0.035, 0.035, 0.02);
  const eyeL = new THREE.Mesh(eyeGeo, matEyes);
  eyeL.position.set(-0.06, 0.18, 0.115);
  const eyeR = new THREE.Mesh(eyeGeo, matEyes);
  eyeR.position.set(0.06, 0.18, 0.115);
  avatar.head.add(eyeL, eyeR);

  const commGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10);
  commGeo.rotateZ(Math.PI / 2);
  const comm = new THREE.Mesh(commGeo, matAccent);
  comm.position.set(-0.12, 0.17, 0.02);
  avatar.head.add(comm);

  // 4. Pernas e Pés
  buildLegs(avatar, THREE, matPants, matShoesWhite, matShoesAccent);

  // 5. Braços e Mãos
  buildArms(avatar, THREE, matJacket, matSkin);
}

function buildLegs(avatar, THREE, matPants, matShoesWhite, matShoesAccent) {
  const uLegGeo = new THREE.BoxGeometry(0.13, 0.42, 0.15);
  const lLegGeo = new THREE.BoxGeometry(0.11, 0.38, 0.13);
  const shoeGeo = new THREE.BoxGeometry(0.12, 0.09, 0.24);
  const soleGeo = new THREE.BoxGeometry(0.125, 0.03, 0.25);

  // Esquerda
  avatar.leftUpperLeg = new THREE.Group();
  avatar.leftUpperLeg.position.set(-0.11, -0.08, 0);
  avatar.hips.add(avatar.leftUpperLeg);

  const uLegMeshL = new THREE.Mesh(uLegGeo, matPants);
  uLegMeshL.position.y = -0.20;
  uLegMeshL.castShadow = true;
  avatar.leftUpperLeg.add(uLegMeshL);

  avatar.leftLowerLeg = new THREE.Group();
  avatar.leftLowerLeg.position.set(0, -0.40, 0);
  avatar.leftUpperLeg.add(avatar.leftLowerLeg);

  const lLegMeshL = new THREE.Mesh(lLegGeo, matPants);
  lLegMeshL.position.y = -0.18;
  lLegMeshL.castShadow = true;
  avatar.leftLowerLeg.add(lLegMeshL);

  avatar.leftFoot = new THREE.Group();
  avatar.leftFoot.position.set(0, -0.37, 0.03);
  avatar.leftLowerLeg.add(avatar.leftFoot);

  const shoeL = new THREE.Mesh(shoeGeo, matShoesWhite);
  shoeL.position.set(0, 0.045, 0.04);
  shoeL.castShadow = true;
  const soleL = new THREE.Mesh(soleGeo, matShoesAccent);
  soleL.position.set(0, 0.015, 0.04);
  avatar.leftFoot.add(shoeL, soleL);

  // Direita
  avatar.rightUpperLeg = new THREE.Group();
  avatar.rightUpperLeg.position.set(0.11, -0.08, 0);
  avatar.hips.add(avatar.rightUpperLeg);

  const uLegMeshR = new THREE.Mesh(uLegGeo, matPants);
  uLegMeshR.position.y = -0.20;
  uLegMeshR.castShadow = true;
  avatar.rightUpperLeg.add(uLegMeshR);

  avatar.rightLowerLeg = new THREE.Group();
  avatar.rightLowerLeg.position.set(0, -0.40, 0);
  avatar.rightUpperLeg.add(avatar.rightLowerLeg);

  const lLegMeshR = new THREE.Mesh(lLegGeo, matPants);
  lLegMeshR.position.y = -0.18;
  lLegMeshR.castShadow = true;
  avatar.rightLowerLeg.add(lLegMeshR);

  avatar.rightFoot = new THREE.Group();
  avatar.rightFoot.position.set(0, -0.37, 0.03);
  avatar.rightLowerLeg.add(avatar.rightFoot);

  const shoeR = new THREE.Mesh(shoeGeo, matShoesWhite);
  shoeR.position.set(0, 0.045, 0.04);
  shoeR.castShadow = true;
  const soleR = new THREE.Mesh(soleGeo, matShoesAccent);
  soleR.position.set(0, 0.015, 0.04);
  avatar.rightFoot.add(shoeR, soleR);
}

function buildArms(avatar, THREE, matJacket, matSkin) {
  const uArmGeo = new THREE.BoxGeometry(0.11, 0.28, 0.12);
  const fArmGeo = new THREE.BoxGeometry(0.09, 0.24, 0.10);
  const handGeo = new THREE.BoxGeometry(0.08, 0.09, 0.07);

  // Braço Esquerdo
  avatar.leftUpperArm = new THREE.Group();
  avatar.leftUpperArm.position.set(-0.24, 0.32, 0);
  avatar.torso.add(avatar.leftUpperArm);

  const uArmMeshL = new THREE.Mesh(uArmGeo, matJacket);
  uArmMeshL.position.y = -0.12;
  uArmMeshL.castShadow = true;
  avatar.leftUpperArm.add(uArmMeshL);

  avatar.leftForearm = new THREE.Group();
  avatar.leftForearm.position.set(0, -0.26, 0);
  avatar.leftUpperArm.add(avatar.leftForearm);

  const fArmMeshL = new THREE.Mesh(fArmGeo, matJacket);
  fArmMeshL.position.y = -0.10;
  fArmMeshL.castShadow = true;
  avatar.leftForearm.add(fArmMeshL);

  avatar.leftHand = new THREE.Mesh(handGeo, matSkin);
  avatar.leftHand.position.set(0, -0.24, 0);
  avatar.leftForearm.add(avatar.leftHand);

  // Braço Direito
  avatar.rightUpperArm = new THREE.Group();
  avatar.rightUpperArm.position.set(0.24, 0.32, 0);
  avatar.torso.add(avatar.rightUpperArm);

  const uArmMeshR = new THREE.Mesh(uArmGeo, matJacket);
  uArmMeshR.position.y = -0.12;
  uArmMeshR.castShadow = true;
  avatar.rightUpperArm.add(uArmMeshR);

  avatar.rightForearm = new THREE.Group();
  avatar.rightForearm.position.set(0, -0.26, 0);
  avatar.rightUpperArm.add(avatar.rightForearm);

  const fArmMeshR = new THREE.Mesh(fArmGeo, matJacket);
  fArmMeshR.position.y = -0.10;
  fArmMeshR.castShadow = true;
  avatar.rightForearm.add(fArmMeshR);

  avatar.rightHand = new THREE.Mesh(handGeo, matSkin);
  avatar.rightHand.position.set(0, -0.24, 0);
  avatar.rightForearm.add(avatar.rightHand);
}
