/**
 * Démarrage de la 3D. Ce module (et Three.js) est chargé dynamiquement par
 * main.js, après l'affichage du texte : il ne bloque jamais la page.
 *
 * La liste SCENE_STEPS décrit tout ce qui compose l'univers, dans l'ordre de
 * création. "weight" sert à calculer le pourcentage de l'écran de chargement.
 */
import { Experience } from './Experience.js';
import { Nebula } from './objects/Nebula.js';
import { Starfield } from './objects/Starfield.js';
import { Earth } from './objects/Earth.js';
import { Moon } from './objects/Moon.js';
import { Asteroids } from './objects/Asteroids.js';
import { Sun } from './objects/Sun.js';
import { BlackHole } from './objects/BlackHole.js';
import { Galaxy } from './objects/Galaxy.js';

const SCENE_STEPS = [
  { label: 'Calcul de la nébuleuse', weight: 3, create: (ctx) => new Nebula(ctx) },
  { label: 'Allumage des étoiles', weight: 1, create: (ctx) => new Starfield(ctx) },
  { label: 'Formation de la Terre', weight: 2, create: (ctx) => new Earth(ctx) },
  { label: 'Sculpture des cratères lunaires', weight: 2, create: (ctx) => new Moon(ctx) },
  { label: 'Dispersion des astéroïdes', weight: 1, create: (ctx) => new Asteroids(ctx) },
  { label: 'Allumage du Soleil', weight: 1, create: (ctx) => new Sun(ctx) },
  { label: "Courbure de l'espace-temps", weight: 1, create: (ctx) => new BlackHole(ctx) },
  { label: 'Naissance de la galaxie', weight: 2, create: (ctx) => new Galaxy(ctx) },
];

export async function startExperience({ canvas, scroll, onProgress }) {
  const experience = new Experience({ canvas, scroll });
  await experience.init(SCENE_STEPS, onProgress);
  return experience;
}
