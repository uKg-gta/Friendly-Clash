      export const state = {
        mode: 'classic', // 'classic' | 'duo'
        activePlayerIndices: [0, 1, 2, 3],
        turnCursor: 0, // index into activePlayerIndices
        tokens: [], // [4][4] of { steps: -1..56, renderX, renderY, renderZ, scale }
        phase: 'awaiting_roll', // 'awaiting_roll' | 'rolling' | 'awaiting_move' | 'animating' | 'victory'
        diceValue: 6,
        consecutiveSixes: 0,
        legalTokenIndices: [],
        showLogicalGrid: false,
        tiltAmount: 0.65,
        stats: { rolls: 0, captures: 0, sixes: 0 },
        effects: [], // rings, sparkles, confetti
        diceAnim: { active: false, startTime: 0, duration: 1000, targetValue: 6, displayFace: 6 },
        tokenAnim: null
      };

      export function currentPlayerIndex() {
        return state.activePlayerIndices[state.turnCursor];
      }

      export function initTokens() {
        state.tokens = PLAYERS.map((p, pIdx) =>
          [0, 1, 2, 3].map((tIdx) => {
            const pos = getLogicalCoords(pIdx, tIdx, -1);
            return { steps: -1, renderX: pos.x, renderY: pos.y, renderZ: 0, scale: 1 };
          })
        );
      }

