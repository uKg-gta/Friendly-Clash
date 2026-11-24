import { PLAYERS } from '../config/board.js';

export function createGameUI({ state, currentPlayerIndex }) {
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
  return {
    renderPlayerCards, triggerAvatarReaction, showToast, clearEventLog,
    logServerEvent, setControlsEnabled, updateUI
  };
}
