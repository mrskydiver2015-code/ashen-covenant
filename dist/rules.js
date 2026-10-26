export const ARENA_RADIUS = 35;
export const REGIONS = [
  { name: 'Forsaken Sanctum', x: 0, z: 0, color: '#bca576' },
  { name: 'Whispering Graves', x: -23, z: 0, color: '#91ae89' },
  { name: 'Crystal Hollow', x: 23, z: 0, color: '#73d9eb' },
  { name: 'Ruined Library', x: 0, z: -24, color: '#ac91d6' },
  { name: 'Gilded Treasury', x: 0, z: 24, color: '#e3b75f' },
];
export const CHEST_SITES = [[4, 5], [-10, 8], [11, -9], [-23, -4], [-26, 5], [23, -5], [27, 4], [-5, -26], [5, -28], [-5, 25], [6, 27], [18, 20]];
export function createChests() {
  return CHEST_SITES.map(([x, z], id) => ({ id, x, z, opened: false, rare: id > 2 }));
}
export function openChest(chest, stats) {
  if (chest.opened) return null;
  chest.opened = true;
  const gold = chest.rare ? 45 : 20;
  stats.gold += gold;
  const loot = chest.id % 3;
  if (loot === 0) stats.damage += chest.rare ? 6 : 3;
  if (loot === 1) { stats.maxHp += 10; heal(stats, 20); }
  if (loot === 2) { stats.flasks = Math.min(3, stats.flasks + 1); heal(stats, 25); }
  return { gold, name: ['Tempered blade', 'Vitality charm', 'Elixir + healing'][loot] };
}
export function buyHealing(stats) {
  if (stats.gold < 30 || stats.hp >= stats.maxHp) return false;
  stats.gold -= 30; heal(stats, 50); return true;
}
export const MAX_ACTIVE_ENEMIES = 38;
export function createStats() {
  return { gold: 0, maxHp: 100, hp: 100, damage: 26, attackDelay: 0.48, speed: 6.2, range: 3.4, crit: 0.12, novaDamage: 65, novaRadius: 6.5, novaDelay: 9, dashDelay: 2.8, leech: 0, frost: 0, orbit: 0, lightning: 0, flasks: 2 };
}
export function waveConfig(wave) {
  return { count: 6 + wave * 5, health: 1 + (wave - 1) * 0.19, damage: 1 + (wave - 1) * 0.07, spawnDelay: Math.max(0.18, 0.8 - wave * 0.04), boss: wave % 5 === 0 };
}
export function enemyKind(wave, roll) {
  if (wave >= 3 && roll > 0.82) return 'brute';
  if (wave >= 2 && roll > 0.61) return 'caster';
  if (roll > 0.32) return 'stalker';
  return 'imp';
}
export const BLESSINGS = [
  { id: 'might', name: 'Butcher’s Oath', icon: '⚔', type: 'MIGHT', description: 'Rend deals 30% more damage. Every strike carries greater weight.', apply: s => { s.damage *= 1.3; } },
  { id: 'haste', name: 'Frenzied Heart', icon: '♜', type: 'FERVOR', description: 'Attack 20% faster and move 6% faster. Become the relentless hunter.', apply: s => { s.attackDelay = Math.max(0.12, s.attackDelay / 1.2); s.speed = Math.min(10, s.speed * 1.06); } },
  { id: 'vitality', name: 'Undying Vessel', icon: '✚', type: 'VITALITY', description: 'Gain 30 maximum health and restore 30 health immediately.', apply: s => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 30); } },
  { id: 'nova', name: 'Cataclysm', icon: '✺', type: 'SOUL NOVA', description: 'Soul Nova deals 40% more damage with a 20% wider blast.', apply: s => { s.novaDamage *= 1.4; s.novaRadius = Math.min(14, s.novaRadius * 1.2); } },
  { id: 'leech', name: 'Crimson Communion', icon: '♆', type: 'BLOOD MAGIC', description: 'Restore 2 health for every demon slain. Each pact adds 2 more.', apply: s => { s.leech += 2; } },
  { id: 'frost', name: 'Winter’s Malice', icon: '❄', type: 'FROSTBITE', description: 'Rend slows demons by 45% for 2 seconds and gains 10% damage.', apply: s => { s.frost = 1; s.damage *= 1.1; } },
  { id: 'orbit', name: 'Grieving Stars', icon: '✧', type: 'FORBIDDEN POWER', description: 'An orbiting soul blade strikes nearby demons. Stacks up to 4 blades.', eligible: s => s.orbit < 4, apply: s => { s.orbit++; } },
  { id: 'lightning', name: 'Heaven’s Ruin', icon: 'ϟ', type: 'STORM PACT', description: 'Every third rend chains lightning to 3 demons. Further gifts empower it.', apply: s => { s.lightning++; } },
  { id: 'reach', name: 'Reaper’s Reach', icon: '☽', type: 'PRECISION', description: 'Gain 15% attack reach and 8% critical chance. Critical hits deal double damage.', eligible: s => s.range < 6.8, apply: s => { s.range = Math.min(7, s.range * 1.15); s.crit = Math.min(0.7, s.crit + 0.08); } },
  { id: 'dash', name: 'Between Worlds', icon: '➶', type: 'SHADOWSTEP', description: 'Dash recharges 20% faster. Soul Nova recharges 15% faster.', apply: s => { s.dashDelay = Math.max(0.8, s.dashDelay * 0.8); s.novaDelay = Math.max(3, s.novaDelay * 0.85); } },
];
export function chooseBlessings(stats, random = Math.random) {
  const pool = BLESSINGS.filter(b => !b.eligible || b.eligible(stats));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
export function heal(stats, amount) { stats.hp = Math.min(stats.maxHp, stats.hp + amount); }
export function constrainPosition(position) {
  const length = Math.hypot(position.x, position.z);
  if (length > ARENA_RADIUS) { position.x *= ARENA_RADIUS / length; position.z *= ARENA_RADIUS / length; }
  return position;
}
