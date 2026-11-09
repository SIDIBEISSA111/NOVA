/**
 * Titre animé lettre par lettre.
 *
 * Accessibilité : le titre complet reste lisible par les lecteurs d'écran
 * (aria-label), les lettres découpées sont masquées pour eux (aria-hidden).
 * Le texte est présent dans le HTML dès le départ : si le JS échoue, il s'affiche.
 */
import { gsap } from 'gsap';
import { env } from '../utils/env.js';

export function splitTitle(el) {
  if (!el) return null;
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';

  // On découpe par mots (pour ne jamais couper un mot en fin de ligne), puis par lettres.
  const chars = [];
  text.split(' ').forEach((word, i, words) => {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    for (const letter of word) {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = letter;
      w.appendChild(c);
      chars.push(c);
    }
    el.appendChild(w);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });

  return chars;
}

/** Joue l'entrée du titre. Durée courte : le texte doit être lisible très vite. */
export function animateTitle(chars) {
  if (!chars || env.reducedMotion) return;
  // Uniquement transform + opacity : le navigateur les anime sur le GPU, sans
  // recalcul de mise en page (un flou animé coûterait cher sur mobile).
  gsap.from(chars, {
    yPercent: 70,
    rotateX: -70,
    opacity: 0,
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.035,
    clearProps: 'transform,opacity',
  });
}
