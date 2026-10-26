import * as THREE from './vendor/three.module.js';

/** Standalone model; hooks use absolute seconds / normalized swing progress. */
export function createBossMesh() {
  const root = new THREE.Group();
  root.name = 'Cathedral Warden';
  const body = new THREE.Group();
  root.add(body);
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 8),
    sphere: new THREE.IcosahedronGeometry(1, 0),
    shaft: new THREE.CylinderGeometry(1, 1, 1, 8),
  };
  const materials = {
    armor: new THREE.MeshStandardMaterial({ color: 0x252c35, metalness: 0.8, roughness: 0.42 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x927044, metalness: 0.75, roughness: 0.48 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xc3b594, roughness: 0.8 }),
    fire: new THREE.MeshStandardMaterial({ color: 0xff9d50, emissive: 0xff390b, emissiveIntensity: 3 }),
  };
  function part(parent, name, shape, material, position, scale) {
    const mesh = new THREE.Mesh(geometries[shape], materials[material]);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  part(body, 'Breastplate', 'sphere', 'armor', [0, 2.65, 0], [1.05, 1.1, 0.6]);
  part(body, 'Gilded spine', 'box', 'trim', [0, 2.6, -0.56], [0.16, 1.5, 0.12]);
  part(body, 'Burning seal', 'sphere', 'fire', [0, 2.9, -0.65], [0.22, 0.3, 0.1]);
  part(body, 'Helm', 'box', 'armor', [0, 4, -0.08], [0.7, 0.85, 0.65]);
  part(body, 'Visor', 'box', 'fire', [0, 4.08, -0.42], [0.57, 0.065, 0.035]);
  part(body, 'Crown', 'cone', 'trim', [0, 4.65, 0], [0.23, 0.65, 0.25]);
  const wings = [];
  for (const side of [-1, 1]) {
    part(root, 'Greave', 'box', 'armor', [side * 0.52, 0.9, 0], [0.65, 1.65, 0.65]);
    part(root, 'Boot', 'box', 'trim', [side * 0.52, 0.2, -0.22], [0.72, 0.4, 1]);
    const horn = part(body, 'Great horn', 'cone', 'bone', [side * 0.62, 4.65, 0], [0.23, 1.6, 0.24]);
    horn.rotation.z = -side * 0.48;
    part(body, 'Pauldron', 'sphere', 'armor', [side * 1.12, 3.25, 0], [0.72, 0.52, 0.65]);
    for (let i = 0; i < 3; i++) {
      const spike = part(body, 'Shoulder spike', 'cone', 'trim', [side * (0.85 + i * 0.26), 3.8, 0.05], [0.12, 0.65 + i * 0.15, 0.12]);
      spike.rotation.z = -side * 0.3;
    }
    const wing = new THREE.Group(); wing.position.set(side * 0.65, 3.15, 0.45); body.add(wing); wings.push(wing);
    for (let i = 0; i < 3; i++) {
      const rib = part(wing, 'Armored wing blade', 'cone', 'armor', [side * (0.7 + i * 0.42), 0.4 - i * 0.3, 0], [0.3, 2.5 - i * 0.3, 0.14]);
      rib.rotation.z = -side * (0.65 + i * 0.25);
    }
  }
  const arm = new THREE.Group(); arm.position.set(1.2, 3.1, 0); body.add(arm);
  part(arm, 'Weapon arm', 'box', 'armor', [0, -0.65, 0], [0.48, 1.3, 0.48]);
  part(arm, 'Executioner haft', 'shaft', 'trim', [0, -1, -0.35], [0.09, 3.5, 0.09]);
  part(arm, 'Hammer head', 'box', 'armor', [0, 0.5, -0.35], [1.35, 0.75, 0.85]);
  part(arm, 'Hammer seal', 'box', 'fire', [0, 0.5, -0.79], [0.48, 0.35, 0.035]);
  part(body, 'Shield arm', 'box', 'armor', [-1.25, 2.5, 0], [0.5, 1.2, 0.5]);
  part(body, 'Tower shield', 'box', 'armor', [-1.35, 2.25, -0.5], [0.9, 1.8, 0.25]);
  part(body, 'Shield cross', 'box', 'trim', [-1.35, 2.25, -0.64], [0.12, 1.5, 0.05]);
  let disposed = false;
  function idle(seconds = 0) {
    if (disposed) return;
    const t = Number.isFinite(seconds) ? seconds : 0;
    body.position.y = Math.sin(t * 1.7) * 0.055;
    wings.forEach((wing, i) => { wing.rotation.y = (i ? 1 : -1) * (0.12 + Math.sin(t * 1.2) * 0.06); });
  }
  function swing(progress = 0) {
    if (disposed) return;
    const p = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    const arc = Math.sin(p * Math.PI);
    arm.rotation.x = -arc * 2.2;
    body.rotation.y = arc * 0.3;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; root.removeFromParent();
    Object.values(geometries).forEach(g => g.dispose());
    Object.values(materials).forEach(m => m.dispose());
  }
  idle(0); swing(0);
  return { root, idle, swing, dispose };
}
