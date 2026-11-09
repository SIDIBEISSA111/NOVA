// ============================================================================
//  Champ d'étoiles — fragment shader
//  Un point carré devient une étoile ronde : noyau très lumineux + halo doux.
//  Les deux sont des gaussiennes (exp(-d²)) : pas de bord dur, pas d'aliasing.
// ============================================================================
varying vec3 vColor;

void main() {
  // gl_PointCoord va de 0 à 1 sur le carré du point ; d = distance au centre (0..1)
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-d * d * 22.0);
  float halo = exp(-d * d * 5.0) * 0.28;
  float alpha = (core + halo) * (1.0 - smoothstep(0.75, 1.0, d));
  if (alpha < 0.003) discard;
  // Mélange additif : la couleur s'ajoute au ciel, comme de la lumière
  gl_FragColor = vec4(vColor, alpha);
}
