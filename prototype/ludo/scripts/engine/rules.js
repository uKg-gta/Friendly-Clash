      export function computeLegalMoves(state, playerIndex, roll) {
        const legal = [];
        const pTokens = state.tokens[playerIndex];
        for (let t = 0; t < 4; t++) {
          const s = pTokens[t].steps;
          if (s === -1) {
            if (roll === 6) legal.push(t);
          } else if (s >= 0 && s < 56) {
            if (s + roll <= 56) legal.push(t);
          }
        }
        return legal;
      }

