// Nébuleuse de fond : on transmet simplement la direction de vue au fragment.
varying vec3 vDir;

void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
