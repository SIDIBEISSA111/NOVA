// ============================================================================
//  Astéroïdes — vertex shader (InstancedMesh : 1 seul appel de dessin pour tous)
//
//  Tous les astéroïdes partagent la même petite géométrie (un icosaèdre).
//  Chaque instance est rendue unique ICI, sur le GPU :
//   1. déformation par bruit, avec une graine propre à l'instance → forme unique
//   2. rotation propre (axe + vitesse) calculée avec le temps → aucune mise à
//      jour de matrice côté JavaScript à chaque image
// ============================================================================
uniform float uTime;

attribute float aSeed;   // graine aléatoire de l'instance
attribute vec4 aSpin;    // xyz = axe de rotation, w = vitesse

varying vec3 vWorldPos;
varying float vSeed;
varying float vCrater;

// Rotation d'un vecteur autour d'un axe (formule de Rodrigues)
vec3 rotateAxis(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

void main() {
  vec3 p = position;
  vec3 dir = normalize(p);

  // 1. Forme : deux octaves de bruit déplacent chaque sommet le long de sa normale
  vec3 s = vec3(aSeed * 17.3, aSeed * 5.1, aSeed * 11.7);
  float big = snoise(dir * 1.2 + s) * 0.38;      // forme générale (patatoïde)
  float small = snoise(dir * 3.4 + s.zxy) * 0.12; // bosses et creux
  vCrater = small;
  p = dir * (1.0 + big + small);

  // 2. Rotation propre
  p = rotateAxis(p, normalize(aSpin.xyz), uTime * aSpin.w);

  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * world;
}
