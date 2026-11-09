/**
 * Chiffres clés animés : ils « comptent » de 0 à leur valeur quand ils apparaissent.
 * La valeur finale est déjà écrite dans le HTML (sans JS ou en mouvements réduits,
 * elle s'affiche directement), on ne l'anime que si c'est autorisé.
 */
import { gsap } from 'gsap';
import { env } from '../utils/env.js';

export function initCounters() {
  if (env.reducedMotion) return;
  const items = document.querySelectorAll('[data-count]');

  const format = (value, decimals) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  items.forEach((el) => {
    const decimals = Number(el.dataset.decimals || 0);
    el.textContent = format(0, decimals);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        const target = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals || 0);
        const state = { v: 0 };
        gsap.to(state, {
          v: target,
          duration: 2.2,
          ease: 'expo.out',
          onUpdate: () => (el.textContent = format(state.v, decimals)),
        });
      }
    },
    { threshold: 0.6 }
  );
  items.forEach((el) => observer.observe(el));
}
