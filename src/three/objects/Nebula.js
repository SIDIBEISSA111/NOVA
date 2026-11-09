/**
 * Nébuleuse de fond « cuite » une seule fois dans une cubemap.
 *
 * Le shader de nébuleuse (bruit fractal déformé) est trop cher pour tourner
 * à chaque image en plein écran. On le rend donc une fois au chargement
 * (voir utils/bakeCube.js), puis la cubemap obtenue sert de fond à la scène :
 * coût quasi nul ensuite.
 */
import fragmentShader from '../shaders/nebula.frag.glsl?raw';
import { bakeCube } from '../utils/bakeCube.js';
import { BAND_NORMAL } from './Starfield.js';

export class Nebula {
  constructor({ renderer, quality }) {
    this.name = 'nebula';
    this.range = [-1, 6];
    this.renderer = renderer;
    this.size = quality.preset.nebula;
  }

  /** Initialisation asynchrone, appelée par Experience juste après la création. */
  init() {
    return this.bake(this.size);
  }

  async bake(size) {
    this.target?.dispose();
    this.target = await bakeCube(this.renderer, fragmentShader, {
      size,
      uniforms: { uBandNormal: { value: BAND_NORMAL } },
    });
    this.background = this.target.texture;
  }

  dispose() {
    this.target?.dispose();
  }
}
