import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createBossMesh } from '../dist/boss-model.js';
import { loadBossArena, clearBossArena } from '../dist/arena-wave5.js';

test('boss hooks animate independently without moving the gameplay root', () => {
  const boss = createBossMesh(), other = createBossMesh();
  assert.ok(boss.root.isObject3D);
  assert.ok(new THREE.Box3().setFromObject(boss.root).getSize(new THREE.Vector3()).y > 5);
  boss.root.position.set(3, 0, 5);
  boss.idle(1); boss.swing(0.5);
  assert.deepEqual(boss.root.position.toArray(), [3, 0, 5]);
  assert.notEqual(boss.root.getObjectByName('Weapon arm').parent.rotation.x, 0);
  assert.ok(Math.abs(other.root.getObjectByName('Weapon arm').parent.rotation.x) < 1e-12);
  boss.swing(1);
  assert.ok(Math.abs(boss.root.getObjectByName('Weapon arm').parent.rotation.x) < 1e-12);
  const geometry = boss.root.getObjectByName('Breastplate').geometry;
  let releases = 0; geometry.addEventListener('dispose', () => releases++);
  boss.dispose(); boss.dispose(); other.dispose();
  assert.equal(releases, 1);
});

test('arena load/clear is repeatable, isolated per scene, and preserves existing scenery', () => {
  const scene = new THREE.Scene(), other = new THREE.Scene(), existing = new THREE.Group();
  scene.add(existing);
  const arena = loadBossArena(scene), otherArena = loadBossArena(other);
  assert.equal(loadBossArena(scene), arena);
  assert.equal(scene.children.length, 2);
  assert.ok(arena.getObjectByName('Sacrificial altar floor'));
  assert.ok(arena.getObjectByName('Runic boundary outer'));
  let releases = 0;
  arena.getObjectByName('Darkened pillar').geometry.addEventListener('dispose', () => releases++);
  clearBossArena(scene); clearBossArena(scene);
  assert.equal(releases, 1);
  assert.deepEqual(scene.children, [existing]);
  assert.equal(otherArena.parent, other);
  assert.notEqual(loadBossArena(scene), arena);
  clearBossArena(scene); clearBossArena(other);
});
