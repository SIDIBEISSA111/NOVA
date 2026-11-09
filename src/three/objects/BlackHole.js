/**
 * Le trou noir.
 *
 * Il n'a pas de géométrie : c'est une passe de post-traitement qui « tord »
 * l'image de la scène (lentille gravitationnelle) et y dessine le disque
 * d'accrétion par lancer de rayons. Voir shaders/blackhole.frag.glsl.
 *
 * Deux étapes :
 *   1. la lentille est calculée dans une texture, en DEMI-résolution sur les
 *      appareils moyens et modestes (c'est l'effet le plus coûteux du site) ;
 *   2. une composition la mélange à l'image pleine résolution.
 *
 * La passe n'est active que dans sa portion du voyage ET si le trou noir est
 * devant la caméra : le reste du temps, elle ne coûte rien.
 */
import { ShaderMaterial, Matrix3, Matrix4, Vector3, Euler, WebGLRenderTarget, HalfFloatType } from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import fullscreenVert from '../shaders/fullscreen.vert.glsl?raw';
import lensFrag from '../shaders/blackhole.frag.glsl?raw';
import compositeFrag from '../shaders/blackholeComposite.frag.glsl?raw';
import { withNoise } from '../utils/glsl.js';
import { WORLD } from '../Journey.js';

const RS = 1.0;          // rayon de l'horizon (unités de la scène)
const BOUND = 12;        // zone d'influence de la lentille

const _local = new Vector3();

/** Passe sur mesure : lentille (résolution réglable) puis composition. */
class BlackHolePass extends Pass {
  constructor(lensMaterial) {
    super();
    this.lensMaterial = lensMaterial;
    this.compositeMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: compositeFrag,
      uniforms: { tDiffuse: { value: null }, tLens: { value: null } },
      depthTest: false,
      depthWrite: false,
    });
    this.lensTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    this.lensQuad = new FullScreenQuad(lensMaterial);
    this.compositeQuad = new FullScreenQuad(this.compositeMaterial);
    this.scale = 1;
    this.fullWidth = 1;
    this.fullHeight = 1;
  }

  setScale(scale) {
    this.scale = scale;
    this.setSize(this.fullWidth, this.fullHeight);
  }

  setSize(width, height) {
    this.fullWidth = width;
    this.fullHeight = height;
    this.lensTarget.setSize(Math.max(1, Math.round(width * this.scale)), Math.max(1, Math.round(height * this.scale)));
  }

  render(renderer, writeBuffer, readBuffer) {
    // 1. Lentille → texture (éventuellement réduite)
    this.lensMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.lensTarget);
    this.lensQuad.render(renderer);

    // 2. Composition → tampon suivant (ou écran si c'est la dernière passe)
    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tLens.value = this.lensTarget.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compositeQuad.render(renderer);
  }

  dispose() {
    this.lensTarget.dispose();
    this.compositeMaterial.dispose();
    this.lensQuad.dispose();
    this.compositeQuad.dispose();
  }
}

export class BlackHole {
  constructor({ quality, post, experience }) {
    this.name = 'blackHole';
    this.range = [3.0, 4.85];
    this.fadeEdge = 0.4;

    // Orientation du disque : légèrement incliné pour un rendu « cinéma »
    const tilt = new Matrix4().makeRotationFromEuler(new Euler(-0.2, 0, 0.14));
    const basis = new Matrix3().setFromMatrix4(tilt).transpose(); // monde → disque

    this.material = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: withNoise(lensFrag),
      uniforms: {
        tDiffuse: { value: null },
        tSky: { value: experience.get('nebula')?.background ?? null },
        uCamPos: { value: new Vector3() },
        uCamWorld: { value: new Matrix4() },
        uInvProj: { value: new Matrix4() },
        uViewProj: { value: new Matrix4() },
        uCenter: { value: WORLD.blackHole },
        uBasis: { value: basis },
        uRs: { value: RS },
        uDiskIn: { value: RS * 3 },
        uDiskOut: { value: RS * 9.5 },
        uBound: { value: BOUND },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uSteps: { value: quality.preset.bhSteps },
        uStepScale: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.pass = new BlackHolePass(this.material);
    this.pass.enabled = false;
    post.insertScenePass(this.pass);
    this.setQuality(quality.preset);
  }

  setQuality(preset) {
    const u = this.material.uniforms;
    u.uSteps.value = preset.bhSteps;
    // Moins de pas → pas plus longs, pour couvrir la même distance
    u.uStepScale.value = Math.max(1, 90 / preset.bhSteps);
    this.pass.setScale(preset.bhScale);
  }

  /** Appelé par Experience quand on entre / sort de la portion du voyage. */
  setActive(active) {
    this.pass.enabled = active;
  }

  update({ time, camera, fade, reducedMotion }) {
    const u = this.material.uniforms;

    // Trou noir derrière la caméra (et loin) : inutile de calculer la passe
    _local.copy(WORLD.blackHole).applyMatrix4(camera.matrixWorldInverse);
    this.pass.enabled = _local.z < BOUND;

    u.uFade.value = fade;
    u.uTime.value = reducedMotion ? 0 : time;
    u.uCamPos.value.copy(camera.position);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }

  dispose() {
    this.material.dispose();
    this.pass.dispose();
  }
}
