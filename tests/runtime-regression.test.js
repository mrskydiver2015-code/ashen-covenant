import test from 'node:test';
import assert from 'node:assert/strict';
import { gameRuntime } from './helpers/game-runtime.mjs';
import { WALLET_KEY } from '../dist/loot.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function arena(id) { const g = gameRuntime(); g.start(id); return g; }

test('full game initializes and class-selection/start handlers are wired', () => {
  const g = gameRuntime(); assert.equal(g.run('state'), 'intro');
  g.ids.get('start').onclick(); assert.equal(g.run('state'), 'class-select');
  assert.equal(g.ids.get('class-choices').children.length, 3);
  g.ids.get('class-choices').children[2].onclick(); g.ids.get('class-start').onclick();
  assert.equal(g.run('classProgress.id'), 'warden'); assert.equal(g.run('wave'), 1);
  assert.equal(g.ids.get('class-slots').children.length, 3);
});

for (const id of ['reaver', 'arcanist', 'warden']) {
  test(`${id}: Z/X/C keyboard gates, repeat protection, cooldowns and pause`, () => {
    const g = arena(id);
    for (const key of ['KeyZ', 'KeyX', 'KeyC']) g.key(key);
    assert.equal(g.run('classProgress.cooldowns.reduce((a,b)=>a+b)'), 0);
    for (let slot = 0; slot < 3; slot++) {
      g.run(`unlockClassWave(classProgress, ${[1, 3, 5][slot]}); resetClassCombat(classProgress);`);
      g.key(['KeyZ', 'KeyX', 'KeyC'][slot], true); assert.equal(g.run(`classProgress.cooldowns[${slot}]`), 0);
      g.key(['KeyZ', 'KeyX', 'KeyC'][slot]);
      assert.equal(g.run(`classProgress.cooldowns[${slot}]`), g.run(`getClass(classProgress.id).abilities[${slot}].cooldown`));
      g.run('resetClassCombat(classProgress); togglePause()'); g.key(['KeyZ', 'KeyX', 'KeyC'][slot]);
      assert.equal(g.run(`classProgress.cooldowns[${slot}]`), 0); g.run('togglePause()');
    }
  });
  test(`${id}: actual wave clears unlock slots and reset transient effects`, () => {
    const g = arena(id);
    for (let wave = 1; wave <= 5; wave++) {
      g.run('clearWave()'); assert.equal(g.run('state'), 'upgrade');
      for (let slot = 0; slot < 3; slot++) assert.equal(g.run(`abilityStatus(classProgress, ${slot})`), wave >= [1, 3, 5][slot] ? 'ready' : 'locked');
      g.key('Digit1'); assert.equal(g.run('wave'), wave + 1);
    }
    g.key('KeyC'); g.run('clearWave()');
    assert.equal(g.run('classProgress.channel'), null); assert.equal(g.run('classProgress.meteors.length'), 0);
  });
}

test('Reaver cleave damages enemies, heals and creates first-kill loot once', () => {
  const g = arena(); const e = g.enemy('imp', 0, 0);
  g.run('stats.hp=40; unlockClassWave(classProgress,1)'); g.key('KeyZ');
  assert.equal(e.dead, true); assert.equal(g.run('stats.hp'), 43); assert.equal(g.run('kills'), 1);
  assert.equal(g.run('drops.length'), 2); g.key('KeyZ'); g.run('damageEnemy(enemies[0],1000)'); assert.equal(g.run('drops.length'), 2);
});
test('Iron Skin and Aegis protect actual receiveDamage calls and expire', () => {
  for (const id of ['reaver', 'warden']) {
    const g = arena(id); g.run('unlockClassWave(classProgress,3)'); g.key('KeyX'); g.run('receiveDamage(50)');
    near(g.run('stats.hp'), id === 'reaver' ? 80 : 90);
    g.run('tickClassCombat(classProgress, 9, classContext()); invulnerable=0; receiveDamage(10)');
    near(g.run('stats.hp'), id === 'reaver' ? 70 : 80);
  }
});
test('Frost Prison freezes standard enemies for 2.5s and bosses for 1s', () => {
  const g = arena('arcanist'), e = g.enemy('brute', 0, 0), boss = g.enemy('boss', 2, 0);
  g.run('unlockClassWave(classProgress,3)'); g.key('KeyX'); assert.equal(e.frozen, 2.5); assert.equal(boss.frozen, 1);
  const before = e.mesh.position.clone(); g.run('updateEnemies(0.5)'); assert.ok(e.mesh.position.equals(before));
  g.run('updateEnemies(0.51)'); assert.equal(boss.frozen, 0); assert.ok(e.frozen > 0);
});
test('Fallen Star impacts captured position once and is suspended on pause', () => {
  const g = arena('arcanist'), e = g.enemy('boss', 0, -5);
  g.run('unlockClassWave(classProgress,5)'); g.key('KeyC'); assert.equal(e.hp, e.maxHp);
  g.key('Escape'); for (let i = 0; i < 50; i++) g.frame(); assert.equal(e.hp, e.maxHp);
  g.key('Escape'); g.run('tickClassCombat(classProgress,0.81,classContext())'); near(e.hp, e.maxHp - 156);
  g.run('tickClassCombat(classProgress,1,classContext())'); near(e.hp, e.maxHp - 156);
});
test('Sanctuary and Whirlwind run their full damage/healing pulse counts', () => {
  for (const id of ['reaver', 'warden']) {
    const g = arena(id), e = g.enemy('boss', 0, 0);
    g.run('stats.hp=40; unlockClassWave(classProgress,5)'); g.key('KeyC'); g.run('tickClassCombat(classProgress,7,classContext())');
    near(e.hp, 700 - 26 * (id === 'reaver' ? 0.55 * 10 : 0.7 * 7));
    near(g.run('stats.hp'), id === 'reaver' ? 40 : 61);
  }
});

test('spawn portals wait before spawning, consume budget, and respect cap', () => {
  const g = arena(); g.run('spawnClock=0; updatePlaying(0.01)');
  assert.equal(g.run('spawns.length'), 1); assert.equal(g.run('enemies.length'), 0); assert.equal(g.run('pending'), 10);
  g.run('spawnClock=100; for(let i=0;i<24;i++) updatePlaying(0.04)'); assert.equal(g.run('enemies.length'), 0);
  g.run('updatePlaying(0.04)'); assert.equal(g.run('enemies.length'), 1);
  g.run('wave=100; config=waveConfig(wave); pending=1000; spawnClock=0; stats.hp=1e9; for(let i=0;i<1500;i++) updatePlaying(0.04)');
  assert.equal(g.run('enemies.length+spawns.length'), 38);
});
test('boss waves spawn exactly one boss before regular enemies', () => {
  const g = arena(); g.run('wave=4; nextWave(); spawnClock=0; updatePlaying(0.01)');
  assert.equal(g.run('spawns[0].kind'), 'boss'); assert.equal(g.run('bossPending'), false); assert.equal(g.run('pending'), 31);
  g.run('stats.hp=1e9; for(let i=0;i<100;i++) updatePlaying(0.04)');
  assert.equal(g.run('enemies.filter(e=>e.kind==="boss").length'), 1);
});
test('portal positions remain in the arena and away from player at center and edges', () => {
  const g = arena();
  for (const [x, z] of [[0, 0], [35, 0], [-35, 0], [0, 35], [0, -35], [24, 24]]) {
    for (let i = 0; i < 24; i++) {
      g.run(`player.position.set(${x},0,${z}); Math.random=()=>${i / 24}; prepareSpawn('imp')`);
      assert.ok(g.run('spawns.at(-1).position.length()') <= 35.000001);
      assert.ok(g.run('spawns.at(-1).position.distanceTo(player.position)') >= 7);
    }
  }
});
test('wave cannot clear with pending enemies, portals, or living enemies', () => {
  const g = arena(); g.run('updatePlaying(0.01)'); assert.equal(g.run('state'), 'playing');
  g.run("pending=0; prepareSpawn('imp'); updatePlaying(0.01)"); assert.equal(g.run('state'), 'playing');
  g.run('for(const s of spawns) disposeObject(s.object); spawns=[]'); g.enemy('imp', 0, 0);
  g.run('updatePlaying(0.01)'); assert.equal(g.run('state'), 'playing');
  g.run('damageEnemy(enemies[0],1000); updatePlaying(0.01)'); assert.equal(g.run('state'), 'upgrade');
});
test('rend uses weapon damage, speed, reach, facing and cooldown', () => {
  const g = arena(); const front = g.enemy('boss', 0, -2), back = g.enemy('boss', 0, 6), far = g.enemy('boss', 15, 15);
  g.run("equippedWeapon=makeWeapon('axe',2); stats.crit=0; rend()"); near(front.hp, 700 - 26 * 1.65 * 1.5);
  assert.equal(back.hp, 700); assert.equal(far.hp, 700); near(g.run('attackCd'), 0.48 * 1.4);
  const hp = front.hp; g.run('rend()'); assert.equal(front.hp, hp);
  g.run("equippedWeapon=makeWeapon('spear',0); attackCd=0; enemies[0].mesh.position.set(0,0,-4.5); rend()"); assert.ok(front.hp < hp);
});
test('nova, dash invulnerability, elixir bounds, and enemy melee damage', () => {
  const g = arena(), e = g.enemy('brute', 0, 0); g.run('nova()'); assert.equal(e.hp, 80); g.run('nova()'); assert.equal(e.hp, 80);
  g.run('dash(); receiveDamage(50)'); assert.equal(g.run('stats.hp'), 100);
  g.run('dashTime=invulnerable=0; stats.hp=20; useElixir()'); assert.equal(g.run('stats.hp'), 70); assert.equal(g.run('stats.flasks'), 1);
  g.run('useElixir(); useElixir()'); assert.equal(g.run('stats.hp'), 100); assert.equal(g.run('stats.flasks'), 0);
  const imp = g.enemy('imp', 0, 2); imp.cooldown = 0; g.run('updateEnemies(0.01)'); assert.equal(g.run('stats.hp'), 93);
});
test('caster projectiles and boss radial attack damage player and expire', () => {
  const g = arena(), e = g.enemy('caster', 0, -5); e.cooldown = 0;
  g.run('updateEnemies(0.01); updateEnemies(0.7)'); assert.equal(g.run('shots.length'), 1);
  g.run('shots[0].object.position.copy(player.position); updatePlaying(0.01)'); assert.equal(g.run('stats.hp'), 89); assert.equal(g.run('shots.length'), 0);
  const boss = g.enemy('boss', 20, 0); boss.special = 0; g.run('updateEnemies(0.01)'); assert.equal(g.run('shots.length'), 12);
  g.run('enemies=[]; pending=100; spawnClock=100; for(let i=0;i<160;i++)updatePlaying(0.04)'); assert.equal(g.run('shots.length'), 0);
});
test('paused/class-path/blur states stop simulation and block gameplay actions', () => {
  const g = arena(); g.enemy('brute', 0, 0); g.run('unlockClassWave(classProgress,5)'); g.key('KeyC'); g.key('KeyK');
  const before = g.run('JSON.stringify([stats,elapsed,pending,classProgress,enemies[0].hp,player.position])');
  g.key('KeyZ'); g.key('KeyX'); g.key('KeyE'); g.run('rend(); nova(); dash(); useElixir()');
  for (let i = 0; i < 20; i++) g.frame();
  assert.equal(g.run('JSON.stringify([stats,elapsed,pending,classProgress,enemies[0].hp,player.position])'), before);
  g.key('KeyK'); assert.equal(g.run('state'), 'playing'); g.event('blur'); assert.equal(g.run('state'), 'paused'); assert.equal(g.run('keys.size'), 0);
});

test('death/restart and fresh runtime retain gold while resetting equipment/chests/class/build', () => {
  const g = arena(); g.run("player.position.copy(chests[0].object.position); interact(); spawnDrop({type:'gold',amount:12},player.position); updateDrops(.01); equippedWeapon=makeWeapon('axe',3); unlockClassWave(classProgress,5); receiveDamage(1000)");
  assert.equal(g.run('state'), 'dead'); assert.equal(g.data.get(WALLET_KEY), '32');
  g.ids.get('restart').onclick(); g.run("selectClass('warden')"); g.ids.get('class-start').onclick();
  assert.equal(g.run('stats.gold'), 32); assert.equal(g.run('stats.hp'), 100); assert.equal(g.run('stats.damage'), 26);
  assert.equal(g.run('equippedWeapon.id'), 'sword'); assert.equal(g.run('drops.length'), 0); assert.equal(g.run('chests.some(c=>c.opened)'), false);
  assert.equal(g.run('classProgress.id'), 'warden'); assert.equal(g.run('classProgress.clearedWave'), 0);
  const reload = gameRuntime({ data: g.data }); assert.equal(reload.run('stats.gold'), 32); assert.equal(reload.run('wave'), 0);
});
test('chest and shrine interactions save immediately and never duplicate income or charge at full health', () => {
  const g = arena(); g.run('player.position.copy(chests[3].object.position); interact(); interact()'); assert.equal(g.data.get(WALLET_KEY), '45');
  g.run('player.position.copy(shrinePosition); stats.hp=20; interact()'); assert.equal(g.data.get(WALLET_KEY), '15'); assert.equal(g.run('stats.hp'), 70);
  g.run('interact()'); assert.equal(g.data.get(WALLET_KEY), '15');
  g.run('stats.gold=60; stats.hp=100; interact()'); assert.equal(g.data.get(WALLET_KEY), '60');
});
test('denied storage keeps session wallet through restart without throwing', () => {
  const g = gameRuntime({ denied: true }); g.start();
  g.run("spawnDrop({type:'gold',amount:42},player.position); updateDrops(.01); receiveDamage(1000); startRun()");
  assert.equal(g.run('stats.gold'), 42); assert.equal(g.run('walletSaved'), false);
  assert.match(g.ids.get('wallet-status').textContent, /SESSION ONLY/);
});
test('gold and equipment drops persist through wave transitions; E swaps once', () => {
  const g = arena(); g.run("spawnDrop({type:'weapon',weapon:makeWeapon('spear',2)},player.position); spawnDrop({type:'gold',amount:10},new THREE.Vector3(10,0,10)); clearWave(); selectBlessing(0)");
  assert.equal(g.run('drops.length'), 2); g.key('KeyE'); assert.equal(g.run('equippedWeapon.id'), 'spear');
  g.key('KeyE', true); assert.equal(g.run('equippedWeapon.id'), 'spear'); assert.equal(g.run('drops.length'), 2);
});

test('class damage respects advertised percent of equipped rend damage', () => {
  const g = arena(); const e = g.enemy('boss', 0, 0);
  g.run("equippedWeapon=makeWeapon('axe',3); unlockClassWave(classProgress,1)");
  const expected = g.run('weaponStats(stats,equippedWeapon).damage * 2.2'); g.key('KeyZ'); near(e.maxHp - e.hp, expected);
});
test('death immediately resets class unlocks and ground drops as documented', () => {
  const g = arena(); g.run("unlockClassWave(classProgress,5); spawnDrop({type:'gold',amount:10},player.position); receiveDamage(1000)");
  assert.deepEqual(JSON.parse(g.run('JSON.stringify({drops:drops.length,clearedWave:classProgress.clearedWave})')), { drops: 0, clearedWave: 0 });
});

test('movement normalizes diagonal speed, confines arena and resolves scenery', () => {
  const g = arena(); g.run("player.position.set(0,0,0); keys.add('KeyD'); keys.add('KeyW'); updatePlaying(0.04)");
  near(g.run('Math.hypot(player.position.x,player.position.z)'), 6.2 * 0.04);
  g.run("keys.clear(); player.position.set(35,0,0); keys.add('KeyD'); updatePlaying(0.04)");
  assert.ok(g.run('Math.hypot(player.position.x,player.position.z)') <= 35.000001);
  g.run('player.position.set(obstacles[0].x,0,obstacles[0].z); resolveScenery(player.position)');
  assert.ok(g.run('Math.hypot(player.position.x-obstacles[0].x,player.position.z-obstacles[0].z)') > 0.5);
});
test('auto-rend targets nearby enemies and toggle disables automatic attacks', () => {
  const g = arena(), e = g.enemy('boss', 0, 0);
  g.run('autoAttack=true; stats.crit=0; updatePlaying(0.01)'); assert.ok(e.hp < 700);
  g.ids.get('auto').onclick(); const hp = e.hp;
  g.run('attackCd=0; updatePlaying(0.01)'); assert.equal(e.hp, hp);
});
test('leech, frost, chain lightning and orbit blessings affect actual combat', () => {
  const g = arena(); g.enemy('imp', 0, 0);
  g.run('stats.leech=2; stats.hp=50; damageEnemy(enemies[0],1000)'); assert.equal(g.run('stats.hp'), 52);
  const target = g.enemy('boss', 0, 0); g.run('stats.frost=1; stats.crit=0; rend()'); assert.equal(target.slow, 2);
  const distant = g.enemy('boss', 8, 2); g.run('stats.lightning=1; attackCount=2; attackCd=0; rend()'); assert.ok(distant.hp < 700);
  g.run("state='upgrade'; choices=[{id:'orbit',name:'orbit',apply:s=>s.orbit++}]; selectBlessing(0); enemies[1].mesh.position.set(0,0,4.5); timer=1; updatePlaying(0.01)");
  assert.equal(g.run('orbiters.length'), 1);
  g.run('enemies[1].mesh.position.copy(orbiters[0].position); enemies[1].orbitHit=0; updatePlaying(0.01)');
  assert.ok(g.run('enemies[1].orbitHit') > 1);
});
test('wallet validates corrupted stored input during complete game startup', () => {
  for (const value of ['not-a-number', '-100', 'Infinity']) {
    const g = gameRuntime({ data: new Map([[WALLET_KEY, value]]) });
    assert.equal(g.run('stats.gold'), 0); g.start(); assert.equal(g.run('stats.gold'), 0);
  }
});
test('touch HUD handlers activate all unlocked slots and joystick cancellation stops movement', () => {
  const g = gameRuntime({ coarse: true }); g.start('arcanist'); g.run('unlockClassWave(classProgress,5)');
  for (let slot = 0; slot < 3; slot++) { g.ids.get(`class-slot-${slot}`).onclick(); assert.ok(g.run(`classProgress.cooldowns[${slot}]`) > 0); }
  const stick = g.ids.get('joystick'); stick.listeners.get('pointerdown')({ pointerId: 1, clientX: 78, clientY: 50 });
  assert.equal(g.run('joystick.x'), 1); stick.listeners.get('pointercancel')(); assert.equal(g.run('joystick.x'), 0);
});
