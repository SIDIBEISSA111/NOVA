/**
 * La Terre : trois sphères concentriques, toutes en shaders procéduraux.
 *   1. la surface (continents, océans, glaces, villes)
 *   2. les nuages (sphère 1,5 % plus grande, transparente, animée)
 *   3. l'atmosphère (coque plus large, mélange additif = lumière qui s'ajoute)
 *
 * Optimisation : le relief et la carte des nuages sont « cuits » une seule fois
 * au chargement dans des cubemaps (bruit fractal coûteux), puis simplement lus
 * à chaque image. Sur un petit GPU, la Terre passe ainsi de ~33 à 60 images/s.
 */
import {
  Group,
  Mesh,
  SphereGeometry,
  ShaderMaterial,
  AdditiveBlending,
  FrontSide,
  MathUtils,
} from 'three';
import vertexShader from '../shaders/planet.vert.glsl?raw';
import earthFrag from '../shaders/earth.frag.glsl?raw';
import earthBakeFrag from '../shaders/earthBake.frag.glsl?raw';
import cloudsFrag from '../shaders/clouds.frag.glsl?raw';
import cloudsBakeFrag from '../shaders/cloudsBake.frag.glsl?raw';
import { bakeCube } from '../utils/bakeCube.js';
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw';
import { withNoise } from '../utils/glsl.js';
import { WORLD } from '../Journey.js';

const RADIUS = 2;
const SHELL = 2.55;

export class Earth {
  constructor({ quality, renderer }) {
    this.name = 'earth';
    this.range = [-1, 1.9];

    this.object = new Group();
    this.object.position.copy(WORLD.earth);

    // Axe incliné de 23,4° comme la vraie Terre
    this.globe = new Group();
    this.globe.rotation.z = MathUtils.degToRad(23.4);
    this.object.add(this.globe);

    const lightDir = { value: WORLD.keyLight };
    const time = { value: 0 };
    this.uniforms = { time };

    this.renderer = renderer;
    // Cuisson : résolution selon la qualité (512 px par face suffisent en moyenne)
    this.bakeSize = quality.level === 'high' ? 1024 : 512;
    this.surfaceMap = null; // créées dans init()
    this.cloudMap = null;

    // 1. Surface — 96×64 segments suffisent : le détail vient du shader, pas des sommets
    this.surfaceGeometry = new SphereGeometry(RADIUS, 96, 64);
    this.surfaceMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader: withNoise(earthFrag),
      uniforms: { uLightDir: lightDir, uSurface: { value: null } },
    });
    this.surface = new Mesh(this.surfaceGeometry, this.surfaceMaterial);
    this.globe.add(this.surface);

    // 2. Nuages : tournent un peu plus vite que la surface
    this.cloudGeometry = new SphereGeometry(RADIUS * 1.015, 96, 64);
    this.cloudMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader: withNoise(cloudsFrag),
      uniforms: { uLightDir: lightDir, uClouds: { value: null }, uTime: time },
      transparent: true,
      depthWrite: false,
    });
    this.clouds = new Mesh(this.cloudGeometry, this.cloudMaterial);
    this.clouds.renderOrder = 1;
    this.globe.add(this.clouds);

    // 3. Atmosphère : simple coque, tout le calcul est dans le shader
    this.atmoGeometry = new SphereGeometry(SHELL, 64, 48);
    this.atmoMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader: atmosphereFrag,
      uniforms: {
        uCenter: { value: this.object.position },
        uPlanetRadius: { value: RADIUS },
        uShellRadius: { value: SHELL },
        uLightDir: lightDir,
        uIntensity: { value: 1.25 },
      },
      side: FrontSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.atmosphere = new Mesh(this.atmoGeometry, this.atmoMaterial);
    this.atmosphere.renderOrder = 2;
    this.object.add(this.atmosphere);
  }

  /** Cuisson des cartes (asynchrone : compilation en arrière-plan). */
  async init() {
    const size = this.bakeSize;
    const uniforms = { uOctaves: { value: 6 } }; // à la cuisson, on peut se permettre le maximum de détails
    this.surfaceMap = await bakeCube(this.renderer, earthBakeFrag, { size, uniforms, mipmaps: true });
    this.cloudMap = await bakeCube(this.renderer, cloudsBakeFrag, { size: size / 2, uniforms, mipmaps: true });
    this.surfaceMaterial.uniforms.uSurface.value = this.surfaceMap.texture;
    this.cloudMaterial.uniforms.uClouds.value = this.cloudMap.texture;
  }

  setQuality() {
    // Les cartes sont déjà calculées : rien à changer à l'affichage.
  }

  update({ time, dt, reducedMotion }) {
    this.uniforms.time.value = time;
    const speed = reducedMotion ? 0 : 1;
    this.surface.rotation.y += dt * 0.035 * speed;
    this.clouds.rotation.y += dt * 0.045 * speed;
  }

  dispose() {
    this.surfaceMap?.dispose();
    this.cloudMap?.dispose();
    this.surfaceGeometry.dispose();
    this.surfaceMaterial.dispose();
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    this.atmoGeometry.dispose();
    this.atmoMaterial.dispose();
  }
}
