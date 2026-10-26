import test from 'node:test';
import assert from 'node:assert/strict';
import { gameRuntime } from './helpers/game-runtime.mjs';

function arena(enabled = true) {
  const g = gameRuntime(); g.start();
  g.run('player.position.set(0,0,0); camera.position.set(0,14,14); camera.lookAt(0,0,0); camera.updateMatrixWorld(true); spawnClock=1000;');
  if (enabled) g.ids.get('touchpad-move').onclick();
  return g;
}
function point(g, x, z, y = 0) {
  return JSON.parse(g.run(`JSON.stringify((() => { const p = new THREE.Vector3(${x},${y},${z}).project(camera); return {clientX: (p.x*.5+.5)*1280, clientY: (-p.y*.5+.5)*900}; })())`));
}

test('held pointer moves toward the cursor without repeatedly swinging, then stops on release', () => {
  const g = arena(), cursor = point(g, 6, -3);
  g.pointer('pointerdown', cursor);
  for (let i = 0; i < 10; i++) g.run('updatePlaying(.04)');
  assert.ok(g.run('player.position.x > 0 && player.position.z < 0'));
  assert.equal(g.run('attackCount'), 0);
  g.advanceTime(400); g.pointer('pointerup', cursor);
  const position = g.run('JSON.stringify(player.position)'); g.run('updatePlaying(.04)');
  assert.equal(g.run('JSON.stringify(player.position)'), position);
  assert.equal(g.run('mouseHeld'), false); assert.equal(g.run('renderer.domElement.hasPointerCapture(1)'), false);
});
test('WASD overrides cursor steering while held and cursor movement resumes on key release', () => {
  const g = arena(); g.pointer('pointerdown', point(g, 8, 0));
  g.run("keys.add('KeyA'); updatePlaying(.04)");
  assert.ok(g.run('player.position.x < 0'));
  g.run("keys.clear(); updatePlaying(.04)"); assert.ok(g.run('move.x > 0'));
});
test('cursor movement eases to a stop without crossing the target or producing invalid coordinates', () => {
  const g = arena(); g.pointer('pointerdown', point(g, 0.5, 0));
  for (let i = 0; i < 100; i++) g.run('updatePlaying(.04)');
  assert.ok(g.run('player.position.x > 0.3 && player.position.x < 0.5'));
  assert.ok(g.run('Number.isFinite(player.position.z) && move.length() === 0'));
});
test('movement mode keeps nearby Auto-Rend aiming and attacks active', () => {
  const g = arena(); const enemy = g.enemy('brute', 0, -2);
  g.run('autoAttack=true'); g.pointer('pointerdown', point(g, 8, 0)); g.run('updatePlaying(.04)');
  assert.ok(g.run('player.position.x > 0')); assert.equal(g.run('attackCount'), 1); assert.ok(enemy.hp < enemy.maxHp);
});
test('short enemy taps strike once with Auto-Rend off; drags do not count as taps', () => {
  const g = arena(); const enemy = g.enemy('brute', 0, -2); g.run('scene.updateMatrixWorld(true)');
  const cursor = point(g, 0, -2, 1.4175);
  g.pointer('pointerdown', cursor); g.advanceTime(80); g.pointer('pointerup', cursor);
  assert.equal(g.run('attackCount'), 1); assert.ok(enemy.hp < enemy.maxHp);
  g.run('attackCd=0'); g.pointer('pointerdown', cursor);
  g.pointer('pointermove', { ...cursor, clientX: cursor.clientX + 20 });
  g.pointer('pointermove', cursor); g.advanceTime(80); g.pointer('pointerup', cursor);
  assert.equal(g.run('attackCount'), 1);
});
test('toggle defaults OFF and restores original hold-to-attack controls', () => {
  const g = arena(false); assert.equal(g.run('touchpadMove'), false);
  g.pointer('pointerdown', point(g, 8, 0)); g.run('updatePlaying(.04)');
  assert.equal(g.run('attackCount'), 1); assert.equal(g.run('player.position.x'), 0);
  g.ids.get('touchpad-move').onclick(); assert.equal(g.ids.get('touchpad-move').attributes['aria-pressed'], 'true');
  assert.equal(g.run('mouseHeld'), false); assert.equal(g.run('pointerGesture'), null);
  g.ids.get('touchpad-move').onclick(); assert.equal(g.ids.get('touchpad-move-label').textContent, 'TOUCHPAD MOVE [OFF]');
});
test('pointer cancellation, lost capture, focus loss and pause all stop held movement', () => {
  for (const stop of ['pointercancel', 'lostpointercapture', 'blur', 'pause']) {
    const g = arena(); g.pointer('pointerdown', point(g, 6, 0));
    if (stop === 'blur') g.event('blur'); else if (stop === 'pause') g.key('Escape'); else g.pointer(stop);
    assert.equal(g.run('mouseHeld'), false, stop); assert.equal(g.run('pointerGesture'), null, stop);
    assert.equal(g.run('renderer.domElement.hasPointerCapture(1)'), false, stop);
  }
});
test('other pointers and right-click do not interrupt or initiate movement', () => {
  const g = arena(); g.pointer('pointerdown', { button: 2 }); assert.equal(g.run('mouseHeld'), false);
  g.pointer('pointerdown', point(g, 8, 0));
  g.pointer('pointerup', { pointerId: 2 }); assert.equal(g.run('mouseHeld'), true);
  g.pointer('pointermove', { buttons: 0 }); assert.equal(g.run('mouseHeld'), false);
});
