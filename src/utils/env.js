/**
 * Détection de l'environnement : mouvements réduits, tactile, mobile, WebGL.
 * Centralisé ici pour que chaque module prenne les mêmes décisions.
 */

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export const env = {
  /** L'utilisateur a demandé moins d'animations (réglage du système). */
  get reducedMotion() {
    return reducedQuery.matches;
  },
  /** Pointeur précis (souris / pavé) : on peut afficher le curseur personnalisé. */
  finePointer: window.matchMedia('(pointer: fine)').matches,
  /** Appareil tactile principal (téléphone, tablette). */
  touch: window.matchMedia('(pointer: coarse)').matches,
  /** Petit écran ou appareil mobile : on part sur une qualité plus prudente. */
  mobile:
    window.matchMedia('(max-width: 820px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
};

/** Abonnement aux changements de « prefers-reduced-motion » en direct. */
export function onReducedMotionChange(callback) {
  reducedQuery.addEventListener('change', () => callback(reducedQuery.matches));
}

/**
 * Vérifie qu'un VRAI WebGL 2 accéléré est disponible (sans garder le contexte).
 *
 * Sans carte graphique utilisable, les navigateurs basculent sur un rendu
 * logiciel (SwiftShader, llvmpipe…) : la 3D tournerait à 2 images/s et
 * bloquerait la page entière. Dans ce cas, l'image de secours est un bien
 * meilleur choix pour le visiteur.
 *   - failIfMajorPerformanceCaveat : le navigateur refuse de créer le contexte
 *     s'il serait logiciel ;
 *   - on vérifie aussi le nom du moteur de rendu, par sécurité.
 */
export function hasWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

/** Exécute une fonction quand le navigateur est inactif (après le premier affichage). */
export function whenIdle(callback, timeout = 1200) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 200);
  }
}

/** Attend la prochaine image : permet de découper un gros travail sans bloquer. */
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
