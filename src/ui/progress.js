/**
 * Barre de progression du voyage (côté droit) + « Distance parcourue ».
 *
 * Fonctionne aussi sans 3D : elle calcule elle-même la progression à partir
 * du défilement. Les mises à jour du DOM n'ont lieu que si la valeur change.
 */
import { gsap } from 'gsap';
import { measureAnchors, scrollToProgress } from '../utils/sections.js';

/*
 * Distances cumulées (années-lumière) à chaque étape — ordres de grandeur réels :
 * Lune ≈ 1,3 seconde-lumière, ceinture ≈ quelques UA, trou noir type Gaia BH1
 * ≈ 1 560 al, galaxie d'Andromède ≈ 2,5 millions d'al.
 * Entre deux étapes, on interpole en échelle logarithmique.
 */
const DISTANCES = [0, 4.1e-8, 3.9e-5, 6.3e-5, 1560, 2537000];

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const nf = (digits) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits });

/** Mise en forme lisible : notation scientifique élégante pour les très petites valeurs. */
export function formatLightYears(value) {
  if (value === 0) return '0';
  if (value < 0.01) {
    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / 10 ** exponent;
    const sup = String(exponent).replace(/./g, (c) => SUPERSCRIPT[c]);
    return `${nf(1).format(mantissa)} × 10${sup}`;
  }
  return nf(value < 10 ? 2 : 0).format(value);
}

function distanceAt(j) {
  const i = Math.min(Math.floor(j), DISTANCES.length - 2);
  const f = j - i;
  const a = DISTANCES[i];
  const b = DISTANCES[i + 1];
  if (a === 0) return b * f * f; // départ depuis zéro : montée douce
  return a * Math.pow(b / a, f); // interpolation logarithmique
}

export function initProgress(scroll) {
  const nav = document.querySelector('.journey');
  if (!nav) return { update() {} };
  const links = [...nav.querySelectorAll('[data-step]')];
  const output = nav.querySelector('[data-distance]');
  const last = links.length - 1;

  let anchors = measureAnchors(scroll.max);
  const remeasure = () => (anchors = measureAnchors(scroll.max));
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);

  let previous = -1;
  let current = -1;

  function update(jFromScene) {
    const j = jFromScene ?? scrollToProgress(scroll.y, anchors);
    if (Math.abs(j - previous) < 0.0005) return;
    previous = j;

    nav.style.setProperty('--journey', (j / last).toFixed(4));
    if (output) output.textContent = formatLightYears(distanceAt(Math.min(j, last)));

    const step = Math.round(j);
    if (step !== current) {
      current = step;
      links.forEach((link, i) => {
        link.classList.toggle('is-current', i === step);
        link.classList.toggle('is-passed', i < step);
        if (i === step) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
    }
  }

  update();
  return { update, remeasure };
}

/** Raccourci : met à jour la barre à chaque image (ticker GSAP partagé). */
export function bindProgress(progress, getJ) {
  gsap.ticker.add(() => progress.update(getJ()));
}
