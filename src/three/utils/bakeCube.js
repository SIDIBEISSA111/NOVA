/**
 * « Cuisson » d'un shader dans une cubemap.
 *
 * On place la caméra au centre d'un cube vu de l'intérieur, dont le shader
 * reçoit la direction (vDir). Une CubeCamera rend les 6 faces une seule fois.
 * Résultat : une texture qui contient le shader « figé » dans toutes les
 * directions, qu'on peut relire pour presque rien à chaque image.
 *
 * La fonction est asynchrone : le shader est d'abord compilé en arrière-plan
 * (compileAsync), pour ne pas figer la page pendant le chargement.
 */
import {
  BoxGeometry,
  Mesh,
  ShaderMaterial,
  BackSide,
  Scene,
  CubeCamera,
  WebGLCubeRenderTarget,
  LinearFilter,
  LinearMipmapLinearFilter,
  PerspectiveCamera,
} from 'three';
import bakeVert from '../shaders/nebula.vert.glsl?raw';
import { withNoise } from './glsl.js';

export async function bakeCube(renderer, fragmentShader, { size = 512, uniforms = {}, defines = {}, mipmaps = false } = {}) {
  const target = new WebGLCubeRenderTarget(size, {
    generateMipmaps: mipmaps,
    minFilter: mipmaps ? LinearMipmapLinearFilter : LinearFilter,
    magFilter: LinearFilter,
  });

  const scene = new Scene();
  const geometry = new BoxGeometry(10, 10, 10);
  const material = new ShaderMaterial({
    vertexShader: bakeVert,
    fragmentShader: withNoise(fragmentShader),
    uniforms,
    defines,
    side: BackSide,
    depthWrite: false,
  });
  scene.add(new Mesh(geometry, material));

  await renderer.compileAsync(scene, new PerspectiveCamera());
  const cubeCamera = new CubeCamera(0.1, 100, target);
  cubeCamera.update(renderer, scene);

  // La mini-scène ne sert plus : on libère tout de suite sa mémoire GPU
  geometry.dispose();
  material.dispose();
  return target;
}
