# Ludo prototype module map

The browser prototype is separated by responsibility.

- `config/board.js`: logical board coordinates, player metadata and track helpers.
- `state/game-state.js`: local prototype state.
- `engine/rules.js`: pure legal-move calculation.
- `controller/game-controller.js`: turn flow, roll handling, move resolution, captures and victory.
- `animations/animations.js`: token movement choreography and particle-effect creation.
- `rendering/board-renderer.js`: canvas board, perspective projection, token rendering and effects.
- `rendering/dice-renderer.js`: ivory dice painter.
- `rendering/animation-loop.js`: frame updates for dice/token animations and board redraw.
- `ui/game-ui.js`: player cards, HUD, event log, reactions and toast messages.
- `ui/interactions.js`: pointer and control event binding.
- `audio/sound-engine.js`: prototype sound effects.
- `main.js`: composition root; wires modules together.

## Prototype boundary

Dice results are still generated locally in the browser and the event log is simulated. These modules are not a production multiplayer authority. Real online play will require server-owned game state and validated commands.
