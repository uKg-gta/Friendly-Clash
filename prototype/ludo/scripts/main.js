import { PLAYERS, getLogicalCoords } from './config/board.js';
import { SoundEngine } from './audio/sound-engine.js';
import { state, currentPlayerIndex, initTokens } from './state/game-state.js';
import { createAnimations } from './animations/animations.js';
import { createBoardRenderer } from './rendering/board-renderer.js';
import { createDiceRenderer } from './rendering/dice-renderer.js';
import { createAnimationLoop } from './rendering/animation-loop.js';
import { createGameUI } from './ui/game-ui.js';
import { bindInteractions } from './ui/interactions.js';
import { createGameController } from './controller/game-controller.js';

const sound = new SoundEngine();
const animations = createAnimations({ state, sound, getLogicalCoords, PLAYERS });
const ui = createGameUI({ state, currentPlayerIndex });
const board = createBoardRenderer({ state, currentPlayerIndex });
const dice = createDiceRenderer();

const controller = createGameController({
  state, currentPlayerIndex, initTokens, sound,
  ...ui, ...animations, drawDice: dice.drawDice
});

bindInteractions({
  state, sound, currentPlayerIndex,
  executeAuthoritativeMove: controller.executeAuthoritativeMove,
  requestServerRoll: controller.requestServerRoll,
  resetGame: controller.resetGame,
  runShowcase: controller.runShowcase,
  boardCanvas: board.boardCanvas,
  project: board.project,
  unproject: board.unproject,
  getBoardMetrics: board.getBoardMetrics,
  showToast: ui.showToast
});

window.addEventListener('resize', board.resizeBoard);
window.addEventListener('load', () => {
  board.resizeBoard();
  controller.resetGame('classic');
  createAnimationLoop({ state, drawBoard: board.drawBoard, drawDice: dice.drawDice }).start();
});
