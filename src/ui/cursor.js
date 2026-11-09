/**
 * Curseur personnalisé : un point (suit exactement la souris) et un anneau
 * (qui suit avec inertie) ; l'anneau grossit sur les éléments cliquables.
 *
 * Désactivé au doigt (pas de curseur sur mobile) et en mouvements réduits.
 * gsap.quickTo : animation optimisée, sans créer d'objet à chaque événement.
 */
import { gsap } from 'gsap';
import { env } from '../utils/env.js';

const INTERACTIVE = 'a, button, input, select, textarea, label, [data-interactive], [data-tilt]';

export function initCursor() {
  const root = document.querySelector('.cursor');
  if (!root || !env.finePointer || env.touch || env.reducedMotion) return () => {};

  document.documentElement.classList.add('has-cursor');
  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });

  root.classList.add('is-hidden'); // invisible tant que la souris n'a pas bougé

  const onMove = (e) => {
    root.classList.remove('is-hidden');
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
  };
  const onOver = (e) => root.classList.toggle('is-hover', !!e.target.closest?.(INTERACTIVE));
  const onDown = () => root.classList.add('is-down');
  const onUp = () => root.classList.remove('is-down');
  const onLeave = () => root.classList.add('is-hidden');

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  document.documentElement.addEventListener('pointerleave', onLeave);

  return () => {
    document.documentElement.classList.remove('has-cursor');
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
  };
}
