export function createAnimationLoop({ state, drawBoard, drawDice }) {
let lastFaceSwap = 0;

      function tick(now) {
        // Update Dice Tumble (~1s natural easing + deceleration)
        if (state.diceAnim.active) {
          const elapsed = now - state.diceAnim.startTime;
          const t = Math.min(1, elapsed / state.diceAnim.duration);
          const easeOut = 1 - Math.pow(1 - t, 3);

          // Swap intermediate faces faster at start, slowing down naturally
          const swapInterval = 55 + easeOut * 165;
          if (t < 0.88 && now - lastFaceSwap > swapInterval) {
            state.diceAnim.displayFace = ((state.diceAnim.displayFace) % 6) + 1;
            lastFaceSwap = now;
          } else if (t >= 0.88) {
            state.diceAnim.displayFace = state.diceAnim.targetValue;
          }

          const spin = (1 - easeOut) * Math.PI * 4.2;
          const bounce = Math.abs(Math.sin(t * Math.PI * 3.5)) * (1 - t) * 16;
          drawDice(state.diceAnim.displayFace, spin, bounce);

          if (t >= 1) {
            state.diceAnim.active = false;
            drawDice(state.diceAnim.targetValue, 0, 0);
            const cb = state.diceAnim.onComplete;
            if (cb) cb();
          }
        }

        // Update Active Token Animation
        if (state.tokenAnim) {
          const a = state.tokenAnim;
          const t = Math.min(1, (now - a.startTime) / a.duration);

          if (a.type === 'arc' || a.type === 'hop') {
            const tok = state.tokens[a.pIdx][a.tokenIdx];
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            tok.renderX = a.fromPos.x + (a.toPos.x - a.fromPos.x) * ease;
            tok.renderY = a.fromPos.y + (a.toPos.y - a.fromPos.y) * ease;
            tok.renderZ = Math.sin(t * Math.PI) * a.peakZ;

            if (t >= 1) {
              tok.renderX = a.toPos.x;
              tok.renderY = a.toPos.y;
              tok.renderZ = 0;
              const done = a.done;
              state.tokenAnim = null;
              done();
            }
          } else if (a.type === 'captureReturn') {
            const ease = 1 - Math.pow(1 - t, 3);
            a.items.forEach(item => {
              const tok = state.tokens[item.pIdx][item.tokenIdx];
              tok.renderX = item.fromPos.x + (item.toPos.x - item.fromPos.x) * ease;
              tok.renderY = item.fromPos.y + (item.toPos.y - item.fromPos.y) * ease;
              tok.renderZ = Math.sin(t * Math.PI) * 1.3;
            });
            if (t >= 1) {
              const done = a.done;
              state.tokenAnim = null;
              done();
            }
          }
        }

        drawBoard(now);
        requestAnimationFrame(tick);
      }
  return { start: () => requestAnimationFrame(tick) };
}
