import test from 'node:test';
import assert from 'node:assert/strict';
import { gameRuntime } from './helpers/game-runtime.mjs';

const arenaName = 'Wave 05 — Sacrificial Sanctum';
function encounter() {
  const g = gameRuntime(); g.start(); g.run('wave=4; nextWave()'); return g;
}
function spawnWarden(g) {
  for (let i = 0; i < 57; i++) g.run('updatePlaying(.04)');
  return g.run("enemies.find(e => e.kind === 'boss')");
}

test('Wave 05 loads scenery and announces once, then its portal creates one custom Warden', () => {
  const g = gameRuntime(); g.start();
  for (let i = 1; i < 4; i++) g.run('nextWave()');
  assert.equal(g.run(`scene.getObjectByName('${arenaName}')`), undefined);
  assert.equal(g.audioCalls.filter(c => c === 'boss').length, 0);
  g.run('nextWave()');
  assert.equal(g.run('wave'), 5);
  assert.equal(g.run(`scene.children.filter(o => o.name === '${arenaName}').length`), 1);
  assert.equal(g.audioCalls.filter(c => c === 'boss').length, 1);
  assert.equal(g.run('enemies.length'), 0);
  const boss = spawnWarden(g);
  assert.ok(boss.bossModel); assert.equal(boss.mesh, boss.bossModel.root);
  assert.equal(boss.mesh.name, 'Cathedral Warden');
  assert.ok(boss.mesh.getObjectByName('Hammer head'));
  assert.equal(g.run("enemies.filter(e => e.kind === 'boss').length"), 1);
  assert.equal(g.audioCalls.filter(c => c === 'boss').length, 1);
  assert.equal(g.ids.get('boss-hud').hidden, false);
  assert.equal(g.ids.get('boss-fill').style.width, '100%');
});

test('Warden animation follows windup, freezes and pauses without relying on generic demon limbs', () => {
  const g = encounter(), boss = spawnWarden(g);
  assert.equal(boss.mesh.userData.leftLeg, undefined);
  g.run('player.position.set(0,0,2); enemies[0].mesh.position.set(0,0,0); enemies[0].cooldown=0; timer=1; updateEnemies(.01); updateEnemies(.4)');
  const arm = boss.mesh.getObjectByName('Weapon arm').parent;
  assert.ok(arm.rotation.x < -1);
  const pose = arm.rotation.x;
  g.run('enemies[0].frozen=1; updateEnemies(.1)'); assert.equal(arm.rotation.x, pose);
  g.run('togglePause()'); g.frame(); assert.equal(arm.rotation.x, pose);
  g.run('togglePause(); enemies[0].frozen=0; updateEnemies(.4)');
  assert.ok(Math.abs(arm.rotation.x) < 1e-8);
  assert.ok(g.run('stats.hp < stats.maxHp'));
});

test('boss death drops one chest at the defeat position and wave transition clears only arena scenery', () => {
  const g = encounter(), boss = spawnWarden(g);
  const arena = g.run(`scene.getObjectByName('${arenaName}')`);
  const ground = g.run('ground');
  let modelReleases = 0, arenaReleases = 0;
  boss.mesh.getObjectByName('Breastplate').geometry.addEventListener('dispose', () => modelReleases++);
  arena.getObjectByName('Darkened pillar').geometry.addEventListener('dispose', () => arenaReleases++);
  g.run('enemies[0].mesh.position.set(3,0,-4); damageEnemy(enemies[0],10000); damageEnemy(enemies[0],10000)');
  const chest = g.run("drops.find(d => d.type === 'boss-chest')");
  assert.equal(g.run('drops.length'), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(chest.position)), { x: 3, y: 0, z: -4 });
  assert.equal(g.audioCalls.filter(c => c === 'chest').length, 1);
  assert.equal(modelReleases, 1); assert.equal(boss.mesh.parent, null);
  assert.equal(g.ids.get('boss-hud').hidden, true);
  assert.ok(arena.parent);
  g.run('pending=0; updatePlaying(.01)');
  assert.equal(g.run('state'), 'upgrade'); assert.ok(arena.parent);
  g.run('selectBlessing(0)');
  assert.equal(g.run('wave'), 6); assert.equal(arena.parent, null); assert.equal(arenaReleases, 1);
  assert.equal(ground.parent, g.run('scene')); assert.ok(chest.object.parent);
  g.run("player.position.copy(drops.find(d => d.type === 'boss-chest').object.position); interact(); interact()");
  assert.equal(g.run('stats.gold'), 100); assert.equal(g.run('drops.length'), 0);
  assert.equal(g.data.get('ashen_gold'), '100');
});

test('death and direct restart clean the boss arena and per-instance model resources once', () => {
  for (const dieFirst of [false, true]) {
    const g = encounter(), boss = spawnWarden(g), arena = g.run(`scene.getObjectByName('${arenaName}')`);
    let modelReleases = 0, arenaReleases = 0;
    boss.mesh.getObjectByName('Breastplate').geometry.addEventListener('dispose', () => modelReleases++);
    arena.getObjectByName('Darkened pillar').geometry.addEventListener('dispose', () => arenaReleases++);
    if (dieFirst) {
      g.run('receiveDamage(1000)');
      assert.equal(g.run('state'), 'dead'); assert.equal(g.ids.get('boss-hud').hidden, true);
      assert.equal(arena.parent, null); assert.equal(boss.mesh.parent, null);
    }
    g.start();
    assert.equal(modelReleases, 1); assert.equal(arenaReleases, 1);
    assert.equal(g.run('wave'), 1); assert.equal(g.run('enemies.length'), 0);
    assert.equal(g.run(`scene.getObjectByName('${arenaName}')`), undefined);
  }
});

test('each accepted swing plays slash once and every damaged enemy receives its own hit cue', () => {
  const g = gameRuntime(); g.start(); g.enemy('brute', -1, 0); g.enemy('brute', 1, 0);
  g.run('stats.crit=0; rend(); rend()');
  assert.equal(g.audioCalls.filter(c => c === 'slash').length, 1);
  assert.equal(g.audioCalls.filter(c => c === 'hit').length, 2);
  g.audioCalls.length = 0; g.run('nova()');
  assert.equal(g.audioCalls.filter(c => c === 'hit').length, 2);
  assert.equal(g.audioCalls.filter(c => c === 'slash').length, 0);
  g.audioCalls.length = 0; g.run('togglePause(); rend(); nova()');
  assert.equal(g.audioCalls.length, 0);
});

test('later boss waves retain their regular rewards without loading the Wave 05 arena', () => {
  const g = gameRuntime(); g.start(); g.run('wave=9; nextWave()');
  assert.equal(g.run(`scene.getObjectByName('${arenaName}')`), undefined);
  const boss = spawnWarden(g); assert.equal(boss.mesh.name, 'Cathedral Warden');
  assert.equal(g.audioCalls.filter(c => c === 'boss').length, 1);
  g.run('damageEnemy(enemies[0],10000)');
  assert.ok(g.run("drops.some(d => d.type === 'gold')"));
  assert.ok(g.run("drops.some(d => d.type === 'weapon')"));
  assert.equal(g.run("drops.some(d => d.type === 'boss-chest')"), false);
});
