/**
 * Qualité adaptative.
 *
 * Trois niveaux prédéfinis. Au démarrage on choisit un niveau selon l'appareil,
 * puis on MESURE les images/seconde réelles : si l'appareil peine, on descend
 * d'un niveau (jamais l'inverse, pour éviter les va-et-vient visibles).
 *
 * Chaque objet de la scène reçoit le preset via setQuality(preset) et adapte
 * ce qui lui coûte cher (nombre de particules, finesse du bruit, etc.).
 */
import { env } from '../utils/env.js';

export const PRESETS = {
  high: {
    name: 'haute',
    pixelRatio: 2,
    stars: 9000,
    asteroids: 2000,
    galaxy: 100000,
    bloom: true,
    bloomScale: 1, // résolution du bloom (1 = moitié de l'écran, comme Three par défaut)
    msaa: 4,
    bhSteps: 110, // pas de calcul du rayon lumineux autour du trou noir
    bhScale: 1,   // résolution de la lentille du trou noir (0.5 = demi-résolution)
    octaves: 6,   // finesse du bruit fractal (Terre, Soleil)
    nebula: 512,  // taille d'une face de la cubemap du fond
  },
  medium: {
    name: 'moyenne',
    pixelRatio: 1.5,
    stars: 6000,
    asteroids: 1300,
    galaxy: 60000,
    bloom: true,
    bloomScale: 0.5,
    msaa: 0,
    bhSteps: 80,
    bhScale: 0.5,
    octaves: 5,
    nebula: 256,
  },
  low: {
    name: 'basse',
    pixelRatio: 1,
    stars: 3500,
    asteroids: 700,
    galaxy: 30000,
    bloom: false, // remplacé par des halos dessinés directement (moins chers)
    bloomScale: 0.5,
    msaa: 0,
    bhSteps: 48,
    bhScale: 0.5,
    octaves: 4,
    nebula: 128,
  },
};

const ORDER = ['high', 'medium', 'low'];

export class Quality {
  constructor() {
    // Forçage possible par l'URL : ?q=low | medium | high (pratique pour tester)
    const forced = new URLSearchParams(location.search).get('q');
    this.forced = ORDER.includes(forced);
    this.level = this.forced ? forced : env.mobile ? 'medium' : 'high';
    this.listeners = new Set();

    // Mesure des FPS
    this.sampling = false;
    this.samples = [];
    this.sampleTime = 0;
    this.warmup = 0;
  }

  get preset() {
    return PRESETS[this.level];
  }

  /** Ratio de pixels plafonné : 2 sur ordinateur, 1.5 sur mobile. */
  get pixelRatio() {
    const cap = env.mobile ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, cap, this.preset.pixelRatio);
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setLevel(level) {
    if (level === this.level || !PRESETS[level]) return;
    this.level = level;
    document.documentElement.classList.toggle('q-low', level === 'low');
    this.listeners.forEach((cb) => cb(this.preset, level));
  }

  /**
   * Lance la mesure (appelé après l'entrée cinématique).
   * Phase 1 « calibrage » : fenêtres de 2,5 s, seuil strict, on descend jusqu'à tenir.
   * Phase 2 « veille » : fenêtres de 4 s pendant tout le voyage, seuil plus tolérant ;
   * si une section lourde (ex. le trou noir) fait chuter les FPS, on descend encore.
   */
  startMonitoring() {
    if (this.forced) return;
    this.sampling = true;
    this.calibrating = true;
    this.resetWindow();
  }

  resetWindow() {
    this.samples.length = 0;
    this.sampleTime = 0;
    this.warmup = 0.6; // on ignore les premières images (compilations, changement de niveau)
  }

  /** À appeler à chaque image avec la durée de l'image (secondes). */
  sample(dt) {
    if (!this.sampling) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    this.samples.push(dt);
    this.sampleTime += dt;
    if (this.sampleTime < (this.calibrating ? 2.5 : 4)) return;

    // Moyenne « robuste » : on retire les 10 % d'images les plus lentes
    // (une saccade ponctuelle ne doit pas dégrader toute l'expérience).
    const sorted = [...this.samples].sort((a, b) => a - b);
    const kept = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.9)));
    const fps = kept.length / kept.reduce((sum, v) => sum + v, 0);
    this.lastMeasuredFps = fps;

    const target = env.mobile ? 30 : 50; // en dessous : l'appareil peine
    const threshold = this.calibrating ? target : target * 0.75;
    const index = ORDER.indexOf(this.level);

    if (fps < threshold && index < ORDER.length - 1) {
      this.setLevel(ORDER[index + 1]);
    } else if (this.calibrating) {
      this.calibrating = false; // le niveau tient : on passe en simple veille
    }
    if (this.level === 'low') this.sampling = false; // plus rien à baisser
    this.resetWindow();
  }
}
