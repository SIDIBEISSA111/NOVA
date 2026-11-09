// ============================================================================
//  Atmosphère — fragment shader (coque sphérique autour de la Terre)
//
//  Pour chaque pixel, on calcule le « paramètre d'impact » b : la distance la
//  plus courte entre le rayon de vue et le centre de la planète.
//   - b proche du rayon terrestre → le rayon frôle la planète : halo intense
//   - b proche du bord de la coque → presque pas d'air traversé : halo nul
//  L'intensité dépend aussi du côté éclairé, avec une teinte dorée au crépuscule.
// ============================================================================
uniform vec3 uCenter;
uniform float uPlanetRadius;
uniform float uShellRadius;
uniform vec3 uLightDir;
uniform float uIntensity;

varying vec3 vWorldPos;

const vec3 ATMO = vec3(0.490, 0.830, 0.990);
const vec3 DUSK = vec3(0.960, 0.600, 0.250);

void main() {
  vec3 rd = normalize(vWorldPos - cameraPosition);
  vec3 oc = uCenter - cameraPosition;
  float tClosest = dot(oc, rd);
  vec3 closest = cameraPosition + rd * tClosest;
  float b = length(closest - uCenter);

  // x < 0 : devant le disque de la planète ; 0..1 : dans le halo
  float x = (b - uPlanetRadius) / (uShellRadius - uPlanetRadius);
  float halo = x >= 0.0
    ? pow(1.0 - clamp(x, 0.0, 1.0), 3.5)        // décroissance vers l'espace
    : exp(x * 9.0) * 0.9;                       // fin liseré sur le bord du disque

  // Éclairage : orientation du point le plus proche par rapport à la lumière
  vec3 n = normalize(closest - uCenter);
  float NdL = dot(n, normalize(uLightDir));
  float lit = smoothstep(-0.45, 0.55, NdL);
  float dusk = smoothstep(0.35, 0.0, abs(NdL + 0.05)); // bande du terminateur

  vec3 color = mix(ATMO, DUSK, dusk * 0.6) * halo * (lit + dusk * 0.4) * uIntensity;
  gl_FragColor = vec4(color, 1.0);
}
