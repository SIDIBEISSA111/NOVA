/**
 * Cartes de mission : légère inclinaison 3D qui suit la souris, et reflet lumineux.
 * Uniquement avec une souris (pas au doigt) et si les animations sont autorisées.
 * Les valeurs sont écrites dans des variables CSS : le navigateur fait le reste.
 */
import { env } from '../utils/env.js';

const MAX_TILT = 8; // degrés

export function initCards() {
  if (!env.finePointer || env.reducedMotion) return () => {};
  const cleanups = [];

  document.querySelectorAll('[data-tilt]').forEach((card) => {
    let frame = 0;
    let lastEvent = null;

    const apply = () => {
      frame = 0;
      const rect = card.getBoundingClientRect();
      const x = (lastEvent.clientX - rect.left) / rect.width; // 0..1
      const y = (lastEvent.clientY - rect.top) / rect.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_TILT}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_TILT}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    };

    const onMove = (e) => {
      lastEvent = e;
      card.classList.add('is-tilting');
      // Au plus une mise à jour par image, même si la souris envoie plus d'événements
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
