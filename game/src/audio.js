// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, pickups and jingles are built from oscillators and noise.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Engine: a low sawtooth whose pitch follows speed, through a low-pass filter.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that wails between two tones while wanted.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      context = null;
    }
  }

  function tone(freq, duration, type, volume, when = 0, slideTo = 0) {
    if (!context || muted) return;
    try {
      const start = context.currentTime + when;
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noiseBurst(duration, volume, lowpass = 1200) {
    if (!context || muted) return;
    try {
      const start = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  return {
    ensure,
    /** Call every frame: speedRatio 0..1, wanted 0..5, dt seconds. */
    update(speedRatio, wanted, dt) {
      if (!context) return;
      try {
        if (context.state === 'suspended') void context.resume();
        const now = context.currentTime;
        if (engineOsc && engineGain) {
          engineOsc.frequency.setTargetAtTime(48 + speedRatio * 130, now, 0.08);
          engineGain.gain.setTargetAtTime(muted ? 0 : 0.02 + speedRatio * 0.05, now, 0.1);
        }
        if (sirenOsc && sirenGain) {
          const wail = wanted >= 1 ? 1 : 0;
          sirenGain.gain.setTargetAtTime(muted ? 0 : wail * 0.028, now, 0.2);
          if (wail) sirenOsc.frequency.setTargetAtTime(650 + 260 * Math.sin(now * 3.2), now, 0.05);
        }
      } catch {
        // Ignore.
      }
    },
    shot() {
      noiseBurst(0.14, 0.5, 2600);
      tone(180, 0.1, 'square', 0.18, 0, 60);
    },
    enemyShot() {
      noiseBurst(0.1, 0.22, 1800);
    },
    crash() {
      noiseBurst(0.3, 0.5, 500);
      tone(90, 0.25, 'sine', 0.3, 0, 40);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.25);
      tone(1318, 0.14, 'sine', 0.22, 0.08);
    },
    alarm() {
      tone(1046, 0.12, 'square', 0.16);
      tone(784, 0.12, 'square', 0.16, 0.14);
      tone(1046, 0.12, 'square', 0.16, 0.28);
    },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.25, i * 0.12));
    },
    busted() {
      const notes = [392, 330, 262, 196];
      notes.forEach((freq, i) => tone(freq, 0.3, 'triangle', 0.22, i * 0.16));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
