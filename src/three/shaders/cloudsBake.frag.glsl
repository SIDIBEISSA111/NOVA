// ============================================================================
//  Nuages — « cuisson » de la carte de densité (une fois au chargement)
//  r = densité de base (bruit fractal légèrement tourbillonnant)
//  g = grands systèmes météo (zones nuageuses / dégagées)
// ============================================================================
uniform int uOctaves;
varying vec3 vDir;

void main() {
  vec3 p = normalize(vDir);
  // Bandes de latitude : les nuages s'étirent d'est en ouest, comme les vents
  vec3 q = p * vec3(2.4, 3.6, 2.4);
  float warp = snoise(q * 0.6);
  float n = fbm(q + warp * 0.45, uOctaves) * 0.5 + 0.5;
  float systems = smoothstep(-0.3, 0.6, snoise(p * 1.3));
  gl_FragColor = vec4(n, systems, 0.0, 1.0);
}
