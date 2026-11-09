/**
 * Assemblage des shaders : Vite importe les fichiers .glsl comme du texte (?raw),
 * et on préfixe les fonctions de bruit communes quand un shader en a besoin.
 */
import noise from '../shaders/common/noise.glsl?raw';

export const withNoise = (source) => `${noise}\n${source}`;
