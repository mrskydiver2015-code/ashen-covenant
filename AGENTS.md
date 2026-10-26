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
- [Designer]: Added collapsible container #arena-info for minimap/stats on mobile; clamped viewport to 100vh.
- [Loot]: Persistent gold wallet implemented via localStorage['ashen_gold'].
- [Gameplay/Designer]: Touchpad mode in `dist/game.js` defaults OFF; hold/drag steers smoothly, WASD/joystick takes priority, Auto-Rend targets nearby enemies, and short enemy taps attack without drag-triggered swings. Contracts: `touchpadMove`, `pointerGesture`, `updateMovementPointer()`, `releaseMovementPointer()`, `enemyAtPointer()`; release, cancellation, blur and panel transitions clear held input.
  HUD contracts: `#touchpad-move`, `#touchpad-move-label`, `#movement-hint`, `.movement-toggles`, and `.active`/`aria-pressed` sit beside `#auto` in `.hud-right`; no new localStorage keys. `tests/pointer-movement.test.js` covers movement, attacks, toggling and input cleanup.
- [Gameplay/Testing]: `classContext()` supplies equipped-weapon damage to class abilities; `die()` resets class unlocks and removes ground drops immediately while preserving the collected gold wallet. Existing runtime regression tests enforce both contracts.
