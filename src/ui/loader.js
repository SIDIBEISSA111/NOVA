/**
 * Écran de chargement : anneau + pourcentage.
 * Le pourcentage affiché « court » vers la valeur réelle (jamais de saut brutal).
 */
import { gsap } from 'gsap';

export function createLoader() {
  const root = document.querySelector('.loader');
  const value = root?.querySelector('[data-loader-value]');
  const label = root?.querySelector('.loader__text');
  const shown = { p: 0 };

  function render() {
    const p = Math.round(shown.p);
    if (value) value.textContent = p;
    root?.style.setProperty('--progress', p);
  }

  return {
    set(progress, text) {
      gsap.to(shown, { p: progress * 100, duration: 0.5, ease: 'power2.out', onUpdate: render, overwrite: true });
      if (text && label) label.textContent = text;
    },
    /** Fin du chargement : l'anneau s'agrandit et s'efface. */
    done() {
      return new Promise((resolve) => {
        gsap.to(shown, {
          p: 100,
          duration: 0.4,
          onUpdate: render,
          overwrite: true,
          onComplete: () => {
            if (label) label.textContent = 'Systèmes prêts';
            root?.classList.add('is-done');
            setTimeout(() => {
              root?.remove(); // plus besoin de ce nœud
              resolve();
            }, 900);
          },
        });
      });
    },
    /** Pas de 3D : on retire simplement l'écran de chargement. */
    remove() {
      root?.remove();
    },
  };
}
