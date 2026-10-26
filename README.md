# Ashen Covenant

A top-down, dark-fantasy arena roguelike built with **Three.js 0.169.0**. Survive increasingly dense demon waves, choose one of three blessings between waves, and face the Cathedral Warden every fifth wave. Death resets the run; your deepest wave is saved in browser storage when available.

## Play

- **WASD / arrows:** move.
- **Mouse + hold left button:** aim and attack.
- **TOUCHPAD MOVE toggle:** when ON, hold left mouse or drag on the arena to move toward the cursor. Release to stop; WASD/joystick input takes priority while used. Auto-Rend continues against nearby demons. A short click directly on a demon within weapon reach performs one attack, subject to the normal cooldown. When OFF, holding left mouse retains aim-and-attack behavior.
- **Auto-rend:** enabled by default; attacks nearby enemies automatically. Toggle it in the bottom-right HUD.
- **Q:** Soul Nova, a large area attack.
- **Space:** Shadowstep, a brief invulnerable dash.
- **R:** consume an elixir to restore 50% maximum health.
- **E / contextual touch button:** open a nearby chest or buy healing at the green shrine.
- **Escape:** pause or resume. Losing focus pauses automatically.
- **1–3:** choose a blessing between waves.
- **Touch:** left joystick for movement, bottom ability buttons; auto-rend handles targeting.

Each cleared wave heals 25% maximum health, restores one elixir (maximum three), and refreshes ability cooldowns. Build combinations from ten blessings, including frost, lifesteal, orbiting blades, and chain lightning. Souls are the run's score, not a spendable currency.

The expanded world has a 35-unit playable radius (previously 17), with the central sanctum, Whispering Graves, Crystal Hollow, Ruined Library, and Gilded Treasury. The minimap shows your position in white, unopened chests in gold, and the healing shrine in green. District scenery has collision; paths and district centers remain open for combat.

Twelve chests each open once per run. The three central chests grant 20 gold each; nine outer chests grant 45 gold each. Loot applies immediately: tempered blades add damage, vitality charms increase maximum health and heal, and elixir caches restore health and replenish an elixir up to the three-flask cap. The shrine north of the center restores up to 50 health for 30 gold, charging only when injured. Loot upgrades and chests reset on restart; the gold wallet carries over. The camera follows the player across the map and enemy portals spawn around the player's current location.

## Class abilities

Choose **Reaver**, **Arcanist**, or **Warden** before each run. Clear waves **1, 3, and 5** to unlock the selected class's abilities automatically, in addition to the usual blessing choice. Unlocks, barriers, and active effects reset on death; each new run lets you choose a different class. Class cooldowns refresh between waves.

| Class | Z · clear wave 1 | X · clear wave 3 | C · clear wave 5 |
| --- | --- | --- | --- |
| Reaver | Blood Cleave: close-range damage and healing on hit | Iron Skin: 60% damage reduction for 6s | Whirlwind: moving damage pulses for 4s |
| Arcanist | Hellfire Lance: piercing aimed beam | Frost Prison: freezes nearby foes (shorter on bosses) | Fallen Star: delayed meteor at the aim point |
| Warden | Judgment: holy area damage and healing on hit | Aegis: an 8s barrier worth 40% maximum health | Sanctuary: a moving healing and damage aura for 7s |

Press **K** or click **Class Path** to pause and inspect the full ability descriptions and unlock requirements. Class abilities also have clickable/touchable HUD buttons showing locks and cooldowns. On touch devices, targeted spells use your facing direction or the nearest enemy. **E** remains reserved for exploration interactions.

`dist/classes.js` contains the class progression and combat rules; `dist/classes.css` styles the selection, progression and HUD screens. `tests/classes.test.js` covers unlock gates, targeting, cooldowns, shields, healing, timed effects, and cleanup between waves/runs.

## Source files

- `dist/index.html`, `style.css`: responsive HUD, menus and upgrade choices.
- `dist/game.js`: procedural cathedral, actors, combat, input, effects and sound.
- `dist/rules.js`: progression, reward selection and bounded stat changes.
- `dist/boot.js`: engine loading and visible startup errors.
- `dist/vendor/`: pinned Three.js engine and MIT license.
- `tests/rules.test.js`: progression and state invariants.
- `.openai/hosting.json`: private Sites deployment identity and static directory.

## Development and validation

No dependency installation or production build is required. Run `npm run dev` to serve `dist/` on a free localhost port, printed at startup. The local server is explicitly authorized for this project and reads edits immediately; refresh the browser after changes. ES modules do not work through `file://`. Run `npm test` for rule tests and `npm run check` for JavaScript syntax checks. Cloud deployment is not part of the current workflow.

The rendering approach follows the [official Three.js installation guide](https://threejs.org/manual/pages/installation.html). All meshes, stone textures, lighting effects, and synthesized audio are created by code. No commercial game assets are used. Google Fonts are optional; local serif/sans-serif fallbacks remain usable if unavailable.

## Performance and scope

Rendering caps pixel density, shares actor geometry, bounds active enemies at 38 and particles at 260, and disposes transient GPU resources. Touch devices skip dynamic shadows. Gameplay is an original endless-wave arena prototype, with procedural scenery and builds; it does not yet include a campaign, inventory, multiplayer, or persistent character progression.

Browser verification should cover loading, movement, attacks, damage, upgrades, pause/resume, death/restart, responsive layout and touch controls. Automated rule checks alone do not prove GPU compatibility or physical mobile-device performance.

## Enemy loot and wallet

Every demon drops gold; walk within two units to collect it. The first kill and bosses other than Wave 05 guarantee a weapon; other kills have a 16% weapon chance. Press E or tap the interaction button near a weapon to swap, leaving the old weapon on the ground. Compare damage, seconds per attack, and reach in the prompt with your equipped weapon. Daggers attack quickly, axes hit hard, and spears have extra reach. Weapon quality increases with waves (Forged, Rare, Relic). Equipment resets each run; blessings remain independent of equipment. Ground drops remain between waves and reset on death/restart; up to 80 drops are retained, merging gold and retiring older weapons when full.

Collected gold and chest gold share a wallet saved immediately in browser localStorage (`ashen_gold`); shrine purchases use this same balance. Gold survives death and reload on the same browser origin, ready for future shops. Browser storage unavailable: play continues with a session wallet. Changing localhost port changes the browser storage origin.

`dist/loot.js` defines weapon modifiers, drop rolls, and wallet validation. Run `npm test` for loot, wallet, classes, exploration and progression tests; `npm run check` validates syntax.

## Wave 05 boss trophy

The Wave 05 Warden drops one Gilded Boss Chest at its death location, replacing normal boss loot. Press E or tap nearby to open it for exactly 100 gold and the guaranteed rare Gilded Resolve blessing (+20 maximum health, 20 healing, +15% Rend damage). The chest remains across wave transitions until claimed; death/new run clears it. Gold persists in `ashen_gold`; the previous wallet key migrates only when this key is absent.
