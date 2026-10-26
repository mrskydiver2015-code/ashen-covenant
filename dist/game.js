import { tone, playSlash, playHit, playChestOpen, playBossSpawn } from './audio.js';
import { createBossMesh } from './boss-model.js';
import { loadBossArena, clearBossArena } from './arena-wave5.js';
import * as THREE from './vendor/three.module.js';
import { makeWeapon, weaponInfo, weaponStats, rollLoot, loadWallet, saveWallet, normalizeGold, dropBossLoot, openBossChest } from './loot.js';
import { CLASSES, CLASS_KEYS, getClass, createClassState, unlockClassWave, abilityStatus, absorbClassDamage, resetClassCombat, castClassAbility, tickClassCombat } from './classes.js';
import { createStats, waveConfig, enemyKind, chooseBlessings, heal, constrainPosition, MAX_ACTIVE_ENEMIES, ARENA_RADIUS, REGIONS, createChests, openChest, buyHealing } from './rules.js';

// All artwork is procedural: shared geometry, hand-built silhouettes and a painted stone atlas.
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const coarse = matchMedia('(pointer: coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !coarse;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#111b20');
scene.fog = new THREE.FogExp2('#111b20', 0.025);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 150);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraOffset = new THREE.Vector3(0, 25, 22);
const ambient = new THREE.HemisphereLight('#a3c5d1', '#35332d', 2.0);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#b5d2e4', 3.2);
moon.position.set(-9, 20, -10);
moon.castShadow = !coarse;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 70 });
moon.shadow.bias = -0.001;
moon.shadow.normalBias = 0.04;
scene.add(moon);
const warm = new THREE.DirectionalLight('#ef8a52', 1.0);
warm.position.set(10, 4, 8);
scene.add(warm);

let seed = 79413;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + random() * (b - a);
const mat = (color, metalness = 0, roughness = 0.85, emissive = 0, intensity = 0) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity, flatShading: true });
const materials = {
  stone: mat('#465050'), darkStone: mat('#252f31'), edge: mat('#71776b'), metal: mat('#71818a', 0.8, 0.35),
  gold: mat('#a28b55', 0.75, 0.4), bone: mat('#b9b19a'), black: mat('#121b21', 0.3),
  cloth: mat('#7c3333'), flesh: mat('#873d38'), ash: mat('#52575c'), eye: mat('#ffd5a0', 0, 0.3, '#ff711a', 5),
  blue: mat('#9cefff', 0.4, 0.3, '#49aacc', 3), blade: mat('#c0d9d9', 0.9, 0.2, '#548c9b', 0.3),
  flame: mat('#ffd898', 0, 0.3, '#ff711a', 4), rune: new THREE.MeshBasicMaterial({ color: '#91845b', transparent: true, opacity: 0.45, depthWrite: false }),
};
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 10, 8), ico: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 7), cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  ring: new THREE.RingGeometry(0.94, 1, 64), oct: new THREE.OctahedronGeometry(1),
};
function mesh(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function ring(parent, radius, color, opacity = 0.6, y = 0.04) {
  const m = mesh(parent, geo.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }), 0, y, 0, radius, radius, radius);
  m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
}
function paintedFloor() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const c = canvas.getContext('2d'); c.fillStyle = '#404748'; c.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 16; col++) {
    const x = col * 64 + (row % 2) * 32, y = row * 64;
    const tone = Math.floor(range(42, 67)); c.fillStyle = `rgb(${tone},${tone + 8},${tone + 9})`; c.fillRect(x + 2, y + 2, 60, 60);
    c.strokeStyle = '#b4b5a114'; c.strokeRect(x + 4, y + 4, 56, 56);
    if (random() < 0.52) { c.beginPath(); c.moveTo(x + range(2, 60), y + 3); for (let k = 1; k < 5; k++) c.lineTo(x + range(12, 52), y + k * 12); c.strokeStyle = '#101b1b80'; c.lineWidth = 1; c.stroke(); }
  }
  for (let i = 0; i < 50000; i++) { c.fillStyle = random() > 0.5 ? '#d4d2bb0a' : '#00000018'; c.fillRect(random() * 1024, random() * 1024, range(1, 4), range(1, 3)); }
  for (let i = 0; i < 130; i++) { const x = random() * 1024, y = random() * 1024, r = range(5, 60); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#080d0e55'); g.addColorStop(1, '#080d0e00'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const ground = mesh(scene, new THREE.CylinderGeometry(38.1, 38.8, 1, 96), mat('#343e40'), 0, -0.56, 0);
const floor = mesh(scene, new THREE.CircleGeometry(37.8, 96), new THREE.MeshStandardMaterial({ map: paintedFloor(), roughness: 0.79, metalness: 0.18 }), 0, -0.035, 0);
floor.rotation.x = -Math.PI / 2;
for (const radius of [6.6, 7, 35.3, 36, 37.3]) ring(scene, radius, '#9d936c', radius > 10 ? 0.3 : 0.24, 0.005);
const seal = new THREE.Group(); scene.add(seal);
for (let i = 0; i < 5; i++) {
  const a = i * TAU / 5, b = (i + 2) * TAU / 5;
  const p1 = new THREE.Vector3(Math.sin(a) * 6.5, 0.015, Math.cos(a) * 6.5), p2 = new THREE.Vector3(Math.sin(b) * 6.5, 0.015, Math.cos(b) * 6.5);
  const bar = mesh(seal, geo.box, materials.rune, (p1.x + p2.x) / 2, 0.015, (p1.z + p2.z) / 2, 0.035, 0.012, p1.distanceTo(p2)); bar.rotation.y = Math.atan2(p2.x - p1.x, p2.z - p1.z);
}
for (let i = 0; i < 32; i++) {
  const a = i * TAU / 32, r = 36.7; const m = mesh(scene, geo.box, materials.rune, Math.sin(a) * r, 0.015, Math.cos(a) * r, 0.09, 0.015, i % 4 === 0 ? 0.7 : 0.3); m.rotation.y = a;
}
const flames = [];
const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
const gc = glowCanvas.getContext('2d'); const gradient = gc.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, '#fff9dd'); gradient.addColorStop(0.15, '#ffb458aa'); gradient.addColorStop(0.4, '#ff6a152c'); gradient.addColorStop(1, '#ff591000'); gc.fillStyle = gradient; gc.fillRect(0, 0, 64, 64);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
function glow(parent, color, size, x, y, z, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(x, y, z); s.scale.set(size, size, 1); parent.add(s); return s;
}
function brazier(x, z, index) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  mesh(g, geo.box, materials.darkStone, 0, 0.2, 0, 1.1, 0.4, 1.1);
  mesh(g, geo.cylinder, materials.metal, 0, 0.9, 0, 0.2, 1.4, 0.2);
  const bowl = mesh(g, geo.cone, materials.gold, 0, 1.55, 0, 0.65, 0.5, 0.65); bowl.rotation.z = Math.PI;
  for (let j = 0; j < 5; j++) { const f = mesh(g, geo.ico, materials.flame, range(-0.28, 0.28), 1.9, range(-0.28, 0.28), 0.17, range(0.35, 0.65), 0.17); flames.push({ mesh: f, base: f.scale.y, phase: range(0, TAU) }); }
  glow(g, '#ffad6e', 4, 0, 2.0, 0);
  if (index % 2 === 0) { const light = new THREE.PointLight('#ff8041', 14, 11, 2); light.position.set(x, 2.8, z); scene.add(light); }
}
// Broken buttresses and pointed arches frame the arena without obscuring the playable floor.
for (let i = 0; i < 12; i++) {
  const a = i * TAU / 12, g = new THREE.Group(); g.position.set(Math.sin(a) * 38, 0, Math.cos(a) * 38); g.rotation.y = a; scene.add(g);
  const height = i >= 3 && i <= 9 ? 6.5 : range(1.8, 3.2);
  mesh(g, geo.box, materials.darkStone, 0, 0.25, 0, 2.2, 0.5, 2.1);
  mesh(g, geo.box, materials.stone, 0, height / 2, 0, 1.3, height, 1.3);
  for (const s of [-1, 1]) mesh(g, geo.cylinder, materials.edge, s * 0.6, height / 2, -0.65, 0.14, height, 0.14);
  mesh(g, geo.box, materials.edge, 0, height - 0.1, 0, 1.8, 0.3, 1.6);
  if (height > 5) {
    mesh(g, geo.cone, materials.darkStone, 0, height + 0.8, 0, 0.9, 1.8, 0.9);
    for (const s of [-1, 1]) { const rib = mesh(g, geo.box, materials.stone, s * 1.5, 5.8, 0, 0.4, 3.5, 0.5); rib.rotation.z = s * -0.67; }
    mesh(g, geo.box, materials.black, 0, 3, -0.69, 0.45, 1.8, 0.06);
    mesh(g, geo.box, materials.gold, 0, 3, -0.75, 0.06, 1.5, 0.07);
    mesh(g, geo.box, materials.gold, 0, 3.2, -0.75, 0.45, 0.06, 0.07);
  }
  if (i % 2 === 0) brazier(Math.sin(a) * 15.8, Math.cos(a) * 15.8, i / 2);
}
for (let i = 0; i < 115; i++) {
  const a = range(0, TAU), r = range(35.8, 38.5), s = range(0.12, 0.6);
  const rubble = mesh(scene, geo.box, random() > 0.5 ? materials.stone : materials.darkStone, Math.sin(a) * r, s * 0.3, Math.cos(a) * r, s, s * 0.7, range(0.2, 0.8)); rubble.rotation.set(range(-0.4, 0.4), range(0, TAU), range(-0.2, 0.2));
}
for (let i = 0; i < 14; i++) {
  const a = range(0, TAU), r = range(13, 18);
  for (let j = 0; j < 3; j++) { const x = Math.sin(a) * r + range(-0.4, 0.4), z = Math.cos(a) * r + range(-0.4, 0.4), h = range(0.18, 0.45); mesh(scene, geo.cylinder, materials.bone, x, h / 2, z, 0.055, h, 0.055); mesh(scene, geo.oct, materials.flame, x, h + 0.06, z, 0.035, 0.08, 0.035); }
}
const altar = new THREE.Group(); altar.position.set(0, 0, -16.6); scene.add(altar);
mesh(altar, geo.box, materials.darkStone, 0, 0.4, 0, 4.2, 0.8, 2);
mesh(altar, geo.box, materials.edge, 0, 0.9, 0, 4.6, 0.25, 2.3);
mesh(altar, geo.box, materials.cloth, 0, 1.05, 0, 1.3, 0.05, 2.4);
mesh(altar, geo.oct, materials.bone, 0, 1.35, 0, 0.3, 0.3, 0.25);

// District landmarks use shared low-poly geometry; clear lanes lead to every chest.
const obstacles = [];
function landmark(group, geometry, material, x, y, z, sx, sy, sz, radius) {
  const object = mesh(group, geometry, material, x, y, z, sx, sy, sz);
  obstacles.push({ x: group.position.x + x, z: group.position.z + z, radius });
  return object;
}
for (const [index, region] of REGIONS.entries()) {
  if (!index) continue;
  const g = new THREE.Group(); g.position.set(region.x, 0, region.z); scene.add(g);
  const paving = mesh(g, geo.cylinder, mat(region.color), 0, -0.06, 0, 8, 0.08, 8); paving.castShadow = false;
  ring(g, 8.2, region.color, 0.45);
  // Low perimeter features leave the center and cardinal approaches open.
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * TAU / 8, x = Math.sin(a) * 7, z = Math.cos(a) * 7;
    if (index === 1) {
      landmark(g, geo.box, materials.stone, x, 0.65, z, 0.8, 1.3, 0.4, 0.6);
      mesh(g, geo.box, materials.bone, x, 1, z - 0.23, 0.5, 0.1, 0.08);
    } else if (index === 2) {
      const crystal = landmark(g, geo.oct, materials.blue, x, 1, z, 0.5, 1.8, 0.5, 0.65); crystal.rotation.z = (i % 2 ? 1 : -1) * 0.25;
    } else if (index === 3) {
      landmark(g, geo.box, materials.darkStone, x, 0.8, z, 1.6, 1.6, 0.6, 1);
      for (let j = 0; j < 4; j++) mesh(g, geo.box, j % 2 ? materials.cloth : materials.gold, x - 0.5 + j * 0.3, 0.9, z - 0.35, 0.2, 0.8, 0.16);
    } else {
      landmark(g, geo.cylinder, materials.gold, x, 0.45, z, 0.7, 0.9, 0.7, 0.85);
      mesh(g, geo.ico, materials.eye, x, 1.05, z, 0.22, 0.3, 0.22);
    }
  }
  for (let j = 1; j < 7; j++) {
    const tile = mesh(scene, geo.box, materials.edge, region.x * j / 8, -0.015, region.z * j / 8, 2.2, 0.025, 2.2); tile.castShadow = false;
  }
}
const shrinePosition = new THREE.Vector3(0, 0, -14);
ring(scene, 2, '#96dfbd', 0.7).position.z = -14;
glow(scene, '#96dfbd', 3, 0, 1, -14);
const chests = createChests().map(data => {
  const object = new THREE.Group(); object.position.set(data.x, 0, data.z); scene.add(object);
  mesh(object, geo.box, materials.black, 0, 0.4, 0, 1.4, 0.8, 0.95);
  for (const x of [-0.5, 0.5]) mesh(object, geo.box, materials.gold, x, 0.43, 0, 0.1, 0.86, 1);
  const lid = new THREE.Group(); lid.position.set(0, 0.8, 0.48); object.add(lid);
  mesh(lid, geo.box, materials.gold, 0, 0.08, -0.48, 1.45, 0.18, 1);
  const beacon = glow(object, data.rare ? '#e7b85c' : '#b1e1ed', 2.8, 0, 1.1, 0);
  return { ...data, object, lid, beacon };
});
function resolveScenery(position, padding = 0.55) {
  for (const o of obstacles) {
    const dx = position.x - o.x, dz = position.z - o.z, d = Math.hypot(dx, dz), min = o.radius + padding;
    if (d < min) { position.x = o.x + (d > 0.001 ? dx / d : 1) * min; position.z = o.z + (d > 0.001 ? dz / d : 0) * min; }
  }
  constrainPosition(position);
}
function interactionTarget() {
  return chests.find(c => !c.opened && c.object.position.distanceTo(player.position) < 2.5);
}
function interact() {
  if (state !== 'playing') return;
  if (nearbyBossChest()) { claimBossChest(nearbyBossChest()); return; }
  if (nearbyWeapon()) { equipDrop(nearbyWeapon()); return; }
  const chest = interactionTarget();
  if (chest) {
    const loot = openChest(chest, stats);
    chest.beacon.visible = false;
    announce('+' + loot.gold + ' GOLD · ' + loot.name.toUpperCase());
    burst(chest.object.position, 20, '#eac277'); playChestOpen();
  } else if (player.position.distanceTo(shrinePosition) < 3) {
    if (buyHealing(stats)) { flashRing(player.position, 3, '#96dfbd'); announce('RESTORED 50 HEALTH'); }
    else announce(stats.hp >= stats.maxHp ? 'HEALTH IS FULL' : 'NEED 30 GOLD');
  }
  updateHud();
}
const mapContext = $('minimap').getContext('2d');
function updateExplorationHud() {
  const region = REGIONS.reduce((best, r) => Math.hypot(player.position.x - r.x, player.position.z - r.z) < Math.hypot(player.position.x - best.x, player.position.z - best.z) ? r : best);
  $('region').textContent = region.name;
  $('gold').textContent = stats.gold + ' GOLD';
  $('chest-count').textContent = chests.filter(c => c.opened).length + '/12 CHESTS';
  const chest = interactionTarget(), shrine = player.position.distanceTo(shrinePosition) < 3;
  const weaponDrop = nearbyWeapon();
  const bossChest = nearbyBossChest();
  $('interact').hidden = state !== 'playing' || (!chest && !shrine && !weaponDrop && !bossChest);
  $('interact').textContent = chest ? 'E · OPEN ' + (chest.rare ? 'RARE ' : '') + 'CHEST' : 'E · HEAL 50 HP · 30 GOLD';
  if (weaponDrop) {
    const info = weaponInfo(weaponDrop.weapon), next = weaponStats(stats, weaponDrop.weapon);
    $('interact').textContent = `E · SWAP: ${info.name} · ${Math.round(next.damage)} DMG / ${next.attackDelay.toFixed(2)}s / ${next.range.toFixed(1)} REACH`;
  }
  const current = weaponStats(stats, equippedWeapon);
  if (bossChest) $('interact').textContent = 'E · OPEN GILDED BOSS CHEST · 100 GOLD + RARE BLESSING';
  $('weapon-name').textContent = weaponInfo(equippedWeapon).name;
  $('weapon-details').textContent = `${Math.round(current.damage)} DMG · ${current.attackDelay.toFixed(2)}s · ${current.range.toFixed(1)} REACH`;
  $('wallet-status').textContent = walletSaved ? 'WALLET · KEPT ON DEATH' : 'WALLET · SESSION ONLY';
  const c = mapContext, scale = 1.65;
  c.clearRect(0, 0, 128, 128); c.strokeStyle = '#8b8063'; c.beginPath(); c.arc(64, 64, ARENA_RADIUS * scale, 0, TAU); c.stroke();
  for (const r of REGIONS) { c.fillStyle = r.color; c.globalAlpha = 0.3; c.beginPath(); c.arc(64 + r.x * scale, 64 + r.z * scale, 10, 0, TAU); c.fill(); }
  c.globalAlpha = 1;
  for (const chest of chests) { c.fillStyle = chest.opened ? '#5a625c' : '#f0c96c'; c.fillRect(62 + chest.x * scale, 62 + chest.z * scale, 4, 4); }
  c.fillStyle = '#96dfbd'; c.fillRect(61, 61 - 14 * scale, 6, 6);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(64 + player.position.x * scale, 64 + player.position.z * scale, 3, 0, TAU); c.fill();
}

function makeActor(kind) {
  const g = new THREE.Group(), hero = kind === 'hero', brute = kind === 'brute' || kind === 'boss', caster = kind === 'caster';
  const flesh = hero ? materials.black : caster ? materials.ash : materials.flesh;
  const body = mesh(g, geo.ico, hero ? materials.metal : flesh, 0, 1.05, 0, brute ? 0.68 : 0.43, 0.62, 0.3);
  mesh(g, geo.ico, hero ? materials.black : flesh, 0, 0.6, 0, 0.34, 0.3, 0.25);
  const head = mesh(g, geo.ico, hero ? materials.metal : flesh, 0, 1.78, -0.02, 0.27, 0.32, 0.25);
  mesh(g, geo.box, hero ? materials.black : materials.bone, 0, 1.7, -0.23, 0.25, 0.11, 0.08);
  for (const side of [-1, 1]) {
    mesh(g, geo.sphere, hero ? materials.blue : materials.eye, side * 0.1, 1.82, -0.235, 0.045, 0.035, 0.025);
    const shoulder = mesh(g, hero ? geo.ico : geo.sphere, hero ? materials.metal : flesh, side * (brute ? 0.67 : 0.43), 1.38, 0, brute ? 0.38 : 0.26, 0.25, 0.28);
    if (hero || brute) mesh(g, geo.cone, hero ? materials.gold : materials.bone, side * (brute ? 0.8 : 0.53), 1.7, 0, 0.10, 0.36, 0.10).rotation.z = -side * 0.5;
    const arm = mesh(g, geo.box, flesh, side * (brute ? 0.73 : 0.49), 0.96, -0.04, 0.17, 0.58, 0.2); arm.rotation.z = side * 0.16;
    mesh(g, geo.ico, hero ? materials.metal : materials.bone, side * (brute ? 0.78 : 0.53), 0.66, -0.08, 0.15, 0.19, 0.16);
    const leg = mesh(g, geo.box, hero ? materials.black : flesh, side * 0.22, 0.31, 0.02, 0.22, 0.62, 0.24); g.userData[side < 0 ? 'leftLeg' : 'rightLeg'] = leg;
    mesh(g, geo.box, hero ? materials.metal : materials.black, side * 0.22, 0.1, -0.1, 0.25, 0.21, 0.4);
    if (!hero) {
      const horn = mesh(g, geo.cone, materials.bone, side * 0.25, 2.12, 0.04, 0.09, brute ? 0.8 : 0.48, 0.10); horn.rotation.z = -side * 0.45; horn.rotation.x = -0.3;
      if (!caster) { const wing = mesh(g, geo.cone, materials.cloth, side * 0.65, 1.32, 0.25, 0.28, 0.85, 0.07); wing.rotation.z = -side * 0.9; }
    }
  }
  if (hero) {
    const cape = mesh(g, geo.cone, materials.cloth, 0, 0.97, 0.34, 0.49, 1.3, 0.12); cape.rotation.x = -0.18; g.userData.cape = cape;
    mesh(g, geo.box, materials.gold, 0, 1.08, -0.3, 0.11, 0.54, 0.04);
    mesh(g, geo.box, materials.gold, 0, 1.2, -0.31, 0.38, 0.08, 0.04);
    const sword = new THREE.Group(); sword.position.set(0.58, 0.8, -0.24); g.add(sword);
    mesh(sword, geo.box, materials.blade, 0, 0.04, -0.72, 0.14, 0.07, 1.6);
    mesh(sword, geo.oct, materials.blade, 0, 0.04, -1.54, 0.08, 0.04, 0.24);
    mesh(sword, geo.box, materials.gold, 0, 0.04, -0.05, 0.5, 0.12, 0.12); g.userData.sword = sword;
  }
  if (caster) {
    mesh(g, geo.cone, materials.black, 0, 0.7, 0, 0.65, 1.4, 0.65);
    mesh(g, geo.cylinder, materials.gold, 0.65, 1.0, -0.2, 0.055, 2, 0.055);
    mesh(g, geo.oct, materials.eye, 0.65, 2.1, -0.2, 0.18, 0.24, 0.18);
  }
  if (kind === 'imp') g.scale.setScalar(0.66);
  if (kind === 'brute') g.scale.setScalar(1.35);
  if (kind === 'boss') g.scale.setScalar(2.2);
  g.userData.body = body;
  return g;
}
const player = makeActor('hero'); scene.add(player);
const playerLight = new THREE.PointLight('#a9e2ff', 5, 8); playerLight.position.set(0, 2.5, 0); scene.add(playerLight);
const playerRing = ring(scene, 0.73, '#b6dce1', 0.35);
const soulGlow = glow(player, '#a6d8ff', 1.7, 0, 0.5, 0, 0.2);
// A small preview tableau is removed before a run starts.
const previewDemons = [];
for (let i = 0; i < 7; i++) { const d = makeActor(i === 0 ? 'brute' : i === 4 ? 'caster' : 'stalker'); const a = i * TAU / 7; d.position.set(Math.sin(a) * (5 + i % 3), 0, Math.cos(a) * (5 + i % 3)); d.rotation.y = Math.atan2(-d.position.x, -d.position.z) + Math.PI; scene.add(d); previewDemons.push(d); }

let state = 'intro', stats = createStats(), wave = 0, kills = 0, souls = 0, elapsed = 0, timer = 0;
let equippedWeapon = makeWeapon(), drops = [], walletSaved = true;
let walletStorage;
try { walletStorage = window.localStorage; } catch { /* Session wallet remains usable. */ }
stats.gold = loadWallet(walletStorage);
walletSaved = Boolean(walletStorage);
let savedGold = stats.gold;
let enemies = [], spawns = [], shots = [], effects = [], particles = [], orbiters = [], choices = [];
let pending = 0, spawnClock = 0, config, bossPending = false, attackCd = 0, novaCd = 0, dashCd = 0, dashTime = 0, invulnerable = 0, shake = 0, attackAnim = 0, attackCount = 0;
let autoAttack = true, mouseHeld = false, pointerSeen = false, aim = 0, hitStop = 0;
let touchpadMove = false, pointerGesture = null;
const keys = new Set(), pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster(), aimPoint = new THREE.Vector3(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const move = new THREE.Vector3(), dashDirection = new THREE.Vector3(0, 0, -1), joystick = { x: 0, y: 0, id: null };
const giftCounts = new Map();
let selectedClass = 'reaver', classProgress = createClassState(), classPathOpen = false;
const classAura = ring(scene, 1, '#ef8d78', 0.6, 0.15); classAura.visible = false;
function setPanel(name) {
  releaseMovementPointer();
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== name;
  $('overlay').hidden = !name; $('overlay').classList.toggle('modal', name !== 'intro');
  if (name) requestAnimationFrame(() => $(name)?.querySelector('button')?.focus());
}
let announcementTimeout;
function announce(text) { $('announcement').textContent = text; $('announcement').style.opacity = 1; clearTimeout(announcementTimeout); announcementTimeout = setTimeout(() => { $('announcement').style.opacity = 0; }, 2400); }
function disposeObject(object) {
  scene.remove(object);
  // Actors share immutable meshes and materials. Only transient objects own their resources.
  if (object.userData.ownedGeometry) object.geometry.dispose();
  if (object.userData.ownedMaterial) object.material.dispose();
}
function addEffect(object, life, update) { object.userData.ownedMaterial = true; scene.add(object); effects.push({ object, life, max: life, update }); }
const particleMaterial = new THREE.MeshBasicMaterial({ color: '#ffab56' });
const particleGeo = new THREE.IcosahedronGeometry(0.065, 0);
function burst(position, count = 12, color = '#ffad66', strength = 1) {
  for (let i = 0; i < count && particles.length < 260; i++) {
    const p = new THREE.Mesh(particleGeo, particleMaterial); p.position.copy(position); p.position.y += 0.6;
    // Color is per-instance material, disposed when the short-lived particle expires.
    p.material = new THREE.MeshBasicMaterial({ color }); p.userData.ownedMaterial = true; scene.add(p);
    particles.push({ object: p, velocity: new THREE.Vector3(range(-3, 3), range(1, 5), range(-3, 3)).multiplyScalar(strength), life: range(0.25, 0.7) });
  }
}
function floating(text, position, color = '#e2ddc4', critical = false) {
  if ($('floaters').childElementCount >= 30) return;
  const p = position.clone(); p.y += 2.1; p.project(camera);
  const el = document.createElement('span'); el.className = `float${critical ? ' crit' : ''}`; el.textContent = text; el.style.color = color; el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`; $('floaters').appendChild(el); setTimeout(() => el.remove(), 750);
}
function flashRing(position, radius, color, duration = 0.5) {
  const r = ring(scene, 1, color, 0.85, 0.11); r.position.x = position.x; r.position.z = position.z;
  addEffect(r, duration, (o, t) => { o.scale.setScalar(0.5 + radius * (1 - t)); o.material.opacity = t * 0.8; });
}
function lightning(from, to) {
  const points = []; for (let i = 0; i <= 7; i++) { const p = from.clone().lerp(to, i / 7); p.y += 1; if (i > 0 && i < 7) { p.x += range(-0.5, 0.5); p.z += range(-0.5, 0.5); } points.push(p); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#b1e9ff', transparent: true })); line.userData.ownedGeometry = true; addEffect(line, 0.22, (o, t) => { o.material.opacity = t; });
}
function persistGold() {
  stats.gold = normalizeGold(stats.gold);
  walletSaved = saveWallet(walletStorage, stats.gold); savedGold = stats.gold;
}
function nearbyBossChest() {
  return drops.find(d => d.type === 'boss-chest' && !d.opened && Math.hypot(d.object.position.x - player.position.x, d.object.position.z - player.position.z) < 2.5);
}
function claimBossChest(chest) {
  if (state !== 'playing' || chest !== nearbyBossChest()) return;
  const reward = openBossChest(chest, stats);
  if (!reward) return;
  persistGold(); scene.remove(chest.object); drops.splice(drops.indexOf(chest), 1);
  giftCounts.set(reward.blessing.id, { blessing: reward.blessing, count: 1 });
  const gift = document.createElement('div'); gift.className = 'gift';
  gift.textContent = '✦ RARE · ' + reward.blessing.name; gift.title = reward.blessing.description;
  $('gifts').appendChild(gift);
  announce('BOSS TROPHY · +100 GOLD · RARE GILDED RESOLVE'); updateHud();
}
function weaponModel(parent, weapon) {
  const material = weapon.id === 'axe' ? materials.gold : weapon.id === 'dagger' ? materials.bone : materials.blade;
  const length = weapon.id === 'spear' ? 2.5 : weapon.id === 'dagger' ? 0.8 : 1.6;
  mesh(parent, geo.box, materials.gold, 0, 0.04, -0.05, 0.4, 0.12, 0.12);
  mesh(parent, geo.box, material, 0, 0.04, -length / 2, 0.14, 0.07, length);
  mesh(parent, weapon.id === 'axe' ? geo.box : geo.oct, material, 0, 0.04, -length, weapon.id === 'axe' ? 0.8 : 0.12, 0.09, 0.3);
}
function refreshWeaponModel() {
  player.userData.sword.clear(); weaponModel(player.userData.sword, equippedWeapon);
}
function nearbyWeapon() {
  let nearest, distance = 2.5;
  for (const drop of drops) {
    const d = Math.hypot(drop.object.position.x - player.position.x, drop.object.position.z - player.position.z);
    if (drop.type === 'weapon' && d < distance) { nearest = drop; distance = d; }
  }
  return nearest;
}
function spawnDrop(loot, position) {
  // Bound scene objects, merging gold stacks instead of losing their value.
  if (drops.length >= 80) {
    const old = drops.find(d => d.type === 'weapon');
    if (old) { scene.remove(old.object); drops.splice(drops.indexOf(old), 1); }
    else {
      const goldDrops = drops.filter(d => d.type === 'gold');
      if (loot.type === 'gold') { goldDrops[0].amount += loot.amount; return; }
      goldDrops[1].amount += goldDrops[0].amount;
      scene.remove(goldDrops[0].object); drops.splice(drops.indexOf(goldDrops[0]), 1);
    }
  }
  const object = new THREE.Group(); object.position.copy(position);
  object.position.x += loot.type === 'weapon' ? 0.7 : loot.type === 'gold' ? -0.4 : 0; constrainPosition(object.position);
  if (loot.type === 'gold') mesh(object, geo.cylinder, materials.gold, 0, 0, 0, 0.3, 0.12, 0.3);
  else if (loot.type === 'boss-chest') {
    mesh(object, geo.box, materials.gold, 0, 0.35, 0, 1.5, 0.7, 1);
    mesh(object, geo.box, materials.blade, 0, 0.76, 0, 1.6, 0.15, 1.1);
    mesh(object, geo.oct, materials.blue, 0, 1.4, 0, 0.3, 0.55, 0.3);
  }
  else {
    weaponModel(object, loot.weapon);
    mesh(object, geo.oct, materials.blue, 0, 0.25, 0, 0.13, 0.4, 0.13);
  }
  object.position.y = 0.5; scene.add(object);
  drops.push({ ...loot, object, phase: Math.random() * TAU });
}
function equipDrop(drop) {
  if (state !== 'playing' || !drops.includes(drop)) return;
  const old = equippedWeapon; equippedWeapon = drop.weapon;
  scene.remove(drop.object); drops.splice(drops.indexOf(drop), 1);
  spawnDrop({ type: 'weapon', weapon: old }, player.position);
  refreshWeaponModel(); announce(weaponInfo(equippedWeapon).name.toUpperCase() + ' EQUIPPED');
  tone(520, 0.16, 'sine', 0.04, 780); updateHud();
}
function updateDrops(dt) {
  let collected = 0;
  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i], p = drop.object.position;
    if (drop.type !== 'boss-chest') { p.y = 0.5 + Math.sin(timer * 3 + drop.phase) * 0.12; drop.object.rotation.y += dt * 0.8; }
    if (drop.type === 'gold' && Math.hypot(p.x - player.position.x, p.z - player.position.z) < 2) {
      collected += drop.amount; scene.remove(drop.object); drops.splice(i, 1);
    }
  }
  if (collected) {
    stats.gold += collected; persistGold();
    floating(`+${collected} GOLD`, player.position, '#f0c96c'); tone(640, 0.09, 'sine', 0.025, 900);
  }
}
function startRun() {
  clearBossArena(scene);
  for (const d of previewDemons) scene.remove(d);
  for (const e of enemies) { e.bossModel?.dispose(); scene.remove(e.mesh); }
  for (const list of [spawns, shots, effects, particles]) for (const e of list) disposeObject(e.object);
  for (const o of orbiters) scene.remove(o);
  enemies = []; spawns = []; shots = []; effects = []; particles = []; orbiters = [];
  for (const chest of chests) { chest.opened = false; chest.lid.rotation.x = 0; chest.beacon.visible = true; }
  const carriedGold = stats.gold;
  for (const drop of drops) scene.remove(drop.object);
  drops = []; equippedWeapon = makeWeapon(); refreshWeaponModel();
  stats = createStats(); stats.gold = carriedGold; wave = kills = souls = elapsed = timer = attackCount = 0; giftCounts.clear();
  classProgress = createClassState(selectedClass); classPathOpen = false; classAura.visible = false;
  renderClassSlots();
  attackCd = novaCd = dashCd = dashTime = invulnerable = hitStop = shake = 0; keys.clear(); mouseHeld = false;
  player.position.set(0, 0, 2); player.rotation.set(0, 0, 0); player.visible = true; aim = 0;
  $('gifts').innerHTML = '<span class="muted">Power comes at a price.</span>'; $('boss-hud').hidden = true; $('floaters').replaceChildren();
  document.body.classList.add('playing'); state = 'playing'; setPanel(null); nextWave(); updateHud();
}
function nextWave() {
  clearBossArena(scene);
  wave++; config = waveConfig(wave); pending = config.count; bossPending = config.boss; spawnClock = 1.2; state = 'playing'; setPanel(null);
  if (wave === 5) { loadBossArena(scene); playBossSpawn(); }
  $('wave-title').textContent = `WAVE ${String(wave).padStart(2, '0')}`;
  $('chapter').textContent = wave < 5 ? 'THE FORSAKEN SANCTUM' : wave < 10 ? 'THE BLOOD COVENANT' : 'THE ABYSS REMEMBERS';
  announce(config.boss ? 'THE WARDEN AWAKENS' : `WAVE ${String(wave).padStart(2, '0')} · ${wave === 1 ? 'FIRST BLOOD' : 'THE DESCENT CONTINUES'}`);
}
function prepareSpawn(kind) {
  const a = Math.random() * TAU; const p = new THREE.Vector3(player.position.x + Math.sin(a) * 13, 0, player.position.z + Math.cos(a) * 13);
  constrainPosition(p);
  if (p.distanceTo(player.position) < 7) { p.copy(player.position).multiplyScalar(0.6); if (p.distanceTo(player.position) < 7) p.set(0, 0, 14); }
  const r = ring(scene, kind === 'boss' ? 2.2 : 0.9, '#e0523a', 0.7); r.position.x = p.x; r.position.z = p.z; r.userData.ownedMaterial = true;
  spawns.push({ object: r, position: p, kind, life: 1.0 });
}
function spawnEnemy(kind, position) {
  const bossModel = kind === 'boss' ? createBossMesh() : null;
  const m = bossModel ? bossModel.root : makeActor(kind); m.position.copy(position); scene.add(m);
  const table = { imp: [28, 3.4, 7, 0.5], stalker: [52, 2.45, 12, 0.75], caster: [38, 1.7, 11, 0.65], brute: [145, 1.55, 24, 1.05], boss: [700, 1.3, 30, 1.7] };
  const [hp, speed, damage, radius] = table[kind];
  enemies.push({ mesh: m, bossModel, kind, hp: hp * config.health, maxHp: hp * config.health, speed, damage: damage * config.damage, radius, cooldown: range(0.5, 1.3), slow: 0, stun: 0, windup: 0, attackTarget: new THREE.Vector3(), special: 4, dead: false });
  burst(position, 9, '#dc6543', 0.7);
  if (kind === 'boss') {
    $('boss-hud').hidden = false; $('boss-fill').style.width = '100%';
    // Wave 05 announces the encounter at entry; do not replay that cue after its portal.
    if (wave !== 5) playBossSpawn();
  }
}
function damageEnemy(enemy, amount, critical = false, frost = false) {
  if (enemy.dead) return;
  enemy.hp -= amount; enemy.stun = 0.13; if (frost) enemy.slow = 2;
  if (amount > 0) playHit();
  floating(Math.round(amount), enemy.mesh.position, frost ? '#a8e8ff' : '#e8dfca', critical);
  burst(enemy.mesh.position, critical ? 8 : 4, frost ? '#8dddf2' : '#d68c52', 0.65);
  if (enemy.hp <= 0) {
    enemy.dead = true; kills++; souls += enemy.kind === 'boss' ? 100 : enemy.kind === 'brute' ? 15 : 5;
    if (stats.leech) heal(stats, stats.leech);
    if (enemy.kind === 'boss' && wave === 5) {
      const bossPos = enemy.mesh.position.clone();
      const chest = dropBossLoot(bossPos); spawnDrop(chest, chest.position); playChestOpen();
    } else for (const loot of rollLoot(enemy.kind, wave, Math.random, kills === 1)) spawnDrop(loot, enemy.mesh.position);
    burst(enemy.mesh.position, enemy.kind === 'boss' ? 36 : 13, '#cb6b42'); flashRing(enemy.mesh.position, enemy.radius * 1.4, '#9d473b', 0.35);
    if (enemy.kind === 'boss') { $('boss-hud').hidden = true; announce('THE WARDEN FALLS'); shake = 0.5; }
    enemy.bossModel?.dispose(); scene.remove(enemy.mesh); tone(85, 0.12, 'triangle', 0.025, 25);
  }
}
function receiveDamage(amount) {
  if (state !== 'playing' || invulnerable > 0 || dashTime > 0) return;
  amount = absorbClassDamage(classProgress, amount);
  if (amount <= 0) { invulnerable = 0.65; flashRing(player.position, 1.5, '#e4ce8d', 0.25); return; }
  stats.hp = Math.max(0, stats.hp - amount); invulnerable = 0.65; shake = 0.3;
  floating(`−${Math.round(amount)}`, player.position, '#f48b75'); playHit();
  $('damage-flash').style.opacity = 0.55; setTimeout(() => { $('damage-flash').style.opacity = 0; }, 150);
  if (stats.hp <= 0) die();
}
function rend() {
  if (state !== 'playing' || attackCd > 0 || dashTime > 0) return;
  const combat = weaponStats(stats, equippedWeapon);
  attackCd = combat.attackDelay; attackAnim = 0.23; attackCount++;
  playSlash();
  const geometry = new THREE.RingGeometry(combat.range * 0.68, combat.range, 28, 1, -1.05, 2.1);
  const arc = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: stats.frost ? '#9ceaff' : '#ead5a8', side: THREE.DoubleSide, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
  arc.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - aim); arc.position.copy(player.position); arc.position.y = 0.6; arc.userData.ownedGeometry = true;
  addEffect(arc, 0.20, (o, t) => { o.material.opacity = t * 0.65; o.scale.setScalar(1 + (1 - t) * 0.15); });
  let hit = false;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.mesh.position.x - player.position.x, dz = e.mesh.position.z - player.position.z, dist = Math.hypot(dx, dz);
    const dot = dist < 0.01 ? 1 : (Math.sin(aim) * dx - Math.cos(aim) * dz) / dist;
    if (dist < combat.range + e.radius && (dot > 0.2 || dist < 1.25)) { const crit = Math.random() < stats.crit; damageEnemy(e, combat.damage * (crit ? 2 : 1), crit, !!stats.frost); if (!e.dead && dist > 0.01) { e.mesh.position.x += dx / dist * 0.4; e.mesh.position.z += dz / dist * 0.4; } hit = true; }
  }
  if (stats.lightning && attackCount % 3 === 0) {
    let origin = player.position; const candidates = enemies.filter(e => !e.dead && e.mesh.position.distanceTo(player.position) < 10).sort((a, b) => a.mesh.position.distanceTo(player.position) - b.mesh.position.distanceTo(player.position)).slice(0, 3);
    for (const e of candidates) { lightning(origin, e.mesh.position); damageEnemy(e, combat.damage * 0.65 * stats.lightning); origin = e.mesh.position; }
  }
  if (hit) { hitStop = 0.025; shake = Math.max(shake, 0.07); }
}
function nova() {
  if (state !== 'playing' || novaCd > 0) return;
  novaCd = stats.novaDelay; shake = 0.3;
  flashRing(player.position, stats.novaRadius, '#9fe8ff', 0.65); flashRing(player.position, stats.novaRadius * 0.8, '#e2e7ce', 0.5); burst(player.position, 35, '#a3e7f6', 2);
  for (const e of enemies) if (!e.dead && e.mesh.position.distanceTo(player.position) < stats.novaRadius + e.radius) { damageEnemy(e, stats.novaDamage); e.slow = 2; e.stun = 0.6; }
  tone(210, 0.6, 'sawtooth', 0.055, 28);
}
function dash() {
  if (state !== 'playing' || dashCd > 0) return;
  dashCd = stats.dashDelay; dashTime = 0.20; invulnerable = 0.35;
  dashDirection.copy(move.lengthSq() > 0.01 ? move : new THREE.Vector3(Math.sin(aim), 0, -Math.cos(aim))).normalize();
  burst(player.position, 12, '#83c2dc'); tone(280, 0.16, 'sine', 0.04, 55);
}
function useElixir() {
  if (state !== 'playing' || stats.flasks <= 0 || stats.hp >= stats.maxHp) return;
  stats.flasks--; heal(stats, stats.maxHp * 0.5); flashRing(player.position, 2.5, '#a6d49a'); floating('+50%', player.position, '#b1dfa4'); tone(320, 0.3, 'sine', 0.05, 650);
}
function clearWave() {
  state = 'upgrade'; mouseHeld = false; keys.clear();
  const unlocked = unlockClassWave(classProgress, wave);
  resetClassCombat(classProgress); classAura.visible = false;
  $('class-unlock').hidden = !unlocked.length;
  $('class-unlock').textContent = unlocked.map(a => `${a.icon} ${a.name} unlocked · Press ${a.key} next wave — ${a.description}`).join(' ');
  for (const s of shots) disposeObject(s.object); shots = [];
  heal(stats, stats.maxHp * 0.25); stats.flasks = Math.min(3, stats.flasks + 1); novaCd = dashCd = 0;
  choices = chooseBlessings(stats); $('upgrade-sub').textContent = `Wave ${wave} survived. One gift. A little less of your humanity.`;
  $('cards').replaceChildren();
  choices.forEach((b, i) => { const button = document.createElement('button'); button.className = 'card'; button.innerHTML = `<span class="card-key">0${i + 1}</span><span class="card-icon">${b.icon}</span><span class="eyebrow">${b.type}</span><h3>${b.name}</h3><p>${b.description}</p>`; button.onclick = () => selectBlessing(i); $('cards').appendChild(button); });
  setPanel('upgrade-panel'); tone(330, 0.5, 'sine', 0.035, 660); updateHud();
}
function selectBlessing(index) {
  if (state !== 'upgrade' || !choices[index]) return;
  const b = choices[index]; b.apply(stats); giftCounts.set(b.id, { blessing: b, count: (giftCounts.get(b.id)?.count || 0) + 1 });
  $('gifts').innerHTML = [...giftCounts.values()].map(({ blessing: gift, count }) => `<div class="gift"><b>${gift.icon}</b> ${gift.tier === 'rare' ? 'RARE ? ' : ''}${gift.name}${count > 1 ? ` ×${count}` : ''}</div>`).join('');
  while (orbiters.length < stats.orbit) { const o = mesh(scene, geo.oct, materials.blue, 0, 0.9, 0, 0.12, 0.13, 0.65); orbiters.push(o); }
  tone(440, 0.3, 'sine', 0.05, 880); nextWave();
}
function die() {
  state = 'dead'; keys.clear(); mouseHeld = false;
  clearBossArena(scene);
  for (const enemy of enemies) enemy.bossModel?.dispose();
  $('boss-hud').hidden = true;
  resetClassCombat(classProgress); classAura.visible = false;
  classProgress = createClassState(classProgress.id);
  for (const drop of drops) scene.remove(drop.object);
  drops = [];
  burst(player.position, 35, '#c1cecc'); player.visible = false;
  let best = wave; try { best = Math.max(wave, Number(localStorage.getItem('ashen-covenant-best')) || 0); localStorage.setItem('ashen-covenant-best', String(best)); } catch { /* Storage is optional. */ }
  $('death-stats').textContent = `You reached wave ${wave}, slew ${kills} demons, and claimed ${souls} souls in ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s.`;
  $('death-stats').textContent += ' Your wallet keeps ' + stats.gold + ' gold' + (walletSaved ? '.' : ' for this session.');
  $('best').textContent = `DEEPEST DESCENT · WAVE ${best}`; setPanel('death-panel'); updateHud();
}
function togglePause() {
  if (state === 'playing') { state = 'paused'; keys.clear(); mouseHeld = false; setPanel('pause-panel'); }
  else if (state === 'paused') { classPathOpen = false; state = 'playing'; setPanel(null); }
}
function updateHud() {
  if (stats.gold !== savedGold) persistGold();
  updateClassHud();
  updateExplorationHud();
  $('health-label').textContent = `${Math.ceil(stats.hp)} / ${stats.maxHp}`; $('health-fill').style.width = `${stats.hp / stats.maxHp * 100}%`;
  $('kills').textContent = kills; $('souls').textContent = souls; $('flasks').textContent = `ELIXIR · ${stats.flasks}`;
  $('nova-cd').style.height = `${Math.max(0, novaCd) / stats.novaDelay * 100}%`; $('dash-cd').style.height = `${Math.max(0, dashCd) / stats.dashDelay * 100}%`;
  $('nova').setAttribute('aria-label', `Soul Nova${novaCd > 0 ? `, ${Math.ceil(novaCd)} seconds remaining` : ', ready'}`);
  $('dash').setAttribute('aria-label', `Shadowstep${dashCd > 0 ? `, ${Math.ceil(dashCd)} seconds remaining` : ', ready'}`);
  $('status').textContent = stats.hp < stats.maxHp * 0.3 ? 'THE FLAME FALTERS · R TO HEAL' : 'THE LAST LIGHT IN THE DARK';
  if (wave) $('wave-detail').textContent = `${pending + spawns.length + enemies.filter(e => !e.dead).length + (bossPending ? 1 : 0)} DEMONS REMAINING`;
}
function shoot(enemy, direction, speed = 5) {
  const projectile = new THREE.Mesh(geo.sphere, materials.eye); projectile.scale.setScalar(0.16); projectile.position.copy(enemy.mesh.position); projectile.position.y = 0.8; scene.add(projectile);
  shots.push({ object: projectile, velocity: direction.clone().multiplyScalar(speed), life: 6, damage: enemy.damage });
}
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.frozen = Math.max(0, (e.frozen || 0) - dt);
    if (e.frozen > 0) continue;
    e.cooldown -= dt; e.slow = Math.max(0, e.slow - dt); e.stun = Math.max(0, e.stun - dt); e.special -= dt;
    const p = e.mesh.position, dx = player.position.x - p.x, dz = player.position.z - p.z, dist = Math.hypot(dx, dz), dir = new THREE.Vector3(dx, 0, dz).normalize();
    e.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
    let moving = false;
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        if (e.kind === 'caster') shoot(e, e.attackTarget.clone().sub(p).setY(0).normalize());
        else { flashRing(e.attackTarget, e.radius + 1.4, '#ef7650', 0.35); burst(e.attackTarget, 15, '#df8b4c'); if (player.position.distanceTo(e.attackTarget) < e.radius + 1.8) receiveDamage(e.damage); }
      }
    } else if (e.stun <= 0) {
      if (e.kind === 'caster') {
        if (dist > 9) { p.addScaledVector(dir, e.speed * dt); moving = true; }
        else if (dist < 5) { p.addScaledVector(dir, -e.speed * dt); moving = true; }
        if (e.cooldown <= 0 && dist < 14) { e.windup = 0.65; e.cooldown = 2.8; e.attackTarget.copy(player.position); flashRing(p, 1.2, '#e77655', 0.65); }
      } else if (dist > e.radius + 0.8) {
        p.addScaledVector(dir, e.speed * (e.slow > 0 ? 0.55 : 1) * dt); moving = true;
      } else if (e.cooldown <= 0) {
        e.cooldown = e.kind === 'imp' ? 1.1 : 1.7;
        if (e.kind === 'brute' || e.kind === 'boss') { e.windup = 0.8; e.attackTarget.copy(player.position); const tell = ring(scene, e.radius + 1.4, '#ff5744', 0.6); tell.position.x = e.attackTarget.x; tell.position.z = e.attackTarget.z; addEffect(tell, 0.8, (o, t) => { o.material.opacity = 0.2 + (1 - t) * 0.6; }); }
        else { receiveDamage(e.damage); e.mesh.position.addScaledVector(dir, -0.3); }
      }
    }
    if (state !== 'playing') return;
    if (e.kind === 'boss') {
      $('boss-fill').style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
      if (e.special <= 0) { e.special = 5; flashRing(p, 3, '#ff6b44'); for (let i = 0; i < 12; i++) shoot(e, new THREE.Vector3(Math.sin(i * TAU / 12), 0, Math.cos(i * TAU / 12)), 4); }
    }
    // Bounded local crowd separation prevents enemies collapsing into one hitbox.
    for (const other of enemies) {
      if (other === e || other.dead) continue;
      const ox = p.x - other.mesh.position.x, oz = p.z - other.mesh.position.z, d = Math.hypot(ox, oz), minimum = (e.radius + other.radius) * 0.65;
      if (d > 0.01 && d < minimum) { p.x += ox / d * dt; p.z += oz / d * dt; }
    }
    resolveScenery(p, e.radius * 0.6);
    if (e.bossModel) {
      e.bossModel.idle(timer);
      e.bossModel.swing(e.windup > 0 ? 1 - e.windup / 0.8 : 0);
    } else {
      e.mesh.userData.leftLeg.rotation.x = moving ? Math.sin(timer * 10 + p.x) * 0.45 : 0;
      e.mesh.userData.rightLeg.rotation.x = -e.mesh.userData.leftLeg.rotation.x;
    }
    e.mesh.position.y = e.stun > 0 ? Math.sin(e.stun * 35) * 0.06 : 0;
  }
  enemies = enemies.filter(e => !e.dead);
}
function updatePlaying(dt) {
  elapsed += dt; attackCd -= dt; novaCd = Math.max(0, novaCd - dt); dashCd = Math.max(0, dashCd - dt); invulnerable = Math.max(0, invulnerable - dt); attackAnim = Math.max(0, attackAnim - dt);
  move.set((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystick.x, 0, (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + joystick.y);
  // Keyboard/joystick input takes priority while used; the held pointer resumes afterward.
  if (touchpadMove && mouseHeld && pointerSeen && move.lengthSq() < 0.0001) {
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) {
      const dx = aimPoint.x - player.position.x, dz = aimPoint.z - player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.15) {
        // Ease into the target like an analog stick, with a dead zone and no overshoot.
        const strength = Math.min(1, distance / 1.5, (distance - 0.12) / (stats.speed * Math.max(dt, 0.001)));
        move.set(dx / distance * strength, 0, dz / distance * strength);
      }
    }
  }
  if (move.length() > 1) move.normalize();
  if (dashTime > 0) { dashTime -= dt; player.position.addScaledVector(dashDirection, dt * 27); if (Math.random() < 0.5) burst(player.position, 2, '#9cd8ec', 0.5); }
  else player.position.addScaledVector(move, dt * stats.speed);
  resolveScenery(player.position);
  let nearest = null, nearestDistance = Infinity;
  for (const e of enemies) { if (e.dead) continue; const d = e.mesh.position.distanceTo(player.position); if (d < nearestDistance) { nearestDistance = d; nearest = e; } }
  if (mouseHeld && pointerSeen && !touchpadMove) { raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) aim = Math.atan2(aimPoint.x - player.position.x, -(aimPoint.z - player.position.z)); }
  else if (autoAttack && nearest && nearestDistance < weaponStats(stats, equippedWeapon).range + 2) aim = Math.atan2(nearest.mesh.position.x - player.position.x, -(nearest.mesh.position.z - player.position.z));
  else if (move.lengthSq() > 0.01) aim = Math.atan2(move.x, -move.z);
  player.rotation.y = -aim;
  player.userData.leftLeg.rotation.x = move.lengthSq() > 0.01 ? Math.sin(timer * 13) * 0.6 : 0;
  player.userData.rightLeg.rotation.x = -player.userData.leftLeg.rotation.x;
  player.userData.cape.rotation.x = -0.18 + Math.sin(timer * 9) * 0.06 + move.length() * -0.25;
  player.userData.sword.rotation.y = attackAnim > 0 ? Math.sin((1 - attackAnim / 0.23) * Math.PI) * 1.8 - 0.7 : 0;
  player.visible = invulnerable > 0 ? Math.sin(timer * 50) > -0.5 : true;
  if ((mouseHeld && !touchpadMove) || (autoAttack && nearest && nearestDistance < weaponStats(stats, equippedWeapon).range + nearest.radius)) rend();
  if (keys.has('KeyQ')) nova(); if (keys.has('Space')) dash(); if (keys.has('KeyR')) useElixir();
  tickClassCombat(classProgress, dt, classContext());
  spawnClock -= dt;
  if (spawnClock <= 0 && enemies.length + spawns.length < MAX_ACTIVE_ENEMIES) {
    if (bossPending) { prepareSpawn('boss'); bossPending = false; spawnClock = 1.8; }
    else if (pending > 0) { prepareSpawn(enemyKind(wave, Math.random())); pending--; spawnClock = config.spawnDelay; }
  }
  for (let i = spawns.length - 1; i >= 0; i--) { const s = spawns[i]; s.life -= dt; s.object.material.opacity = 0.3 + Math.sin(timer * 12) * 0.2; if (s.life <= 0) { spawnEnemy(s.kind, s.position); disposeObject(s.object); spawns.splice(i, 1); } }
  updateEnemies(dt);
  if (state !== 'playing') return;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; s.object.position.addScaledVector(s.velocity, dt);
    if (Math.hypot(s.object.position.x - player.position.x, s.object.position.z - player.position.z) < 0.7) { receiveDamage(s.damage); s.life = 0; }
    if (s.life <= 0) { disposeObject(s.object); shots.splice(i, 1); }
  }
  orbiters.forEach((o, i) => {
    const a = timer * 2.5 + i * TAU / orbiters.length; o.position.set(player.position.x + Math.sin(a) * 2.5, 0.8, player.position.z + Math.cos(a) * 2.5); o.rotation.y = a;
    for (const e of enemies) if (!e.dead && e.mesh.position.distanceTo(o.position) < e.radius + 0.65 && (e.orbitHit || 0) < timer) { e.orbitHit = timer + 0.45; damageEnemy(e, stats.damage * 0.7); }
  });
  if (state === 'playing') updateDrops(dt);
  if (state === 'playing' && pending === 0 && !bossPending && spawns.length === 0 && enemies.every(e => e.dead)) clearWave();
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i]; e.life -= dt; if (e.life <= 0) { disposeObject(e.object); effects.splice(i, 1); } else e.update(e.object, e.life / e.max); }
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.velocity.y -= dt * 12; p.object.position.addScaledVector(p.velocity, dt); p.object.scale.setScalar(Math.max(0.1, p.life * 2)); if (p.life <= 0 || p.object.position.y < 0) { disposeObject(p.object); particles.splice(i, 1); } }
}
function classPathMarkup(progress, preview = false) {
  return getClass(progress.id).abilities.map((a, slot) => {
    const unlocked = !preview && abilityStatus(progress, slot) !== 'locked';
    return `<article class="path-ability${unlocked ? ' unlocked' : ''}"><span class="path-icon">${a.icon}</span><div><span class="eyebrow">${unlocked ? 'UNLOCKED' : `CLEAR WAVE ${a.wave}`} · ${a.cooldown}s RECHARGE</span><h3><kbd>${a.key}</kbd> ${a.name}</h3><p>${a.description}</p></div></article>`;
  }).join('');
}
function chooseClass() {
  state = 'class-select'; keys.clear(); mouseHeld = false; classPathOpen = false;
  document.body.classList.remove('playing');
  const container = $('class-choices'); container.replaceChildren();
  for (const archetype of CLASSES) {
    const button = document.createElement('button'); button.className = 'class-choice'; button.dataset.classId = archetype.id;
    button.style.setProperty('--class-color', archetype.color);
    button.innerHTML = `<span>${archetype.icon}</span><b>${archetype.name}</b><small>${archetype.role}</small>`;
    button.onclick = () => selectClass(archetype.id); container.appendChild(button);
  }
  selectClass(selectedClass); setPanel('class-panel');
}
function selectClass(id) {
  selectedClass = getClass(id).id;
  for (const button of $('class-choices').children) button.setAttribute('aria-pressed', String(button.dataset.classId === selectedClass));
  $('class-preview').innerHTML = classPathMarkup(createClassState(selectedClass), true);
  $('class-start').textContent = `ENTER AS ${getClass(selectedClass).name.toUpperCase()} →`;
}
function renderClassSlots() {
  const archetype = getClass(classProgress.id); const container = $('class-slots'); container.replaceChildren();
  $('class-hud').style.setProperty('--class-color', archetype.color);
  $('class-info').innerHTML = `${archetype.name.toUpperCase()} · CLASS PATH <kbd>K</kbd>`;
  archetype.abilities.forEach((a, slot) => {
    const button = document.createElement('button'); button.className = 'ability class-ability'; button.id = `class-slot-${slot}`;
    button.innerHTML = `<kbd>${a.key}</kbd><span class="ability-glyph">${a.icon}</span><small>${a.name.toUpperCase()}</small><span class="class-state"></span><i class="cooldown"></i>`;
    button.onclick = () => useClassAbility(slot); container.appendChild(button);
  });
  updateClassHud();
}
function updateClassHud() {
  getClass(classProgress.id).abilities.forEach((a, slot) => {
    const button = $(`class-slot-${slot}`); if (!button) return;
    const status = abilityStatus(classProgress, slot), locked = status === 'locked';
    button.disabled = status !== 'ready' || state !== 'playing'; button.classList.toggle('locked', locked);
    const label = locked ? `CLEAR WAVE ${a.wave}` : status === 'cooldown' ? `${Math.ceil(classProgress.cooldowns[slot])}s` : 'READY';
    button.querySelector('.class-state').textContent = label;
    button.querySelector('.cooldown').style.height = `${classProgress.cooldowns[slot] / a.cooldown * 100}%`;
    button.title = `${a.name} [${a.key}] — ${a.description} ${label}`;
    button.setAttribute('aria-label', `${a.name}, ${a.key}, ${label}`);
  });
  const buffs = [];
  if (classProgress.guard > 0) buffs.push(`IRON SKIN ${Math.ceil(classProgress.guard)}s`);
  if (classProgress.shield > 0) buffs.push(`BARRIER ${Math.ceil(classProgress.shield)}`);
  if (classProgress.channel) buffs.push(`${classProgress.channel.ability.name.toUpperCase()} ${Math.ceil(classProgress.channel.remaining)}s`);
  $('class-buff').textContent = buffs.join(' · ');
}
function showClassPath() {
  if (state !== 'playing' && state !== 'paused') return;
  state = 'paused'; classPathOpen = true; keys.clear(); mouseHeld = false;
  $('class-path-title').textContent = `${getClass(classProgress.id).name} · Class path`;
  $('class-path').innerHTML = classPathMarkup(classProgress); setPanel('class-path-panel');
}
function classContext() {
  return {
    stats: { ...stats, damage: weaponStats(stats, equippedWeapon).damage }, position: player.position, aim,
    targets: () => enemies.filter(e => !e.dead).map(e => ({ enemy: e, position: e.mesh.position, radius: e.radius })),
    hit: (target, amount, freeze) => {
      damageEnemy(target.enemy, amount, false, freeze > 0);
      if (freeze && !target.enemy.dead) target.enemy.frozen = Math.max(target.enemy.frozen || 0, target.enemy.kind === 'boss' ? 1 : freeze);
    },
    heal: amount => { if (amount > 0) heal(stats, amount); },
    targetPoint: () => {
      if (pointerSeen && !coarse) { raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) return aimPoint; }
      const nearest = enemies.filter(e => !e.dead).sort((a, b) => a.mesh.position.distanceTo(player.position) - b.mesh.position.distanceTo(player.position))[0];
      return nearest ? nearest.mesh.position : { x: player.position.x + Math.sin(aim) * 8, z: player.position.z - Math.cos(aim) * 8 };
    },
    visual: classVisual,
  };
}
function useClassAbility(slot) {
  if (state !== 'playing') return;
  if (pointerSeen && !coarse) {
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) aim = Math.atan2(aimPoint.x - player.position.x, -(aimPoint.z - player.position.z));
  }
  const ability = castClassAbility(classProgress, slot, classContext());
  if (ability) { tone(ability.id === 'meteor' ? 100 : 260, 0.25, 'triangle', 0.04, 60); updateClassHud(); }
}
function classVisual(event, ability, point) {
  const position = new THREE.Vector3(point.x, 0, point.z), color = getClass(classProgress.id).color;
  if (ability.id === 'meteor') {
    if (event === 'cast') {
      const tell = ring(scene, ability.radius, '#ee9957', 0.65); tell.position.copy(position); tell.position.y = 0.12;
      addEffect(tell, 0.8, (o, t) => { o.material.opacity = 0.3 + (1 - t) * 0.6; });
      const meteor = new THREE.Mesh(geo.ico, new THREE.MeshBasicMaterial({ color: '#ffc17b' })); meteor.position.copy(position); meteor.scale.setScalar(0.7);
      addEffect(meteor, 0.8, (o, t) => { o.position.y = 14 * t; o.rotation.x += 0.1; o.rotation.z += 0.1; });
    } else { flashRing(position, ability.radius, '#ffb16a'); burst(position, 32, '#ffc17b', 1.8); shake = Math.max(shake, 0.3); tone(60, 0.35, 'sawtooth', 0.045, 18); }
    return;
  }
  if (ability.id === 'hellfire-lance') {
    const end = position.clone().add(new THREE.Vector3(Math.sin(aim) * ability.range, 0, -Math.cos(aim) * ability.range));
    lightning(position, end); flashRing(end, 1.5, '#f7af72', 0.3);
    const beam = new THREE.Mesh(geo.box, new THREE.MeshBasicMaterial({ color: '#ffc88c', transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.copy(position).lerp(end, 0.5); beam.position.y = 0.8; beam.rotation.y = -aim; beam.scale.set(0.65, 0.5, ability.range);
    addEffect(beam, 0.3, (o, t) => { o.material.opacity = t * 0.65; });
  } else {
    flashRing(position, ability.radius || 2, ability.id === 'frost-prison' ? '#a2e8ff' : color, event === 'pulse' ? 0.3 : 0.55);
    if (event === 'cast') burst(position, 16, color);
  }
}
function updateClassAura() {
  const active = classProgress.guard > 0 || classProgress.shield > 0 || classProgress.channel;
  classAura.visible = !!active && (state === 'playing' || state === 'paused');
  if (!active) return;
  classAura.position.set(player.position.x, 0.15, player.position.z);
  classAura.scale.setScalar(classProgress.channel?.ability.radius || 1.4);
  classAura.material.color.set(getClass(classProgress.id).color);
  classAura.material.opacity = 0.4 + Math.sin(timer * 5) * 0.15;
}
$('interact').onclick = interact;
$('start').onclick = chooseClass; $('restart').onclick = chooseClass; $('resume').onclick = togglePause; $('pause').onclick = togglePause;
$('class-start').onclick = startRun;
$('class-info').onclick = showClassPath;
$('class-back').onclick = togglePause;
$('nova').onclick = nova; $('dash').onclick = dash; $('heal').onclick = useElixir; $('attack').onclick = rend;
$('auto').onclick = () => { autoAttack = !autoAttack; $('auto').classList.toggle('active', autoAttack); $('auto').setAttribute('aria-pressed', String(autoAttack)); };
$('touchpad-move').onclick = () => {
  releaseMovementPointer();
  touchpadMove = !touchpadMove;
  $('touchpad-move').classList.toggle('active', touchpadMove);
  $('touchpad-move').setAttribute('aria-pressed', String(touchpadMove));
  $('touchpad-move-label').textContent = `TOUCHPAD MOVE [${touchpadMove ? 'ON' : 'OFF'}]`;
  $('movement-hint').textContent = touchpadMove ? 'HOLD / DRAG TO MOVE · WASD ALSO WORKS' : 'WASD TO MOVE · MOUSE TO AIM';
  $('attack').title = touchpadMove ? 'Click a nearby demon to rend, or use Auto-Rend' : 'Hold left mouse to attack';
};
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && state === 'playing') e.preventDefault();
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'Escape' && !e.repeat) togglePause();
  if (e.code === 'KeyK' && !e.repeat) { if (classPathOpen) togglePause(); else showClassPath(); }
  if (!e.repeat && CLASS_KEYS.includes(e.code)) useClassAbility(CLASS_KEYS.indexOf(e.code));
  if (state === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) selectBlessing(Number(e.code.slice(-1)) - 1);
  if (state === 'playing') keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
function updateMovementPointer(e) {
  pointerSeen = true;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1);
}
function releaseMovementPointer() {
  const id = pointerGesture?.id;
  pointerGesture = null; mouseHeld = false;
  if (id !== undefined && renderer.domElement.hasPointerCapture(id)) renderer.domElement.releasePointerCapture(id);
}
function enemyAtPointer() {
  raycaster.setFromCamera(pointer, camera);
  const living = enemies.filter(e => !e.dead);
  const hit = raycaster.intersectObjects(living.map(e => e.mesh), true)[0];
  if (!hit) return null;
  let object = hit.object;
  while (object && object.parent !== scene) object = object.parent;
  return living.find(e => e.mesh === object) || null;
}
renderer.domElement.addEventListener('pointermove', e => {
  if (pointerGesture && pointerGesture.id !== e.pointerId) return;
  updateMovementPointer(e);
  if (pointerGesture) {
    pointerGesture.dragged ||= Math.hypot(e.clientX - pointerGesture.x, e.clientY - pointerGesture.y) > 8;
    if ((e.buttons & 1) === 0) releaseMovementPointer();
  }
});
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.isPrimary === false || state !== 'playing' || (e.pointerType === 'touch' && !touchpadMove) || pointerGesture) return;
  e.preventDefault(); updateMovementPointer(e); mouseHeld = true;
  pointerGesture = { id: e.pointerId, x: e.clientX, y: e.clientY, started: performance.now(), dragged: false };
  renderer.domElement.setPointerCapture(e.pointerId);
});
addEventListener('pointerup', e => {
  if (pointerGesture?.id !== e.pointerId || e.button !== 0) return;
  const gesture = pointerGesture;
  updateMovementPointer(e); releaseMovementPointer();
  const tapped = !gesture.dragged && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= 8 && performance.now() - gesture.started < 300;
  if (!touchpadMove || !tapped || state !== 'playing') return;
  const target = enemyAtPointer();
  if (target && target.mesh.position.distanceTo(player.position) < weaponStats(stats, equippedWeapon).range + target.radius) {
    aim = Math.atan2(target.mesh.position.x - player.position.x, -(target.mesh.position.z - player.position.z));
    player.rotation.y = -aim; rend();
  }
});
for (const event of ['pointercancel', 'lostpointercapture']) renderer.domElement.addEventListener(event, e => {
  if (pointerGesture?.id === e.pointerId) releaseMovementPointer();
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
function resetInput() { keys.clear(); releaseMovementPointer(); joystick.x = joystick.y = 0; joystick.id = null; $('joystick').firstElementChild.style.transform = ''; if (state === 'playing') togglePause(); }
addEventListener('blur', resetInput); document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
const stick = $('joystick');
function moveStick(e) { const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 28, y = (e.clientY - r.top - r.height / 2) / 28; const l = Math.max(1, Math.hypot(x, y)); x /= l; y /= l; joystick.x = x; joystick.y = y; stick.firstElementChild.style.transform = `translate(${x * 24}px,${y * 24}px)`; }
stick.addEventListener('pointerdown', e => { joystick.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (joystick.id === e.pointerId) moveStick(e); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(name, () => { joystick.id = null; joystick.x = joystick.y = 0; stick.firstElementChild.style.transform = ''; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); resetInput(); $('error-message').textContent = 'The graphics context was interrupted. Reload to relight the sanctum.'; setPanel('error-panel'); });

const clock = new THREE.Clock(); let hudClock = 0;
function animate() {
  requestAnimationFrame(animate);
  const realDt = Math.min(clock.getDelta(), 0.04); let dt = realDt;
  if (state === 'paused' || state === 'upgrade') dt = 0;
  timer += dt;
  if (hitStop > 0) { hitStop -= dt; dt *= 0.12; }
  if (state === 'playing') updatePlaying(dt);
  updateEffects(dt);
  for (const chest of chests) if (chest.opened) chest.lid.rotation.x = Math.min(1.9, chest.lid.rotation.x + dt * 5);
  for (const f of flames) f.mesh.scale.y = f.base * (1 + Math.sin(timer * 9 + f.phase) * 0.2);
  if (state === 'intro') {
    cameraTarget.set(-3.5, 0, -0.5); cameraOffset.set(0, 25, 25);
    player.rotation.y = -0.3; player.userData.cape.rotation.x = -0.18 + Math.sin(timer * 2) * 0.05;
  } else {
    cameraTarget.lerp(new THREE.Vector3(player.position.x, 0, player.position.z), 1 - Math.exp(-realDt * 4));
    cameraOffset.set(0, innerWidth < 700 ? 30 : 23, innerWidth < 700 ? 26 : 20);
  }
  camera.position.copy(cameraTarget).add(cameraOffset);
  shake = Math.max(0, shake - realDt * 1.5);
  if (!reducedMotion && shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.z += (Math.random() - 0.5) * shake; }
  camera.lookAt(cameraTarget);
  playerLight.position.set(player.position.x, 2.5, player.position.z); playerRing.position.set(player.position.x, 0.03, player.position.z);
  updateClassAura();
  soulGlow.material.opacity = 0.15 + Math.sin(timer * 3) * 0.03;
  hudClock += realDt; if (hudClock > 0.1) { updateHud(); hudClock = 0; }
  renderer.render(scene, camera);
}
animate();
