// ============================================================================
//  Lune — fragment shader
//  Le relief (cratères) est dans la géométrie, calculée une fois au chargement.
//  Ici : couleur (mers lunaires sombres + poussière) et éclairage « poudreux ».
// ============================================================================
uniform vec3 uLightDir;
uniform int uOctaves;

varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 p = normalize(vPos);

  // Mers lunaires : grandes taches sombres, basse fréquence
  float maria = smoothstep(0.05, 0.35, fbm(p * 1.3 + 4.0, 3));
  float dust = fbm(p * 7.0, max(uOctaves - 2, 2)) * 0.5 + 0.5;
  vec3 albedo = mix(vec3(0.62, 0.61, 0.60), vec3(0.24, 0.24, 0.26), maria);
  albedo *= 0.8 + dust * 0.35;

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - vWorldPos);

  // Modèle de Lommel-Seeliger : la poussière lunaire renvoie la lumière de façon
  // presque uniforme, d'où ce disque « plat » si caractéristique.
  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.0);
  float ls = mu0 / (mu0 + mu + 1e-4);
  float lambert = mu0;
  float light = mix(lambert, ls * 1.6, 0.55);

  vec3 color = albedo * light * 1.25 + albedo * 0.012; // petite lumière ambiante (lumière cendrée)
  // Très léger contour bleuté pour détacher la Lune du fond
  color += vec3(0.49, 0.83, 0.99) * pow(1.0 - mu, 4.0) * 0.06;

  gl_FragColor = vec4(color, 1.0);
}
