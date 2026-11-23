      // 1. LOGICAL BOARD GEOMETRY (STRICTLY SEPARATED FROM VISUAL PROJECTION)
      // =========================================================================
      // 15x15 logical grid: col 0..14, row 0..14
      // Provisional standard 52-cell clockwise main track (pending Stage 1 validation)
      export const TRACK = [
        [6,13],[6,12],[6,11],[6,10],[6,9],      // 0..4   (0 = Red Start)
        [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],    // 5..10  (8 = Star Safe)
        [0,7],                                   // 11
        [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],    // 12..17 (13 = Green Start)
        [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],    // 18..23 (21 = Star Safe)
        [7,0],                                   // 24
        [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],    // 25..30 (26 = Yellow Start)
        [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],// 31..36 (34 = Star Safe)
        [14,7],                                  // 37
        [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],// 38..43 (39 = Blue Start)
        [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],// 44..49 (47 = Star Safe)
        [7,14],                                  // 50
        [6,14]                                   // 51
      ];

      // Provisional safe squares (traditional 4 starts + 4 stars)
      export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
      export const STAR_ONLY_INDICES = new Set([8, 21, 34, 47]);

      export const PLAYERS = [
        {
          id: 'red',
          name: 'Red',
          label: 'You (Red)',
          color: '#D94B4B',
          colorLight: '#F17A7A',
          colorDark: '#8F2626',
          tint: 'rgba(217, 75, 75, 0.22)',
          startIndex: 0,
          yardSlots: [[1.65, 10.65], [3.35, 10.65], [1.65, 12.35], [3.35, 12.35]],
          homePath: [[7,13],[7,12],[7,11],[7,10],[7,9]],
          finishPos: [7.0, 7.95],
          avatarGlyph: '🦊',
          positionSlot: 'bottom'
        },
        {
          id: 'green',
          name: 'Green',
          label: 'Aarav (Green)',
          color: '#3FA36C',
          colorLight: '#6DD099',
          colorDark: '#236841',
          tint: 'rgba(63, 163, 108, 0.22)',
          startIndex: 13,
          yardSlots: [[1.65, 1.65], [3.35, 1.65], [1.65, 3.35], [3.35, 3.35]],
          homePath: [[1,7],[2,7],[3,7],[4,7],[5,7]],
          finishPos: [6.05, 7.0],
          avatarGlyph: '🐼',
          positionSlot: 'top'
        },
        {
          id: 'yellow',
          name: 'Yellow',
          label: 'Maya (Yellow)',
          color: '#E2B93B',
          colorLight: '#F8DA77',
          colorDark: '#9A7817',
          tint: 'rgba(226, 185, 59, 0.24)',
          startIndex: 26,
          yardSlots: [[10.65, 1.65], [12.35, 1.65], [10.65, 3.35], [12.35, 3.35]],
          homePath: [[7,1],[7,2],[7,3],[7,4],[7,5]],
          finishPos: [7.0, 6.05],
          avatarGlyph: '🦁',
          positionSlot: 'top'
        },
        {
          id: 'blue',
          name: 'Blue',
          label: 'Kabir (Blue)',
          color: '#3D7FD6',
          colorLight: '#74ADF8',
          colorDark: '#204E8F',
          tint: 'rgba(61, 127, 214, 0.22)',
          startIndex: 39,
          yardSlots: [[10.65, 10.65], [12.35, 10.65], [10.65, 12.35], [12.35, 12.35]],
          homePath: [[13,7],[12,7],[11,7],[10,7],[9,7]],
          finishPos: [7.95, 7.0],
          avatarGlyph: '🦉',
          positionSlot: 'bottom'
        }
      ];

      export function getLogicalCoords(playerIndex, tokenIndex, steps) {
        const p = PLAYERS[playerIndex];
        if (steps === -1) {
          const slot = p.yardSlots[tokenIndex];
          return { x: slot[0] + 0.5, y: slot[1] + 0.5 };
        }
        if (steps >= 0 && steps <= 50) {
          const cell = TRACK[(p.startIndex + steps) % 52];
          return { x: cell[0] + 0.5, y: cell[1] + 0.5 };
        }
        if (steps >= 51 && steps <= 55) {
          const cell = p.homePath[steps - 51];
          return { x: cell[0] + 0.5, y: cell[1] + 0.5 };
        }
        // steps === 56 (finished inside central home triangle)
        const jitter = [
          [-0.22, -0.14], [0.22, -0.14], [-0.22, 0.14], [0.22, 0.14]
        ][tokenIndex];
        return { x: p.finishPos[0] + 0.5 + jitter[0], y: p.finishPos[1] + 0.5 + jitter[1] };
      }

      export function getTrackIndex(playerIndex, steps) {
        if (steps < 0 || steps > 50) return -1;
        return (PLAYERS[playerIndex].startIndex + steps) % 52;
      }

      // =========================================================================

