import { TRACK, SAFE_TRACK_INDICES, STAR_ONLY_INDICES, PLAYERS } from '../config/board.js';

export function createBoardRenderer({ state, currentPlayerIndex }) {
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
  return {
    boardCanvas, resizeBoard, project, unproject, drawBoard,
    getBoardMetrics: () => boardMetrics
  };
}
