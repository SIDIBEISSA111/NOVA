/**
 * Le voyage : trajectoire de la caméra et correspondance avec le défilement.
 *
 * La progression du voyage est un nombre "j" entre 0 et 5 :
 *   0 = Terre, 1 = Lune, 2 = astéroïdes, 3 = Soleil, 4 = trou noir, 5 = galaxie.
 * Chaque valeur entière correspond au CENTRE d'une section HTML.
 *
 * Deux courbes Catmull-Rom (douces, qui passent exactement par leurs points) :
 *   - camCurve  : où se trouve la caméra ;
 *   - lookCurve : ce qu'elle regarde.
 * Des points intermédiaires (j = 0.5, 1.5…) dessinent les virages entre deux étapes.
 *
 * "frame" décale l'image à l'écran pour laisser la place au texte :
 *   [x écran large, y écran étroit, y écran large (facultatif)], de -1 à 1 (0 = centré).
 */
import { CatmullRomCurve3, Vector3, Color } from 'three';
import { clamp, lerp, smoothstep } from './utils/math.js';
import { measureAnchors, scrollToProgress } from '../utils/sections.js';

// Positions des objets célestes (partagées avec les objets de la scène)
export const WORLD = {
  earth: new Vector3(0, 0, 0),
  moon: new Vector3(-3.3, 1.0, -9.5),
  sun: new Vector3(34, 0, -128),
  blackHole: new Vector3(0, 0, -200),
  galaxy: new Vector3(0, -30, -330),
  // Lumière principale du système Terre-Lune (venant d'en haut à gauche, légèrement de face)
  keyLight: new Vector3(-0.82, 0.32, 0.5).normalize(),
};

/*
 * Images-clés du voyage.
 *  cam / look : position et cible de la caméra
 *  frame      : décalage de cadrage (voir plus haut)
 *  exposure   : exposition du tone mapping ACES (ambiance lumineuse)
 *  bloom      : intensité du halo lumineux
 *  tint       : teinte d'ambiance appliquée en post-traitement
 */
export const KEYFRAMES = [
  { j: 0,   cam: [0, 0.4, 7.6],      look: [0, 0, 0],          frame: [0.4, 0.3],  exposure: 1.0,  bloom: 0.7,  tint: '#dbeeff' },
  { j: 0.5, cam: [-4.8, 1.5, 1.6],   look: [-3.4, 0.9, -7],    frame: [0.0, 0.28],   exposure: 1.0,  bloom: 0.7,  tint: '#e4efff' },
  { j: 1,   cam: [-6.6, 2.0, -15.4], look: [-2.2, 0.7, -5],    frame: [-0.32, 0.3],  exposure: 1.05, bloom: 0.7,  tint: '#eef2ff' },
  { j: 1.5, cam: [-3.4, 1.2, -25],   look: [0, 0, -44],        frame: [0.0, 0.22],   exposure: 1.0,  bloom: 0.75, tint: '#f2efe8' },
  { j: 2,   cam: [0, 0.8, -45],      look: [6, 0.5, -64],       frame: [0.0, 0.3],    exposure: 1.05, bloom: 0.8,  tint: '#fff1dc' },
  { j: 2.5, cam: [5, 1.5, -72],      look: [24, 0, -118],      frame: [0.2, 0.3],    exposure: 0.95, bloom: 0.9,  tint: '#ffe6c2' },
  { j: 3,   cam: [9, 2.2, -92],      look: [34, 0, -128],      frame: [0.34, 0.3],   exposure: 0.85, bloom: 1.05, tint: '#ffdcaa' },
  { j: 3.5, cam: [6, 2.5, -150],     look: [0, 0, -200],       frame: [0.0, 0.25],   exposure: 0.95, bloom: 0.9,  tint: '#f4e6d0' },
  { j: 4,   cam: [0, 2.3, -178],     look: [0, 0, -200],       frame: [0.0, 0.2, 0.2], exposure: 0.95, bloom: 0.5,  tint: '#ffe9c9' },
  { j: 4.5, cam: [-26, 14, -212],    look: [0, -24, -322],     frame: [-0.1, 0.25],  exposure: 1.0,  bloom: 0.8,  tint: '#e6ecff' },
  { j: 5,   cam: [0, 34, -262],      look: [0, -30, -330],     frame: [-0.4, 0.3],   exposure: 1.05, bloom: 0.85, tint: '#e3eeff' },
];

export const J_MAX = 5;

export class Journey {
  constructor(keyframes = KEYFRAMES) {
    this.keyframes = keyframes.map((k) => ({ ...k, tintColor: new Color(k.tint) }));
    const cams = keyframes.map((k) => new Vector3(...k.cam));
    const looks = keyframes.map((k) => new Vector3(...k.look));
    // "centripetal" : variante de Catmull-Rom qui évite boucles et dépassements
    this.camCurve = new CatmullRomCurve3(cams, false, 'centripetal');
    this.lookCurve = new CatmullRomCurve3(looks, false, 'centripetal');

    this.anchors = [0, 1, 2, 3, 4, 5]; // positions de scroll (px) des centres de sections
  }

  /** Mesure la position des sections dans la page (au chargement et au redimensionnement). */
  measure(maxScroll) {
    this.anchors = measureAnchors(maxScroll);
  }

  /** Position de scroll (px) → progression j (0..5). */
  fromScroll(y) {
    return scrollToProgress(y, this.anchors);
  }

  /** Index du segment d'images-clés contenant j, et position relative dans ce segment. */
  locate(j) {
    const k = this.keyframes;
    j = clamp(j, 0, J_MAX);
    let i = 0;
    while (i < k.length - 2 && j > k[i + 1].j) i++;
    const f = (j - k[i].j) / (k[i + 1].j - k[i].j);
    return { i, f: clamp(f, 0, 1) };
  }

  /** Remplit outCam, outLook et renvoie l'interpolation des réglages d'ambiance. */
  sample(j, outCam, outLook, outState) {
    const { i, f } = this.locate(j);
    const n = this.keyframes.length - 1;
    const u = (i + f) / n; // paramètre de courbe : le point k est à u = k/n
    this.camCurve.getPoint(u, outCam);
    this.lookCurve.getPoint(u, outLook);

    if (outState) {
      const a = this.keyframes[i];
      const b = this.keyframes[i + 1];
      const s = smoothstep(0, 1, f);
      outState.frameX = lerp(a.frame[0], b.frame[0], s);
      outState.frameY = lerp(a.frame[1], b.frame[1], s);
      outState.frameYWide = lerp(a.frame[2] ?? 0, b.frame[2] ?? 0, s);
      outState.exposure = lerp(a.exposure, b.exposure, s);
      outState.bloom = lerp(a.bloom, b.bloom, s);
      outState.tint.copy(a.tintColor).lerp(b.tintColor, s);
    }
  }
}
