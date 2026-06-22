# Mobile Combat

A 3D browser fighting game built with [Astro](https://astro.build/) and [Three.js](https://threejs.org/). Two players battle locally on a Mayan Temple arena with keyboard controls, round-based scoring, and animated combat.

**Play online:** https://gilsonmandalogo.github.io/mobile-combat/

## Controls

Click the game canvas to focus it before using the keyboard.

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move left / right | `A` / `D` | `←` / `→` |
| Jump | `Space` | `Right Ctrl` |
| Punch up / down | `G` / `V` | `=` / `]` |
| Block | `Y` | `\` |

## Local development

```bash
yarn install
yarn dev
```

Open http://localhost:3000 to play locally. Build the static site with:

```bash
yarn build
```

## Deployment

The site is automatically deployed to GitHub Pages whenever changes are pushed to the `main` branch via the [deploy workflow](.github/workflows/deploy.yml).
