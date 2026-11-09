// ============================================================================
//  Vertex shader commun à la Terre, aux nuages et à la Lune.
//  vPos     : position sur la sphère dans l'espace de l'OBJET. Le bruit est
//             calculé à partir d'elle : les continents tournent avec la planète.
//  vNormalW : normale dans l'espace du MONDE (pour l'éclairage).
//  vWorldPos: position dans le monde (pour la direction de vue).
// ============================================================================
varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vPos = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
