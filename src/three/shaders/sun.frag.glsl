// ============================================================================
//  Soleil — fragment shader de la surface (photosphère)
//
//  « Surface en ébullition » : du bruit fractal dont on fait défiler les
//  coordonnées dans le temps, avec une déformation de domaine qui crée des
//  cellules de convection (granulation). Les couleurs dépassent 1.0 : ce sont
//  des valeurs HDR, que le bloom transforme ensuite en rayonnement.
// ============================================================================
uniform float uTime;
uniform int uOctaves;
uniform float uFade;

varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 p = normalize(vPos);
  float t = uTime * 0.06;

  // 1. Déformation lente à grande échelle : les « courants » de plasma
  //    (deux bruits suffisent : le 3e axe est dérivé des deux premiers)
  float fx = snoise(p * 1.5 + vec3(t, 0.0, 0.0));
  float fy = snoise(p * 1.5 + vec3(0.0, t, 4.0));
  vec3 flow = vec3(fx, fy, fx - fy);

  // 2. Granulation : bruit fin transporté par ces courants, qui évolue avec le temps
  float gran = fbm(p * 5.5 + flow * 0.6 + vec3(0.0, 0.0, t * 2.0), uOctaves - 1) * 0.5 + 0.5;
  // On « creuse » le bruit pour obtenir des cellules aux bords sombres
  float cells = 1.0 - abs(fbm(p * 11.0 + flow + t * 3.0, 2));

  // 3. Taches solaires : rares zones plus froides
  float spots = smoothstep(0.78, 0.95, snoise(p * 1.7 + vec3(t * 0.3))) * 0.7;

  // 4. Assombrissement centre-bord : au bord du disque, on voit des couches
  //    plus hautes et plus froides de l'étoile (vrai phénomène physique)
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = max(dot(N, V), 0.0);
  float limb = pow(mu, 0.45);

  // Palette HDR : rouge-orangé (froid) → or → blanc-jaune (chaud)
  float heat = gran * 0.75 + cells * 0.35 - spots * 0.6;
  // (valeurs modérées : au-delà, le tone mapping « brûle » le disque en blanc uniforme)
  vec3 cool = vec3(0.55, 0.10, 0.015);
  vec3 warm = vec3(1.25, 0.48, 0.08);
  vec3 hot = vec3(2.1, 1.35, 0.55);
  vec3 color = mix(cool, warm, smoothstep(0.25, 0.6, heat));
  color = mix(color, hot, smoothstep(0.62, 0.95, heat));

  color *= mix(0.3, 1.0, limb);
  // Bord du disque légèrement plus orangé (transition vers la couronne)
  color += vec3(1.0, 0.35, 0.05) * pow(1.0 - mu, 3.0) * 0.5;

  gl_FragColor = vec4(color * uFade, 1.0);
}
