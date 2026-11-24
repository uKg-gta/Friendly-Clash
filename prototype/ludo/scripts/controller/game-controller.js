import { PLAYERS, SAFE_TRACK_INDICES, getLogicalCoords, getTrackIndex } from '../config/board.js';
import { computeLegalMoves } from '../engine/rules.js';

export function createGameController(deps) {
  const {
    state, currentPlayerIndex, initTokens, sound, clearEventLog, logServerEvent,
    updateUI, drawDice, setControlsEnabled, showToast, triggerAvatarReaction,
    animateSingleArc, animateWaypoints, animateCapturedTokensHome,
    spawnHomeSparkle, spawnCaptureImpact, spawnVictoryConfetti
  } = deps;

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

  return {
    resetGame, requestServerRoll, handleServerRollConfirmed,
    executeAuthoritativeMove, finishMoveResolution, advanceTurn,
    triggerVictory, syncTokenToLogical, runShowcase
  };
}
