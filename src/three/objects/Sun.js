/**
 * Le Soleil : une sphère au shader « en ébullition » + une couronne en billboard.
 * Ses couleurs HDR (> 1) déclenchent le bloom du post-traitement.
 */
import { Group, Mesh, SphereGeometry, PlaneGeometry, ShaderMaterial, AdditiveBlending } from 'three';
import planetVert from '../shaders/planet.vert.glsl?raw';
import sunFrag from '../shaders/sun.frag.glsl?raw';
import coronaVert from '../shaders/corona.vert.glsl?raw';
import coronaFrag from '../shaders/corona.frag.glsl?raw';
import { withNoise } from '../utils/glsl.js';
import { WORLD } from '../Journey.js';

const RADIUS = 10;
const CORONA_SIZE = RADIUS * 4.2; // côté du carré de la couronne

export class Sun {
  constructor({ quality }) {
    this.name = 'sun';
    this.range = [1.3, 3.9];
    this.fadeEdge = 0.5;

    this.object = new Group();
    this.object.position.copy(WORLD.sun);

    const time = { value: 0 };
    const fade = { value: 1 };
    this.time = time;
    this.fade = fade;

    this.sphereGeometry = new SphereGeometry(RADIUS, 64, 48);
    this.sphereMaterial = new ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: withNoise(sunFrag),
      uniforms: { uTime: time, uOctaves: { value: quality.preset.octaves }, uFade: fade },
    });
    this.sphere = new Mesh(this.sphereGeometry, this.sphereMaterial);
    this.object.add(this.sphere);

    this.coronaGeometry = new PlaneGeometry(CORONA_SIZE, CORONA_SIZE);
    this.coronaMaterial = new ShaderMaterial({
      vertexShader: coronaVert,
      fragmentShader: withNoise(coronaFrag),
      uniforms: {
        uTime: time,
        uEdge: { value: (RADIUS * 2) / CORONA_SIZE },
        uIntensity: { value: 1 },
        uFade: fade,
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.corona = new Mesh(this.coronaGeometry, this.coronaMaterial);
    this.corona.renderOrder = 3;
    this.object.add(this.corona);

    this.setQuality(quality.preset);
  }

  setQuality(preset) {
    this.sphereMaterial.uniforms.uOctaves.value = preset.octaves;
    // Sans bloom (qualité basse), la couronne compense : plus large et plus intense.
    // C'est l'alternative légère au bloom pour garder un soleil éblouissant.
    this.coronaMaterial.uniforms.uIntensity.value = preset.bloom ? 1 : 2.2;
  }

  update({ time, camera, fade, reducedMotion }) {
    this.time.value = time;
    this.fade.value = fade;
    // Billboard : le carré prend l'orientation de la caméra
    this.corona.quaternion.copy(camera.quaternion);
    if (!reducedMotion) this.sphere.rotation.y = time * 0.01;
  }

  dispose() {
    this.sphereGeometry.dispose();
    this.sphereMaterial.dispose();
    this.coronaGeometry.dispose();
    this.coronaMaterial.dispose();
  }
}
