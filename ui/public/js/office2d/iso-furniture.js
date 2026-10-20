// @ts-check
// DAI HQ — Renderizador de Móveis Isométricos no Canvas 2D
export { drawDesk } from "./iso-agent-desks.js";

export function drawServerRack(ctx, pos, time) {
  const rH = 55;
  const rW = 26;

  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, 20, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.fillStyle = "#1e2124";
  ctx.fillRect(pos.x - rW / 2, pos.y - rH, rW, rH);

  ctx.strokeStyle = "#474e57";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pos.x - rW / 2, pos.y - rH, rW, rH);

  for (let i = 0; i < 4; i++) {
    const sy = pos.y - rH + 6 + i * 11;
    ctx.fillStyle = "#2b3036";
    ctx.fillRect(pos.x - rW / 2 + 2, sy, rW - 4, 8);

    const blink = Math.sin(time * 8 + i) > 0;
    ctx.fillStyle = blink ? "#00cec9" : "#0984e3";
    ctx.fillRect(pos.x - rW / 2 + 4, sy + 3, 2, 2);
    ctx.fillStyle = !blink ? "#2ecc71" : "#27ae60";
    ctx.fillRect(pos.x - rW / 2 + 8, sy + 3, 2, 2);
  }
}

export function drawMeetingTable(ctx, pos) {
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, 34, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - 22, 32, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#dfe6e9";
  ctx.fill();
  ctx.strokeStyle = "#b2bec3";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#0984e3";
  ctx.fillRect(pos.x - 10, pos.y - 27, 20, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(pos.x - 8, pos.y - 25, 16, 1);
  ctx.fillRect(pos.x - 8, pos.y - 22, 12, 1);
}

export function drawCabinet(ctx, pos, isHovered) {
  const cabH = 46;
  const cabW = 20;

  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, 18, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.fillStyle = "#4a4e54";
  ctx.fillRect(pos.x - cabW / 2, pos.y - cabH, cabW, cabH);

  ctx.fillStyle = "#636870";
  ctx.beginPath();
  ctx.moveTo(pos.x - cabW / 2, pos.y - cabH);
  ctx.lineTo(pos.x, pos.y - cabH - 8);
  ctx.lineTo(pos.x + cabW / 2 + 8, pos.y - cabH - 4);
  ctx.lineTo(pos.x + cabW / 2, pos.y - cabH);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const gy = pos.y - cabH + 4 + i * 13;
    ctx.fillStyle = (isHovered && i === 0) ? "#737a85" : "#3b3e42";
    const offset = (isHovered && i === 0) ? -5 : 0;
    ctx.fillRect(pos.x - cabW / 2 + 2, gy + offset, cabW - 4, 10);
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(pos.x - 3, gy + 4 + offset, 6, 2);
  }
}

export function drawWhiteboard(ctx, pos, type) {
  ctx.fillStyle = "#e8e8e8";
  ctx.beginPath();
  ctx.moveTo(pos.x - 14, pos.y - 60);
  ctx.lineTo(pos.x + 14, pos.y - 74);
  ctx.lineTo(pos.x + 14, pos.y - 36);
  ctx.lineTo(pos.x - 14, pos.y - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (type === "prototype") {
    ctx.fillStyle = "#0984e3";
    ctx.fillRect(pos.x - 6, pos.y - 52, 14, 9);
    ctx.fillStyle = "#00cec9";
    ctx.fillRect(pos.x - 2, pos.y - 38, 10, 6);
  } else {
    ctx.fillStyle = "#fbc531";
    ctx.fillRect(pos.x - 8, pos.y - 50, 5, 5);
    ctx.fillStyle = "#e84118";
    ctx.fillRect(pos.x, pos.y - 56, 5, 5);
  }
}

export function drawArcade(ctx, pos, time) {
  const aH = 50;
  const aW = 20;

  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, 16, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.fillStyle = "#2c2c54";
  ctx.fillRect(pos.x - aW / 2, pos.y - aH, aW, aH);

  const blink = Math.sin(time * 5) > 0;
  ctx.fillStyle = blink ? "#ff5252" : "#ff793f";
  ctx.fillRect(pos.x - aW / 2 + 2, pos.y - aH + 3, aW - 4, 8);

  ctx.fillStyle = "#000000";
  ctx.fillRect(pos.x - aW / 2 + 2, pos.y - aH + 13, aW - 4, 15);
  ctx.fillStyle = "#2ed573";
  ctx.fillRect(pos.x - 4, pos.y - aH + 18, 8, 5);

  ctx.fillStyle = "#ff5252";
  ctx.beginPath();
  ctx.arc(pos.x - 3, pos.y - aH + 32, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffda79";
  ctx.fillRect(pos.x + 2, pos.y - aH + 31, 2, 2);
  ctx.fillRect(pos.x + 5, pos.y - aH + 31, 2, 2);
}

export function drawCoffeeBar(ctx, pos, time) {
  ctx.fillStyle = "#2d3436";
  ctx.fillRect(pos.x - 16, pos.y - 26, 32, 26);
  ctx.fillStyle = "#636e72";
  ctx.beginPath();
  ctx.moveTo(pos.x - 16, pos.y - 26);
  ctx.lineTo(pos.x, pos.y - 34);
  ctx.lineTo(pos.x + 16, pos.y - 26);
  ctx.lineTo(pos.x, pos.y - 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d63031";
  ctx.fillRect(pos.x - 8, pos.y - 44, 14, 18);
  ctx.fillStyle = "#dfe6e9";
  ctx.fillRect(pos.x - 4, pos.y - 30, 6, 5);

  const steamY = pos.y - 38 - ((time * 20) % 15);
  const steamAlpha = 1 - ((time * 20) % 15) / 15;
  ctx.fillStyle = `rgba(255, 255, 255, ${steamAlpha * 0.7})`;
  ctx.beginPath();
  ctx.arc(pos.x - 1 + Math.sin(time * 4) * 2, steamY, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawWaterCooler(ctx, pos) {
  ctx.fillStyle = "#f5f6fa";
  ctx.fillRect(pos.x - 8, pos.y - 28, 16, 28);
  ctx.fillStyle = "rgba(0, 168, 255, 0.75)";
  ctx.beginPath();
  ctx.roundRect(pos.x - 7, pos.y - 44, 14, 16, 4);
  ctx.fill();
}

export function drawSofa(ctx, pos) {
  ctx.fillStyle = "#2f3542";
  ctx.beginPath();
  ctx.roundRect(pos.x - 22, pos.y - 24, 44, 20, 6);
  ctx.fill();

  ctx.fillStyle = "#57606f";
  ctx.beginPath();
  ctx.roundRect(pos.x - 20, pos.y - 32, 40, 12, 4);
  ctx.fill();
}

export function drawPlant(ctx, pos, time) {
  ctx.fillStyle = "#e17055";
  ctx.beginPath();
  ctx.moveTo(pos.x - 10, pos.y - 18);
  ctx.lineTo(pos.x + 10, pos.y - 18);
  ctx.lineTo(pos.x + 7, pos.y);
  ctx.lineTo(pos.x - 7, pos.y);
  ctx.closePath();
  ctx.fill();

  const wind = Math.sin(time * 2) * 1.5;
  ctx.fillStyle = "#00b894";
  ctx.beginPath();
  ctx.ellipse(pos.x - 6 + wind, pos.y - 28, 9, 14, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#55efc4";
  ctx.beginPath();
  ctx.ellipse(pos.x + 6 + wind, pos.y - 30, 8, 13, 0.4, 0, Math.PI * 2);
  ctx.fill();
}
