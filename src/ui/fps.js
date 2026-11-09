/**
 * Compteur d'images/seconde discret, affiché / masqué avec la touche « F ».
 * Montre aussi le niveau de qualité choisi par le système adaptatif.
 */
export function initFps(getExperience) {
  const panel = document.querySelector('.fps');
  if (!panel) return;
  let timer = 0;

  function render() {
    const exp = getExperience();
    if (!exp) {
      panel.textContent = '3D inactive';
      return;
    }
    const s = exp.stats;
    const q = exp.quality;
    panel.textContent =
      `${Math.round(s.fps)} i/s · ${s.ms.toFixed(1)} ms\n` +
      `qualité ${q.preset.name}${q.forced ? ' (forcée)' : ''}\n` +
      `pixels ×${exp.renderer.getPixelRatio()} · ${s.calls ?? 0} appels\n` +
      `${Math.round((s.triangles ?? 0) / 1000)} k triangles`;
  }

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'f' && event.key !== 'F') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return; // on tape du texte
    panel.hidden = !panel.hidden;
    clearInterval(timer);
    if (!panel.hidden) {
      render();
      timer = setInterval(render, 250);
    }
  });
}
