/**
 * Formulaire de candidature (sans serveur).
 * Validation accessible : messages en français reliés aux champs (aria-describedby),
 * état aria-invalid, focus sur le premier champ en erreur. À l'envoi, un message
 * de confirmation animé remplace le formulaire et reçoit le focus.
 */
import { gsap } from 'gsap';
import { env } from '../utils/env.js';

const MESSAGES = {
  name: {
    valueMissing: 'Indiquez votre nom pour que nous sachions qui embarque.',
    tooShort: 'Votre nom semble un peu court.',
  },
  email: {
    valueMissing: 'Il nous faut une adresse e-mail pour vous répondre.',
    typeMismatch: 'Cette adresse e-mail ne semble pas valide (ex. : nom@domaine.fr).',
  },
};

function errorFor(input) {
  const v = input.validity;
  if (v.valid) return '';
  const messages = MESSAGES[input.name] ?? {};
  for (const key of ['valueMissing', 'typeMismatch', 'tooShort']) {
    if (v[key]) return messages[key] ?? input.validationMessage;
  }
  return input.validationMessage;
}

export function initForm() {
  const form = document.querySelector('.form');
  const confirm = document.querySelector('.confirm');
  if (!form || !confirm) return;
  const fields = [...form.querySelectorAll('input[required]')];

  function validate(input) {
    const error = document.getElementById(`${input.id}-err`);
    const message = errorFor(input);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) error.textContent = message;
    if (message) input.setAttribute('aria-describedby', error.id);
    else input.removeAttribute('aria-describedby');
    return !message;
  }

  fields.forEach((input) => {
    // On valide en quittant le champ, puis en direct une fois qu'une erreur est affichée
    input.addEventListener('blur', () => input.value && validate(input));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validate(input);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const invalid = fields.filter((input) => !validate(input));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const name = form.elements.name.value.trim().split(' ')[0];
    confirm.querySelector('[data-confirm-name]').textContent = name ? `, ${name}` : '';

    const show = () => {
      form.hidden = true;
      confirm.hidden = false;
      confirm.classList.add('is-visible');
      confirm.focus();
      if (!env.reducedMotion) {
        gsap.from(confirm.querySelectorAll('p, button'), { y: 16, opacity: 0, duration: 0.8, stagger: 0.1, delay: 0.3, ease: 'expo.out' });
      }
    };
    if (env.reducedMotion) show();
    else gsap.to(form, { opacity: 0, y: -12, duration: 0.4, ease: 'power2.in', onComplete: show });
  });

  confirm.querySelector('[data-confirm-reset]')?.addEventListener('click', () => {
    form.reset();
    fields.forEach((input) => input.setAttribute('aria-invalid', 'false'));
    confirm.hidden = true;
    confirm.classList.remove('is-visible');
    form.hidden = false;
    gsap.set(form, { clearProps: 'all' });
    form.elements.name.focus();
  });
}
