/**
 * Champ d'astéroïdes : 2 000 rochers en UN seul appel de dessin (InstancedMesh).
 *
 * Placement : les rochers sont semés autour de la trajectoire de la caméra,
 * en laissant un « tunnel » libre au centre pour qu'elle passe sans collision.
 * Forme et rotation de chaque rocher sont calculées sur le GPU (voir le shader).
 */
import {
  IcosahedronGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  ShaderMaterial,
  Object3D,
  Vector3,
  Color,
} from 'three';
import vertexShader from '../shaders/asteroid.vert.glsl?raw';
import fragmentShader from '../shaders/asteroid.frag.glsl?raw';
import { withNoise } from '../utils/glsl.js';
import { createRandom, gaussian } from '../utils/math.js';
import { WORLD } from '../Journey.js';

const MAX_COUNT = 2000;
const J_START = 1.45; // portion de trajectoire couverte par le champ
const J_END = 2.8;
const TUNNEL = 2.6;   // rayon du couloir libre autour de la caméra

export class Asteroids {
  constructor({ quality, journey }) {
    this.name = 'asteroids';
    this.range = [1.15, 3.0];

    const random = createRandom(2024);
    // Icosaèdre de détail 1 : 80 triangles. Assez pour une silhouette rocheuse,
    // et ×2000 = 160 000 triangles seulement.
    this.geometry = new IcosahedronGeometry(1, 1);

    const seeds = new Float32Array(MAX_COUNT);
    const spins = new Float32Array(MAX_COUNT * 4);

    this.material = new ShaderMaterial({
      vertexShader: withNoise(vertexShader),
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunPos: { value: WORLD.sun },
        uRimColor: { value: new Color('#7dd3fc') },
        uFade: { value: 1 },
        uFogDensity: { value: 0.028 },
      },
    });

    const mesh = new InstancedMesh(this.geometry, this.material, MAX_COUNT);
    const dummy = new Object3D();
    const center = new Vector3();
    const tangent = new Vector3();
    const side = new Vector3();
    const up = new Vector3();
    const n = journey.keyframes.length - 1;

    for (let i = 0; i < MAX_COUNT; i++) {
      // Un point de la trajectoire…
      const j = J_START + random() * (J_END - J_START);
      const { i: k, f } = journey.locate(j);
      const u = (k + f) / n;
      journey.camCurve.getPoint(u, center);
      journey.camCurve.getTangent(u, tangent);

      // …puis un décalage perpendiculaire, en dehors du tunnel central
      side.set(0, 1, 0).cross(tangent).normalize();
      up.crossVectors(tangent, side).normalize();
      const angle = random() * Math.PI * 2;
      const size = 0.06 + Math.pow(random(), 5) * 1.9; // beaucoup de cailloux, peu de géants
      const minRadius = TUNNEL + size * 2.5;
      const radius = minRadius + Math.pow(random(), 1.4) * 26;

      dummy.position
        .copy(center)
        .addScaledVector(side, Math.cos(angle) * radius)
        .addScaledVector(up, Math.sin(angle) * radius * 0.6) // champ aplati, comme une ceinture
        .addScaledVector(tangent, gaussian(random) * 2);
      dummy.rotation.set(random() * 6.28, random() * 6.28, random() * 6.28);
      // Légère déformation non uniforme : rochers allongés
      dummy.scale.set(size * (0.8 + random() * 0.6), size * (0.6 + random() * 0.4), size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      seeds[i] = random();
      const axis = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      spins[i * 4] = axis.x;
      spins[i * 4 + 1] = axis.y;
      spins[i * 4 + 2] = axis.z;
      // Les petits tournent plus vite que les gros (inertie)
      spins[i * 4 + 3] = (0.15 + random() * 0.6) / Math.sqrt(size + 0.2);
    }

    this.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    this.geometry.setAttribute('aSpin', new InstancedBufferAttribute(spins, 4));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); // pour le « frustum culling » de Three.js

    this.object = mesh;
    this.setQuality(quality.preset);
  }

  setQuality(preset) {
    // Les instances ont été tirées au hasard : en garder les N premières reste uniforme
    this.object.count = Math.min(MAX_COUNT, preset.asteroids);
  }

  update({ time, fade }) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFade.value = fade;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.object.dispose();
  }
}
