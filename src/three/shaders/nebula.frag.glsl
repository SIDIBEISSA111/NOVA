// ============================================================================
//  Nébuleuse de fond — fragment shader
//
//  Ce shader est coûteux (bruit fractal déformé), MAIS il n'est exécuté
//  qu'UNE seule fois au chargement : on le « cuit » dans une cubemap
//  (6 images formant un cube autour de la caméra). Ensuite, afficher le fond
//  ne coûte qu'une lecture de texture par pixel.
// ============================================================================
varying vec3 vDir;
uniform vec3 uBandNormal; // orientation de la « Voie lactée »

void main() {
  vec3 d = normalize(vDir);

  // Déformation de domaine (domain warping) : on décale les coordonnées
  // avec un premier bruit avant d'évaluer le second. Résultat : volutes
  // et filaments, comme de la poussière interstellaire.
  vec3 q = vec3(
    fbm(d * 1.8, 4),
    fbm(d * 1.8 + vec3(5.2, 1.3, 2.8), 4),
    fbm(d * 1.8 + vec3(1.7, 9.2, 3.1), 4)
  );
  float n = fbm(d * 2.6 + q * 1.6, 5) * 0.5 + 0.5;  // 0..1
  float fine = fbm(d * 9.0 + q, 3) * 0.5 + 0.5;

  // Bande galactique : plus dense près d'un grand cercle du ciel
  float lat = dot(d, uBandNormal);
  float band = exp(-lat * lat * 10.0);

  // Palette très sombre : le fond ne doit jamais gêner la lecture du texte
  vec3 deep = vec3(0.010, 0.016, 0.040);
  vec3 ice = vec3(0.49, 0.83, 0.99);
  vec3 gold = vec3(0.96, 0.72, 0.25);

  float clouds = smoothstep(0.45, 0.95, n);
  vec3 col = deep * (0.6 + n);
  col += ice * 0.050 * clouds * (0.35 + band);
  col += gold * 0.030 * pow(clouds, 2.0) * band * fine;
  col += vec3(0.6, 0.7, 1.0) * 0.025 * band * smoothstep(0.4, 1.0, fine); // poussière d'étoiles

  // Tramage : un soupçon de bruit évite les « marches » de couleur (banding)
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
