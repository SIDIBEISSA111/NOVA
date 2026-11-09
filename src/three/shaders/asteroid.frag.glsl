// ============================================================================
//  Astéroïdes — fragment shader
//
//  Normale « à facettes » : on la calcule à partir des dérivées écran de la
//  position (dFdx / dFdy). Chaque triangle reçoit une normale plate : look
//  minéral taillé, et aucun calcul de normale coûteux dans le vertex shader.
// ============================================================================
uniform vec3 uSunPos;     // position du Soleil : la lumière vient de lui
uniform vec3 uRimColor;   // contre-jour bleu glacier
uniform float uFade;      // apparition / disparition du champ
uniform float uFogDensity;

varying vec3 vWorldPos;
varying float vSeed;
varying float vCrater;

void main() {
  // Normale plate de la facette : produit vectoriel des dérivées écran
  vec3 N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  vec3 V = normalize(cameraPosition - vWorldPos);
  if (dot(N, V) < 0.0) N = -N;

  vec3 L = normalize(uSunPos - vWorldPos);

  // Couleur : roches grises / brunes ; quelques-unes métalliques dorées
  vec3 rock = mix(vec3(0.20, 0.19, 0.18), vec3(0.32, 0.26, 0.20), fract(vSeed * 7.13));
  float metallic = step(0.93, fract(vSeed * 3.71));
  vec3 albedo = mix(rock, vec3(0.75, 0.55, 0.22), metallic);
  albedo *= 0.75 + vCrater * 1.6; // creux plus sombres

  float diffuse = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), mix(16.0, 60.0, metallic)) * mix(0.08, 1.2, metallic);

  // Contre-jour : quand le Soleil est DERRIÈRE le rocher, ses bords s'illuminent
  // d'un liseré doré (backlit) ; sinon un léger reflet bleu glacier les détache du fond.
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  float backlit = pow(max(dot(-V, L), 0.0), 2.0);

  // Lumière d'appoint bleutée venant du côté de la caméra (lumière diffuse de l'espace)
  float fill = max(dot(N, V), 0.0) * 0.16 + 0.03;

  vec3 color = albedo * (diffuse * 1.7) + albedo * uRimColor * fill
    + vec3(1.0, 0.85, 0.6) * spec
    + vec3(1.0, 0.72, 0.35) * rim * backlit * 1.1
    + uRimColor * rim * 0.12;

  // Brume : les astéroïdes lointains se fondent dans le noir (pas d'apparition brutale)
  float dist = length(cameraPosition - vWorldPos);
  float fog = exp(-dist * uFogDensity);
  gl_FragColor = vec4(color * fog * uFade, 1.0);
}
