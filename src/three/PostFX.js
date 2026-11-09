/**
 * Post-traitement : la chaîne d'effets appliquée à l'image rendue.
 *
 *   RenderPass      → rend la scène dans une texture HDR (demi-flottants)
 *   [BlackHolePass] → lentille gravitationnelle + disque (seulement près du trou noir)
 *   UnrealBloomPass → halo lumineux autour des zones très claires (Soleil, étoiles…)
 *   FinalPass       → ambiance, ACES, sRGB, vignettage, grain (notre shader)
 *
 * Les passes inutiles sont désactivées (enabled = false) : elles ne coûtent rien.
 */
import {
  WebGLRenderTarget,
  HalfFloatType,
  Vector2,
  Color,
  ShaderMaterial,
  Scene,
  Mesh,
  PlaneGeometry,
  OrthographicCamera,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import finalFrag from './shaders/final.frag.glsl?raw';
import { withNoise } from './utils/glsl.js';

export class PostFX {
  constructor({ renderer, scene, camera, quality }) {
    this.renderer = renderer;
    this.quality = quality;
    this.preset = quality.preset;

    this.composer = new EffectComposer(renderer, this.createTarget(this.preset));
    this.composer.addPass(new RenderPass(scene, camera));

    // Emplacement réservé aux passes « de scène » (ex. trou noir), avant le bloom
    this.sceneEffectsIndex = 1;

    // Seuil 1.15 : seules les valeurs HDR (Soleil, cœurs d'étoiles, villes, disque) rayonnent ;
    // la Terre et les nuages éclairés restent nets.
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.8, 0.55, 1.15);
    this.composer.addPass(this.bloom);

    this.finalMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: withNoise(finalFrag),
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uExposure: { value: 1 },
        uTint: { value: new Color(1, 1, 1) },
        uGrain: { value: 0.045 },
        uVignette: { value: 0.75 },
        uAberration: { value: 0.012 },
        uResolution: { value: new Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.finalPass = new ShaderPass(this.finalMaterial);
    this.composer.addPass(this.finalPass);

    this.setQuality(this.preset, quality);
  }

  createTarget(preset) {
    // HalfFloat : l'image garde des valeurs > 1 (HDR) jusqu'au tone mapping.
    // samples > 0 : anticrénelage MSAA directement dans la cible de rendu.
    return new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: preset.msaa });
  }

  /** Insère une passe avant le bloom (ex. le trou noir). */
  insertScenePass(pass) {
    this.composer.insertPass(pass, this.sceneEffectsIndex);
    this.sceneEffectsIndex++;
  }

  setQuality(preset, quality) {
    const msaaChanged = preset.msaa !== this.preset.msaa;
    this.preset = preset;
    this.bloom.enabled = preset.bloom;
    if (msaaChanged) {
      this.composer.reset(this.createTarget(preset)); // recrée les tampons avec le bon MSAA
    }
    if (this.width) this.setSize(this.width, this.height, quality.pixelRatio);
  }

  setSize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    // Le bloom travaille à résolution réduite : 4× moins de pixels en qualité moyenne
    const scale = this.preset.bloomScale;
    this.bloom.setSize(width * pixelRatio * scale, height * pixelRatio * scale);
    this.finalMaterial.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  }

  /**
   * Compile en arrière-plan les shaders de TOUTES les passes (trou noir, bloom,
   * passe finale…) pendant le chargement. Sans cela, ils seraient compilés au
   * moment où l'on arrive au trou noir, provoquant une saccade en plein voyage.
   */
  async warmup() {
    const materials = new Set();
    for (const pass of this.composer.passes) {
      for (const value of Object.values(pass)) {
        const list = Array.isArray(value) ? value : [value];
        for (const item of list) if (item?.isMaterial) materials.add(item);
      }
    }
    const scene = new Scene();
    // Même « forme » de géométrie que les passes plein écran (position + uv, SANS
    // normales) : sinon Three.js compilerait une autre variante du shader.
    const geometry = new PlaneGeometry(2, 2);
    geometry.deleteAttribute('normal');
    materials.forEach((material) => scene.add(new Mesh(geometry, material)));
    await this.renderer.compileAsync(scene, new OrthographicCamera());
    geometry.dispose();
  }

  /** Applique l'ambiance de la section courante puis dessine la chaîne complète. */
  render({ time, dt, rig, reducedMotion }) {
    const u = this.finalMaterial.uniforms;
    const s = rig.state;
    u.uTime.value = reducedMotion ? 0 : time; // grain figé si mouvements réduits
    u.uExposure.value = s.exposure;
    u.uTint.value.copy(s.tint);
    this.bloom.strength = s.bloom;
    this.composer.render(dt);
  }

  dispose() {
    this.composer.passes.forEach((pass) => pass.dispose?.());
    this.composer.dispose();
    this.finalMaterial.dispose();
  }
}
