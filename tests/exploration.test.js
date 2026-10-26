import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_RADIUS, createStats, createChests, openChest, buyHealing, REGIONS } from '../dist/rules.js';

test('all districts and twelve unique chests fit inside the expanded world', () => {
  assert.ok(ARENA_RADIUS >= 34);
  const chests = createChests();
  assert.equal(chests.length, 12);
  assert.equal(new Set(chests.map(c => `${c.x},${c.z}`)).size, 12);
  for (const p of [...chests, ...REGIONS]) assert.ok(Math.hypot(p.x, p.z) < ARENA_RADIUS - 2.5);
});
test('each chest grants gold and useful loot only once', () => {
  const stats = createStats();
  for (const chest of createChests()) {
    const before = stats.gold;
    assert.ok(openChest(chest, stats).name);
    assert.ok(stats.gold > before);
    const after = { ...stats };
    assert.equal(openChest(chest, stats), null);
    assert.deepEqual(stats, after);
  }
  assert.equal(stats.gold, 465);
  assert.ok(stats.damage > createStats().damage);
  assert.ok(stats.maxHp > createStats().maxHp);
  assert.ok(stats.hp <= stats.maxHp);
  assert.ok(stats.flasks <= 3);
});
test('healing purchases require gold and missing health', () => {
  const stats = createStats(); stats.hp = 10;
  assert.equal(buyHealing(stats), false);
  stats.gold = 60;
  assert.equal(buyHealing(stats), true);
  assert.equal(stats.hp, 60); assert.equal(stats.gold, 30);
  assert.equal(buyHealing(stats), true);
  assert.equal(stats.hp, 100); assert.equal(stats.gold, 0);
  stats.gold = 30;
  assert.equal(buyHealing(stats), false); assert.equal(stats.gold, 30);
});
test('new runs reset currency and chest state independently', () => {
  const oldChests = createChests(), oldStats = createStats();
  openChest(oldChests[0], oldStats);
  assert.equal(createStats().gold, 0);
  assert.ok(createChests().every(c => !c.opened));
});
