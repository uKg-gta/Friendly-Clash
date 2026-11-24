import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimations } from '../prototype/ludo/scripts/animations/animations.js';
import { createBoardRenderer } from '../prototype/ludo/scripts/rendering/board-renderer.js';
import { createDiceRenderer } from '../prototype/ludo/scripts/rendering/dice-renderer.js';
import { createAnimationLoop } from '../prototype/ludo/scripts/rendering/animation-loop.js';
import { createGameUI } from '../prototype/ludo/scripts/ui/game-ui.js';
import { bindInteractions } from '../prototype/ludo/scripts/ui/interactions.js';
import { createGameController } from '../prototype/ludo/scripts/controller/game-controller.js';

test('all separated browser modules expose their composition entry points', () => {
  assert.equal(typeof createAnimations, 'function');
  assert.equal(typeof createBoardRenderer, 'function');
  assert.equal(typeof createDiceRenderer, 'function');
  assert.equal(typeof createAnimationLoop, 'function');
  assert.equal(typeof createGameUI, 'function');
  assert.equal(typeof bindInteractions, 'function');
  assert.equal(typeof createGameController, 'function');
});
