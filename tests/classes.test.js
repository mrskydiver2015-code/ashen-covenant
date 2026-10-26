import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, createClassState, unlockClassWave, abilityStatus, castClassAbility, tickClassCombat, absorbClassDamage, resetClassCombat } from '../dist/classes.js';

function arena(targets = [{ x: 0, z: -3 }, { x: 2, z: -2 }, { x: 20, z: 20 }]) {
  const hits = [], visuals = [];
  const stats = { hp: 40, maxHp: 100, damage: 20 };
  const context = {
    stats, position: { x: 0, z: 0 }, aim: 0,
    targets: () => targets.map((position, id) => ({ position, id, radius: 0.5 })),
    hit: (target, damage, freeze) => hits.push({ id: target.id, damage, freeze }),
    heal: amount => { stats.hp = Math.min(stats.maxHp, stats.hp + amount); },
    targetPoint: () => ({ x: 0, z: -3 }),
    visual: (event, ability, position) => visuals.push({ event, id: ability.id, position }),
  };
  return { context, hits, visuals, stats };
}

test('all classes unlock exactly on completed waves 1, 3 and 5', () => {
  for (const archetype of CLASSES) {
    const progress = createClassState(archetype.id);
    for (let wave = 0; wave <= 6; wave++) {
      const unlocked = unlockClassWave(progress, wave);
      assert.equal(unlocked.length, [1, 3, 5].includes(wave) ? 1 : 0);
      archetype.abilities.forEach((a, slot) => assert.equal(abilityStatus(progress, slot), wave >= a.wave ? 'ready' : 'locked'));
      assert.deepEqual(unlockClassWave(progress, wave), []);
    }
  }
});
test('locked abilities and cooldowns cannot be bypassed by repeated casts', () => {
  const p = createClassState(), { context, hits } = arena();
  assert.equal(castClassAbility(p, 0, context), null); assert.equal(hits.length, 0);
  unlockClassWave(p, 1); castClassAbility(p, 0, context); const count = hits.length;
  assert.equal(castClassAbility(p, 0, context), null); assert.equal(hits.length, count);
  tickClassCombat(p, 0, context); assert.equal(p.cooldowns[0], 7);
  tickClassCombat(p, 7, context); assert.equal(abilityStatus(p, 0), 'ready');
  assert.equal(castClassAbility(p, 99, context), null);
});
test('blood cleave deals radial damage, heals only for targets hit and caps healing', () => {
  const p = createClassState(); unlockClassWave(p, 1);
  const { context, hits, stats } = arena(); castClassAbility(p, 0, context);
  assert.deepEqual(hits.map(h => h.id), [0, 1]); assert.equal(hits[0].damage, 44); assert.equal(stats.hp, 46);
  const empty = arena([]); resetClassCombat(p); castClassAbility(p, 0, empty.context); assert.equal(empty.stats.hp, 40);
  const crowd = arena(Array.from({ length: 20 }, () => ({ x: 0, z: -2 })));
  resetClassCombat(p); castClassAbility(p, 0, crowd.context); assert.equal(crowd.stats.hp, 55);
});
test('iron skin mitigates damage and expires on the simulation clock', () => {
  const p = createClassState(), { context } = arena(); unlockClassWave(p, 3); castClassAbility(p, 1, context);
  assert.equal(absorbClassDamage(p, 50), 20); tickClassCombat(p, 6, context); assert.equal(absorbClassDamage(p, 50), 50);
});
test('whirlwind ticks exactly ten times and does not tick while paused', () => {
  const p = createClassState(), { context, hits } = arena([{ x: 0, z: -2 }]); unlockClassWave(p, 5); castClassAbility(p, 2, context);
  tickClassCombat(p, 0, context); assert.equal(hits.length, 0);
  for (let i = 0; i < 100; i++) tickClassCombat(p, 0.04, context);
  assert.equal(hits.length, 10); assert.equal(hits[0].damage, 11); assert.equal(p.channel, null);
});
test('lance pierces enemies in its aiming line and excludes side and rear targets', () => {
  const p = createClassState('arcanist'), { context, hits } = arena([{ x: 0, z: -3 }, { x: 0, z: -9 }, { x: 3, z: -3 }, { x: 0, z: 3 }]);
  unlockClassWave(p, 1); castClassAbility(p, 0, context);
  assert.deepEqual(hits.map(h => h.id), [0, 1]); assert.equal(hits[0].damage, 50);
});
test('frost prison freezes nearby enemies and does not affect distant targets', () => {
  const p = createClassState('arcanist'), { context, hits } = arena(); unlockClassWave(p, 3); castClassAbility(p, 1, context);
  assert.equal(hits.length, 2); assert.ok(hits.every(h => h.freeze === 2.5));
});
test('meteor has a delayed, range-limited impact at its captured target', () => {
  const p = createClassState('arcanist'), a = arena([{ x: 0, z: -12 }, { x: 0, z: 0 }]);
  a.context.targetPoint = () => ({ x: 0, z: -100 }); unlockClassWave(p, 5); castClassAbility(p, 2, a.context);
  assert.equal(p.meteors[0].position.z, -12); assert.equal(a.hits.length, 0);
  tickClassCombat(p, 0.4, a.context); assert.equal(a.hits.length, 0);
  tickClassCombat(p, 0.4, a.context); assert.deepEqual(a.hits.map(h => h.id), [0]); assert.equal(a.hits[0].damage, 120);
  tickClassCombat(p, 1, a.context); assert.equal(a.hits.length, 1);
});
test('judgment healing scales with maximum health and targets hit', () => {
  const p = createClassState('warden'), a = arena(); a.stats.maxHp = 200;
  unlockClassWave(p, 1); castClassAbility(p, 0, a.context); assert.equal(a.stats.hp, 48); assert.equal(a.hits[0].damage, 36);
});
test('aegis absorbs damage, passes overflow through and expires', () => {
  const p = createClassState('warden'), a = arena(); unlockClassWave(p, 3); castClassAbility(p, 1, a.context);
  assert.equal(absorbClassDamage(p, 25), 0); assert.equal(p.shield, 15);
  assert.equal(absorbClassDamage(p, 25), 10); assert.equal(p.shield, 0);
  resetClassCombat(p); castClassAbility(p, 1, a.context); tickClassCombat(p, 8, a.context); assert.equal(p.shield, 0);
});
test('sanctuary pulses seven times and follows the player', () => {
  const p = createClassState('warden'), a = arena([{ x: 10, z: 0 }]); unlockClassWave(p, 5); castClassAbility(p, 2, a.context);
  a.context.position.x = 10; tickClassCombat(p, 7, a.context);
  assert.equal(a.hits.length, 7); assert.equal(a.stats.hp, 61); assert.equal(p.channel, null);
});
test('wave cleanup preserves unlocks but cancels pending effects; new runs reset everything', () => {
  const p = createClassState('arcanist'), a = arena(); unlockClassWave(p, 5); castClassAbility(p, 2, a.context);
  resetClassCombat(p); tickClassCombat(p, 2, a.context); assert.equal(a.hits.length, 0);
  assert.equal(abilityStatus(p, 2), 'ready');
  const next = createClassState('warden'); assert.equal(abilityStatus(next, 2), 'locked'); assert.equal(next.shield, 0); assert.deepEqual(next.cooldowns, [0, 0, 0]);
});
