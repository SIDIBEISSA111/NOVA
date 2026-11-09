// ============================================================================
//  Couronne solaire — fragment shader (carré face caméra, mélange additif)
//
//  En coordonnées polaires autour du centre du Soleil :
//   - un halo qui décroît exponentiellement avec la distance au bord du disque ;
//   - des « jets » : un bruit qui dépend de l'ANGLE (et du temps) module le halo,
//     d'où ces rayons irréguliers qui ondulent lentement.
//  Le centre est caché par la sphère du Soleil (test de profondeur).
// ============================================================================
uniform float uTime;
uniform float uEdge;       // rayon du disque solaire, en coordonnées du carré (0..1)
uniform float uIntensity;  // plus fort quand le bloom est désactivé (qualité basse)
uniform float uFade;

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float x = max(r - uEdge, 0.0) / (1.0 - uEdge); // 0 au bord du Soleil → 1 au bord du carré

  // Direction sur le cercle unité : le bruit est continu tout autour (pas de couture)
  vec2 dir = p / max(r, 1e-4);
  float t = uTime * 0.08;
  // Hors du halo, rien à dessiner : on sort tout de suite (économie sur grand écran)
  if (x > 0.98) discard;
  float rays = snoise(vec3(dir * 3.0, t)) * 0.5 + 0.5;
  rays = pow(rays, 2.2);

  float inner = exp(-x * 9.0);                 // halo serré, très lumineux
  float outer = exp(-x * 3.2) * (0.25 + rays); // halo large, strié de jets
  float glow = (inner * 0.9 + outer * 0.6) * (1.0 - smoothstep(0.75, 1.0, r));

  vec3 color = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.85, 0.55), inner);
  gl_FragColor = vec4(color * glow * uIntensity * uFade, 1.0);
}
