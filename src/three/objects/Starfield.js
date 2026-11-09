/**
 * Champ d'étoiles scintillantes.
 *
 * Un seul objet Points (un seul appel de dessin) pour des milliers d'étoiles.
 * La sphère d'étoiles suit la caméra : elles restent à l'infini.
 * Une partie des étoiles est concentrée dans une bande : notre « Voie lactée ».
 */
import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Vector3 } from 'three';
import vertexShader from '../shaders/starfield.vert.glsl?raw';
import fragmentShader from '../shaders/starfield.frag.glsl?raw';
import { createRandom, gaussian } from '../utils/math.js';

export const BAND_NORMAL = new Vector3(0.35, 0.88, 0.32).normalize();

const MAX_STARS = 9000;
const RADIUS = 900;

export class Starfield {
  constructor({ quality }) {
    this.name = 'starfield';
    this.range = [-1, 6]; // visible pendant tout le voyage
    const random = createRandom(42);

    const positions = new Float32Array(MAX_STARS * 3);
    const colors = new Float32Array(MAX_STARS * 3);
    const sizes = new Float32Array(MAX_STARS);
    const phases = new Float32Array(MAX_STARS);

    // Deux axes perpendiculaires à la normale de la bande galactique
    const u = new Vector3(1, 0, 0).cross(BAND_NORMAL).normalize();
    const v = new Vector3().crossVectors(BAND_NORMAL, u);
    const dir = new Vector3();

    // Palette : blanc bleuté, bleu glacier, or chaud
    const palette = [
      [0.85, 0.92, 1.0],
      [0.55, 0.82, 1.0],
      [1.0, 0.82, 0.52],
      [1.0, 0.95, 0.88],
    ];

    for (let i = 0; i < MAX_STARS; i++) {
      if (random() < 0.38) {
        // Étoile de la bande : un point du grand cercle, légèrement dispersé
        const a = random() * Math.PI * 2;
        dir.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
        dir.addScaledVector(BAND_NORMAL, gaussian(random) * 0.12).normalize();
      } else {
        // Étoile uniformément répartie sur la sphère
        const z = random() * 2 - 1;
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(1 - z * z);
        dir.set(r * Math.cos(a), z, r * Math.sin(a));
      }
      dir.multiplyScalar(RADIUS).toArray(positions, i * 3);

      // Beaucoup de petites étoiles, quelques géantes (loi de puissance)
      const big = Math.pow(random(), 9);
      sizes[i] = 1.1 + big * 6.5 + random() * 0.8;

      const c = palette[random() < 0.55 ? 0 : Math.floor(random() * palette.length)];
      // Intensité > 1 pour les plus grosses : elles « déclenchent » le bloom
      const intensity = 0.35 + random() * 0.5 + big * 2.6;
      colors[i * 3] = c[0] * intensity;
      colors[i * 3 + 1] = c[1] * intensity;
      colors[i * 3 + 2] = c[2] * intensity;

      phases[i] = random();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: quality.pixelRatio },
        uTwinkle: { value: 1 },
        uFade: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.object = new Points(geometry, this.material);
    this.object.frustumCulled = false; // la sphère entoure toujours la caméra
    this.object.renderOrder = -10;     // dessinée en premier, derrière tout
    this.geometry = geometry;
    this.setQuality(quality.preset, quality);
  }

  setQuality(preset, quality) {
    // On ne dessine qu'une partie des étoiles : pas de nouvelle géométrie à créer
    this.geometry.setDrawRange(0, preset.stars);
    if (quality) this.material.uniforms.uPixelRatio.value = quality.pixelRatio;
  }

  update({ time, camera, reducedMotion }) {
    this.object.position.copy(camera.position);
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uTwinkle.value = reducedMotion ? 0 : 1;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
