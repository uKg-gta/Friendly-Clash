import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLegalMoves } from '../prototype/ludo/scripts/engine/rules.js';

function makeState(steps) {
  return { tokens: steps.map(player => player.map(value => ({ steps: value }))) };
}

test('tokens in the yard can only enter on a six', () => {
  const state = makeState([[-1, -1, -1, -1]]);
  assert.deepEqual(computeLegalMoves(state, 0, 5), []);
  assert.deepEqual(computeLegalMoves(state, 0, 6), [0, 1, 2, 3]);
});

test('a token may finish only when the roll lands exactly on 56', () => {
  const state = makeState([[55, 54, 0, -1]]);
  assert.deepEqual(computeLegalMoves(state, 0, 1), [0, 1, 2]);
  assert.deepEqual(computeLegalMoves(state, 0, 2), [1, 2]);
});

test('finished tokens cannot move again', () => {
  const state = makeState([[56, 10, -1, -1]]);
  assert.deepEqual(computeLegalMoves(state, 0, 6), [1, 2, 3]);
});

