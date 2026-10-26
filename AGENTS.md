# Agent Architecture & Coordination Rules — Ashen Covenant

## Core Rule: Continuous Documentation
Whenever any agent makes architectural, gameplay, UI, or state changes:
- Append a brief 1-2 line summary to the "Recent Changes & Contracts" section below before completing the task.
- Document added/modified DOM element IDs, CSS classes, localStorage keys, or shared functions so peer agents stay aligned without code collisions.

## Shared Interface Contracts & Roles
- Live Output Directory: All game assets served to browser/Vercel reside in dist/.
- Input & Game Mechanics: Owned by gameplay (dist/game.js).
- UI, Responsiveness & CSS: Owned by designer (dist/style.css, dist/index.html).
- Loot, Economy & Progression: Owned by loot (dist/loot.js).
- QA & Validation: Owned by testing (tests/).

## Hardware Constraints
- Optimize strictly for an 8 GB RAM ceiling.

## Recent Changes & Contracts
- [Boss Model]: `dist/boss-model.js` exports `createBossMesh()` -> `{ root, idle(seconds), swing(progress), dispose() }`. Root is a ground-centered, -Z-facing Object3D about 5.5 units tall; idle takes absolute seconds, swing takes clamped 0..1 progress (0/1 neutral). Hooks preserve root transforms; dispose is idempotent and releases per-instance shared geometry/materials. Standalone visual contract, no gameplay integration.
- [Boss Arena]: `dist/arena-wave5.js` exports `loadBossArena(scene)` -> root Object3D (idempotent per scene), and `clearBossArena(scene)` -> void (safe to repeat). Adds dark outer pillars, emissive-looking runic boundary and flat sacrificial altar; cleanup disposes only owned resources. No collision, lighting, DOM or wave-state changes; caller loads/clears at wave transitions.
- [Designer]: Added collapsible container #arena-info for minimap/stats on mobile; clamped viewport to 100vh.
- [Loot]: Persistent gold wallet implemented via localStorage['ashen_gold'].
- [Gameplay/Designer]: Touchpad mode in `dist/game.js` defaults OFF; hold/drag steers smoothly, WASD/joystick takes priority, Auto-Rend targets nearby enemies, and short enemy taps attack without drag-triggered swings. Contracts: `touchpadMove`, `pointerGesture`, `updateMovementPointer()`, `releaseMovementPointer()`, `enemyAtPointer()`; release, cancellation, blur and panel transitions clear held input.
  HUD contracts: `#touchpad-move`, `#touchpad-move-label`, `#movement-hint`, `.movement-toggles`, and `.active`/`aria-pressed` sit beside `#auto` in `.hud-right`; no new localStorage keys. `tests/pointer-movement.test.js` covers movement, attacks, toggling and input cleanup.
- [Gameplay/Testing]: `classContext()` supplies equipped-weapon damage to class abilities; `die()` resets class unlocks and removes ground drops immediately while preserving the collected gold wallet. Existing runtime regression tests enforce both contracts.

- [Audio]: `dist/audio.js` exports void `playSlash()`, `playHit()`, `playChestOpen()`, `playBossSpawn()` and compatibility `tone(frequency, duration, type, volume, end)`; synthesized locally, no-op while muted/suspended, one lazy AudioContext and at most 24 voices. Game hooks cover swings, hits/player damage, chests and boss spawning.
- [Audio]: `setSoundEnabled(boolean): Promise<boolean>` and `isSoundEnabled(): boolean` control session-only sound (default OFF; no storage). Module owns `#sound` click listener, span text, aria-label and aria-pressed. User-gesture enable creates/resumes audio; failure restores OFF; mute cancels active/scheduled voices. Imported by game.js; do not add a second toggle handler.
- [Gameplay/Testing]: `nextWave()` loads `loadBossArena(scene)` and calls `playBossSpawn()` once on Wave 05; `spawnEnemy()` stores the `createBossMesh()` controller in `enemy.bossModel` and uses its root/idle/swing/dispose hooks. Arena clears on the next wave, death or restart; boss-owned resources dispose on defeat, death or restart.
  Wave 05 defeat calls `dropBossLoot(bossPos)` and `playChestOpen()` once; the chest survives transition for E/tap collection. `rend()` calls `playSlash()` once per accepted swing; `damageEnemy()` calls `playHit()` per damaged enemy. Existing `#boss-hud`/`#boss-fill` and audio toggle contracts remain; no new DOM/CSS/storage keys. Integration coverage: `tests/boss-encounter.test.js`.
