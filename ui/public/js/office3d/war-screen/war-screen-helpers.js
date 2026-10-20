// @ts-check
// DAI HQ — War Room Tactical Screen: Helpers de Renderização Gráfica em Canvas 2D

/**
 * Desenha cantos cibernéticos angulares de alta precisão
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} color
 */
export function drawCornerAccents(ctx, x, y, width, height, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  const len = 30;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  ctx.stroke();
}

/**
 * Desenha badge métrica com contorno brilhante
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} label
 * @param {string} val
 * @param {string} color
 */
export function drawMetricBadge(ctx, x, y, label, val, color) {
  ctx.fillStyle = "rgba(30, 41, 59, 0.75)";
  ctx.fillRect(x, y, 115, 68);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, 115, 68);

  ctx.fillStyle = color;
  ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(val, x + 16, y + 36);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 16, y + 56);
}
