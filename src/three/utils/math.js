/**
 * Petites fonctions mathématiques utilisées partout dans la scène.
 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Amortissement indépendant du nombre d'images/seconde.
 * Rapproche "current" de "target" à la vitesse "lambda" (plus grand = plus rapide).
 * Contrairement à un simple lerp(…, 0.1), le résultat est identique à 30 ou 144 FPS.
 */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

/**
 * Visibilité d'un objet selon la progression du voyage.
 * Renvoie 0 hors de [start, end], 1 au cœur, avec des fondus de largeur "edge".
 */
export function rangeFade(j, [start, end], edge = 0.3) {
  if (j <= start || j >= end) return 0;
  return Math.min(smoothstep(start, start + edge, j), 1 - smoothstep(end - edge, end, j));
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine = même univers. */
export function createRandom(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage gaussien (Box-Muller) : utile pour des répartitions naturelles. */
export function gaussian(random) {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
