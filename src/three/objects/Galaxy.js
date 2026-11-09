/**
 * Galaxie spirale de 100 000 particules, générée par code.
 *
 * Génération (une fois, en JavaScript) : chaque particule reçoit un bras,
 * un rayon, un angle d'enroulement proportionnel au rayon (d'où la spirale)
 * et une dispersion aléatoire, plus forte près du centre.
 * Animation (à chaque image, sur le GPU) : voir galaxy.vert.glsl.
 */
import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  Group,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import vertexShader from '../shaders/galaxy.vert.glsl?raw';
import fragmentShader from '../shaders/galaxy.frag.glsl?raw';
import { WORLD } from '../Journey.js';
import { createRandom, gaussian, damp } from '../utils/math.js';
import { nextFrame } from '../../utils/env.js';

const MAX_PARTICLES = 100000;
const RADIUS = 58;
const ARMS = 4;
const SPIN = 0.1; // enroulement des bras (radians par unité de rayon)

const _hit = new Vector3();

export class Galaxy {
  constructor({ quality }) {
    this.name = 'galaxy';
    this.range = [3.35, 6];
    this.fadeEdge = 0.6;

    const random = createRandom(31415);
    const radius = new Float32Array(MAX_PARTICLES);
    const angle = new Float32Array(MAX_PARTICLES);
    const height = new Float32Array(MAX_PARTICLES);
    const size = new Float32Array(MAX_PARTICLES);
    const mix = new Float32Array(MAX_PARTICLES);
    const offset = new Float32Array(MAX_PARTICLES * 3);
    // La position initiale sert seulement au calcul des limites (frustum culling)
    const position = new Float32Array(MAX_PARTICLES * 3);

    this.random = random;
    this.data = { radius, angle, height, size, mix, offset, position };

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('aRadius', new BufferAttribute(radius, 1));
    geometry.setAttribute('aAngle', new BufferAttribute(angle, 1));
    geometry.setAttribute('aHeight', new BufferAttribute(height, 1));
    geometry.setAttribute('aSize', new BufferAttribute(size, 1));
    geometry.setAttribute('aMix', new BufferAttribute(mix, 1));
    geometry.setAttribute('aOffset', new BufferAttribute(offset, 3));
    this.geometry = geometry;

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: quality.pixelRatio },
      uSize: { value: 1 },
      uRadius: { value: RADIUS },
      uBrightness: { value: 1 },
      uFade: { value: 0 },
      uMouse: { value: new Vector3(9999, 0, 0) },
      uMouseStrength: { value: 0 },
    };
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(this.geometry, this.material);
    this.object = new Group();
    this.object.position.copy(WORLD.galaxy);
    this.object.rotation.set(0.32, 0, 0.12); // galaxie légèrement inclinée
    this.object.add(this.points);

    // --- Interaction souris / doigt ---------------------------------------
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.pointerActive = false;
    this.lastMove = 0;
    this.plane = new Plane();
    this.target = new Vector3(9999, 0, 0);
    this.onPointerMove = (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.pointerActive = true;
      this.lastMove = performance.now();
    };
    this.onPointerLeave = () => (this.pointerActive = false);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerleave', this.onPointerLeave);

    this.setQuality(quality.preset, quality);
  }

  /**
   * Génération des 100 000 particules, par paquets de 20 000 : entre deux
   * paquets on rend la main au navigateur, la page ne se fige jamais.
   */
  async init() {
    const random = this.random;
    const { radius, angle, height, size, mix, offset, position } = this.data;
    const CHUNK = 20000;
    for (let start = 0; start < MAX_PARTICLES; start += CHUNK) {
      const end = Math.min(MAX_PARTICLES, start + CHUNK);
      for (let i = start; i < end; i++) {
        const inBulge = random() < 0.1;
        let r;
        let a;
        if (inBulge) {
          // Bulbe central : nuage sphérique dense
          r = Math.abs(gaussian(random)) * RADIUS * 0.09;
          a = random() * Math.PI * 2;
          height[i] = gaussian(random) * RADIUS * 0.05;
        } else {
          // Disque : plus de particules vers le centre (loi de puissance)
          r = Math.pow(random(), 1.6) * RADIUS + RADIUS * 0.04;
          const arm = Math.floor(random() * ARMS);
          a = (arm / ARMS) * Math.PI * 2 + r * SPIN;
          // Dispersion autour du bras : une loi « en puissance » garde la plupart des
          // étoiles collées au bras, avec quelques-unes égarées entre les bras
          const scatter = Math.pow(random(), 2.6) * (random() < 0.5 ? -1 : 1);
          a += scatter * (0.55 + 0.6 * (1 - r / RADIUS));
          height[i] = gaussian(random) * (1.2 - (r / RADIUS) * 0.9);
        }
        radius[i] = r;
        angle[i] = a;

        // Petit bruit 3D supplémentaire (les étoiles ne sont pas sur une ligne)
        const spread = 0.25 + r * 0.012;
        offset[i * 3] = gaussian(random) * spread;
        offset[i * 3 + 1] = gaussian(random) * spread * 0.3;
        offset[i * 3 + 2] = gaussian(random) * spread;

        size[i] = 110 + Math.pow(random(), 6) * 380; // quelques étoiles plus grosses
        mix[i] = random();
        position[i * 3] = Math.cos(a) * r;
        position[i * 3 + 1] = height[i];
        position[i * 3 + 2] = Math.sin(a) * r;
      }

      await nextFrame();
    }
    for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.data = null;
  }

  setQuality(preset, quality) {
    const count = Math.min(MAX_PARTICLES, preset.galaxy);
    this.geometry.setDrawRange(0, count);
    // Moins de particules → chacune un peu plus lumineuse et plus grosse : même allure
    const ratio = MAX_PARTICLES / count;
    this.uniforms.uBrightness.value = 0.9 * Math.pow(ratio, 0.6);
    this.uniforms.uSize.value = Math.pow(ratio, 0.25);
    if (quality) this.uniforms.uPixelRatio.value = quality.pixelRatio;
  }

  resize(_w, _h, pixelRatio) {
    this.uniforms.uPixelRatio.value = pixelRatio;
  }

  update({ time, dt, camera, fade, reducedMotion }) {
    const u = this.uniforms;
    u.uTime.value = reducedMotion ? 0 : time * 0.12;
    u.uFade.value = fade;

    // La souris ne compte que si elle a bougé récemment (sinon l'effet « colle »)
    const recent = this.pointerActive && performance.now() - this.lastMove < 2500;
    let strength = 0;
    if (recent && !reducedMotion) {
      // On projette le pointeur sur le plan de la galaxie
      this.raycaster.setFromCamera(this.pointer, camera);
      const normal = _hit.set(0, 1, 0).applyQuaternion(this.object.quaternion);
      this.plane.setFromNormalAndCoplanarPoint(normal, this.object.position);
      if (this.raycaster.ray.intersectPlane(this.plane, _hit)) {
        this.points.worldToLocal(_hit);
        if (_hit.length() < 90) {
          this.target.copy(_hit);
          strength = 1;
        }
      }
    }
    // Lissage : le point d'attraction glisse et l'effet apparaît / disparaît en douceur
    u.uMouse.value.x = damp(u.uMouse.value.x, this.target.x, 4, dt);
    u.uMouse.value.y = damp(u.uMouse.value.y, this.target.y, 4, dt);
    u.uMouse.value.z = damp(u.uMouse.value.z, this.target.z, 4, dt);
    u.uMouseStrength.value = damp(u.uMouseStrength.value, strength, 2, dt);
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    this.geometry.dispose();
    this.material.dispose();
  }
}
