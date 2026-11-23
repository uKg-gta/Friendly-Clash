import { TRACK, SAFE_TRACK_INDICES, STAR_ONLY_INDICES, PLAYERS, getLogicalCoords, getTrackIndex } from './config/board.js';
import { SoundEngine } from './audio/sound-engine.js';
import { state, currentPlayerIndex, initTokens } from './state/game-state.js';
import { computeLegalMoves } from './engine/rules.js';

const sound = new SoundEngine();

// =========================================================================
      // 3. SIMULATED AUTHORITATIVE SERVER STATE & CONFIRMED LUDO RULES
      // =========================================================================
      function resetGame(mode = state.mode) {
        state.mode = mode;
        state.activePlayerIndices = mode === 'duo' ? [0, 2] : [0, 1, 2, 3];
        state.turnCursor = 0;
        state.phase = 'awaiting_roll';
        state.diceValue = 6;
        state.consecutiveSixes = 0;
        state.legalTokenIndices = [];
        state.stats = { rolls: 0, captures: 0, sixes: 0 };
        state.effects = [];
        state.tokenAnim = null;
        state.diceAnim.active = false;
        state.diceAnim.displayFace = 6;
        initTokens();

        document.getElementById('victoryModal').classList.remove('open');
        document.getElementById('provisionalBanner').classList.toggle('visible', mode === 'duo');
        document.getElementById('modeClassicBtn').classList.toggle('active', mode === 'classic');
        document.getElementById('modeDuoBtn').classList.toggle('active', mode === 'duo');

        clearEventLog();
        logServerEvent('ROOM', `Fresh ${mode === 'duo' ? 'Duo (2P Preview)' : 'Classic (4P)'} room initialized.`);
        updateUI();
        drawDice(state.diceAnim.displayFace, 0, 0);
      }

      // Authoritative roll request (supports forcedValue for interactive showcases)
      function requestServerRoll(forcedValue = null, onLandCallback = null) {
        if (state.phase !== 'awaiting_roll') return;
        const pIdx = currentPlayerIndex();
        const result = forcedValue !== null ? forcedValue : (Math.floor(Math.random() * 6) + 1);

        state.phase = 'rolling';
        state.stats.rolls += 1;
        if (result === 6) state.stats.sixes += 1;

        document.getElementById('serverStateBadge').textContent = 'Server Rolling...';
        setControlsEnabled(false);

        state.diceAnim = {
          active: true,
          startTime: performance.now(),
          duration: 1000, // Confirmed ~1s natural tumble, no skip
          targetValue: result,
          displayFace: state.diceAnim.displayFace,
          onComplete: () => {
            state.diceValue = result;
            state.diceAnim.displayFace = result;
            handleServerRollConfirmed(pIdx, result, onLandCallback);
          }
        };

        sound.playDiceTumble();
        logServerEvent('ROLL', `${PLAYERS[pIdx].name} requested roll → Server confirmed [${result}].`);
        updateUI();
      }

      function handleServerRollConfirmed(pIdx, roll, onLandCallback) {
        // Confirmed Rule: Three consecutive sixes forfeit turn with no move
        if (roll === 6) {
          state.consecutiveSixes += 1;
          if (state.consecutiveSixes >= 3) {
            sound.playForfeit();
            showToast(`${PLAYERS[pIdx].name} rolled three 6s — turn forfeited!`);
            triggerAvatarReaction(pIdx, '😮');
            logServerEvent('FORFEIT', `${PLAYERS[pIdx].name} hit 3 consecutive 6s. No move allowed; turn forfeited.`, 'forfeit');
            updateUI();
            setTimeout(() => {
              state.consecutiveSixes = 0;
              advanceTurn();
              if (onLandCallback) onLandCallback();
            }, 950);
            return;
          }
        } else {
          state.consecutiveSixes = 0;
        }

        const legal = computeLegalMoves(state, pIdx, roll);
        state.legalTokenIndices = legal;

        if (legal.length === 0) {
          // Confirmed Rule: If a player rolls a 6 with no legal move, the extra turn still applies
          if (roll === 6) {
            showToast(`${PLAYERS[pIdx].name} rolled 6 (no legal move) — extra turn applies!`);
            logServerEvent('EXTRA', `No legal move on 6. Confirmed rule: ${PLAYERS[pIdx].name} keeps extra turn.`);
            state.phase = 'awaiting_roll';
            updateUI();
            if (onLandCallback) onLandCallback();
          } else {
            showToast(`${PLAYERS[pIdx].name} rolled ${roll} — no legal moves.`);
            logServerEvent('PASS', `${PLAYERS[pIdx].name} has no legal moves on ${roll}.`);
            updateUI();
            setTimeout(() => {
              advanceTurn();
              if (onLandCallback) onLandCallback();
            }, 650);
          }
          return;
        }

        state.phase = 'awaiting_move';
        updateUI();

        if (onLandCallback) {
          onLandCallback();
        } else if (legal.length === 1) {
          // Smooth UX: briefly highlight the sole legal token, then let user tap or auto-hint
          showToast(`${PLAYERS[pIdx].name} rolled ${roll} — tap highlighted token.`);
        } else {
          showToast(`${PLAYERS[pIdx].name} rolled ${roll} — choose a highlighted token.`);
        }
      }

      function executeAuthoritativeMove(pIdx, tokenIdx) {
        if (state.phase !== 'awaiting_move') return;
        if (!state.legalTokenIndices.includes(tokenIdx)) return;

        const token = state.tokens[pIdx][tokenIdx];
        const roll = state.diceValue;
        const fromSteps = token.steps;
        const toSteps = fromSteps === -1 ? 0 : fromSteps + roll;

        state.phase = 'animating';
        state.legalTokenIndices = [];
        updateUI();

        // Build exact step waypoints for confirmed animations
        if (fromSteps === -1) {
          // Board Entry: small pop and settle
          const startPos = getLogicalCoords(pIdx, tokenIdx, -1);
          const endPos = getLogicalCoords(pIdx, tokenIdx, 0);
          sound.playEntryPop();
          logServerEvent('ENTRY', `${PLAYERS[pIdx].name} token #${tokenIdx + 1} entered board (pop & settle).`);

          animateSingleArc(pIdx, tokenIdx, startPos, endPos, 360, 0.85, () => {
            token.steps = 0;
            syncTokenToLogical(pIdx, tokenIdx);
            finishMoveResolution(pIdx, tokenIdx, roll, false, false);
          });
        } else {
          // Square-by-square bounce movement
          const waypoints = [];
          for (let s = fromSteps + 1; s <= toSteps; s++) {
            waypoints.push({ steps: s, pos: getLogicalCoords(pIdx, tokenIdx, s) });
          }

          animateWaypoints(pIdx, tokenIdx, waypoints, () => {
            token.steps = toSteps;
            syncTokenToLogical(pIdx, tokenIdx);

            // Check Home Arrival (steps === 56)
            if (toSteps === 56) {
              sound.playHomeSparkle();
              const pos = getLogicalCoords(pIdx, tokenIdx, 56);
              spawnHomeSparkle(pos.x, pos.y);
              triggerAvatarReaction(pIdx, '✨');
              logServerEvent('HOME', `${PLAYERS[pIdx].name} token #${tokenIdx + 1} reached home!`, 'home');

              // Check Victory (all 4 tokens at 56)
              const allHome = state.tokens[pIdx].every(t => t.steps === 56);
              if (allHome) {
                triggerVictory(pIdx);
                return;
              }
              finishMoveResolution(pIdx, tokenIdx, roll, false, true);
              return;
            }

            // Check Capture on main track (provisional safe square check, no blockades)
            const destTrackIdx = getTrackIndex(pIdx, toSteps);
            const capturedList = [];
            if (destTrackIdx !== -1 && !SAFE_TRACK_INDICES.has(destTrackIdx)) {
              state.activePlayerIndices.forEach(otherP => {
                if (otherP === pIdx) return;
                state.tokens[otherP].forEach((otherT, otherIdx) => {
                  if (getTrackIndex(otherP, otherT.steps) === destTrackIdx) {
                    capturedList.push({ pIdx: otherP, tokenIdx: otherIdx });
                  }
                });
              });
            }

            if (capturedList.length > 0) {
              state.stats.captures += capturedList.length;
              sound.playCapture();
              const impactPos = getLogicalCoords(pIdx, tokenIdx, toSteps);
              spawnCaptureImpact(impactPos.x, impactPos.y, PLAYERS[pIdx].color);
              triggerAvatarReaction(pIdx, '🔥');
              capturedList.forEach(c => triggerAvatarReaction(c.pIdx, '😵'));

              const names = capturedList.map(c => `${PLAYERS[c.pIdx].name} #${c.tokenIdx + 1}`).join(', ');
              logServerEvent('CAPTURE', `${PLAYERS[pIdx].name} captured ${names} → sent home (+1 extra turn).`, 'capture');
              showToast(`${PLAYERS[pIdx].name} captured ${names}! Extra turn granted.`);

              animateCapturedTokensHome(capturedList, () => {
                finishMoveResolution(pIdx, tokenIdx, roll, true, false);
              });
            } else {
              logServerEvent('MOVE', `${PLAYERS[pIdx].name} token #${tokenIdx + 1} moved ${roll} square${roll > 1 ? 's' : ''}.`);
              finishMoveResolution(pIdx, tokenIdx, roll, false, false);
            }
          });
        }
      }

      function finishMoveResolution(pIdx, tokenIdx, roll, didCapture, reachedHome) {
        // Confirmed rules: Rolling 6 grants extra turn; capture grants 1 extra turn (max 1 even on multi-capture)
        if (roll === 6 || didCapture) {
          state.phase = 'awaiting_roll';
          const reason = didCapture ? 'capture bonus' : 'rolled a 6';
          showToast(`${PLAYERS[pIdx].name} gets an extra turn (${reason})!`);
          updateUI();
        } else {
          advanceTurn();
        }
      }

      function advanceTurn() {
        state.consecutiveSixes = 0;
        state.turnCursor = (state.turnCursor + 1) % state.activePlayerIndices.length;
        state.phase = 'awaiting_roll';
        state.legalTokenIndices = [];
        updateUI();
      }

      function triggerVictory(pIdx) {
        state.phase = 'victory';
        sound.playVictory();
        spawnVictoryConfetti();
        PLAYERS.forEach((_, idx) => {
          triggerAvatarReaction(idx, idx === pIdx ? '🎉' : '👏');
        });
        logServerEvent('VICTORY', `${PLAYERS[pIdx].name} won the match!`, 'win');
        showToast(`${PLAYERS[pIdx].name} wins the match!`);
        updateUI();

        setTimeout(() => {
          document.getElementById('victoryTitle').textContent = `${PLAYERS[pIdx].name} Wins the Match!`;
          document.getElementById('statRolls').textContent = String(state.stats.rolls);
          document.getElementById('statCaptures').textContent = String(state.stats.captures);
          document.getElementById('statSixes').textContent = String(state.stats.sixes);
          document.getElementById('victoryModal').classList.add('open');
        }, 1250);
      }

      function syncTokenToLogical(pIdx, tokenIdx) {
        const t = state.tokens[pIdx][tokenIdx];
        const pos = getLogicalCoords(pIdx, tokenIdx, t.steps);
        t.renderX = pos.x;
        t.renderY = pos.y;
        t.renderZ = 0;
        t.scale = 1;
      }

      // =========================================================================
      // 4. ANIMATION HELPERS (BOUND STRICTLY TO SERVER-CONFIRMED RESULTS)
      // =========================================================================
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

      // =========================================================================
      // 5. ONE-TAP INTERACTIVE SHOWCASES (CONFIRMED BEHAVIOURS)
      // =========================================================================
      function runShowcase(kind) {
        if (state.phase === 'rolling' || state.phase === 'animating') return;
        document.getElementById('victoryModal').classList.remove('open');

        if (kind === 'entry') {
          state.turnCursor = 0;          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 0;
          state.tokens[0][0].steps = -1;
          syncTokenToLogical(0, 0);
          showToast('Showcase: Board Entry (rolling server-confirmed 6)');
          requestServerRoll(6, () => {
            setTimeout(() => executeAuthoritativeMove(0, 0), 260);
          });
        } else if (kind === 'move') {
          state.turnCursor = 0;
          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 0;
          state.tokens[0][0].steps = 2;
          syncTokenToLogical(0, 0);
          showToast('Showcase: Smooth Square-by-Square Bounce (rolling 5)');
          requestServerRoll(5, () => {
            setTimeout(() => executeAuthoritativeMove(0, 0), 260);
          });
        } else if (kind === 'capture') {
          state.turnCursor = 0;
          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 0;
          // Place Red at step 3 (track 3) and Yellow at track 6 (not a safe square!)
          // Yellow startIndex=26 => (26 + 32) % 52 = 6
          state.tokens[0][0].steps = 3;
          state.tokens[2][0].steps = 32;
          syncTokenToLogical(0, 0);
          syncTokenToLogical(2, 0);
          showToast('Showcase: Capture Impact (Red rolling 3 to land on Yellow)');
          requestServerRoll(3, () => {
            setTimeout(() => executeAuthoritativeMove(0, 0), 260);
          });
        } else if (kind === 'threeSixes') {
          state.turnCursor = 0;
          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 2; // Already rolled two 6s
          updateUI();
          showToast('Showcase: 3rd Consecutive 6 (turn forfeit, no move)');
          requestServerRoll(6);
        } else if (kind === 'homeArrival') {
          state.turnCursor = 0;
          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 0;
          state.tokens[0][0].steps = 53; // 3 steps away from 56
          syncTokenToLogical(0, 0);
          showToast('Showcase: Exact-Roll Home Arrival (sparkle & glow)');
          requestServerRoll(3, () => {
            setTimeout(() => executeAuthoritativeMove(0, 0), 260);
          });
        } else if (kind === 'victory') {
          state.turnCursor = 0;
          state.phase = 'awaiting_roll';
          state.consecutiveSixes = 0;
          state.tokens[0][0].steps = 56;
          state.tokens[0][1].steps = 56;
          state.tokens[0][2].steps = 56;
          state.tokens[0][3].steps = 54; // 2 away from victory
          for (let i = 0; i < 4; i++) syncTokenToLogical(0, i);
          showToast('Showcase: Final Token Home → Victory Celebration!');
          requestServerRoll(2, () => {
            setTimeout(() => executeAuthoritativeMove(0, 3), 260);
          });
        }
      }

      // =========================================================================
      // 6. PERSPECTIVE 3D PROJECTION & BOARD RENDERER
      // =========================================================================
      const boardCanvas = document.getElementById('boardCanvas');
      const bCtx = boardCanvas.getContext('2d');
      let boardMetrics = { width: 600, height: 576, cx: 300, cy: 288, baseSize: 500 };

      function resizeBoard() {
        const shell = document.getElementById('boardShell');
        const rect = shell.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        boardCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
        boardCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
        bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        boardMetrics = {
          width: rect.width,
          height: rect.height,
          cx: rect.width / 2,
          cy: rect.height / 2 - 6,
          baseSize: Math.min(rect.width * 0.84, rect.height * 0.84)
        };
      }

      // Slight 3D perspective projection from logical grid (0..15, 0..15, z>=0) to screen
      function project(lx, ly, lz = 0) {
        const { cx, cy, baseSize } = boardMetrics;
        const nx = (lx / 15) - 0.5; // -0.5 .. 0.5
        const ny = (ly / 15) - 0.5; // -0.5 .. 0.5
        const k = 0.24 * state.tiltAmount; // perspective depth factor
        const persp = 1 / (1 - ny * k);
        const ySquash = 1 - 0.1 * state.tiltAmount;

        const sx = cx + nx * baseSize * persp;
        const sy = cy + ny * baseSize * ySquash * persp - lz * (baseSize / 15) * 0.9 * persp;
        return { x: sx, y: sy, scale: persp };
      }

      // Exact algebraic inverse projection for pinpoint touch hit-testing (z = 0)
      function unproject(sx, sy) {
        const { cx, cy, baseSize } = boardMetrics;
        const k = 0.24 * state.tiltAmount;
        const ySquash = 1 - 0.1 * state.tiltAmount;
        const dy = (sy - cy) / (baseSize * ySquash);
        const ny = dy / (1 + dy * k);
        const persp = 1 / (1 - ny * k);
        const nx = (sx - cx) / (baseSize * persp);
        return { lx: (nx + 0.5) * 15, ly: (ny + 0.5) * 15 };
      }

      function fillProjectedQuad(x0, y0, x1, y1, fillStyle, strokeStyle = null, lineWidth = 1) {
        const p1 = project(x0, y0);
        const p2 = project(x1, y0);
        const p3 = project(x1, y1);
        const p4 = project(x0, y1);
        bCtx.beginPath();
        bCtx.moveTo(p1.x, p1.y);
        bCtx.lineTo(p2.x, p2.y);
        bCtx.lineTo(p3.x, p3.y);
        bCtx.lineTo(p4.x, p4.y);
        bCtx.closePath();
        if (fillStyle) {
          bCtx.fillStyle = fillStyle;
          bCtx.fill();
        }
        if (strokeStyle) {
          bCtx.strokeStyle = strokeStyle;
          bCtx.lineWidth = lineWidth;
          bCtx.stroke();
        }
      }

      function drawStar(cx, cy, outerR, innerR, fill) {
        bCtx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) bCtx.moveTo(x, y);
          else bCtx.lineTo(x, y);
        }
        bCtx.closePath();
        bCtx.fillStyle = fill;
        bCtx.fill();
      }

      function drawBoard(now) {
        const { width, height, baseSize } = boardMetrics;
        bCtx.clearRect(0, 0, width, height);

        // Soft ambient table vignette
        const bgGrad = bCtx.createRadialGradient(width / 2, height / 2, baseSize * 0.1, width / 2, height / 2, baseSize * 0.78);
        bgGrad.addColorStop(0, '#1D1F25');
        bgGrad.addColorStop(1, '#141519');
        bCtx.fillStyle = bgGrad;
        bCtx.fillRect(0, 0, width, height);

        // Physical Board Slab (3D thickness underneath front edge + soft ground shadow)
        const pad = 0.42;
        const bl = project(-pad, 15 + pad);
        const br = project(15 + pad, 15 + pad);
        const tl = project(-pad, -pad);
        const tr = project(15 + pad, -pad);
        const slabDepth = Math.max(6, 15 * state.tiltAmount);

        // Ground shadow
        bCtx.save();
        bCtx.beginPath();
        bCtx.moveTo(tl.x - 4, tl.y + slabDepth + 12);
        bCtx.lineTo(tr.x + 4, tr.y + slabDepth + 12);
        bCtx.lineTo(br.x + 12, br.y + slabDepth + 18);
        bCtx.lineTo(bl.x - 12, bl.y + slabDepth + 18);
        bCtx.closePath();
        bCtx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        bCtx.filter = 'blur(12px)';
        bCtx.fill();
        bCtx.restore();

        // Front edge thickness
        bCtx.beginPath();
        bCtx.moveTo(bl.x, bl.y);
        bCtx.lineTo(br.x, br.y);
        bCtx.lineTo(br.x, br.y + slabDepth);
        bCtx.lineTo(bl.x, bl.y + slabDepth);
        bCtx.closePath();
        bCtx.fillStyle = '#181512';
        bCtx.fill();
        bCtx.strokeStyle = 'rgba(214, 179, 106, 0.28)';
        bCtx.lineWidth = 1;
        bCtx.stroke();

        // Outer tactile board bezel (warm dark walnut/slate frame with subtle gold trim)
        fillProjectedQuad(-pad, -pad, 15 + pad, 15 + pad, '#24211D', 'rgba(214, 179, 106, 0.42)', 1.5);
        // Inner playing surface (warm ivory-parchment hybrid surface for classic legibility)
        fillProjectedQuad(0, 0, 15, 15, '#EFE9DC', 'rgba(24, 22, 18, 0.4)', 1);

        // Draw 52 Track Cells
        TRACK.forEach((cell, idx) => {
          const [c, r] = cell;
          let fill = '#F5F0E6';
          let starColor = null;

          if (idx === 0) { fill = PLAYERS[0].color; starColor = '#F0E8D8'; }
          else if (idx === 13) { fill = PLAYERS[1].color; starColor = '#F0E8D8'; }
          else if (idx === 26) { fill = PLAYERS[2].color; starColor = '#2A2210'; }
          else if (idx === 39) { fill = PLAYERS[3].color; starColor = '#F0E8D8'; }
          else if (STAR_ONLY_INDICES.has(idx)) {
            fill = '#EAE1CE';
            starColor = '#A88642';
          }

          fillProjectedQuad(c, r, c + 1, r + 1, fill, 'rgba(30, 28, 25, 0.22)', 0.9);

          if (starColor) {
            const center = project(c + 0.5, r + 0.5);
            const cellPx = (baseSize / 15) * center.scale;
            drawStar(center.x, center.y, cellPx * 0.33, cellPx * 0.14, starColor);
          }

          if (state.showLogicalGrid) {
            const center = project(c + 0.5, r + 0.5);
            bCtx.fillStyle = idx === 0 || idx === 13 || idx === 39 ? '#FFFFFF' : '#3A352E';
            bCtx.font = `700 ${Math.max(8, Math.floor((baseSize / 15) * 0.34))}px monospace`;
            bCtx.textAlign = 'center';
            bCtx.textBaseline = 'middle';
            bCtx.fillText(String(idx), center.x, center.y);
          }
        });

        // Draw 4 Home Paths (5 cells each)
        PLAYERS.forEach((p, pIdx) => {
          const dim = state.mode === 'duo' && !state.activePlayerIndices.includes(pIdx);
          p.homePath.forEach(([c, r]) => {
            fillProjectedQuad(c, r, c + 1, r + 1, dim ? '#DDD7CA' : p.color, 'rgba(30, 28, 25, 0.22)', 0.9);
          });
        });

        // Draw 4 Home Yards (6x6 corners)
        const yardBounds = [
          [0, 9, 6, 15],  // Red (bottom-left)
          [0, 0, 6, 6],   // Green (top-left)
          [9, 0, 15, 6],  // Yellow (top-right)
          [9, 9, 15, 15]  // Blue (bottom-right)
        ];

        PLAYERS.forEach((p, pIdx) => {
          const [x0, y0, x1, y1] = yardBounds[pIdx];
          const inactive = state.mode === 'duo' && !state.activePlayerIndices.includes(pIdx);
          fillProjectedQuad(x0, y0, x1, y1, inactive ? '#27282D' : p.color, 'rgba(20, 20, 22, 0.35)', 1.2);
          // Inner yard tray
          fillProjectedQuad(x0 + 0.8, y0 + 0.8, x1 - 0.8, y1 - 0.8, inactive ? '#1E1F24' : '#F7F3EA', 'rgba(20, 20, 22, 0.18)', 1);

          // 4 recessed token bases
          p.yardSlots.forEach(([sx, sy]) => {
            const pt = project(sx + 0.5, sy + 0.5);
            const r = (baseSize / 15) * 0.52 * pt.scale;
            bCtx.beginPath();
            bCtx.ellipse(pt.x, pt.y, r, r * (1 - 0.1 * state.tiltAmount), 0, 0, Math.PI * 2);
            bCtx.fillStyle = inactive ? 'rgba(255,255,255,0.05)' : p.tint;
            bCtx.fill();
            bCtx.strokeStyle = inactive ? 'rgba(255,255,255,0.1)' : p.color;
            bCtx.lineWidth = 1.6;
            bCtx.stroke();
          });

          // Highlight active player's yard border subtly in champagne gold
          if (!inactive && currentPlayerIndex() === pIdx && state.phase !== 'victory') {
            fillProjectedQuad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, null, '#D6B36A', 2.6);
          }
        });

        // Draw Center Finishing Triangles (6..9, 6..9)
        const cTL = project(6, 6), cTR = project(9, 6), cBR = project(9, 9), cBL = project(6, 9), cM = project(7.5, 7.5);
        const tris = [
          { pts: [cBL, cBR, cM], pIdx: 0 }, // Red bottom
          { pts: [cTL, cBL, cM], pIdx: 1 }, // Green left
          { pts: [cTL, cTR, cM], pIdx: 2 }, // Yellow top
          { pts: [cTR, cBR, cM], pIdx: 3 }  // Blue right
        ];
        tris.forEach(({ pts, pIdx }) => {
          const inactive = state.mode === 'duo' && !state.activePlayerIndices.includes(pIdx);
          bCtx.beginPath();
          bCtx.moveTo(pts[0].x, pts[0].y);
          bCtx.lineTo(pts[1].x, pts[1].y);
          bCtx.lineTo(pts[2].x, pts[2].y);
          bCtx.closePath();
          bCtx.fillStyle = inactive ? '#2A2B30' : PLAYERS[pIdx].color;
          bCtx.fill();
          bCtx.strokeStyle = 'rgba(24, 22, 18, 0.35)';
          bCtx.lineWidth = 1;
          bCtx.stroke();
        });

        // Subtle gold center medallion
        bCtx.beginPath();
        bCtx.arc(cM.x, cM.y, (baseSize / 15) * 0.36, 0, Math.PI * 2);
        bCtx.fillStyle = '#191A1E';
        bCtx.fill();
        bCtx.strokeStyle = '#D6B36A';
        bCtx.lineWidth = 1.6;
        bCtx.stroke();
        drawStar(cM.x, cM.y, (baseSize / 15) * 0.22, (baseSize / 15) * 0.09, '#D6B36A');

        // Draw Tokens (depth-sorted by renderY so closer tokens overlap naturally)
        drawAllTokens(now);

        // Draw Active Effects (impact rings, home sparkles, victory confetti)
        drawEffects(now);
      }

      function computeStackOffsets() {
        // Group tokens sharing the same logical cell (on main track or home path)
        const groups = new Map();
        state.activePlayerIndices.forEach(pIdx => {
          state.tokens[pIdx].forEach((t, tIdx) => {
            if (t.steps >= 0 && t.steps <= 55) {
              const key = `${Math.round(t.renderX * 2)},${Math.round(t.renderY * 2)}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push({ pIdx, tIdx });
            }
          });
        });

        const offsets = new Map();
        groups.forEach(list => {
          if (list.length <= 1) return;
          const pattern = [
            [-0.2, -0.15], [0.2, -0.15], [-0.2, 0.18], [0.2, 0.18], [0, 0]
          ];
          list.forEach((item, idx) => {
            const o = pattern[idx % pattern.length];
            offsets.set(`${item.pIdx}-${item.tIdx}`, { dx: o[0], dy: o[1], shrink: 0.82 });
          });
        });
        return offsets;
      }

      function drawAllTokens(now) {
        const stackOffsets = computeStackOffsets();
        const renderList = [];
        const activeP = currentPlayerIndex();

        state.activePlayerIndices.forEach(pIdx => {
          state.tokens[pIdx].forEach((t, tIdx) => {
            const off = stackOffsets.get(`${pIdx}-${tIdx}`) || { dx: 0, dy: 0, shrink: 1 };
            const isLegal = state.phase === 'awaiting_move' && pIdx === activeP && state.legalTokenIndices.includes(tIdx);
            renderList.push({
              pIdx, tIdx,
              lx: t.renderX + off.dx,
              ly: t.renderY + off.dy,
              lz: t.renderZ,
              shrink: off.shrink,
              isLegal
            });
          });
        });

        // Painter's algorithm sort: lower Y (further back) drawn first, airborne tokens on top
        renderList.sort((a, b) => (a.ly - b.ly) || (a.lz - b.lz));

        renderList.forEach(item => {
          draw3DToken(item, now);
        });
      }

      function draw3DToken(item, now) {
        const p = PLAYERS[item.pIdx];
        const ground = project(item.lx, item.ly, 0);
        const topPt = project(item.lx, item.ly, item.lz);
        const cellPx = (boardMetrics.baseSize / 15) * topPt.scale;
        const r = cellPx * 0.42 * item.shrink;
        const pawnH = cellPx * 0.56 * item.shrink;

        // Pulsing champagne-gold selection ring for legal moves
        if (item.isLegal) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
          bCtx.beginPath();
          bCtx.ellipse(ground.x, ground.y, r * (1.32 + pulse * 0.24), r * (1.1 + pulse * 0.2), 0, 0, Math.PI * 2);
          bCtx.strokeStyle = `rgba(214, 179, 106, ${0.55 + pulse * 0.45})`;
          bCtx.lineWidth = 2.4;
          bCtx.stroke();
        }

        // Ground shadow (softens & shrinks slightly as token hops higher)
        const shadowScale = Math.max(0.55, 1 - item.lz * 0.32);
        bCtx.beginPath();
        bCtx.ellipse(ground.x + 2, ground.y + 3, r * 1.05 * shadowScale, r * 0.65 * shadowScale, 0, 0, Math.PI * 2);
        bCtx.fillStyle = `rgba(10, 11, 14, ${0.38 * shadowScale})`;
        bCtx.fill();

        const cx = topPt.x;
        const cy = topPt.y;

        // 3D Pawn Base Disc
        bCtx.beginPath();
        bCtx.ellipse(cx, cy, r, r * 0.64, 0, 0, Math.PI * 2);
        bCtx.fillStyle = p.colorDark;
        bCtx.fill();

        // 3D Tapered Body
        const bodyGrad = bCtx.createLinearGradient(cx - r, cy - pawnH, cx + r, cy);
        bodyGrad.addColorStop(0, p.colorLight);
        bodyGrad.addColorStop(0.55, p.color);
        bodyGrad.addColorStop(1, p.colorDark);

        bCtx.beginPath();
        bCtx.moveTo(cx - r * 0.88, cy - 1);
        bCtx.quadraticCurveTo(cx - r * 0.55, cy - pawnH * 0.65, cx - r * 0.42, cy - pawnH * 0.88);
        bCtx.lineTo(cx + r * 0.42, cy - pawnH * 0.88);
        bCtx.quadraticCurveTo(cx + r * 0.55, cy - pawnH * 0.65, cx + r * 0.88, cy - 1);
        bCtx.ellipse(cx, cy - 1, r * 0.88, r * 0.52, 0, 0, Math.PI);
        bCtx.closePath();
        bCtx.fillStyle = bodyGrad;
        bCtx.fill();

        // 3D Spherical Crown Head
        const headR = r * 0.56;
        const headY = cy - pawnH;
        const headGrad = bCtx.createRadialGradient(cx - headR * 0.35, headY - headR * 0.35, headR * 0.1, cx, headY, headR);
        headGrad.addColorStop(0, '#FFFFFF');
        headGrad.addColorStop(0.28, p.colorLight);
        headGrad.addColorStop(0.8, p.color);
        headGrad.addColorStop(1, p.colorDark);

        bCtx.beginPath();
        bCtx.arc(cx, headY, headR, 0, Math.PI * 2);
        bCtx.fillStyle = headGrad;
        bCtx.fill();
        bCtx.strokeStyle = 'rgba(255,255,255,0.28)';
        bCtx.lineWidth = 0.8;
        bCtx.stroke();
      }

      function drawEffects(now) {
        const remaining = [];
        for (const fx of state.effects) {
          const t = (now - fx.startTime) / fx.duration;
          if (t >= 1) continue;
          remaining.push(fx);

          if (fx.type === 'ring') {
            const pt = project(fx.lx, fx.ly, 0.1);
            const r = (boardMetrics.baseSize / 15) * (0.4 + t * 1.4);
            bCtx.beginPath();
            bCtx.ellipse(pt.x, pt.y, r, r * 0.72, 0, 0, Math.PI * 2);
            bCtx.strokeStyle = fx.color;
            bCtx.globalAlpha = 1 - t;
            bCtx.lineWidth = 3 * (1 - t);
            bCtx.stroke();
            bCtx.globalAlpha = 1;
          } else if (fx.type === 'sparkle') {
            const pt = project(fx.lx + fx.vx * t * 1.4, fx.ly + fx.vy * t * 1.4, t * 0.8);
            bCtx.globalAlpha = 1 - t;
            drawStar(pt.x, pt.y, fx.size * (1.2 - t * 0.4), fx.size * 0.45, fx.color);
            bCtx.globalAlpha = 1;
          } else if (fx.type === 'confetti') {
            const x = (fx.x + fx.vx * t) * boardMetrics.width;
            const y = (fx.y + fx.vy * t + 0.18 * t * t) * boardMetrics.height;
            bCtx.save();
            bCtx.translate(x, y);
            bCtx.rotate(fx.rot + fx.vrot * t);
            bCtx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
            bCtx.fillStyle = fx.color;
            bCtx.fillRect(-fx.w / 2, -fx.h / 2, fx.w, fx.h);
            bCtx.restore();
          }
        }
        state.effects = remaining;
      }

      // =========================================================================
      // 7. CLASSIC IVORY DICE RENDERER (~1s NATURAL TUMBLE, DARK PIPS)
      // =========================================================================
      const diceCanvas = document.getElementById('diceCanvas');
      const dCtx = diceCanvas.getContext('2d');

      const PIP_LAYOUTS = {
        1: [[0.5, 0.5]],
        2: [[0.28, 0.28], [0.72, 0.72]],
        3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
        4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
        5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
        6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]]
      };

      function drawDice(face, angleRad, bounceOffset) {
        const w = diceCanvas.width;
        const h = diceCanvas.height;
        dCtx.clearRect(0, 0, w, h);

        dCtx.save();
        dCtx.translate(w / 2, h / 2 - bounceOffset);
        dCtx.rotate(angleRad);

        const size = 94;
        const r = 18;
        const x = -size / 2;
        const y = -size / 2;

        // Soft drop shadow
        dCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        dCtx.shadowBlur = 12;
        dCtx.shadowOffsetY = 6;

        // Classic Ivory Body
        const grad = dCtx.createLinearGradient(x, y, x + size, y + size);
        grad.addColorStop(0, '#FBF7EE');
        grad.addColorStop(0.65, '#EFE7D6');
        grad.addColorStop(1, '#D8CCB4');

        roundRectPath(dCtx, x, y, size, size, r);
        dCtx.fillStyle = grad;
        dCtx.fill();

        dCtx.shadowColor = 'transparent';
        dCtx.strokeStyle = 'rgba(130, 114, 86, 0.42)';
        dCtx.lineWidth = 2;
        dCtx.stroke();

        // Inner subtle dish bevel
        roundRectPath(dCtx, x + 7, y + 7, size - 14, size - 14, 13);
        dCtx.fillStyle = 'rgba(255, 252, 245, 0.55)';
        dCtx.fill();

        // Dark Recessed Pips
        const pips = PIP_LAYOUTS[face] || PIP_LAYOUTS[6];
        pips.forEach(([px, py]) => {
          const cx = x + px * size;
          const cy = y + py * size;
          dCtx.beginPath();
          dCtx.arc(cx, cy, 8.2, 0, Math.PI * 2);
          dCtx.fillStyle = '#1D1C1A';
          dCtx.fill();
          // Tiny top specular edge for physical depth
          dCtx.beginPath();
          dCtx.arc(cx + 1.4, cy + 1.6, 2.2, 0, Math.PI * 2);
          dCtx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          dCtx.fill();
        });

        dCtx.restore();
      }

      function roundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      // =========================================================================
      // 8. MAIN ANIMATION LOOP
      // =========================================================================
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

      // =========================================================================
      // 9. UI BINDINGS, HUD RENDERING & INTERACTION
      // =========================================================================
      function renderPlayerCards() {
        const topEl = document.getElementById('topPlayers');
        const botEl = document.getElementById('bottomPlayers');
        topEl.innerHTML = '';
        botEl.innerHTML = '';

        // Top row: Green (left), Yellow (right); Bottom row: Red (left), Blue (right)
        const order = [
          { idx: 1, target: topEl },
          { idx: 2, target: topEl },
          { idx: 0, target: botEl },
          { idx: 3, target: botEl }
        ];

        order.forEach(({ idx, target }) => {
          const p = PLAYERS[idx];
          const isActiveMode = state.activePlayerIndices.includes(idx);
          const isTurn = isActiveMode && currentPlayerIndex() === idx && state.phase !== 'victory';
          const tokens = state.tokens[idx];

          const card = document.createElement('div');
          card.className = `player-card${isTurn ? ' active-turn' : ''}${!isActiveMode ? ' inactive-mode' : ''}`;
          card.id = `playerCard-${idx}`;

          const dotsHtml = tokens.map(tok => {
            const cls = tok.steps === 56 ? 'pip-dot home' : tok.steps >= 0 ? 'pip-dot out' : 'pip-dot';
            const style = tok.steps >= 0 ? `background:${p.color};` : '';
            return `<span class="${cls}" style="${style}"></span>`;
          }).join('');

          const homeCount = tokens.filter(tok => tok.steps === 56).length;

          card.innerHTML = `
            <div class="avatar-wrap" style="background:${p.tint};border-color:${isActiveMode ? p.color : 'transparent'};">
              <span aria-hidden="true">${p.avatarGlyph}</span>
              <span class="avatar-reaction" id="reaction-${idx}"></span>
            </div>
            <div class="player-meta">
              <div class="player-name-row">
                <span class="player-name">${p.label}</span>
                <span class="turn-pill">Turn</span>
              </div>
              <div class="player-tokens-mini">
                ${dotsHtml}
                <span style="margin-left:4px;">${isActiveMode ? `${homeCount}/4 Home` : 'Inactive in Duo'}</span>
              </div>
            </div>
          `;
          target.appendChild(card);
        });
      }

      const reactionTimers = {};
      function triggerAvatarReaction(pIdx, emoji) {
        const el = document.getElementById(`reaction-${pIdx}`);
        if (!el) return;
        el.textContent = emoji;
        el.classList.add('show');
        clearTimeout(reactionTimers[pIdx]);
        reactionTimers[pIdx] = setTimeout(() => {
          el.classList.remove('show');
        }, 1600);
      }

      let toastTimer = null;
      function showToast(msg) {
        const el = document.getElementById('toastStatus');
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          el.classList.remove('visible');
        }, 2800);
      }

      function clearEventLog() {
        document.getElementById('eventLog').innerHTML = '';
      }

      function logServerEvent(tag, msg, cls = '') {
        const log = document.getElementById('eventLog');
        const row = document.createElement('div');
        row.className = 'log-entry';
        row.innerHTML = `<span class="log-tag ${cls}">${tag}</span><span class="log-msg">${msg}</span>`;
        log.prepend(row);
        while (log.children.length > 25) {
          log.removeChild(log.lastChild);
        }
      }

      function setControlsEnabled(canInteract) {
        document.querySelectorAll('.showcase-btn').forEach(btn => {
          btn.disabled = !canInteract;
        });
      }

      function updateUI() {
        renderPlayerCards();
        const p = PLAYERS[currentPlayerIndex()];
        const diceBtn = document.getElementById('diceBtn');
        const badge = document.getElementById('serverStateBadge');
        const turnLabel = document.getElementById('turnLabel');
        const turnHint = document.getElementById('turnHint');

        turnLabel.textContent = `${p.name}'s Turn`;
        turnLabel.style.color = p.colorLight;

        if (state.phase === 'awaiting_roll') {
          diceBtn.disabled = false;
          badge.textContent = 'Server Ready';
          turnHint.textContent = 'Tap the ivory dice to roll (1s natural tumble, no skip).';
          setControlsEnabled(true);
        } else if (state.phase === 'rolling') {
          diceBtn.disabled = true;
          badge.textContent = 'Rolling (~1s)';
          turnHint.textContent = 'Animating server-confirmed result...';
          setControlsEnabled(false);
        } else if (state.phase === 'awaiting_move') {
          diceBtn.disabled = true;
          badge.textContent = `Rolled ${state.diceValue}`;
          turnHint.textContent = `Tap a gold-ringed ${p.name} token on the board to move.`;
          setControlsEnabled(true);
        } else if (state.phase === 'animating') {
          diceBtn.disabled = true;
          badge.textContent = 'Syncing Move';
          turnHint.textContent = 'Playing confirmed token sequence...';
          setControlsEnabled(false);
        } else if (state.phase === 'victory') {
          diceBtn.disabled = true;
          badge.textContent = 'Match Complete';
          turnHint.textContent = `${p.name} won! Start a rematch or run another showcase.`;
          setControlsEnabled(true);
        }

        // Update consecutive 6s pips
        for (let i = 0; i < 3; i++) {
          const pip = document.getElementById(`streak${i}`);
          pip.className = 'streak-pip';
          if (i < state.consecutiveSixes) {
            pip.classList.add(state.consecutiveSixes >= 3 ? 'danger' : 'filled');
          }
        }
      }

      // Pinpoint touch/click selection on 3D-projected board
      boardCanvas.addEventListener('pointerdown', (e) => {
        if (state.phase !== 'awaiting_move') return;
        const rect = boardCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const activeP = currentPlayerIndex();

        // Check distance to projected screen center of each legal token (generous mobile hit radius)
        let bestToken = -1;
        let bestDist = Infinity;
        const hitRadius = Math.max(24, (boardMetrics.baseSize / 15) * 0.95);

        state.legalTokenIndices.forEach(tIdx => {
          const tok = state.tokens[activeP][tIdx];
          const pt = project(tok.renderX, tok.renderY, 0.25);
          const dist = Math.hypot(sx - pt.x, sy - pt.y);
          if (dist < hitRadius && dist < bestDist) {
            bestDist = dist;
            bestToken = tIdx;
          }
        });

        // Fallback: inverse-project tap onto logical cell
        if (bestToken === -1) {
          const logical = unproject(sx, sy);
          state.legalTokenIndices.forEach(tIdx => {
            const tok = state.tokens[activeP][tIdx];
            const dist = Math.hypot(logical.lx - tok.renderX, logical.ly - tok.renderY);
            if (dist < 1.15 && dist < bestDist) {
              bestDist = dist;
              bestToken = tIdx;
            }
          });
        }

        if (bestToken !== -1) {
          executeAuthoritativeMove(activeP, bestToken);
        }
      });

      // Control Listeners
      document.getElementById('diceBtn').addEventListener('click', () => requestServerRoll());
      document.getElementById('modeClassicBtn').addEventListener('click', () => resetGame('classic'));
      document.getElementById('modeDuoBtn').addEventListener('click', () => resetGame('duo'));
      document.getElementById('resetGameBtn').addEventListener('click', () => resetGame(state.mode));

      document.getElementById('gridOverlayBtn').addEventListener('click', (e) => {
        state.showLogicalGrid = !state.showLogicalGrid;
        e.currentTarget.classList.toggle('active', state.showLogicalGrid);
        showToast(state.showLogicalGrid ? 'Logical cell indices visible (separated from 3D projection).' : 'Logical cell overlay hidden.');
      });

      document.getElementById('soundToggleBtn').addEventListener('click', (e) => {
        sound.enabled = !sound.enabled;
        e.currentTarget.classList.toggle('active', sound.enabled);
        e.currentTarget.textContent = sound.enabled ? 'Sound: On' : 'Sound: Off';
      });

      document.getElementById('volumeSlider').addEventListener('input', (e) => {
        const val = Number(e.target.value);
        sound.volume = val / 100;
        document.getElementById('volumeVal').textContent = `${val}%`;
      });

      document.getElementById('fontSelect').addEventListener('change', (e) => {
        document.documentElement.style.setProperty('--font-active', e.target.value);
      });

      document.getElementById('perspectiveSlider').addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.tiltAmount = val / 100;
        document.getElementById('perspectiveVal').textContent = `${val}%`;
      });

      document.querySelectorAll('.showcase-btn').forEach(btn => {
        btn.addEventListener('click', () => runShowcase(btn.dataset.demo));
      });

      document.getElementById('rematchBtn').addEventListener('click', () => resetGame(state.mode));
      document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('victoryModal').classList.remove('open');
      });

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && state.phase === 'awaiting_roll' && !document.getElementById('victoryModal').classList.contains('open')) {
          e.preventDefault();
          requestServerRoll();
        }
      });

      window.addEventListener('resize', resizeBoard);

      window.onload = () => {
        resizeBoard();
        resetGame('classic');
        requestAnimationFrame(tick);
      };

