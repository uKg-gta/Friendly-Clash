# Friendly-Clash

A private social gaming project for invited friends. This repository currently contains a modular browser prototype of Ludo, selected from the G prototype. The prototype is a development reference, not the production multiplayer app.

## Run locally

Use a local static server from the repository root (ES modules require HTTP):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/prototype/ludo/`.

## Project layout

- `prototype/ludo/index.html` — page structure only.
- `prototype/ludo/styles/` — design tokens, layout, components and responsive styles.
- `prototype/ludo/scripts/config/` — board geometry and player definitions.
- `prototype/ludo/scripts/state/` — game state and state helpers.
- `prototype/ludo/scripts/engine/` — pure Ludo rule calculations.
- `prototype/ludo/scripts/audio/` — synthesized sound effects.
- `prototype/ludo/scripts/main.js` — current prototype orchestration, rendering, animations and UI wiring. This is intentionally the next area to split into smaller modules.
- `tests/` — automated rule tests.
- `docs/` — architecture notes and development boundaries.

## Current limitations

- Dice results and game state are local to this browser prototype.
- The “server” event log is simulated; there is no online multiplayer server.
- Duo mode remains a preview and is not a validated two-player board implementation.
- No authentication, accounts, friends service, persistence or production backend is connected.

Do not treat UI labels such as “server-confirmed” as evidence of real server authority.

