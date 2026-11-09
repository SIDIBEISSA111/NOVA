// ============================================================================
//  Galaxie — fragment shader : chaque particule est un petit disque lumineux
//  à bord très doux (décroissance en puissance), mélangé de façon additive.
//  Là où les particules s'accumulent (le bulbe), la lumière s'additionne.
// ============================================================================
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float strength = pow(max(1.0 - d, 0.0), 2.5);
  if (strength < 0.01) discard;
  gl_FragColor = vec4(vColor, strength * vAlpha);
}
