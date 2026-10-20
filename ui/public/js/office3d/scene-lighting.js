// @ts-check
// DAI HQ — Módulo de Iluminação Cênica do Escritório 3D (Three.js)

/**
 * Configura luzes cenográficas e holofotes do estúdio e da Sala de Guerra
 * @param {any} scene
 * @param {any} THREE
 */
export function setupOfficeLights(scene, THREE) {
  const ambient = new THREE.AmbientLight(0x1e293b, 1.3);
  scene.add(ambient);

  const moonLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  moonLight.position.set(6, 6, -2);
  moonLight.castShadow = true;
  scene.add(moonLight);

  const deskSpot = new THREE.SpotLight(0xfff5ea, 2.6, 4.0, Math.PI / 3, 0.45, 1.2);
  deskSpot.position.set(0, 2.4, 0.2);
  deskSpot.target.position.set(0, 0.95, 0.25);
  deskSpot.castShadow = true;
  scene.add(deskSpot);
  scene.add(deskSpot.target);

  const screenGlow = new THREE.PointLight(0x00d2ff, 1.8, 2.5);
  screenGlow.position.set(0, 1.38, 0.15);
  scene.add(screenGlow);

  const corridorLight = new THREE.PointLight(0x00d2ff, 1.4, 3.8);
  corridorLight.position.set(-6.5, 2.2, -1.0);
  scene.add(corridorLight);

  const warTableSpot = new THREE.SpotLight(0xfff8ee, 3.2, 7.0, Math.PI / 3.2, 0.45, 1.2);
  warTableSpot.position.set(-13.0, 3.8, -0.3);
  warTableSpot.target.position.set(-13.0, 0.8, -0.3);
  warTableSpot.castShadow = true;
  scene.add(warTableSpot);
  scene.add(warTableSpot.target);

  const warScreenGlow = new THREE.PointLight(0x38bdf8, 2.6, 8.5);
  warScreenGlow.position.set(-13.0, 2.4, -4.8);
  scene.add(warScreenGlow);
}
