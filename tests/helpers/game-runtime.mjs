// Executes the complete game script with real Three.js scene/math objects.
// Only browser surfaces (DOM, canvas, WebGL, audio, wall-clock scheduling) are stubbed.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from '../../dist/vendor/three.module.js';
import * as rules from '../../dist/rules.js';
import * as classes from '../../dist/classes.js';
import * as loot from '../../dist/loot.js';

const source = readFileSync(new URL('../../dist/game.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
export function gameRuntime({ data = new Map(), denied = false, coarse = false } = {}) {
  const ids = new Map(), listeners = new Map();
  const drawing = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.style = { setProperty() {} }; this.attributes = {};
      const set = new Set();
      this.classList = { add: x => set.add(x), remove: x => set.delete(x), contains: x => set.has(x), toggle(x, on) { if (on ?? !set.has(x)) set.add(x); else set.delete(x); } };
    }
    set id(value) { this._id = value; ids.set(value, this); }
    get id() { return this._id; }
    set innerHTML(value) { this._html = value; this.replaceChildren(); for (const match of value.matchAll(/<(\w+)([^>]*)>/g)) { const el = new Element(); el.tagName = match[1]; el.className = /class="([^"]*)"/.exec(match[2])?.[1] || ''; this.appendChild(el); } }
    get innerHTML() { return this._html || ''; }
    get childElementCount() { return this.children.length; }
    get firstElementChild() { return this.children[0]; }
    appendChild(el) { this.children.push(el); el.parent = this; return el; }
    replaceChildren() { this.children = []; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
    querySelector(selector) { return this.children.find(x => selector.startsWith('.') ? x.className?.split(' ').includes(selector.slice(1)) : x.tagName === selector) || null; }
    setAttribute(k, v) { this.attributes[k] = v; }
    getContext() { return drawing; }
    addEventListener(name, fn) { (this.listeners ??= new Map()).set(name, fn); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
    setPointerCapture() {}
    focus() {}
  }
  for (const match of html.matchAll(/<\w+[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const el = new Element(); el.id = match[1]; el.className = /class="([^"]*)"/.exec(match[0])?.[1] || ''; el.hidden = /\bhidden\b/.test(match[0]);
  }
  ids.get('joystick').appendChild(new Element());
  const document = { body: new Element(), hidden: false, createElement: () => new Element(), getElementById: id => ids.get(id) || null,
    querySelectorAll: selector => [...ids.values()].filter(x => selector === '.panel' && x.className.split(' ').includes('panel')),
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const storage = { getItem(k) { if (denied) throw Error('storage denied'); return data.get(k) ?? null; }, setItem(k, v) { if (denied) throw Error('storage denied'); data.set(k, String(v)); } };
  class Renderer { constructor() { this.domElement = new Element(); this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 1 }; } setPixelRatio() {} setSize() {} render() {} }
  const math = Object.create(Math); math.random = () => 0.5;
  let frameDelta = 0.04;
  const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer, Clock: class { getDelta() { return frameDelta; } } }, ...rules, ...classes, ...loot,
    document, window: { localStorage: storage }, localStorage: storage, Math: math, console,
    matchMedia: query => ({ matches: query.includes('coarse') && coarse }), devicePixelRatio: 1, innerWidth: 1280, innerHeight: 900,
    requestAnimationFrame() {}, setTimeout() { return 1; }, clearTimeout() {},
    addEventListener: (name, fn) => listeners.set(name, fn),
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, ''), context, { filename: 'dist/game.js', timeout: 5000 });
  const run = code => vm.runInContext(code, context, { timeout: 5000 });
  return { run, data, ids, key(code, repeat = false) { listeners.get('keydown')({ code, repeat, preventDefault() {} }); listeners.get('keyup')({ code }); },
    event(name) { listeners.get(name)(); }, frame(dt = 0.04) { frameDelta = dt; run('animate()'); },
    start(id = 'reaver') { run(`selectedClass = ${JSON.stringify(id)}; startRun(); autoAttack = false;`); },
    enemy(kind = 'brute', x = 0, z = 0) { run(`spawnEnemy(${JSON.stringify(kind)}, new THREE.Vector3(${x}, 0, ${z}));`); return run('enemies.at(-1)'); },
  };
}
