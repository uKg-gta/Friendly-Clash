# Prototype architecture

## Current boundaries

The browser prototype is kept under `prototype/ludo/` so it cannot be confused with a future native Android application. The HTML file owns markup only; styles and JavaScript are loaded from separate files. JavaScript uses ES modules.

- `config/board.js`: board track, safe-square indices, player configuration and logical coordinate helpers.
- `state/game-state.js`: in-memory match state and token initialization helpers.
- `engine/rules.js`: pure legal-move calculation, isolated for automated tests.
- `audio/sound-engine.js`: synthesized sound effects.
- `main.js`: temporary composition root for game orchestration, canvas rendering, animations and UI events. Split this further before adding substantial features.

## Change-safety rules

1. Keep game rules independent from DOM and canvas rendering.
2. Add or update automated tests when changing rule calculations.
3. Keep visual rendering separate from authoritative game state.
4. Never describe local random dice or simulated logs as online/server-authoritative.
5. Make future modules small and single-purpose; avoid rebuilding a single giant `index.html`.
6. Validate syntax and run `npm test` before committing.

## Future production boundary

This prototype is not the final Android architecture. A later migration can replace the browser UI while preserving tested pure game rules where appropriate. Real multiplayer must use a server-authoritative game session; browser-side state is not trusted.

