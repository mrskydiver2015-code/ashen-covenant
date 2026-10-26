// Procedural effects share one lazy context and a bounded voice pool.
let context, master, noise, enabled = false, revision = 0;
const voices = new Set();
const MAX_VOICES = 24;

function updateButton() {
  const button = document.getElementById('sound');
  if (!button) return;
  button.querySelector('span').textContent = `SOUND ${enabled ? 'ON' : 'OFF'}`;
  button.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
  button.setAttribute('aria-pressed', String(enabled));
}

export function isSoundEnabled() { return enabled; }

export async function setSoundEnabled(value) {
  const request = ++revision;
  enabled = Boolean(value);
  if (!enabled) {
    if (master) master.gain.setValueAtTime(0, context.currentTime);
    for (const voice of [...voices]) voice.cancel();
    updateButton();
    return false;
  }
  try {
    if (!context || context.state === 'closed') {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      noise = null;
    }
    if (context.state !== 'running') await context.resume();
    if (request !== revision) return enabled;
    enabled = context.state === 'running';
    master.gain.setValueAtTime(enabled ? 0.6 : 0, context.currentTime);
  } catch {
    if (request === revision) enabled = false;
  }
  if (request === revision) updateButton();
  return enabled;
}

function ready() { return enabled && context?.state === 'running'; }

function voice(source, duration, volume, delay = 0, filter = null, attack = 0.004) {
  if (voices.size >= MAX_VOICES) voices.values().next().value.cancel();
  const gain = context.createGain(), start = context.currentTime + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.gain.setValueAtTime(0, start + duration + 0.01);
  source.connect(filter || gain);
  if (filter) filter.connect(gain);
  gain.connect(master);
  const cleanup = () => {
    source.disconnect(); filter?.disconnect(); gain.disconnect(); voices.delete(entry);
  };
  const entry = { cancel() { try { source.stop(); } catch { /* Already stopped. */ } cleanup(); } };
  voices.add(entry);
  source.onended = cleanup;
  source.start(start);
  source.stop(start + duration + 0.01);
}

function oscillator(frequency, end, duration, type, volume, delay = 0, attack = 0.004) {
  const source = context.createOscillator(), start = context.currentTime + delay;
  source.type = type;
  source.frequency.setValueAtTime(frequency, start);
  source.frequency.exponentialRampToValueAtTime(Math.max(15, end), start + duration);
  voice(source, duration, volume, delay, null, attack);
}

// Compatibility cue for existing healing, loot and ability sounds.
export function tone(frequency = 100, duration = 0.12, type = 'sine', volume = 0.06, end = 30) {
  if (ready()) oscillator(frequency, end, duration, type, volume);
}

export function playSlash() {
  if (!ready()) return;
  if (!noise) {
    noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.13), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource(), filter = context.createBiquadFilter();
  source.buffer = noise;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(350, context.currentTime + 0.12);
  voice(source, 0.12, 0.18, 0, filter);
}

export function playHit() {
  if (ready()) oscillator(120, 32, 0.18, 'triangle', 0.22);
}

export function playChestOpen() {
  if (!ready()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    oscillator(frequency, frequency, 0.22, 'square', 0.055, index * 0.09);
  });
}

export function playBossSpawn() {
  if (!ready()) return;
  oscillator(55, 32, 1.8, 'sine', 0.24, 0, 0.12);
  oscillator(82.4, 48, 1.8, 'triangle', 0.06, 0, 0.12);
}

const button = document.getElementById('sound');
if (button) {
  updateButton();
  button.addEventListener('click', () => { void setSoundEnabled(!enabled); });
}
