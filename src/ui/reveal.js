/**
 * Apparition en fondu des blocs [data-reveal] quand ils entrent à l'écran.
 * IntersectionObserver : aucun calcul à chaque image, le navigateur prévient.
 */
export function initReveals(root = document) {
  const items = root.querySelectorAll('[data-reveal]');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // une seule fois
      }
    },
    { rootMargin: '0px 0px -15% 0px', threshold: 0.15 }
  );
  items.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}
