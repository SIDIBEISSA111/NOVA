// ============================================================================
//  Terre — « cuisson » de la surface (exécuté UNE fois au chargement)
//
//  Ce shader calcule tout ce qui ne change pas avec le temps : relief,
//  couleurs, océans, glaces. Le résultat est enregistré dans une
//  cubemap (6 images autour de la planète). Ensuite, à chaque image, le
//  shader de la Terre se contente de LIRE cette texture : une lecture au lieu
//  d'une quinzaine d'évaluations de bruit par pixel.
//
//  Sortie :  rgb = couleur du sol (racine carrée : plus de précision dans
//                  les tons sombres sur 8 bits)
//            a   = masque de l'eau (1 = océan), pour le reflet du soleil
// ============================================================================
uniform int uOctaves;
varying vec3 vDir;

const vec3 OCEAN_DEEP    = vec3(0.004, 0.025, 0.080);
const vec3 OCEAN_SHALLOW = vec3(0.020, 0.200, 0.360);
const vec3 LAND_LOW      = vec3(0.080, 0.180, 0.090);
const vec3 LAND_DRY      = vec3(0.330, 0.260, 0.140);
const vec3 LAND_HIGH     = vec3(0.300, 0.290, 0.270);
const vec3 ICE           = vec3(0.850, 0.900, 0.950);
const float SEA_LEVEL = 0.03;

void main() {
  vec3 p = normalize(vDir);

  // Altitude : grandes masses (basse fréquence) + détails fractals
  float h = fbm(p * 1.25 + vec3(3.1, 0.0, 7.7), uOctaves) + 0.32 * snoise(p * 0.55 + 11.0) - 0.06;
  float land = smoothstep(SEA_LEVEL - 0.004, SEA_LEVEL + 0.004, h);

  // Océan : plus clair près des côtes (hauts-fonds)
  float shallow = smoothstep(-0.25, SEA_LEVEL, h);
  vec3 ocean = mix(OCEAN_DEEP, OCEAN_SHALLOW, shallow * shallow * shallow);

  // Terres : végétation → zones arides (vers l'équateur) → reliefs
  float elevation = smoothstep(SEA_LEVEL, 0.5, h);
  float dryness = smoothstep(0.35, 0.0, abs(p.y)) * smoothstep(-0.2, 0.4, snoise(p * 2.3));
  vec3 ground = mix(LAND_LOW, LAND_DRY, dryness);
  ground = mix(ground, LAND_HIGH, smoothstep(0.25, 0.6, elevation));

  vec3 albedo = mix(ocean, ground, land);

  // Calottes polaires, au bord irrégulier
  float ice = smoothstep(0.80, 0.86, abs(p.y) + h * 0.12);
  albedo = mix(albedo, ICE, ice);

  float water = (1.0 - land) * (1.0 - ice);
  gl_FragColor = vec4(sqrt(albedo), water);
}
