// ============================================================================
//  Nuages — fragment shader (sphère légèrement plus grande que la Terre)
//
//  La forme des nuages vient d'une carte précalculée (cloudsBake.frag.glsl).
//  Pour qu'ils évoluent, on déforme légèrement la direction de lecture avec
//  UN bruit animé : les formations s'étirent et se reforment lentement.
//  La sphère tourne aussi un peu plus vite que la surface (vents).
// ============================================================================
uniform samplerCube uClouds;
uniform vec3 uLightDir;
uniform float uTime;

varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 p = normalize(vPos);
  float t = uTime * 0.03;

  // Déformation animée de la lecture → nuages vivants pour le prix d'un seul bruit
  float n = snoise(p * 2.2 + vec3(t, -t * 0.7, t * 0.4));
  vec3 dir = normalize(p + vec3(0.7, 0.25, -0.65) * n * 0.05);
  vec2 cloud = textureCube(uClouds, dir).rg;

  float cover = smoothstep(0.52, 0.74, cloud.r) * (0.35 + 0.65 * cloud.g);
  cover = max(cover, smoothstep(0.55, 0.9, cloud.r) * 0.25); // fins voiles (cirrus)

  // Éclairage : assombrissement au terminateur, avec une lisière dorée
  vec3 N = normalize(vNormalW);
  float NdL = dot(N, normalize(uLightDir));
  float light = smoothstep(-0.15, 0.6, NdL);
  float dusk = smoothstep(0.25, 0.0, abs(NdL - 0.02));
  vec3 color = vec3(1.0) * (light * 1.05 + 0.02) + vec3(1.0, 0.55, 0.25) * dusk * 0.35;

  gl_FragColor = vec4(color, cover * 0.88);
}
