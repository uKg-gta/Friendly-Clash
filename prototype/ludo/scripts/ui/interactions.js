export function bindInteractions({
  state, sound, currentPlayerIndex, executeAuthoritativeMove, requestServerRoll,
  resetGame, runShowcase, boardCanvas, project, unproject, getBoardMetrics, showToast
}) {
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
        const hitRadius = Math.max(24, (getBoardMetrics().baseSize / 15) * 0.95);

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
}
