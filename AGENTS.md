# mobile-combat

A 3D fighting game built with [Astro](https://astro.build/) and [Three.js](https://threejs.org/). It renders a single page (`src/pages/index.astro`) that mounts a WebGL canvas; all game logic lives under `src/` (game loop in `src/scene.ts`, `src/game.ts`, `src/player.ts`). 3D assets (models, animations, textures) are served from `public/assets`.

## Cursor Cloud specific instructions

### Tooling
- Package manager is **Yarn (classic, v1)** — a `yarn.lock` is committed. Use `yarn`, not npm.
- `.nvmrc` pins Node v19, but that version is not installed in this environment. Node v22 (the available version) installs, lints, builds, and runs the dev server without issues, so there is no need to install Node 19.

### Commands (see `package.json` scripts)
- Dev server: `yarn dev` — starts Astro on `http://localhost:3000`. Use `yarn dev --host 0.0.0.0` to expose it on the network. This is a static single-page app; there is no backend service.
- Lint: `yarn lint` — runs `eslint src --ext=.ts --fix`. Note the `--fix` flag means linting can rewrite source files in place.
- Build: `yarn build` — outputs a static site to `dist/`.
- There is no automated test suite in this repository.

### Running / testing the game (non-obvious)
- The game is a 3D scene rendered to a `<canvas>`. Keyboard controls are bound to the canvas element, so you must **click the canvas first to give it focus** before key presses register.
- Default Player 1 controls: `A`/`D` move, `Space` jump, `G` punch up, `V` punch down. Player 2 uses arrow keys, `Equal`/`BracketRight` to punch, etc. (defined in `src/stores/settings.ts`).
- The debug overlay (top-left text showing game status, player life, round timer, scores, plus collider wireframes) is **hidden by default**. There is no in-game UI to toggle it. To enable it for testing, set the persisted setting in the browser console and reload:
  ```js
  localStorage.setItem('settings', JSON.stringify({debug:true,inputs:{player1:{left:"KeyA",right:"KeyD",jump:"Space",attackUp:"KeyG",attackDown:"KeyV",block:"KeyY"},player2:{left:"ArrowLeft",right:"ArrowRight",jump:"ControlRight",attackUp:"Equal",attackDown:"BracketRight",block:"Backslash"},menu:"Escape"},inputType:"keyboard"}))
  ```
  The live round timer counting down (once per second) is a quick way to confirm the game loop is running.
