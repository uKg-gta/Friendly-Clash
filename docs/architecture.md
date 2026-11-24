# Prototype architecture

## Current boundaries

The browser prototype lives under `prototype/ludo/` so it remains separate from a future native Android application. The HTML file owns markup; CSS and JavaScript are loaded from separate files using ES modules.

- `config/board.js`: board track, safe-square indices, player configuration and logical coordinate helpers.
- `state/game-state.js`: in-memory match state and token initialization.
- `engine/rules.js`: pure legal-move calculation.
- `controller/game-controller.js`: turn flow, roll handling, move resolution, captures and victory.
- `animations/animations.js`: token movement choreography and visual effect creation.
- `rendering/board-renderer.js`: board projection, board cells, tokens and effects.
- `rendering/dice-renderer.js`: dice drawing.
- `rendering/animation-loop.js`: frame updates for dice/token animations and board redraw.
- `ui/game-ui.js`: player cards, HUD, event log, reactions and toast messages.
- `ui/interactions.js`: pointer, keyboard and control event binding.
- `audio/sound-engine.js`: synthesized sound effects.
- `main.js`: composition root only; creates modules and injects dependencies.

## Change-safety rules

1. Keep game rules independent from DOM and canvas rendering.
2. Add or update automated tests when changing rule calculations.
3. Keep rendering separate from game-state transitions.
4. Do not describe local random dice or simulated logs as online/server-authoritative.
5. Keep modules single-purpose; do not rebuild a giant `index.html` or monolithic script.
6. Run `npm test` before committing. GitHub Actions also runs the test suite for pushes and pull requests to `main`.

## Future production boundary

This remains a browser prototype, not the final Android architecture. A later migration may preserve suitable tested pure rules while replacing the UI. Real multiplayer must use server-owned state and validated commands; browser-side state is not trusted.
