// Passe plein écran : un triangle/rectangle qui couvre l'écran, et ses coordonnées UV.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
