// ============================================================================
//  Passe finale — étalonnage « cinéma »
//
//  Entrée : l'image HDR (valeurs linéaires, pouvant dépasser 1) avec le bloom.
//  Étapes, dans l'ordre :
//   1. aberration chromatique légère sur les bords (imperfection d'objectif)
//   2. teinte d'ambiance de la section + exposition
//   3. tone mapping ACES : compresse le HDR en 0..1 avec un rendu filmique
//   4. conversion linéaire → sRGB (espace de couleur de l'écran)
//   5. vignettage (bords assombris) et grain argentique animé
// ============================================================================
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uExposure;
uniform vec3 uTint;
uniform float uGrain;
uniform float uVignette;
uniform float uAberration;
uniform vec2 uResolution;

varying vec2 vUv;

// ACES filmique (ajustement de Stephen Hill, utilisé aussi par Three.js)
vec3 novaRRTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 novaACES(vec3 color) {
  // Matrices de passage vers / depuis l'espace de travail ACES
  const mat3 inputMat = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  const mat3 outputMat = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602
  );
  color = inputMat * color;
  color = novaRRTFit(color);
  color = outputMat * color;
  return clamp(color, 0.0, 1.0);
}

vec3 novaToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center);

  // 1. Aberration chromatique : rouge et bleu légèrement décalés vers les bords
  vec2 offset = center * dist * uAberration;
  vec3 color;
  color.r = texture2D(tDiffuse, vUv + offset).r;
  color.g = texture2D(tDiffuse, vUv).g;
  color.b = texture2D(tDiffuse, vUv - offset).b;

  // 2. Ambiance + exposition (le facteur 1/0.6 reprend la convention de Three.js)
  color *= uTint * uExposure / 0.6;

  // 3. & 4. Tone mapping puis encodage écran
  color = novaToSRGB(novaACES(color));

  // 5a. Vignettage doux
  float vignette = smoothstep(0.85, 0.25, dist * (1.0 + uVignette * 0.5));
  color *= mix(1.0, vignette, uVignette);

  // 5b. Grain : bruit renouvelé 24 fois par seconde (cadence cinéma),
  //     plus visible dans les tons moyens que dans les noirs profonds
  float frame = floor(uTime * 24.0);
  float noise = hash12(vUv * uResolution + frame * 17.13) - 0.5;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color += noise * uGrain * (0.4 + 0.6 * smoothstep(0.0, 0.5, luma));

  gl_FragColor = vec4(color, 1.0);
}
