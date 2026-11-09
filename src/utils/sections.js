/**
 * Correspondance entre la position de défilement et la progression du voyage.
 * Sans dépendance à Three.js : utilisé aussi par la barre de progression,
 * qui doit fonctionner même si la 3D est indisponible.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smooth = (t) => t * t * (3 - 2 * t);

/** Position de scroll (px) où chaque section est centrée à l'écran. */
export function measureAnchors(maxScroll) {
  const sections = document.querySelectorAll('[data-section]');
  const vh = window.innerHeight;
  return Array.from(sections, (el, i) => {
    if (i === 0) return 0;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    return clamp(top + rect.height / 2 - vh / 2, 0, maxScroll);
  });
}

/**
 * Scroll (px) → progression j (0 = première section, n-1 = dernière).
 * Entre deux sections, on adoucit légèrement : la caméra ralentit à
 * l'approche de chaque étape, ce qui laisse le temps de lire.
 */
export function scrollToProgress(y, anchors) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y <= anchors[i + 1]) {
      const f = (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
      return i + (f + (smooth(f) - f) * 0.55);
    }
  }
  return anchors.length - 1;
}
