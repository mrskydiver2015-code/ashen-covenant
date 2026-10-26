export const WALLET_KEY = 'ashen-covenant-gold-v1';
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
  try { return normalizeGold(storage.getItem(WALLET_KEY)); } catch { return 0; }
}
export function saveWallet(storage, gold) {
  try { storage.setItem(WALLET_KEY, String(normalizeGold(gold))); return true; } catch { return false; }
}
