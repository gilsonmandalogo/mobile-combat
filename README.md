# Mobile Combat

A 3D browser fighting game built with [Astro](https://astro.build/) and [Three.js](https://threejs.org/). Pick a fighter and a stage, then play a best of three.

**Play online:** https://gilsonmandalogo.github.io/mobile-combat/

## How to play

The first screen is the title. From there the path is main menu, mode and devices, character select, arena select, then the fight. Nothing loads the stage until both players have confirmed it.

- **Versus human** is local multiplayer. Each side can be a keyboard or a gamepad, including gamepad versus gamepad.
- **Versus AI** is a solo match. Choose easy, normal, hard, or nightmare on the mode screen. The choice is stored with the other settings. The computer approaches, attacks, blocks, crouch-blocks lows, jumps in more often on higher difficulties, anti-airs a jump, and retreats when it is hurt. It reads the fighter's manifest and performs specials by entering the same input sequences a player would, choosing a fireball at range or an uppercut against a jump-in. Easier profiles react slower, mistime inputs, attack less, crouch less, and throw fewer specials. Its fighter is chosen on the same roster screen.
- **Online** is on the main menu. Host shows a four-letter room code and a link. Guest types the code. Each player picks a fighter, the host picks the arena, and both press Ready. Input delay is 0 to 8 frames and is saved with the other settings. The match is lockstep rollback: both peers run the same fixed step, trade inputs for each frame, repeat the last remote input when a packet is late, and resimulate when the real input disagrees. Hits, blocks, and round calls play only after the frame is confirmed, once each, so a corrected hit is heard and the prediction is not played twice. A checksum goes out every 15 confirmed frames. If confirmation skips one, it is still sent, and the last few checksums repeat until the other peer acks them. The HUD shows ping and Live, Desync, or Opponent left. The HUD shows ping and Live, Desync, or Opponent left. Escape leaves the room. Rematch on the results panel waits until both accept, then the same room starts again with a new seed. Create offer and Accept code are a manual WebRTC fallback: paste the offer one way and the answer back. There is no game server. Trystero connects through public Nostr relays. `?net=loopback` swaps in an in-page transport so two browsers can be bridged without the internet.
- **Fighters** opens the roster. Player 1 cycles with `A` and `D`. Player 2 cycles with the arrow keys. A stick or d-pad does the same for that pad. **Arenas** then opens the stage list.
- A round lasts 60 seconds. Empty the opponent's life bar, or have more life when the clock hits zero. The center banner calls the round, a K.O., and the match winner. The results panel can rematch or return to the menu.
- **Escape** or **Start** pauses a local round. Resume, restart, open settings, or quit to the menu. The clock stays frozen while the pause menu is up, and that menu lists each fighter's moves. In an online round, Escape leaves the room so one peer cannot freeze the simulation.

Health bars, round pips, the clock, and a keyboard / gamepad / CPU tag stay on screen during the fight.

Menus take the keyboard, the mouse, and a gamepad. The d-pad or left stick moves the gold focus ring, **A** confirms, and **B** goes back. Arrow keys do the same. A hover plays a short cue. Panels rise open and drop closed. Focus and hover lift the control. A health bar drops at once, and a pale trail catches up. A large hit flashes and shakes that bar. The round call and the K.O. banner scale in. `prefers-reduced-motion: reduce` cuts those transitions.

## Controls

Keys work as soon as the page is open. Default bindings:

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move left / right | `A` / `D` | `←` / `→` |
| Jump | `Space` | `Right Ctrl` |
| Punch up / down | `G` / `V` | `=` / `]` |
| Block | `Y` | `\` |
| Crouch | `S` | `↓` |
| Pause | `Escape` | `Escape` |

A gamepad uses the standard mapping. In a round, the left stick or d-pad moves, and down on the stick, the d-pad, or **LT** crouches. **A** jumps, **X** punches up, **Y** punches down, and **RB** blocks. Crouch is also a rebindable button. On a hit, the pad rumbles through `vibrationActuator` or `hapticActuators` when the browser provides one.

Specials are Mortal Kombat-style sequences of two or three inputs inside a short window. Directions are relative to the way the fighter is facing: back, forward, then a punch or a kick. Colin's Ember is back, forward, punch and throws a fireball. Maria's Needle is back, forward, kick and dashes in. Her Slip is back, up, kick and blinks past the opponent. Brute's Riser is forward, up, punch and launches. The pause menu prints the list for whoever is in the match, including Block and Crouch. Holding up as the middle of a special does not jump, so the button can still finish the sequence. Holding down crouches and will not walk. Crouch plus punch, or crouch plus kick, is the crouching attack from the manifest.

Jump reads the stick once, then a few prejump frames, then a fixed arc. Neutral is straight up. Toward the way you face is a forward jump. Away is a back jump. The horizontal speed stays locked: there is no air control and no second jump. You cannot block in the air. Punch or kick in the air is the jump attack from the manifest, one per jump, and it is an overhead, so it has to be blocked standing. Landing takes a few recovery frames and turns you toward the opponent, including after you jump over them. A hit in the air pops into a juggle and then a knockdown on the ground. Grounded fighters cannot overlap; an airborne fighter can pass over. The view exposes poses for later clips: `jumpStart`, `jumpAscend`, `jumpPeak`, `jumpDescend`, `jumpLand`, `jumpAttack`, and `juggle`. Until those clips exist, the body uses a small squash or lean.

Hold **Block** on the ground while facing the hit. The fighter leans back, the guard flashes blue, and the HUD reads BLOCK. Crouching makes the hurtbox shorter and the guard low. A blocked strike deals chip damage instead of the full hit, then a short block stun and a smaller pushback. Chip is a fraction from 0 to 1 on each move and combo in the manifest. When it is omitted, the fraction is 0.2. A chip of 0 negates the strike. You cannot block in the air, and you cannot block a hit that comes from behind. Facing stays locked while the guard is up, so a cross-up such as Maria's Slip lands full if it connects from the back. There is no throw. A throw would ignore the guard. A standing block stops highs, mids, and overheads, including a jump-in. It does not stop a low. A crouch block stops mids and lows. It does not stop an overhead or a jump-in, and a high whiffs on the short hurtbox. Every other strike and projectile in the current roster can be chipped when the guard is legal. The AI blocks, crouch-blocks, and throws lows according to its difficulty profile.

Open **Settings** from the main menu or the pause menu to rebind a key or a button: click the binding, then press the new input. Taking a key that the same player already uses swaps the two actions. **Reset to defaults** restores bindings and volumes. Choices are stored in `localStorage`.

Music and effect volumes are sliders in that same panel. Hits, punches, blocks, K.O.s, the round call, and the menu click are short tones synthesized with the Web Audio API. The background phrase is synthesized the same way. There are no third-party audio files; the synthesis is original code under the project MIT license.

## Adding a character

Each fighter is a folder under `src/content/characters/<id>/` with a `manifest.json`. The loader discovers those folders with `import.meta.glob`, checks the file with zod, and refuses a manifest whose `id` does not match the folder name. Drop in the folder and reload. No registry edit.

Colin Cole and Maria Bennett use the models already in `public/assets/models/` (`Mr-Colin-Cole.glb`, `Maria-Bennett.glb`), shipped with this project. Brute is an original procedural mesh, MIT, with no third-party geometry.

```json
{
  "id": "brute",
  "name": "Brute",
  "portrait": { "color": "#8d2f2f", "mark": "B" },
  "stats": { "health": 130, "speed": 2.5, "damage": 1.35 },
  "animations": {
    "idle": "Idle",
    "walkForward": "WalkForward",
    "walkBackward": "WalkBackward",
    "punchUp": "PunchUp",
    "punchDown": "PunchDown"
  },
  "model": {
    "kind": "primitive",
    "color": "#8d2f2f",
    "scale": 1.15,
    "license": "Original procedural model, MIT, no third-party mesh."
  },
  "moves": [
    { "name": "Hammer", "input": "Punch up", "damage": 12, "chip": 0.2, "slot": "attackUp", "hitLevel": "high", "height": "stand" }
  ],
  "combos": [
    {
      "id": "riser",
      "name": "Riser",
      "sequence": ["forward", "up", "punch"],
      "window": 0.55,
      "damage": 22,
      "effect": "uppercut",
      "startup": 0.1,
      "active": 0.14,
      "recovery": 0.34,
      "reach": 0.85,
      "hitY": 1.45,
      "hitW": 0.7,
      "hitH": 0.7,
      "knockback": 5,
      "hop": 8.5,
      "chip": 0.5,
      "hitLevel": "overhead"
    }
  ]
}
```

`model.kind` may be `glb` with a `file` such as `assets/models/Your-Fighter.glb`, a `scale`, and a `license`. Combo `sequence` entries are `back`, `forward`, `up`, `punch`, or `kick` (two or three of them). `effect` is `projectile`, `dash`, `uppercut`, or `teleport`. `window` is seconds, at most 1.5. Optional `chip` on a move or combo is the fraction of damage that lands on a legal block. Leave it out to use 0.2. Optional `hitLevel` is `high`, `mid`, `low`, or `overhead`. Optional `height` is `stand`, `crouch`, or `air`. `slot` is `attackUp`, `attackDown`, `crouchPunch`, `crouchKick`, `jumpPunch`, or `jumpKick`. A crouch or jump slot can also set `startup`, `active`, `recovery`, `reach`, `hitY`, `hitW`, `hitH`, `knockback`, and `hop`. Optional `air` on the character sets `hurtHeight` and `hurtHalfW` for the airborne hurtbox. A broken field fails the load with the file path and the field name.

Difficulty profiles live in `src/content/ai/difficulties.json`. Each of easy, normal, hard, and nightmare sets reaction time, how often an input is wrong or late, aggression, how often a special is attempted, block chance, crouch-block chance, how often an attack is a low, how often an approach becomes a jump, and how often a special is followed by another hit. The loader checks that file with zod.

## Adding an arena

Stages live in `src/content/arenas/<id>/manifest.json` and are discovered the same way. Mayan Temple uses `public/assets/models/Mayan-Temple.glb`, shipped with this project. Ember Pit and Moon Court are original procedural stages, MIT, with no third-party mesh. `music` is `temple`, `pit`, or `court`, which picks the synthesized phrase.

```json
{
  "id": "ember-pit",
  "name": "Ember Pit",
  "preview": { "color": "#ff6a1a", "mark": "E" },
  "environment": {
    "kind": "primitive",
    "background": "#140806",
    "fog": "#2a100c",
    "floor": "#3a1c16",
    "accent": "#ff6a1a",
    "ambient": "#ffb089",
    "ambientIntensity": 0.35,
    "sun": { "color": "#ffb15a", "intensity": 1.35, "position": [-2, 7, 3] },
    "license": "Original procedural arena, MIT, no third-party mesh."
  },
  "bounds": { "minX": -4.5, "maxX": 4.5 },
  "spawns": [-2.4, 2.4],
  "music": "pit"
}
```

`environment.kind` may instead be `glb` with `file`, `background`, and `license`. Spawns have to sit inside the bounds. Those bounds are the walls of the round, and the spawns are where the fighters reset.

## Local development

Node 22 or newer. `.nvmrc` pins 22.

```bash
yarn install
yarn dev
```

Open http://localhost:3000/mobile-combat/ . The dev server uses the Astro `base` path. Build the static site with:

```bash
yarn build
```

## Tests

```bash
yarn lint:check
yarn typecheck
yarn test:unit
yarn test:e2e
```

`yarn test` runs the unit tests and then the browser tests. End-to-end tests start the dev server themselves and drive Chromium. Install the browser once with:

```bash
yarn playwright install chromium
```

Append `?debug=1` to expose `window.__MOBILE_COMBAT__` (`getState`, `setIntent`, `stepFor`, `setVirtualGamepad`, `getAudio`, and, with `net=loopback`, `takeNet`, `pushNet`, `netInfo`, `netSum`). Add `&autostart=1` to skip the menus. `mode=ai`, `difficulty=nightmare`, `seed=1`, `characters=colin,maria`, and `arena=ember-pit` are optional. `difficulty` accepts easy, normal, hard, or nightmare. `net=loopback` keeps online play on the in-page transport. The debug overlay of collider wireframes is separate: it follows the `debug` flag inside the saved settings.

GitHub Actions runs lint, the typecheck, unit tests, and end-to-end tests on every push and pull request.

## Deployment

The site is deployed to GitHub Pages when `main` changes, via the [deploy workflow](.github/workflows/deploy.yml).
