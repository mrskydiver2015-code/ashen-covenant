import * as THREE from './vendor/three.module.js';
import { ARENA_RADIUS } from './rules.js';

const arenas = new WeakMap();

/** Idempotently adds visual scenery only; does not alter lights or collision. */
export function loadBossArena(scene) {
  if (arenas.has(scene)) return arenas.get(scene).root;
  const root = new THREE.Group(); root.name = 'Wave 05 — Sacrificial Sanctum';
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    column: new THREE.CylinderGeometry(0.5, 0.65, 1, 8),
    disc: new THREE.CylinderGeometry(1, 1, 1, 48),
    ring: new THREE.RingGeometry(0.985, 1, 96),
  };
  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: 0x14171e, roughness: 0.94 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x34303a, metalness: 0.35, roughness: 0.65 }),
    altar: new THREE.MeshStandardMaterial({ color: 0x351e29, roughness: 0.78 }),
    rune: new THREE.MeshBasicMaterial({ color: 0xff492e, toneMapped: false, side: THREE.DoubleSide }),
  };
  function part(name, shape, material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geometries[shape], materials[material]); m.name = name;
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); root.add(m); return m;
  }
  function circle(name, radius, y) {
    const m = part(name, 'ring', 'rune', 0, y, 0, radius, radius, radius);
    m.rotation.x = -Math.PI / 2;
  }
  // Pillars sit beyond the playable boundary, so decoration cannot block combat.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = ARENA_RADIUS + 1.7;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    part('Obsidian pillar base', 'box', 'edge', x, 0.3, z, 1.7, 0.6, 1.7);
    const pillar = part('Darkened pillar', 'column', 'stone', x, 3, z, 1.3, 5.4, 1.3);
    pillar.castShadow = pillar.receiveShadow = true;
    part('Pillar capital', 'box', 'edge', x, 5.8, z, 1.6, 0.45, 1.6);
  }
  circle('Runic boundary outer', ARENA_RADIUS, 0.07);
  circle('Runic boundary inner', ARENA_RADIUS - 0.55, 0.075);
  for (let i = 0; i < 40; i++) {
    const a = i * Math.PI * 2 / 40, r = ARENA_RADIUS - 0.28;
    const rune = part('Boundary rune', 'box', 'rune', Math.sin(a) * r, 0.08, Math.cos(a) * r, 0.07, 0.025, 0.3);
    rune.rotation.y = a + (i % 2 ? 0.45 : -0.45);
  }
  part('Sacrificial altar floor', 'disc', 'altar', 0, 0.035, 0, 4, 0.06, 4);
  circle('Altar seal outer', 3.8, 0.08); circle('Altar seal inner', 2.3, 0.085);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const spoke = part('Sacrificial seal spoke', 'box', 'rune', Math.sin(a) * 1.9, 0.09, Math.cos(a) * 1.9, 0.07, 0.025, 3.5);
    spoke.rotation.y = a;
  }
  scene.add(root); arenas.set(scene, { root, geometries, materials });
  return root;
}

/** Removes only this module's scenery and releases its GPU resources. */
export function clearBossArena(scene) {
  const arena = arenas.get(scene);
  if (!arena) return;
  arena.root.removeFromParent();
  Object.values(arena.geometries).forEach(g => g.dispose());
  Object.values(arena.materials).forEach(m => m.dispose());
  arenas.delete(scene);
}
