// Run-local class progression and combat rules. No rendering or browser dependencies.
export const CLASS_KEYS = ['KeyZ', 'KeyX', 'KeyC'];
export const CLASSES = [
  { id: 'reaver', name: 'Reaver', icon: '⚔', color: '#ef8d78', motto: 'Turn suffering into strength.', role: 'Close combat · sustain · fury', abilities: [
    { id: 'blood-cleave', name: 'Blood Cleave', icon: '☽', key: 'Z', wave: 1, cooldown: 7, description: 'Sweep every nearby demon for 220% rend damage. Restore 3 health per hit, up to 15.', radius: 4.8, multiplier: 2.2 },
    { id: 'iron-skin', name: 'Iron Skin', icon: '◆', key: 'X', wave: 3, cooldown: 16, duration: 6, description: 'Take 60% less damage for 6 seconds. Stand your ground against the horde.' },
    { id: 'whirlwind', name: 'Whirlwind', icon: '✺', key: 'C', wave: 5, cooldown: 24, duration: 4, description: 'Become a moving storm of steel for 4 seconds, striking nearby foes every 0.4 seconds.', radius: 4.8, multiplier: 0.55 },
  ] },
  { id: 'arcanist', name: 'Arcanist', icon: 'ϟ', color: '#9acff4', motto: 'Wield the fire that heaven abandoned.', role: 'Ranged bursts · control · devastation', abilities: [
    { id: 'hellfire-lance', name: 'Hellfire Lance', icon: 'ϟ', key: 'Z', wave: 1, cooldown: 7, description: 'Pierce all enemies along a 12-unit line for 250% rend damage. Aim with the mouse.', range: 12, multiplier: 2.5 },
    { id: 'frost-prison', name: 'Frost Prison', icon: '❄', key: 'X', wave: 3, cooldown: 15, description: 'Freeze nearby demons for 2.5 seconds and deal 100% rend damage. Bosses freeze for 1 second.', radius: 6.5, multiplier: 1 },
    { id: 'meteor', name: 'Fallen Star', icon: '✧', key: 'C', wave: 5, cooldown: 24, description: 'Call a meteor at your aim point after 0.8 seconds. Deals 600% rend damage in a wide blast.', range: 12, radius: 5.5, multiplier: 6 },
  ] },
  { id: 'warden', name: 'Warden', icon: '✚', color: '#e4ce8d', motto: 'Be the light the abyss cannot swallow.', role: 'Holy damage · barriers · renewal', abilities: [
    { id: 'judgment', name: 'Judgment', icon: '✦', key: 'Z', wave: 1, cooldown: 8, description: 'Smite nearby demons for 180% rend damage. Restore 2% maximum health per hit, up to 10%.', radius: 5.8, multiplier: 1.8 },
    { id: 'aegis', name: 'Aegis', icon: '◇', key: 'X', wave: 3, cooldown: 17, duration: 8, description: 'Gain a barrier equal to 40% maximum health for up to 8 seconds. It absorbs incoming damage.' },
    { id: 'sanctuary', name: 'Sanctuary', icon: '☀', key: 'C', wave: 5, cooldown: 26, duration: 7, description: 'A moving sacred aura lasts 7 seconds. Each second, heal 3% maximum health and burn nearby demons.', radius: 6, multiplier: 0.7 },
  ] },
];
export function getClass(id) { return CLASSES.find(c => c.id === id) || CLASSES[0]; }
export function createClassState(id = 'reaver') {
  return { id: getClass(id).id, clearedWave: 0, cooldowns: [0, 0, 0], guard: 0, shieldTime: 0, shield: 0, channel: null, meteors: [] };
}
export function unlockClassWave(progress, wave) {
  const previous = progress.clearedWave;
  progress.clearedWave = Math.max(previous, wave);
  return getClass(progress.id).abilities.filter(a => a.wave > previous && a.wave <= progress.clearedWave);
}
export function abilityStatus(progress, slot) {
  const ability = getClass(progress.id).abilities[slot];
  if (!ability) return 'invalid';
  if (progress.clearedWave < ability.wave) return 'locked';
  return progress.cooldowns[slot] > 0 ? 'cooldown' : 'ready';
}
export function absorbClassDamage(progress, damage) {
  const reduced = damage * (progress.guard > 0 ? 0.4 : 1);
  const absorbed = Math.min(progress.shield, reduced);
  progress.shield -= absorbed;
  return reduced - absorbed;
}
export function resetClassCombat(progress) {
  progress.cooldowns.fill(0); progress.guard = progress.shieldTime = progress.shield = 0;
  progress.channel = null; progress.meteors = [];
}
function radialHits(context, position, radius, multiplier, freeze = 0) {
  let hits = 0;
  for (const target of context.targets()) {
    if (Math.hypot(target.position.x - position.x, target.position.z - position.z) <= radius + target.radius) {
      context.hit(target, context.stats.damage * multiplier, freeze); hits++;
    }
  }
  return hits;
}
export function castClassAbility(progress, slot, context) {
  if (abilityStatus(progress, slot) !== 'ready') return null;
  const ability = getClass(progress.id).abilities[slot];
  progress.cooldowns[slot] = ability.cooldown;
  const position = { x: context.position.x, z: context.position.z };
  switch (ability.id) {
    case 'blood-cleave': {
      const hits = radialHits(context, position, ability.radius, ability.multiplier);
      context.heal(Math.min(15, hits * 3)); break;
    }
    case 'iron-skin': progress.guard = ability.duration; break;
    case 'whirlwind': case 'sanctuary': progress.channel = { ability, remaining: ability.duration, untilTick: ability.id === 'whirlwind' ? 0.4 : 1 }; break;
    case 'hellfire-lance': {
      const dx = Math.sin(context.aim), dz = -Math.cos(context.aim);
      for (const target of context.targets()) {
        const x = target.position.x - position.x, z = target.position.z - position.z;
        const forward = x * dx + z * dz, sideways = Math.abs(x * dz - z * dx);
        if (forward >= -target.radius && forward <= ability.range + target.radius && sideways < 0.8 + target.radius) context.hit(target, context.stats.damage * ability.multiplier, 0);
      }
      break;
    }
    case 'frost-prison': radialHits(context, position, ability.radius, ability.multiplier, 2.5); break;
    case 'meteor': {
      const target = context.targetPoint();
      const dx = target.x - position.x, dz = target.z - position.z, factor = Math.min(1, ability.range / (Math.hypot(dx, dz) || 1));
      position.x += dx * factor; position.z += dz * factor;
      progress.meteors.push({ ability, position, remaining: 0.8 }); break;
    }
    case 'judgment': {
      const hits = radialHits(context, position, ability.radius, ability.multiplier);
      context.heal(context.stats.maxHp * Math.min(0.1, hits * 0.02)); break;
    }
    case 'aegis': progress.shield = context.stats.maxHp * 0.4; progress.shieldTime = ability.duration; break;
  }
  context.visual('cast', ability, position);
  return ability;
}
export function tickClassCombat(progress, dt, context) {
  if (!(dt > 0)) return;
  progress.cooldowns = progress.cooldowns.map(c => Math.max(0, c - dt));
  progress.guard = Math.max(0, progress.guard - dt);
  progress.shieldTime = Math.max(0, progress.shieldTime - dt);
  if (progress.shieldTime === 0) progress.shield = 0;
  for (const meteor of progress.meteors) {
    meteor.remaining -= dt;
    if (meteor.remaining <= 0) {
      radialHits(context, meteor.position, meteor.ability.radius, meteor.ability.multiplier);
      context.visual('impact', meteor.ability, meteor.position);
    }
  }
  progress.meteors = progress.meteors.filter(m => m.remaining > 0);
  const channel = progress.channel;
  if (channel) {
    const activeDt = Math.min(dt, channel.remaining);
    channel.remaining = Math.max(0, channel.remaining - dt); channel.untilTick -= activeDt;
    while (channel.untilTick <= 1e-8) {
      radialHits(context, context.position, channel.ability.radius, channel.ability.multiplier);
      if (channel.ability.id === 'sanctuary') context.heal(context.stats.maxHp * 0.03);
      context.visual('pulse', channel.ability, context.position);
      channel.untilTick += channel.ability.id === 'whirlwind' ? 0.4 : 1;
    }
    if (channel.remaining === 0) progress.channel = null;
  }
}
