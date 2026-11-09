// ============================================================================
//  Champ d'étoiles — vertex shader
//  Chaque étoile est un point posé sur une sphère géante qui suit la caméra :
//  les étoiles paraissent donc infiniment lointaines (aucun décalage de parallaxe).
// ============================================================================
uniform float uTime;
uniform float uPixelRatio;
uniform float uTwinkle;   // 1 = scintillement, 0 = étoiles fixes (mouvements réduits)
uniform float uFade;      // fondu global (entrée cinématique)

attribute float aSize;    // taille en pixels CSS
attribute vec3 aColor;    // couleur (valeurs > 1 = étoile assez brillante pour le bloom)
attribute float aPhase;   // décalage aléatoire du scintillement

varying vec3 vColor;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Scintillement : produit de deux sinus de fréquences différentes.
  // Le résultat n'est pas périodique à l'œil : il paraît aléatoire.
  float a = 0.5 + 0.5 * sin(uTime * (1.1 + aPhase * 2.3) + aPhase * 40.0);
  float b = 0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 1.1) + aPhase * 13.0);
  float twinkle = mix(1.0, 0.45 + 1.1 * a * b, uTwinkle);

  vColor = aColor * twinkle * uFade;
  gl_PointSize = aSize * uPixelRatio * mix(1.0, 0.8 + 0.4 * a, uTwinkle);
}
