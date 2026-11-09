// ============================================================================
//  Trou noir — passe de post-traitement (lentille gravitationnelle + disque)
//
//  Principe : pour chaque pixel, on lance un rayon lumineux depuis la caméra
//  et on le fait avancer pas à pas (« ray marching »). Près du trou noir, sa
//  trajectoire se courbe. Trois issues possibles :
//    1. le rayon tombe sous l'horizon        → noir absolu (l'ombre)
//    2. il traverse le disque d'accrétion    → on accumule la couleur du disque
//    3. il s'échappe                         → on lit l'image de la scène DANS LA
//       DIRECTION DÉVIÉE : les vraies étoiles derrière apparaissent déformées.
//  Un même rayon peut traverser le disque plusieurs fois : c'est ce qui crée
//  l'arc lumineux au-dessus de l'ombre (l'arrière du disque, vu « par-dessus »).
//
//  Optimisations :
//   - un pixel dont le rayon ne passe jamais à moins de uBound du trou noir
//     n'est pas calculé (alpha 0 : la scène d'origine reste telle quelle) ;
//   - en qualité moyenne / basse, ce shader tourne en DEMI-résolution
//     (4× moins de pixels), puis est recomposé sur l'image nette.
// ============================================================================
uniform sampler2D tDiffuse;      // image de la scène (sans le trou noir)
uniform samplerCube tSky;        // nébuleuse de fond (si le rayon dévié sort de l'écran)
uniform vec3 uCamPos;
uniform mat4 uCamWorld;          // caméra → monde
uniform mat4 uInvProj;           // écran → caméra
uniform mat4 uViewProj;          // monde → écran
uniform vec3 uCenter;            // position du trou noir
uniform mat3 uBasis;             // monde → repère du disque (disque dans le plan xz)
uniform float uRs;               // rayon de Schwarzschild (horizon)
uniform float uDiskIn;           // bord intérieur du disque (≈ 3 rs, dernière orbite stable)
uniform float uDiskOut;
uniform float uBound;            // au-delà, plus de déviation (zone d'influence)
uniform float uTime;
uniform float uFade;
uniform int uSteps;              // nombre maximal de pas (qualité adaptative)
uniform float uStepScale;        // taille des pas (plus grand = moins de pas)

varying vec2 vUv;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Fond pour les rayons déviés hors de l'écran : nébuleuse + étoiles procédurales
vec3 skyFallback(vec3 d) {
  vec3 col = textureCube(tSky, d).rgb;
  vec3 cell = floor(d * 260.0);
  float h = hash13(cell);
  col += vec3(0.9, 0.95, 1.0) * step(0.9965, h) * (h - 0.9965) * 400.0;
  return col;
}

// Lit la scène dans une direction du monde (ou la nébuleuse si hors écran)
vec3 background(vec3 worldDir) {
  vec4 clip = uViewProj * vec4(uCamPos + worldDir * 1000.0, 1.0);
  vec3 fallback = skyFallback(worldDir);
  if (clip.w <= 0.0) return fallback;
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  // Transition douce près des bords de l'écran (pas de coupure visible)
  vec2 edge = smoothstep(vec2(0.0), vec2(0.06), uv) * smoothstep(vec2(1.0), vec2(0.94), uv);
  float inside = edge.x * edge.y;
  if (inside <= 0.0) return fallback;
  return mix(fallback, texture2D(tDiffuse, uv).rgb, inside);
}

// Couleur et opacité du disque d'accrétion au point d'impact
vec4 disk(vec3 hit, vec3 dir) {
  float r = length(hit.xz);
  float x = (r - uDiskIn) / (uDiskOut - uDiskIn); // 0 = bord intérieur, 1 = extérieur

  // Rotation képlérienne : la vitesse angulaire décroît en r^-1.5,
  // l'intérieur tourne plus vite → le motif s'étire en spirale
  float angle = atan(hit.z, hit.x) + uTime * 1.6 * pow(uDiskIn / r, 1.5);
  vec2 q = vec2(cos(angle), sin(angle)) * r; // coordonnées sans couture à ±π
  float n = snoise(vec3(q * 0.55, r * 0.9)) * 0.5 + 0.5;
  float fine = snoise(vec3(q * 2.2, r * 3.0 + uTime * 0.2)) * 0.5 + 0.5;
  float gas = n * 0.75 + fine * 0.45;
  gas *= 0.6 + 0.4 * sin(r * 5.0 + n * 3.0); // anneaux de densité

  // Température : plus chaud (et plus clair) vers l'intérieur
  float temp = pow(1.0 - clamp(x, 0.0, 1.0), 1.6);
  vec3 col = mix(vec3(0.75, 0.16, 0.02), vec3(1.0, 0.64, 0.22), temp); // rouge → or
  col = mix(col, vec3(1.0, 0.93, 0.8), pow(temp, 5.0));                  // blanc incandescent

  // Effet Doppler relativiste : le côté qui vient vers nous est plus brillant
  // (et légèrement bleui), le côté qui s'éloigne plus sombre (et rougi).
  vec3 velocity = normalize(vec3(-hit.z, 0.0, hit.x));
  float beta = 0.5 * sqrt(uDiskIn / r);            // vitesse en fraction de c
  float approach = dot(velocity, -dir);
  float doppler = 1.0 / (1.0 - beta * approach);
  float beaming = pow(doppler, 3.0);
  col *= mix(vec3(1.0, 0.75, 0.6), vec3(0.85, 0.95, 1.1), smoothstep(0.8, 1.4, doppler));

  float edges = smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.55, 1.0, x));
  float density = gas * edges;
  float brightness = (0.35 + temp * 1.6) * beaming;
  return vec4(col * brightness * density, clamp(density * 1.1, 0.0, 0.97));
}

void main() {
  // Alpha de sortie = part de l'effet (0 = garder la scène nette d'origine).
  // Ce shader peut tourner en demi-résolution : la passe de composition
  // mélange ensuite son résultat avec l'image pleine résolution.
  if (uFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

  // Rayon de la caméra pour ce pixel (en tenant compte du décalage de cadrage)
  vec4 view = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(view.xyz / view.w, 0.0)).xyz);

  // Passage dans le repère du disque : trou noir à l'origine, disque dans le plan xz
  vec3 pos = uBasis * (uCamPos - uCenter);
  vec3 dir = uBasis * rd;

  // Distance minimale du rayon (en ligne droite) au trou noir
  float tc = -dot(pos, dir);
  float b = length(pos + dir * tc);
  if (tc < 0.0 && length(pos) > uBound) { gl_FragColor = vec4(0.0); return; } // il s'éloigne
  if (b >= uBound) { gl_FragColor = vec4(0.0); return; }                       // trop loin : intact

  // On commence la marche à l'entrée de la zone d'influence
  float tEnter = tc - sqrt(uBound * uBound - b * b);
  pos += dir * max(tEnter, 0.0);
  // Petit décalage aléatoire du point de départ, différent pour chaque pixel :
  // les « marches » dues aux pas discrets deviennent un bruit fin, invisible.
  pos += dir * hash12(gl_FragCoord.xy) * 0.6 * uStepScale;

  vec3 color = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;

  // Borne dynamique (uniform) : la boucle n'est pas déroulée à la compilation
  for (int i = 0; i < uSteps; i++) {
    float r = length(pos);
    if (r < uRs) { captured = true; break; }
    if (r > uBound && dot(pos, dir) > 0.0) break; // ressorti de la zone : échappé

    // Pas adaptatif : petits pas près du trou noir, grands pas au loin
    float dt = clamp(0.1 * r, 0.03, 1.4) * uStepScale;

    // Courbure : accélération d'un photon dans l'espace-temps de Schwarzschild
    //   a = -3/2 · rs · h² · r⃗ / r⁵   (h = moment cinétique du photon)
    // Elle s'estompe vers le bord de la zone pour se raccorder sans couture à la scène.
    vec3 h = cross(pos, dir);
    float falloff = 1.0 - smoothstep(uBound * 0.55, uBound, r);
    vec3 acc = -1.5 * uRs * dot(h, h) * pos / pow(r, 5.0) * falloff;

    vec3 prev = pos;
    dir = normalize(dir + acc * dt);
    pos += dir * dt;

    // Traversée du plan du disque (changement de signe de y) ?
    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      float hr = length(hit.xz);
      if (hr > uDiskIn && hr < uDiskOut) {
        vec4 d = disk(hit, dir);
        // Mélange « de l'avant vers l'arrière » : ce qui est devant masque ce qui est derrière
        color += (1.0 - alpha) * d.rgb;
        alpha += (1.0 - alpha) * d.a;
        if (alpha > 0.97) break;
      }
    }
  }

  // Direction finale du rayon, ramenée dans le repère du monde (transposée = inverse)
  vec3 bg = captured ? vec3(0.0) : background(transpose(uBasis) * dir);
  vec3 result = color + (1.0 - alpha) * bg;

  // Vers le bord de la zone (où la déviation est quasi nulle), on rend la main
  // progressivement à l'image pleine résolution : aucune couture visible.
  float blend = 1.0 - smoothstep(uBound * 0.7, uBound, b);
  gl_FragColor = vec4(result, uFade * blend);
}
