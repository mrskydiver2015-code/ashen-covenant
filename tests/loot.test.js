import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWeapon, weaponStats, rollLoot, loadWallet, saveWallet, normalizeGold, WALLET_KEY, MAX_GOLD } from '../dist/loot.js';
import { createStats, BLESSINGS, buyHealing, openChest, createChests } from '../dist/rules.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../dist/vendor/three.module.js';
import * as lootRules from '../dist/loot.js';
import { constrainPosition } from '../dist/rules.js';

function runtime() {
  const source = readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8');
  const data = new Map(), player = new THREE.Group();
  player.userData.sword = new THREE.Group(); player.add(player.userData.sword);
  const material = new THREE.MeshBasicMaterial();
  const context = vm.createContext({ ...lootRules, THREE, constrainPosition, Math,
    stats: createStats(), drops: [], equippedWeapon: makeWeapon(), player, scene: new THREE.Scene(),
    state: 'playing', timer: 0, TAU: Math.PI * 2, walletSaved: true, savedGold: 0,
    walletStorage: { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) },
    materials: { gold: material, bone: material, blade: material, blue: material },
    geo: { box: new THREE.BoxGeometry(), oct: new THREE.OctahedronGeometry(), cylinder: new THREE.CylinderGeometry() },
    mesh(parent, geometry, material) { const m = new THREE.Mesh(geometry, material); parent.add(m); return m; },
    floating() {}, tone() {}, announce() {}, updateHud() {},
  });
  vm.runInContext(source.slice(source.indexOf('function persistGold()'), source.indexOf('function startRun()')), context);
  return context;
}

test('game pickup credits a nearby gold drop exactly once and saves immediately', () => {
  const game = runtime();
  game.spawnDrop({ type: 'gold', amount: 12 }, new THREE.Vector3());
  game.spawnDrop({ type: 'gold', amount: 30 }, new THREE.Vector3(10, 0, 0));
  game.updateDrops(0.016); game.updateDrops(0.016);
  assert.equal(game.stats.gold, 12); assert.equal(game.drops.length, 1);
  assert.equal(loadWallet(game.walletStorage), 12);
});
test('game weapon swap leaves previous equipment and blocks swaps when paused', () => {
  const game = runtime(), original = { ...game.stats };
  game.spawnDrop({ type: 'weapon', weapon: makeWeapon('axe', 2) }, new THREE.Vector3());
  game.equipDrop(game.nearbyWeapon());
  assert.equal(game.equippedWeapon.id, 'axe'); assert.equal(game.drops.length, 1);
  assert.equal(game.drops[0].weapon.id, 'sword'); assert.deepEqual(game.stats, original);
  game.state = 'paused'; game.equipDrop(game.drops[0]); assert.equal(game.equippedWeapon.id, 'axe');
  game.state = 'playing'; game.equipDrop(game.drops[0]); assert.equal(game.equippedWeapon.id, 'sword');
});
test('ground drop limit preserves gold value even when a weapon arrives at capacity', () => {
  const game = runtime();
  for (let i = 0; i < 200; i++) game.spawnDrop({ type: 'gold', amount: 5 }, new THREE.Vector3(10, 0, 0));
  game.spawnDrop({ type: 'weapon', weapon: makeWeapon('spear', 3) }, new THREE.Vector3());
  assert.equal(game.drops.length, 80); assert.equal(game.scene.children.length, 80);
  assert.equal(game.drops.reduce((sum, d) => sum + (d.amount || 0), 0), 1000);
});

test('every kill drops gold; first kill and bosses guarantee equipment', () => {
  for (const kind of ['imp', 'stalker', 'caster', 'brute', 'boss']) {
    const drops = rollLoot(kind, 5, () => 0.99);
    assert.ok(drops[0].amount > 0);
    assert.equal(drops.length, kind === 'boss' ? 2 : 1);
  }
  assert.equal(rollLoot('imp', 1, () => 0.99, true)[1].type, 'weapon');
  assert.equal(rollLoot('imp', 1, () => 0.15).length, 2);
  assert.equal(rollLoot('imp', 1, () => 0.16).length, 1);
  assert.equal(rollLoot('boss', 100, () => 0.99)[1].weapon.tier, 3);
});
test('weapons change combat without modifying blessings or stacking on swaps', () => {
  const stats = createStats(), sword = makeWeapon(), dagger = makeWeapon('dagger'), axe = makeWeapon('axe'), spear = makeWeapon('spear');
  const original = { ...stats };
  assert.ok(weaponStats(stats, dagger).attackDelay < stats.attackDelay);
  assert.ok(weaponStats(stats, axe).damage > stats.damage);
  assert.ok(weaponStats(stats, spear).range > stats.range);
  for (let i = 0; i < 100; i++) { weaponStats(stats, axe); weaponStats(stats, sword); }
  assert.deepEqual(stats, original);
  BLESSINGS.find(b => b.id === 'might').apply(stats);
  assert.equal(weaponStats(stats, sword).damage, original.damage * 1.3);
  stats.attackDelay = 0.12;
  assert.equal(weaponStats(stats, dagger).attackDelay, 0.12);
});
test('wallet retains chest income and spending through reload and new run', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  const stats = createStats(); stats.gold = 50;
  openChest(createChests()[0], stats); stats.hp = 30;
  assert.ok(buyHealing(stats)); assert.equal(stats.gold, 40);
  assert.ok(saveWallet(storage, stats.gold));
  const nextRun = createStats(); nextRun.gold = loadWallet(storage);
  assert.equal(nextRun.gold, 40); assert.equal(nextRun.hp, 100);
  nextRun.gold = 29; nextRun.hp = 20;
  assert.equal(buyHealing(nextRun), false); assert.equal(nextRun.gold, 29);
  data.set(WALLET_KEY, 'corrupt'); assert.equal(loadWallet(storage), 0);
});
test('wallet rejects invalid balances and safely handles denied storage', () => {
  for (const value of [-1, Infinity, NaN, 'invalid']) assert.equal(normalizeGold(value), 0);
  assert.equal(normalizeGold(3.9), 3); assert.equal(normalizeGold(1e20), MAX_GOLD);
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(loadWallet(denied), 0); assert.equal(saveWallet(denied, 42), false);
});
