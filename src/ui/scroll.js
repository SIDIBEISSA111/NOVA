/**
 * Défilement fluide : Lenis lisse la molette, GSAP ScrollTrigger lit la position.
 *
 * Un seul « tic » pilote tout le site : celui de GSAP (gsap.ticker, basé sur
 * requestAnimationFrame). Lenis et le rendu 3D s'y accrochent, ce qui évite
 * d'avoir plusieurs boucles concurrentes.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { env } from '../utils/env.js';

gsap.registerPlugin(ScrollTrigger);

export function initScroll() {
  let lenis = null;

  // Mouvements réduits : défilement natif, sans inertie.
  if (!env.reducedMotion) {
    lenis = new Lenis({
      lerp: 0.085, // inertie : plus petit = plus « glissant »
      wheelMultiplier: 0.9,
      // Sur mobile, on garde le défilement natif (plus naturel et moins coûteux)
      syncTouch: false,
    });

    // Chaque mouvement Lenis met à jour ScrollTrigger…
    lenis.on('scroll', ScrollTrigger.update);
    // …et Lenis avance au rythme du ticker GSAP (temps en secondes → ms).
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    // Pas de « rattrapage » de GSAP après une image lente : le scroll resterait décalé.
    gsap.ticker.lagSmoothing(0);
  }

  /** Défile jusqu'à un élément, en lui donnant le focus (navigation clavier). */
  function scrollToElement(target) {
    const focusTarget = () => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };

    if (lenis) {
      const distance = Math.abs(target.getBoundingClientRect().top);
      lenis.scrollTo(target, {
        // Durée proportionnelle à la distance : un long voyage prend plus de temps.
        duration: gsap.utils.clamp(1, 4.5, distance / 2200),
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        onComplete: focusTarget,
      });
    } else {
      target.scrollIntoView({ behavior: 'auto' });
      focusTarget();
    }
  }

  // Tous les liens internes (#section) passent par le défilement fluide.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains('skip-link')) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    scrollToElement(target);
    history.replaceState(null, '', link.getAttribute('href'));
  });

  return {
    lenis,
    scrollToElement,
    /** Position de défilement lissée (celle que voit l'utilisateur). */
    get y() {
      return lenis ? lenis.animatedScroll : window.scrollY;
    },
    /** Défilement maximal possible. */
    get max() {
      return ScrollTrigger.maxScroll(window);
    },
    destroy() {
      lenis?.destroy();
    },
  };
}
