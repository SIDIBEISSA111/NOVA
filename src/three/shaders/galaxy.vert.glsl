// ============================================================================
//  Galaxie spirale — vertex shader (100 000 particules, tout sur le GPU)
//
//  Chaque particule est décrite en coordonnées polaires (rayon, angle, hauteur).
//  À chaque image, le GPU :
//   1. fait tourner la particule — rotation DIFFÉRENTIELLE : le centre tourne
//      plus vite que la périphérie, comme dans une vraie galaxie ;
//   2. l'attire doucement vers le curseur (gaussienne autour du point visé) ;
//   3. calcule sa couleur selon la distance au centre (or → bleu glacier).
//  Le processeur n'envoie que quelques nombres (temps, souris) : rien par particule.
// ============================================================================
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uRadius;         // rayon de la galaxie
uniform float uBrightness;     // compense le nombre de particules (qualité adaptative)
uniform float uFade;
uniform vec3 uMouse;           // point visé par la souris, dans le repère de la galaxie
uniform float uMouseStrength;  // 0 = pas d'attraction, 1 = attraction maximale

attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aSize;
attribute float aMix;          // 0..1 : variation de couleur propre à la particule
attribute vec3 aOffset;        // dispersion autour du bras spiral

varying vec3 vColor;
varying float vAlpha;

const vec3 CORE  = vec3(1.00, 0.86, 0.62);
const vec3 GOLD  = vec3(0.96, 0.62, 0.20);
const vec3 ICE   = vec3(0.35, 0.72, 1.00);
const vec3 PINK  = vec3(1.00, 0.45, 0.65); // nébuleuses d'hydrogène, rares

void main() {
  // 1. Rotation différentielle : vitesse angulaire ∝ 1 / (rayon + constante)
  float angle = aAngle + uTime * 0.9 / (aRadius * 0.12 + 1.0);
  vec3 p = vec3(cos(angle) * aRadius, aHeight, sin(angle) * aRadius) + aOffset;

  // 2. Attraction vers le curseur : déplacement pondéré par une gaussienne
  vec3 toMouse = uMouse - p;
  float d2 = dot(toMouse, toMouse);
  float pull = uMouseStrength * exp(-d2 / 90.0);
  p += toMouse * pull * 0.45;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Taille en perspective (plus petite au loin)
  float size = aSize * uSize * uPixelRatio / -mvPosition.z;
  // Une particule de moins d'un pixel scintillerait : on la garde à 1 px
  // mais on baisse son opacité à proportion (anticrénelage « gratuit »)
  vAlpha = clamp(size, 0.0, 1.0);
  gl_PointSize = max(size, 1.0);

  // 3. Couleur : cœur doré et brillant → bras dorés → périphérie bleue
  float t = aRadius / uRadius;
  vec3 color = mix(CORE * 0.9, GOLD, smoothstep(0.0, 0.22, t));
  // Le bulbe est très dense : on atténue chaque particule pour ne pas saturer
  color *= mix(0.35, 1.0, smoothstep(0.02, 0.2, t));
  color = mix(color, ICE, smoothstep(0.18, 0.75, t + (aMix - 0.5) * 0.25));
  color = mix(color, PINK, step(0.985, aMix) * 0.8);
  // Les particules attirées s'illuminent légèrement
  color *= 1.0 + pull * 1.5;

  vColor = color * uBrightness * uFade;
}
