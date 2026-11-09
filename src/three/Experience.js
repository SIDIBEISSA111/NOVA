/**
 * Experience : le moteur 3D du site.
 *
 *  - UN renderer, UN canvas, UNE scène pour tout le voyage ;
 *  - les objets célestes sont ajoutés un par un (avec progression du chargement) ;
 *  - chaque objet n'est mis à jour et dessiné que dans sa portion du voyage ;
 *  - la boucle est accrochée au ticker GSAP (une seule boucle pour tout le site)
 *    et se met en pause quand l'onglet est caché.
 */
import { WebGLRenderer, Scene, PerspectiveCamera, NoToneMapping, LinearSRGBColorSpace } from 'three';
import { gsap } from 'gsap';
import { Journey } from './Journey.js';
import { CameraRig } from './CameraRig.js';
import { Quality } from './Quality.js';
import { PostFX } from './PostFX.js';
import { rangeFade } from './utils/math.js';
import { env, nextFrame } from '../utils/env.js';

export class Experience {
  constructor({ canvas, scroll }) {
    this.canvas = canvas;
    this.scroll = scroll;
    this.objects = [];
    this.time = 0;
    this.running = false;
    this.reducedMotion = env.reducedMotion;
    this.stats = { fps: 0, ms: 0, frames: 0, acc: 0 };
    // ?debug dans l'URL : journal des images lentes (> 50 ms) dans window.__novaSlow
    this.debug = new URLSearchParams(location.search).has('debug');
    if (this.debug) window.__novaSlow = [];

    this.tick = this.tick.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onVisibility = () => {
      // Onglet caché : on arrête de dessiner (économie de batterie et de GPU)
      this.paused = document.hidden;
    };
  }

  /**
   * Construit la scène étape par étape.
   * @param {(progress:number, label:string) => void} onProgress  0..1
   * @param {Array<{label:string, weight:number, create:(ctx)=>object}>} steps
   */
  async init(steps, onProgress = () => {}) {
    this.quality = new Quality();

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,           // l'anticrénelage est géré par le post-traitement (MSAA)
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    // Le tone mapping ACES et la conversion sRGB sont faits À LA MAIN dans la passe
    // finale (shaders/final.frag.glsl). Le renderer reste donc « neutre » : ainsi,
    // chaque shader n'a qu'une seule variante, précompilable pendant le chargement.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    // Statistiques cumulées sur toute l'image (toutes passes), remises à zéro à chaque image
    this.renderer.info.autoReset = false;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 3000);
    this.journey = new Journey();
    this.rig = new CameraRig({ camera: this.camera, journey: this.journey, scroll: this.scroll });

    this.ctx = {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      quality: this.quality,
      journey: this.journey,
      rig: this.rig,
      experience: this,
    };

    // Chaîne de post-traitement (bloom, ACES, grain…) ; les objets peuvent y ajouter leurs passes
    this.post = new PostFX(this.ctx);
    this.ctx.post = this.post;

    this.onResize();

    // Création des objets, un par image : le fil principal n'est jamais bloqué longtemps
    const total = steps.reduce((s, step) => s + step.weight, 0);
    let done = 0;
    for (const step of steps) {
      onProgress(done / total, step.label);
      await nextFrame();
      const t0 = performance.now();
      const object = await step.create(this.ctx);
      await object?.init?.(); // préparation asynchrone éventuelle (cuisson de textures…)
      if (object) this.add(object);
      if (this.debug) console.info(`[NOVA] ${step.label} : ${Math.round(performance.now() - t0)} ms`);
      done += step.weight;
    }

    // Compilation des shaders en tâche de fond (extension KHR_parallel_shader_compile)
    onProgress(0.94, 'Compilation des shaders');
    this.setAllVisible(true);
    await this.renderer.compileAsync(this.scene, this.camera);
    await this.post.warmup();
    if (this.debug) console.info(`[NOVA] programmes précompilés : ${this.renderer.info.programs.length}`);
    onProgress(1, 'Prêt');

    this.quality.onChange((preset) => this.applyQuality(preset));
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.running = true;
    gsap.ticker.add(this.tick);
  }

  add(object) {
    this.objects.push(object);
    if (object.object) this.scene.add(object.object);
    // Un objet « de fond » (la nébuleuse) fournit la texture d'arrière-plan
    if (object.background) this.scene.background = object.background;
  }

  /** Retrouve un objet par son nom (ex. 'blackHole'). */
  get(name) {
    return this.objects.find((o) => o.name === name);
  }

  setAllVisible(visible) {
    for (const o of this.objects) if (o.object) o.object.visible = visible;
  }

  /** Entrée cinématique : la caméra plonge vers la Terre depuis l'espace. */
  playIntro() {
    if (this.reducedMotion) {
      this.rig.intro = 0;
      return Promise.resolve();
    }
    return gsap.to(this.rig, { intro: 0, duration: 3.2, ease: 'expo.inOut' }).then();
  }

  onResize() {
    // On mesure le conteneur (100lvh) et non la fenêtre : sur mobile, l'apparition
    // de la barre d'adresse ne doit pas provoquer un redimensionnement coûteux.
    const parent = this.canvas.parentElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width === this.width && height === this.height) {
      this.journey.measure(this.scroll.max); // la page a pu changer de hauteur
      return;
    }
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.rig.resize(width, height);
    this.post?.setSize(width, height, this.quality.pixelRatio);
    for (const o of this.objects) o.resize?.(width, height, this.quality.pixelRatio);
  }

  applyQuality(preset) {
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.width = 0; // force le redimensionnement
    this.onResize();
    for (const o of this.objects) o.setQuality?.(preset, this.quality);
    this.post?.setQuality(preset, this.quality);
  }

  tick(_time, deltaMs) {
    if (!this.running || this.paused) return;
    // Durée de l'image, bornée : après une pause, pas de saut brutal
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.time += this.reducedMotion ? dt * 0.15 : dt; // mouvements réduits : animations ralenties

    this.quality.sample(dt);
    this.rig.update(dt);
    const j = this.rig.j;

    const frame = {
      time: this.time,
      dt,
      j,
      camera: this.camera,
      rig: this.rig,
      reducedMotion: this.reducedMotion,
    };

    for (const o of this.objects) {
      // Hors de sa portion du voyage : l'objet n'est ni mis à jour ni dessiné
      const fade = rangeFade(j, o.range, o.fadeEdge ?? 0.3);
      const visible = fade > 0;
      if (o.object) o.object.visible = visible;
      if (o.active !== visible) {
        o.active = visible;
        o.setActive?.(visible); // ex. activer / couper une passe de post-traitement
      }
      if (!visible) continue;
      frame.fade = fade;
      o.update?.(frame);
    }

    const t0 = this.debug ? performance.now() : 0;
    this.renderer.info.reset();
    if (this.post) this.post.render(frame);
    else this.renderer.render(this.scene, this.camera);
    if (this.debug) {
      const ms = performance.now() - t0;
      // Un nouveau programme GPU en plein voyage = une compilation imprévue (saccade)
      const programs = this.renderer.info.programs.length;
      if (this.lastPrograms !== undefined && programs !== this.lastPrograms) {
        console.warn(`[NOVA] ${programs - this.lastPrograms} shader(s) compilé(s) pendant le rendu`);
      }
      this.lastPrograms = programs;
      if (ms > 50) window.__novaSlow.push({ at: Math.round(performance.now()), ms: Math.round(ms), j: +j.toFixed(2), q: this.quality.level });
    }

    this.measure(deltaMs);
  }

  /** Statistiques pour le compteur FPS (touche F). */
  measure(deltaMs) {
    const s = this.stats;
    s.frames++;
    s.acc += deltaMs;
    if (s.acc >= 500) {
      s.fps = (s.frames * 1000) / s.acc;
      s.ms = s.acc / s.frames;
      s.frames = 0;
      s.acc = 0;
      s.calls = this.renderer.info.render.calls;
      s.triangles = this.renderer.info.render.triangles;
    }
  }

  onContextLost = (event) => {
    // Le GPU a été réinitialisé (pilote, mise en veille…) : on s'arrête proprement
    event.preventDefault();
    this.running = false;
    document.documentElement.classList.add('no-webgl');
  };

  onContextRestored = () => {
    document.documentElement.classList.remove('no-webgl');
    const nebula = this.get('nebula');
    nebula?.bake(this.quality.preset.nebula); // la cubemap était en mémoire GPU : elle est perdue
    this.scene.background = nebula?.background ?? null;
    this.running = true;
  };

  /** Libère toute la mémoire GPU et retire tous les écouteurs. */
  dispose() {
    this.running = false;
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const o of this.objects) {
      if (o.object) this.scene.remove(o.object);
      o.dispose?.();
    }
    this.objects.length = 0;
    this.post?.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }
}
