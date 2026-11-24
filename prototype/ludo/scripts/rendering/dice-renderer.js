export function createDiceRenderer(canvas = document.getElementById('diceCanvas')) {
  const diceCanvas = canvas;
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
  return { drawDice };
}
