// Couronne : simple carré (« billboard ») toujours tourné vers la caméra.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
