/**
 * Le « rig » de caméra : suit la trajectoire selon le défilement,
 * ajoute une parallaxe douce selon la souris et gère le cadrage.
 */
import { Vector3, Vector2, Color, MathUtils } from 'three';
import { damp } from './utils/math.js';
import { env } from '../utils/env.js';

const _right = new Vector3();
const _up = new Vector3();
const _forward = new Vector3();

export class CameraRig {
  constructor({ camera, journey, scroll }) {
    this.camera = camera;
    this.journey = journey;
    this.scroll = scroll;

    this.j = 0;          // progression lissée affichée
    this.target = 0;     // progression demandée par le scroll
    this.velocity = 0;   // vitesse de progression (utile pour le son, les effets)
    this.reducedMotion = env.reducedMotion;
    this.intro = 1;      // 1 = caméra reculée (avant l'entrée cinématique), 0 = position normale

    this.position = new Vector3();
    this.look = new Vector3();
    this.state = { frameX: 0, frameY: 0, frameYWide: 0, exposure: 1, bloom: 0.8, tint: new Color() };

    // Parallaxe souris : position brute et position lissée (inertie)
    this.pointer = new Vector2();
    this.pointerSmooth = new Vector2();
    this.onPointerMove = (e) => {
      if (e.pointerType === 'touch') return; // pas de parallaxe au doigt
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    this.width = 1;
    this.height = 1;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.camera.aspect = aspect;
    // En portrait, on élargit le champ de vision pour garder les objets dans le cadre
    this.camera.fov = aspect < 1 ? Math.min(72, 45 / Math.pow(aspect, 0.55)) : 45;
    this.journey.measure(this.scroll.max);
    this.target = this.journey.fromScroll(this.scroll.y);
    this.j = this.target;
  }

  update(dt) {
    this.target = this.journey.fromScroll(this.scroll.y);

    if (this.reducedMotion) {
      // Mouvements réduits : caméra statique sur l'étape la plus proche, sans transition
      this.j = Math.round(this.target);
      this.velocity = 0;
    } else {
      const previous = this.j;
      // Lenis lisse déjà le défilement ; ce second amortissement adoucit le tactile
      this.j = damp(this.j, this.target, 6, dt);
      this.velocity = dt > 0 ? (this.j - previous) / dt : 0;
    }

    this.journey.sample(this.j, this.position, this.look, this.state);

    // Entrée cinématique : la caméra part de plus loin et plonge vers la Terre
    if (this.intro > 0) {
      _forward.subVectors(this.position, this.look).normalize();
      this.position.addScaledVector(_forward, this.intro * 9);
      this.position.y += this.intro * 2.5;
    }

    const cam = this.camera;
    cam.position.copy(this.position);
    cam.lookAt(this.look);

    // Parallaxe : léger décalage dans le plan de la caméra, proportionnel à la distance
    if (!this.reducedMotion) {
      this.pointerSmooth.x = damp(this.pointerSmooth.x, this.pointer.x, 2.5, dt);
      this.pointerSmooth.y = damp(this.pointerSmooth.y, this.pointer.y, 2.5, dt);
      const amp = cam.position.distanceTo(this.look) * 0.035;
      _right.set(1, 0, 0).applyQuaternion(cam.quaternion);
      _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(_right, this.pointerSmooth.x * amp);
      cam.position.addScaledVector(_up, this.pointerSmooth.y * amp * 0.6);
      cam.lookAt(this.look);
      // Très léger roulis : renforce la sensation de vol
      cam.rotateZ(-this.pointerSmooth.x * 0.015 + MathUtils.clamp(this.velocity, -1, 1) * 0.02);
    }

    this.applyFrame();
    // Matrices à jour dès maintenant : certains effets (trou noir) en ont besoin avant le rendu
    cam.updateMatrixWorld();
  }

  /**
   * Décale le centre optique (setViewOffset) pour placer l'objet à gauche,
   * à droite ou en haut de l'écran, sans déformer la perspective.
   */
  applyFrame() {
    const { width: w, height: h, camera } = this;
    // Même seuil que le CSS (960 px) : au-dessus, le texte est sur le côté → décalage
    // horizontal ; en dessous, le texte est en bas → l'objet remonte dans l'écran.
    const sideLayout = w >= 960 && w >= h;
    const fx = sideLayout ? this.state.frameX : 0;
    const fy = sideLayout ? this.state.frameYWide : this.state.frameY;
    camera.setViewOffset(w, h, (-fx * w) / 2, (fy * h) / 2, w, h);
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove);
  }
}
