export const WALLET_KEY = 'ashen_gold';
export const LEGACY_WALLET_KEY = 'ashen-covenant-gold-v1';
export const BOSS_BLESSING = Object.freeze({
  id: 'gilded-resolve', name: 'Gilded Resolve', tier: 'rare', icon: '✦',
  description: '+20 maximum health, restore 20 health, and deal 15% more Rend damage.',
});
// Pure spawn descriptor; the game owns rendering, proximity and lifetime.
export function dropBossLoot(position) {
  if (!position || !['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]))) {
    throw new TypeError('dropBossLoot requires a finite { x, y, z } position');
  }
  return { type: 'boss-chest', name: 'Gilded Boss Chest', position: { x: position.x, y: position.y, z: position.z },
    gold: 100, blessing: BOSS_BLESSING, opened: false };
}
export function openBossChest(chest, stats) {
  if (chest.type !== 'boss-chest' || chest.opened) return null;
  chest.opened = true;
  stats.gold = normalizeGold(stats.gold + chest.gold);
  stats.maxHp += 20; stats.hp = Math.min(stats.maxHp, stats.hp + 20); stats.damage *= 1.15;
  return { gold: chest.gold, blessing: chest.blessing };
}
export const MAX_GOLD = 999999999;
export const WEAPONS = Object.freeze([
  Object.freeze({ id: 'sword', name: 'Sanctum Sword', damage: 1, delay: 1, reach: 1, color: '#c0d9d9' }),
  Object.freeze({ id: 'dagger', name: 'Thorn Dagger', damage: 0.8, delay: 0.65, reach: 0.8, color: '#9de8ba' }),
  Object.freeze({ id: 'axe', name: 'Executioner Axe', damage: 1.65, delay: 1.4, reach: 0.95, color: '#f3b777' }),
  Object.freeze({ id: 'spear', name: 'Moon Spear', damage: 1.1, delay: 1.1, reach: 1.45, color: '#a4cfff' }),
]);
export function makeWeapon(id = 'sword', tier = 0) {
  return { id: WEAPONS.some(w => w.id === id) ? id : 'sword', tier: Math.max(0, Math.min(3, Math.floor(Number(tier) || 0))) };
}
export function weaponInfo(weapon) {
  const base = WEAPONS.find(w => w.id === weapon.id) || WEAPONS[0];
  return { ...base, name: `${['Worn', 'Forged', 'Rare', 'Relic'][weapon.tier]} ${base.name}`, damage: base.damage * (1 + weapon.tier * 0.25) };
}
export function weaponStats(stats, weapon) {
  const info = weaponInfo(weapon);
  return { damage: stats.damage * info.damage, attackDelay: Math.max(0.12, stats.attackDelay * info.delay), range: stats.range * info.reach };
}
export function rollLoot(kind, wave, random = Math.random, guaranteed = false) {
  const gold = ({ imp: 3, stalker: 5, caster: 7, brute: 12, boss: 75 }[kind] || 3) + Math.min(20, Math.max(0, wave - 1));
  const drops = [{ type: 'gold', amount: gold }];
  if (guaranteed || kind === 'boss' || random() < 0.16) {
    const id = WEAPONS[1 + Math.min(2, Math.floor(random() * 3))].id;
    const tier = kind === 'boss' ? Math.min(3, 1 + Math.floor(wave / 5)) : Math.min(3, 1 + Math.floor(wave / 8));
    drops.push({ type: 'weapon', weapon: makeWeapon(id, tier) });
  }
  return drops;
}
export function normalizeGold(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(MAX_GOLD, Math.max(0, Math.floor(n))) : 0;
}
export function loadWallet(storage) {
  try {
    const current = storage.getItem(WALLET_KEY);
    if (current != null) return normalizeGold(current);
    const gold = normalizeGold(storage.getItem(LEGACY_WALLET_KEY));
    saveWallet(storage, gold);
    return gold;
  } catch { return 0; }
}
export function saveWallet(storage, gold) {
  try { storage.setItem(WALLET_KEY, String(normalizeGold(gold))); return true; } catch { return false; }
}
