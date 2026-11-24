# Friendly-Clash

A private social gaming project for invited friends. This repository currently contains a modular browser prototype of Ludo, selected from the G prototype. It is a development reference, not the production multiplayer app.

## Run locally

Use a local static server from the repository root (ES modules require HTTP):

```bash
python -m http.server 8000
```

Open `http://localhost:8000/prototype/ludo/`.

Run automated checks:

```bash
npm test
```

## Ludo prototype structure

- `prototype/ludo/index.html` — semantic page markup.
- `styles/` — design tokens, layout, components and responsive rules.
- `scripts/config/` — logical board geometry and player definitions.
- `scripts/state/` — in-memory prototype state.
- `scripts/engine/` — pure Ludo rule calculations.
- `scripts/controller/` — turn flow, dice request flow, moves, captures and victory.
- `scripts/animations/` — token movement and visual effects.
- `scripts/rendering/` — board, dice and animation frame rendering.
- `scripts/ui/` — HUD, player cards and input event binding.
- `scripts/audio/` — synthesized sound effects.
- `scripts/main.js` — composition root that wires modules together.

See [the module map](docs/ludo-module-map.md) and [architecture notes](docs/architecture.md).

## Change-safety

- Keep rules independent of DOM and canvas.
- Add or update tests when changing rule calculations.
- Run `npm test` before committing.
- GitHub Actions runs the same test command on pushes and pull requests to `main`.

## Current limitations

- Dice results and game state are local to this browser prototype.
- The event log is simulated; there is no online multiplayer server.
- Duo mode remains a visual preview, not a validated two-player implementation.
- There is no authentication, friend service, persistence or production backend.

Do not treat UI labels such as “server-confirmed” as evidence of real server authority.
