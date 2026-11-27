# Mobile Combat

A 3D browser fighting game built with [Astro](https://astro.build/) and [Three.js](https://threejs.org/). Two fighters share a Mayan temple floor. The first to win two rounds takes the match.

**Play online:** https://gilsonmandalogo.github.io/mobile-combat/

## How to play

Open the game and use the main menu to name the fighters, pick a mode, and assign a device to each human player.

- **Versus human** is local multiplayer. Each side can be a keyboard or a gamepad, including gamepad versus gamepad.
- **Versus AI** is a solo match. Choose easy, normal, or hard. The computer approaches, attacks, blocks, jumps low punches, and retreats when it is hurt.
- **Start match** begins a best of three. A round lasts 60 seconds. Empty the opponent's life bar, or have more life when the clock hits zero. The center banner calls the round, a K.O., and the match winner.
- **Escape** pauses the round. Resume, restart, open settings, or quit to the menu. The clock stays frozen while the pause menu is up.

Health bars, round pips, the clock, and a keyboard / gamepad / CPU tag stay on screen during the fight.

## Controls

Keys work as soon as the page is open. Default bindings:

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move left / right | `A` / `D` | `←` / `→` |
| Jump | `Space` | `Right Ctrl` |
| Punch up / down | `G` / `V` | `=` / `]` |
| Block | `Y` | `\` |
| Pause | `Escape` | `Escape` |

A gamepad uses the standard mapping. The left stick or d-pad moves. **A** jumps, **X** punches up, **Y** punches down, and **RB** blocks. On a hit, the pad rumbles through `vibrationActuator` or `hapticActuators` when the browser provides one.

Open **Settings** from the main menu or the pause menu to rebind a key or a button: click the binding, then press the new input. Taking a key that the same player already uses swaps the two actions. **Reset to defaults** restores bindings and volumes. Choices are stored in `localStorage`.

Music and effect volumes are sliders in that same panel. Hits, punches, blocks, K.O.s, the round call, and the menu click are short tones synthesized with the Web Audio API. The background phrase is synthesized the same way. There are no third-party audio files; the synthesis is original code under the project MIT license.

## Local development

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

Append `?debug=1` to expose `window.__MOBILE_COMBAT__` (`getState`, `setIntent`, `stepFor`, `setVirtualGamepad`, `getAudio`). Add `&autostart=1` to skip the menu. `mode=ai`, `difficulty=hard`, and `seed=1` are optional. The debug overlay of collider wireframes is separate: it follows the `debug` flag inside the saved settings.

GitHub Actions runs lint, the typecheck, unit tests, and end-to-end tests on every push and pull request.

## Deployment

The site is deployed to GitHub Pages when `main` changes, via the [deploy workflow](.github/workflows/deploy.yml).
