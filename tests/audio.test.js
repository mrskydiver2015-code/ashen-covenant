import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/audio.js', import.meta.url), 'utf8').replace(/export /g, '');
function runtime(fail = false) {
  const nodes = [], attributes = {}, span = {};
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { gain: param(), frequency: param(), connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; } }; nodes.push(n); return n; };
  const button = { querySelector: () => span, setAttribute: (k, v) => attributes[k] = v, addEventListener() {} };
  let contexts = 0;
  class AudioContext {
    constructor() { contexts++; this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 48000; }
    async resume() { if (fail) throw Error('blocked'); this.state = 'running'; }
    createGain = node; createOscillator = node; createBufferSource = node; createBiquadFilter = node;
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  const context = vm.createContext({ AudioContext, document: { getElementById: () => button } });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), nodes, attributes, span, contexts: () => contexts };
}
test('effects are lazy, share one context, bound voices, and mute cancels scheduled notes', async () => {
  const r = runtime();
  r.run('playSlash(); playHit(); playChestOpen(); playBossSpawn()');
  assert.equal(r.contexts(), 0);
  assert.equal(await r.run('setSoundEnabled(true)'), true);
  r.run('playSlash(); playHit(); playChestOpen(); playBossSpawn()');
  assert.equal(r.run('voices.size'), 8);
  assert.ok(r.nodes.some(n => n.type === 'lowpass'));
  r.run('for (let i = 0; i < 40; i++) playHit()');
  assert.equal(r.run('voices.size'), 24);
  await r.run('setSoundEnabled(false)');
  assert.equal(r.run('voices.size'), 0);
  assert.equal(r.attributes['aria-pressed'], 'false');
  assert.ok(r.nodes.filter(n => n.stopped).every(n => n.disconnected));
  await r.run('setSoundEnabled(true)');
  assert.equal(r.contexts(), 1);
});
test('resume rejection and a rapid enable/mute leave sound off', async () => {
  const failure = runtime(true);
  assert.equal(await failure.run('setSoundEnabled(true)'), false);
  assert.equal(failure.span.textContent, 'SOUND OFF');
  const r = runtime();
  const pending = r.run('setSoundEnabled(true)');
  await r.run('setSoundEnabled(false)');
  await pending;
  assert.equal(r.run('isSoundEnabled()'), false);
  assert.equal(r.run('master.gain.value'), 0);
});
