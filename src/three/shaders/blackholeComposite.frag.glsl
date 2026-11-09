// ============================================================================
//  Trou noir — composition
//  Mélange l'image nette de la scène (pleine résolution) avec le résultat de
//  la lentille (calculé éventuellement en demi-résolution). L'alpha de la
//  lentille vaut 0 loin du trou noir : là, on garde la scène d'origine intacte.
// ============================================================================
uniform sampler2D tDiffuse; // scène pleine résolution
uniform sampler2D tLens;    // lentille + disque (rgb) et part de l'effet (a)

varying vec2 vUv;

void main() {
  vec4 scene = texture2D(tDiffuse, vUv);
  vec4 lens = texture2D(tLens, vUv);
  gl_FragColor = vec4(mix(scene.rgb, lens.rgb, lens.a), 1.0);
}
