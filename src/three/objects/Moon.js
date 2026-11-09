/**
 * La Lune : sphère dont le relief (cratères) est calculé en JavaScript,
 * UNE fois au chargement. Le GPU n'a ensuite qu'à afficher une géométrie fixe,
 * ce qui est bien moins cher que de recalculer les cratères à chaque pixel.
 */
import { Mesh, SphereGeometry, ShaderMaterial, Vector3 } from 'three';
import vertexShader from '../shaders/planet.vert.glsl?raw';
import fragmentShader from '../shaders/moon.frag.glsl?raw';
import { withNoise } from '../utils/glsl.js';
import { WORLD } from '../Journey.js';
import { createRandom } from '../utils/math.js';

const RADIUS = 0.75;

/** Crée une liste de cratères : beaucoup de petits, quelques grands. */
function createCraters(count, random) {
  const craters = [];
  for (let i = 0; i < count; i++) {
    const dir = new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    const size = 0.04 + Math.pow(random(), 3.2) * 0.38; // rayon angulaire (radians)
    craters.push({
      dir,
      size,
      cos: Math.cos(size * 1.6), // au-delà, le cratère n'a plus d'influence
      depth: size * (0.06 + random() * 0.05), // cratères peu profonds : la silhouette reste ronde
    });
  }
  return craters;
}

/**
 * Profil d'un cratère selon la distance au centre d (1 = bord) :
 * cuvette parabolique, rempart surélevé, puis retour au sol.
 */
function craterProfile(d, depth) {
  const bowl = d < 1 ? (d * d - 1) * depth : 0;
  const rim = Math.exp(-Math.pow((d - 1) / 0.28, 2)) * depth * 0.45;
  return bowl + rim;
}

export class Moon {
  constructor({ quality }) {
    this.name = 'moon';
    this.range = [-1, 2.0];

    const random = createRandom(7);
    const craters = createCraters(110, random);

    // Sphère UV indexée (sommets partagés → normales lisses, calcul rapide).
    const W = 192;
    const H = 128;
    const geometry = new SphereGeometry(1, W, H);
    geometry.deleteAttribute('uv');

    const pos = geometry.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      let height = 0;
      for (const c of craters) {
        const cosAngle = v.dot(c.dir);
        if (cosAngle < c.cos) continue; // trop loin : on saute vite
        const d = Math.acos(Math.min(1, cosAngle)) / c.size;
        height += craterProfile(d, c.depth);
      }
      v.multiplyScalar(RADIUS * (1 + height));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();

    // La sphère UV a une « couture » (première et dernière colonne au même endroit)
    // et des pôles où plusieurs sommets se superposent : on y moyenne les normales
    // pour éviter une ligne ou un pincement visibles dans l'éclairage.
    const normal = geometry.attributes.normal;
    const a = new Vector3();
    const b = new Vector3();
    for (let iy = 0; iy <= H; iy++) {
      const first = iy * (W + 1);
      const last = first + W;
      a.fromBufferAttribute(normal, first).add(b.fromBufferAttribute(normal, last)).normalize();
      normal.setXYZ(first, a.x, a.y, a.z);
      normal.setXYZ(last, a.x, a.y, a.z);
    }
    for (const iy of [0, H]) {
      a.set(0, 0, 0);
      for (let ix = 0; ix <= W; ix++) a.add(b.fromBufferAttribute(normal, iy * (W + 1) + ix));
      a.normalize();
      for (let ix = 0; ix <= W; ix++) normal.setXYZ(iy * (W + 1) + ix, a.x, a.y, a.z);
    }
    this.geometry = geometry;

    this.uniforms = {
      uLightDir: { value: WORLD.keyLight },
      uOctaves: { value: quality.preset.octaves },
    };
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader: withNoise(fragmentShader),
      uniforms: this.uniforms,
    });

    this.object = new Mesh(geometry, this.material);
    this.object.position.copy(WORLD.moon);
    this.object.rotation.set(0.4, 2.2, 0.1);
  }

  setQuality(preset) {
    this.uniforms.uOctaves.value = preset.octaves;
  }

  update({ dt, reducedMotion }) {
    if (!reducedMotion) this.object.rotation.y += dt * 0.02;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
