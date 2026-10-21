// @ts-check
/**
 * Rig de iluminação do escritório 3D (EP-03.06).
 * Responsabilidade única: criar as luzes cenográficas e aplicar presets.
 */
import { LIGHTING_PRESETS, resolveLightingPreset } from "../office/lighting-presets.js";

export const LIGHT_NAMES = Object.freeze([
  "ambient",
  "keyLight",
  "desk",
  "screen",
  "corridor",
  "warTable",
  "warScreen"
]);

export class OfficeLightingRig {
  /**
   * @param {any} scene
   * @param {any} THREE
   */
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    /** @type {Record<string, any>} */
    this.lights = {};
    /** @type {Record<string, any>} */
    this.targets = {};
    this._build();
  }

  _build() {
    const THREE = this.THREE;
    this._addLight("ambient", new THREE.AmbientLight(0x1e293b, 1.3));

    this._addLight(
      "keyLight",
      new THREE.DirectionalLight(0x38bdf8, 1.2),
      { position: [6, 6, -2], castShadow: true }
    );

    this._addSpot("desk", [0, 2.4, 0.2], [0, 0.95, 0.25], {
      color: 0xfff5ea,
      intensity: 2.6,
      distance: 4.0,
      angle: Math.PI / 3,
      penumbra: 0.45,
      decay: 1.2
    });

    this._addPoint("screen", [0, 1.38, 0.15], { color: 0x00d2ff, intensity: 1.8, distance: 2.5 });
    this._addPoint("corridor", [-6.5, 2.2, -1.0], { color: 0x00d2ff, intensity: 1.4, distance: 3.8 });

    this._addSpot("warTable", [-13.0, 3.8, -0.3], [-13.0, 0.8, -0.3], {
      color: 0xfff8ee,
      intensity: 3.2,
      distance: 7.0,
      angle: Math.PI / 3.2,
      penumbra: 0.45,
      decay: 1.2
    });

    this._addPoint("warScreen", [-13.0, 2.4, -4.8], {
      color: 0x38bdf8,
      intensity: 2.6,
      distance: 8.5
    });
  }

  /**
   * @param {string} name
   * @param {any} light
   * @param {{ position?: number[], castShadow?: boolean }} [options]
   */
  _addLight(name, light, options = {}) {
    if (options.position && light.position?.set) {
      light.position.set(options.position[0], options.position[1], options.position[2]);
    }
    if (options.castShadow) light.castShadow = true;
    this.scene.add(light);
    this.lights[name] = light;
  }

  /**
   * @param {string} name
   * @param {number[]} position
   * @param {number[]} targetPosition
   * @param {any} options
   */
  _addSpot(name, position, targetPosition, options) {
    const THREECtor = this.THREE;
    const spot = new THREECtor.SpotLight(
      options.color,
      options.intensity,
      options.distance,
      options.angle,
      options.penumbra,
      options.decay
    );
    spot.position.set(position[0], position[1], position[2]);
    spot.target.position.set(targetPosition[0], targetPosition[1], targetPosition[2]);
    spot.castShadow = true;
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.lights[name] = spot;
    this.targets[name] = spot.target;
  }

  /**
   * @param {string} name
   * @param {number[]} position
   * @param {any} options
   */
  _addPoint(name, position, options) {
    const PointLight = this.THREE.PointLight;
    const light = new PointLight(options.color, options.intensity, options.distance);
    light.position.set(position[0], position[1], position[2]);
    this.scene.add(light);
    this.lights[name] = light;
  }

  /**
   * Aplica um preset de iluminação sem recriar a cena.
   * @param {{ id?: string, lights?: Record<string, { color: number, intensity: number }> }} [preset]
   * @returns {string} id do preset efetivamente aplicado
   */
  apply(preset) {
    const resolved = resolveLightingPreset(preset?.id);
    for (const name of LIGHT_NAMES) {
      const definition = resolved.lights[name];
      const light = this.lights[name];
      if (!definition || !light) continue;
      if (light.color && typeof light.color.set === "function") {
        light.color.set(definition.color);
      } else {
        light.color = definition.color;
      }
      light.intensity = definition.intensity;
    }
    return resolved.id;
  }

  /**
   * @param {string} name
   * @returns {any}
   */
  getLight(name) {
    return this.lights[name];
  }

  /** Remove as luzes e alvos da cena. */
  dispose() {
    for (const light of Object.values(this.lights)) {
      this.scene.remove(light);
      if (typeof light.dispose === "function") light.dispose();
    }
    for (const target of Object.values(this.targets)) {
      this.scene.remove(target);
    }
    this.lights = {};
    this.targets = {};
  }
}

/**
 * @param {any} scene
 * @param {any} THREE
 * @returns {OfficeLightingRig}
 */
export function createLightingRig(scene, THREE) {
  return new OfficeLightingRig(scene, THREE);
}

export { LIGHTING_PRESETS };
