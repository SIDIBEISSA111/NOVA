/**
 * Son d'ambiance spatial, 100 % généré par la Web Audio API (aucun fichier).
 * Désactivé par défaut ; le contexte audio n'est créé qu'au premier clic
 * (obligatoire pour les navigateurs, et rien n'est chargé si on ne l'active pas).
 *
 * Graphe audio :
 *   bourdon (3 oscillateurs graves désaccordés) ─┐
 *   souffle (bruit brun filtré, vitesse du vol) ─┼─→ réverbération ─→ volume ─→ compresseur ─→ sortie
 *   scintillement (2 sinus aigus en trémolo)    ─┘
 * Le filtre et le souffle évoluent avec la progression du voyage.
 */

/** Bruit « brun » : bruit blanc intégré, grave et doux comme un grondement lointain. */
function createBrownNoise(ctx, seconds = 4) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

/** Réponse impulsionnelle synthétique : bruit qui décroît → réverbération de « cathédrale ». */
function createImpulse(ctx, seconds = 5, decay = 2.6) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

class SpaceAmbience {
  constructor() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AudioCtx());
    const now = ctx.currentTime;

    // Sortie : compresseur (évite toute saturation) ← volume général
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(compressor);

    // Réverbération (mélange sec / mouillé)
    const reverb = ctx.createConvolver();
    reverb.buffer = createImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(this.master);
    const dry = ctx.createGain();
    dry.gain.value = 0.6;
    dry.connect(this.master);
    const bus = ctx.createGain();
    bus.connect(reverb);
    bus.connect(dry);

    // 1. Bourdon : La grave (55 Hz), quinte et octave, légèrement désaccordés
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 420;
    this.droneFilter.Q.value = 0.8;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.32;
    this.droneFilter.connect(droneGain).connect(bus);
    this.oscillators = [
      [55, 'sine', 0],
      [82.41, 'sine', 4],
      [110, 'triangle', -6],
      [164.81, 'sine', 7],
    ].map(([freq, type, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = type === 'triangle' ? 0.25 : 0.5;
      osc.connect(g).connect(this.droneFilter);
      osc.start(now);
      return osc;
    });

    // Oscillateur très lent (LFO) qui fait « respirer » le filtre du bourdon
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 140;
    lfo.connect(lfoDepth).connect(this.droneFilter.frequency);
    lfo.start(now);
    this.oscillators.push(lfo);

    // 2. Souffle : bruit brun passe-bande ; son volume suit la vitesse du voyage
    const noise = ctx.createBufferSource();
    noise.buffer = createBrownNoise(ctx);
    noise.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 260;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.08;
    noise.connect(this.windFilter).connect(this.windGain).connect(bus);
    noise.start(now);
    this.noise = noise;

    // 3. Scintillement : deux sinus aigus très discrets, en trémolo lent
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.012;
    shimmerGain.connect(reverb);
    [1318.5, 1975.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const trem = ctx.createGain();
      trem.gain.value = 0;
      const tremLfo = ctx.createOscillator();
      tremLfo.frequency.value = 0.11 + i * 0.07;
      const tremDepth = ctx.createGain();
      tremDepth.gain.value = 0.5;
      tremLfo.connect(tremDepth).connect(trem.gain);
      osc.connect(trem).connect(shimmerGain);
      osc.start(now);
      tremLfo.start(now);
      this.oscillators.push(osc, tremLfo);
    });
  }

  fadeTo(value, seconds = 1.5) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(value, t, seconds / 3);
  }

  /** Le son suit le voyage : plus sombre vers le trou noir, souffle selon la vitesse. */
  update(j, velocity) {
    const t = this.ctx.currentTime;
    const nearBlackHole = Math.max(0, 1 - Math.abs(j - 4) / 1.2);
    this.droneFilter.frequency.setTargetAtTime(420 - nearBlackHole * 220 + (j < 1 ? 80 : 0), t, 0.5);
    this.windFilter.frequency.setTargetAtTime(220 + Math.min(Math.abs(velocity), 2) * 300, t, 0.3);
    this.windGain.gain.setTargetAtTime(0.06 + Math.min(Math.abs(velocity), 2) * 0.22 + nearBlackHole * 0.08, t, 0.3);
  }

  dispose() {
    this.oscillators.forEach((o) => o.stop());
    this.noise.stop();
    this.ctx.close();
  }
}

export function initAudio(getState) {
  const button = document.querySelector('.sound');
  const stateLabel = button?.querySelector('[data-sound-state]');
  if (!button) return;
  if (!(window.AudioContext || window.webkitAudioContext)) {
    button.hidden = true;
    return;
  }

  let ambience = null;
  let enabled = false;
  let timer = 0;

  button.addEventListener('click', async () => {
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    if (stateLabel) stateLabel.textContent = enabled ? 'activé' : 'coupé';

    if (enabled) {
      ambience ??= new SpaceAmbience();
      await ambience.ctx.resume();
      ambience.fadeTo(0.55, 2.5);
      // Mise à jour 10 fois par seconde : largement suffisant pour l'oreille
      clearInterval(timer);
      timer = setInterval(() => {
        const { j, velocity } = getState();
        ambience.update(j, velocity);
      }, 100);
    } else if (ambience) {
      ambience.fadeTo(0, 0.6);
      clearInterval(timer);
      // On suspend le contexte après le fondu : plus aucun calcul audio
      setTimeout(() => !enabled && ambience.ctx.suspend(), 900);
    }
  });

  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    ambience?.dispose();
    ambience = null;
    enabled = false;
    button.setAttribute('aria-pressed', 'false');
    if (stateLabel) stateLabel.textContent = 'coupé';
  });
}
