import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2020',
    // Three.js est volontairement isolé dans son propre fichier, chargé après l'affichage.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'vendor-motion';
        },
      },
    },
  },
});
