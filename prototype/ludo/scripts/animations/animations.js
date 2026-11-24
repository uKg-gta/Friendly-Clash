export function createAnimations({ state, sound, getLogicalCoords, PLAYERS }) {
function animateSingleArc(pIdx, tokenIdx, fromPos, toPos, duration, peakZ, done) {
        state.tokenAnim = {
          type: 'arc',
          pIdx,
          tokenIdx,
          fromPos,
          toPos,
          startTime: performance.now(),
          duration,
          peakZ,
          done
        };
      }

      function animateWaypoints(pIdx, tokenIdx, waypoints, done) {
        const token = state.tokens[pIdx][tokenIdx];
        let stepIdx = 0;

        function nextHop() {
          if (stepIdx >= waypoints.length) {
            state.tokenAnim = null;
            done();
            return;
          }
          const fromPos = { x: token.renderX, y: token.renderY };
          const toPos = waypoints[stepIdx].pos;
          sound.playHop(stepIdx);
          state.tokenAnim = {
            type: 'hop',
            pIdx,
            tokenIdx,
            fromPos,
            toPos,
            startTime: performance.now(),
            duration: 165, // Crisp, smooth square-by-square bounce
            peakZ: 0.52,
            done: () => {
              token.steps = waypoints[stepIdx].steps;
              stepIdx += 1;
              nextHop();
            }
          };
        }
        nextHop();
      }

      function animateCapturedTokensHome(capturedList, done) {
        const items = capturedList.map(c => {
          const tok = state.tokens[c.pIdx][c.tokenIdx];
          return {
            pIdx: c.pIdx,
            tokenIdx: c.tokenIdx,
            fromPos: { x: tok.renderX, y: tok.renderY },
            toPos: getLogicalCoords(c.pIdx, c.tokenIdx, -1)
          };
        });
        state.tokenAnim = {
          type: 'captureReturn',
          items,
          startTime: performance.now(),
          duration: 520,
          done: () => {
            items.forEach(item => {
              state.tokens[item.pIdx][item.tokenIdx].steps = -1;
              syncTokenToLogical(item.pIdx, item.tokenIdx);
            });
            done();
          }
        };
      }

      // Visual Particle Effects (Impact, Sparkle, Confetti)
      function spawnCaptureImpact(lx, ly, color) {
        state.effects.push({
          type: 'ring',
          lx, ly, color,
          startTime: performance.now(),
          duration: 460
        });
      }

      function spawnHomeSparkle(lx, ly) {
        const now = performance.now();
        for (let i = 0; i < 18; i++) {
          const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.2;
          const speed = 0.6 + Math.random() * 1.1;
          state.effects.push({
            type: 'sparkle',
            lx, ly,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2.2 + Math.random() * 2.6,
            color: i % 2 === 0 ? '#D6B36A' : '#F0E8D8',
            startTime: now,
            duration: 650 + Math.random() * 250
          });
        }
      }

      function spawnVictoryConfetti() {
        const now = performance.now();
        const palette = ['#D6B36A', '#F0E8D8', '#D94B4B', '#3FA36C', '#E2B93B', '#3D7FD6'];
        for (let i = 0; i < 75; i++) {
          state.effects.push({
            type: 'confetti',
            x: Math.random(),
            y: -0.05 - Math.random() * 0.2,
            vx: (Math.random() - 0.5) * 0.25,
            vy: 0.28 + Math.random() * 0.32,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 8,
            w: 6 + Math.random() * 5,
            h: 4 + Math.random() * 4,
            color: palette[i % palette.length],
            startTime: now,
            duration: 2100 + Math.random() * 800
          });
        }
      }
  return {
    animateSingleArc, animateWaypoints, animateCapturedTokensHome,
    spawnCaptureImpact, spawnHomeSparkle, spawnVictoryConfetti
  };
}
