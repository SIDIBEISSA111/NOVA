/**
 * Point d'entrée.
 *
 * Ordre volontaire pour la performance :
 *  1. le HTML et le CSS s'affichent tout de suite (texte lisible immédiatement) ;
 *  2. ce fichier, léger, branche le défilement et les animations d'interface ;
 *  3. la 3D (Three.js, lourde) est chargée APRÈS, quand le navigateur est libre.
 */
import './styles/main.css';
import { initScroll } from './ui/scroll.js';
import { splitTitle, animateTitle } from './ui/title.js';
import { initReveals } from './ui/reveal.js';
import { createLoader } from './ui/loader.js';
import { initCards } from './ui/cards.js';
import { initCounters } from './ui/counters.js';
import { initForm } from './ui/form.js';
import { initProgress, bindProgress } from './ui/progress.js';
import { initCursor } from './ui/cursor.js';
import { initAudio } from './ui/audio.js';
import { initFps } from './ui/fps.js';
import { env, hasWebGL2, whenIdle } from './utils/env.js';

// Le voyage commence toujours sur Terre : pas de restauration de la position au rechargement
// (sauf si l'URL vise une section précise, ex. /#equipage)
if ('scrollRestoration' in history && !location.hash) {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

const app = { scroll: null, experience: null, booting: false };
const scroll = (app.scroll = initScroll());

// --- Interface (fonctionne avec ou sans 3D) --------------------------------
animateTitle(splitTitle(document.querySelector('[data-split]')));
initReveals();
initCards();
initCounters();
initForm();
initCursor();

// La barre de progression lit la progression lissée de la caméra si la 3D tourne,
// sinon elle la calcule elle-même depuis le défilement.
const progress = initProgress(scroll);
bindProgress(progress, () => app.experience?.rig.j);

initAudio(() => ({
  j: app.experience?.rig.j ?? 0,
  velocity: app.experience?.rig.velocity ?? 0,
}));
initFps(() => app.experience);

// --- 3D ---------------------------------------------------------------------
const loader = createLoader();
const poster = document.querySelector('.fallback');

/**
 * Sur écran tactile, la 3D démarre au premier geste (toucher, défilement, clavier).
 * En attendant, une illustration de la Terre s'affiche : la page est légère et
 * réactive immédiatement, et la batterie / les données ne sont dépensées que si
 * le visiteur s'engage. Mettre à false pour démarrer la 3D dès le chargement.
 */
const START_3D_ON_INTERACTION_ON_TOUCH = true;

/** Pas de WebGL : on affiche l'illustration de secours, le site reste complet. */
function showFallback() {
  document.documentElement.classList.add('no-webgl');
  document.documentElement.classList.remove('is-booting', 'has-poster');
  poster?.removeAttribute('hidden');
  loader.remove();
}

async function boot3D() {
  if (app.experience || app.booting) return;
  app.booting = true;
  document.documentElement.classList.add('is-booting'); // affiche l'écran de chargement
  try {
    // Import dynamique : Three.js forme un fichier séparé, téléchargé maintenant seulement
    const { startExperience } = await import('./three/index.js');
    app.experience = await startExperience({
      canvas: document.getElementById('webgl'),
      scroll,
      onProgress: (p, label) => loader.set(p, label),
    });
    await loader.done();
    // Entrée cinématique : le canvas apparaît en fondu pendant que la caméra plonge
    document.documentElement.classList.add('is-3d-ready');
    document.documentElement.classList.remove('has-poster');
    await app.experience.playIntro();
    app.experience.quality.startMonitoring(); // mesure des FPS une fois la scène stable
  } catch (error) {
    console.error('[NOVA] Échec de la 3D, passage en mode image :', error);
    app.experience?.dispose();
    app.experience = null;
    showFallback();
  }
}

function scheduleBoot() {
  if (!hasWebGL2()) return showFallback();

  const touchOnly = env.touch && !env.finePointer;
  if (START_3D_ON_INTERACTION_ON_TOUCH && touchOnly) {
    // Illustration en attendant le premier geste
    document.documentElement.classList.add('has-poster');
    poster?.removeAttribute('hidden');
    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];
    const start = () => {
      events.forEach((type) => window.removeEventListener(type, start));
      boot3D();
    };
    events.forEach((type) => window.addEventListener(type, start, { passive: true }));
    return;
  }
  whenIdle(boot3D);
}

// On attend que la page soit affichée et le navigateur disponible
if (document.readyState === 'complete') scheduleBoot();
else window.addEventListener('load', scheduleBoot, { once: true });

// Libération de la mémoire GPU quand la page est réellement quittée
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) app.experience?.dispose();
});

if (import.meta.env.DEV) window.nova = app; // inspection depuis la console en développement
