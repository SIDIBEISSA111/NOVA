// ============================================================================
//  Terre procédurale — fragment shader (à chaque image)
//
//  La surface (continents, océans, glaces) a été calculée UNE fois au
//  chargement par earthBake.frag.glsl et stockée dans une cubemap.
//  Ici, il ne reste que ce qui dépend de la lumière et du point de vue :
//   1. éclairage diffus avec terminateur adouci
//   2. reflet spéculaire du soleil sur l'eau (Blinn-Phong)
//   3. lumières des villes côté nuit (or chaud)
//   4. liseré atmosphérique en Fresnel sur le bord du disque
// ============================================================================
uniform samplerCube uSurface;
uniform vec3 uLightDir;   // direction VERS la lumière, dans le monde

varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vWorldPos;

const vec3 ATMO = vec3(0.490, 0.830, 0.990); // bleu glacier #7DD3FC
const vec3 CITY = vec3(1.000, 0.700, 0.260); // or chaud

void main() {
  vec4 surface = textureCube(uSurface, normalize(vPos));
  vec3 albedo = surface.rgb * surface.rgb;     // la cuisson stockait la racine carrée
  float water = surface.a;

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdL = dot(N, L);

  // 1. Diffus : la lumière « s'enroule » un peu au-delà du terminateur
  float diffuse = smoothstep(-0.08, 1.0, NdL);
  float day = smoothstep(-0.12, 0.2, NdL);

  // 2. Reflet du soleil sur les océans : un point net + un large halo doux
  vec3 H = normalize(L + V);
  float NdH = max(dot(N, H), 0.0);
  float spec = pow(NdH, 120.0) * water * day;
  float sheen = pow(NdH, 12.0) * water * day * 0.08;

  vec3 color = albedo * (diffuse * 1.35 + 0.015);
  color += vec3(1.0, 0.92, 0.78) * (spec * 1.6 + sheen);

  // 3. Villes : petites grappes de bruit sur les terres, calculées seulement
  //    côté nuit (le test évite tout calcul sur la face éclairée)
  float night = (1.0 - day) * (1.0 - water) * (1.0 - smoothstep(0.7, 0.8, abs(normalize(vPos).y)));
  if (night > 0.01) {
    vec3 p = normalize(vPos);
    float clusters = smoothstep(0.35, 0.75, snoise(p * 9.0) * 0.5 + 0.5);
    float lights = smoothstep(0.62, 0.9, snoise(p * 48.0) * 0.5 + 0.5) * clusters;
    color += CITY * lights * night * 2.4;
  }

  // 4. Fresnel : plus on regarde la surface en rasant, plus l'air traversé est épais
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float lit = smoothstep(-0.3, 0.5, NdL);
  color += ATMO * fresnel * (0.15 + lit * 1.1);
  color = mix(color, ATMO * 0.35, 0.08 * day); // légère brume bleue côté jour

  gl_FragColor = vec4(color, 1.0);
}
