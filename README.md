# Ashen Covenant

A top-down, dark-fantasy arena roguelike built with **Three.js 0.169.0**. Survive increasingly dense demon waves, choose one of three blessings between waves, and face the Cathedral Warden every fifth wave. Death resets the run; your deepest wave is saved in browser storage when available.

## Play

- **WASD / arrows:** move.
- **Mouse + hold left button:** aim and attack.
- **Auto-rend:** enabled by default; attacks nearby enemies automatically. Toggle it in the bottom-right HUD.
- **Q:** Soul Nova, a large area attack.
- **Space:** Shadowstep, a brief invulnerable dash.
- **R:** consume an elixir to restore 50% maximum health.
- **Escape:** pause or resume. Losing focus pauses automatically.
- **1–3:** choose a blessing between waves.
- **Touch:** left joystick for movement, bottom ability buttons; auto-rend handles targeting.

Each cleared wave heals 25% maximum health, restores one elixir (maximum three), and refreshes ability cooldowns. Build combinations from ten blessings, including frost, lifesteal, orbiting blades, and chain lightning. Souls are the run's score, not a spendable currency.

## Structure

- `dist/index.html`, `style.css`: responsive HUD, menus and upgrade choices.
- `dist/game.js`: procedural cathedral, actors, combat, input, effects and sound.
- `dist/rules.js`: progression, reward selection and bounded stat changes.
- `dist/boot.js`: engine loading and visible startup errors.
- `dist/vendor/`: pinned Three.js engine and MIT license.
- `tests/rules.test.js`: progression and state invariants.
- `.openai/hosting.json`: private Sites deployment identity and static directory.

## Development and validation

No dependency installation or production build is required. Serve `dist/` over HTTP in Codex Cloud or another authorized development environment; ES modules do not work through `file://`. Run `npm test` for rule tests and `npm run check` for JavaScript syntax checks. Do not run local Windows build or development servers under the repository's current instructions.

The rendering approach follows the [official Three.js installation guide](https://threejs.org/manual/pages/installation.html). All meshes, stone textures, lighting effects, and synthesized audio are created by code. No commercial game assets are used. Google Fonts are optional; local serif/sans-serif fallbacks remain usable if unavailable.

## Performance and scope

Rendering caps pixel density, shares actor geometry, bounds active enemies at 38 and particles at 260, and disposes transient GPU resources. Touch devices skip dynamic shadows. Gameplay is an original endless-wave arena prototype, with procedural scenery and builds; it does not yet include a campaign, inventory, multiplayer, or persistent character progression.

Browser verification should cover loading, movement, attacks, damage, upgrades, pause/resume, death/restart, responsive layout and touch controls. Automated rule checks alone do not prove GPU compatibility or physical mobile-device performance.
