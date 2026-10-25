import test from 'node:test';
import assert from 'node:assert/strict';
import { createStats, waveConfig, enemyKind, chooseBlessings, BLESSINGS, heal, constrainPosition, ARENA_RADIUS } from '../dist/rules.js';

test('waves escalate and introduce a boss every fifth wave', () => {
  for (let wave = 1; wave <= 100; wave++) {
    const current = waveConfig(wave), next = waveConfig(wave + 1);
    assert.ok(next.count > current.count);
    assert.ok(next.health > current.health);
    assert.equal(current.boss, wave % 5 === 0);
    assert.ok(current.spawnDelay >= 0.18);
  }
});
test('early waves do not introduce advanced enemy types', () => {
  assert.equal(enemyKind(1, 0.99), 'stalker');
  assert.equal(enemyKind(2, 0.99), 'caster');
  assert.equal(enemyKind(3, 0.99), 'brute');
});
test('each reward offers three distinct eligible blessings without mutating the catalog', () => {
  const stats = createStats(); stats.orbit = 4; stats.range = 7;
  const ids = BLESSINGS.map(b => b.id);
  for (let i = 0; i < 100; i++) {
    const choices = chooseBlessings(stats);
    assert.equal(new Set(choices.map(b => b.id)).size, 3);
    assert.ok(choices.every(b => !['orbit', 'reach'].includes(b.id)));
  }
  assert.deepEqual(BLESSINGS.map(b => b.id), ids);
});
test('healing and vitality never exceed maximum health', () => {
  const stats = createStats(); stats.hp = 90; heal(stats, 50); assert.equal(stats.hp, 100);
  BLESSINGS.find(b => b.id === 'vitality').apply(stats);
  assert.equal(stats.hp, 130); assert.equal(stats.maxHp, 130);
});
test('stacking cooldown and speed blessings keeps combat bounded', () => {
  const stats = createStats();
  for (let i = 0; i < 200; i++) {
    BLESSINGS.find(b => b.id === 'haste').apply(stats);
    BLESSINGS.find(b => b.id === 'dash').apply(stats);
  }
  assert.ok(stats.attackDelay >= 0.12); assert.ok(stats.speed <= 10);
  assert.ok(stats.dashDelay >= 0.8); assert.ok(stats.novaDelay >= 3);
});
test('arena confinement handles center, edges and diagonal movement', () => {
  for (const position of [{ x: 0, z: 0 }, { x: 100, z: 100 }, { x: -30, z: 0 }]) {
    constrainPosition(position);
    assert.ok(Math.hypot(position.x, position.z) <= ARENA_RADIUS + 1e-9);
    assert.ok(Number.isFinite(position.x));
  }
});
test('new runs start with independent stats', () => {
  const first = createStats(); first.hp = 0; first.orbit = 4;
  assert.equal(createStats().hp, 100); assert.equal(createStats().orbit, 0);
});
