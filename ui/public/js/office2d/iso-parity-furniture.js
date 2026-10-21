// @ts-check
import { officeScreenPresets } from "../office/office-screen-presets.js";

const PANEL_PRESET_COLORS = {
  kanban: "#38bdf8",
  orchestration: "#a855f7",
  metrics: "#eab308",
  prototype: "#22c55e",
  terminal: "#64748b"
};

function drawShadow(ctx, pos, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fill();
}

function drawChairBody(ctx, pos, color) {
  drawShadow(ctx, pos, 16, 8);
  ctx.fillStyle = "#20242b";
  ctx.beginPath();
  ctx.roundRect(pos.x - 12, pos.y - 26, 24, 22, 5);
  ctx.fill();
  ctx.strokeStyle = "#3a4049";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(pos.x - 9, pos.y - 23, 18, 15, 4);
  ctx.fill();

  ctx.fillStyle = "#15181d";
  ctx.fillRect(pos.x - 2, pos.y - 4, 4, 8);
  ctx.fillRect(pos.x - 11, pos.y + 4, 22, 3);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 * @param {number} time
 */
export function drawWorkstationChair(ctx, pos, time) {
  drawChairBody(ctx, pos, "#d97757");
  const pulse = 0.55 + Math.sin(time * 3) * 0.15;
  ctx.fillStyle = `rgba(217, 119, 87, ${pulse})`;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - 38, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 * @param {number} time
 */
export function drawMonitorScreen(ctx, pos, time) {
  drawShadow(ctx, pos, 30, 12);
  ctx.fillStyle = "#6b4a2f";
  ctx.beginPath();
  ctx.moveTo(pos.x - 28, pos.y - 14);
  ctx.lineTo(pos.x, pos.y - 30);
  ctx.lineTo(pos.x + 28, pos.y - 14);
  ctx.lineTo(pos.x, pos.y + 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1f242e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 20);
  ctx.lineTo(pos.x, pos.y - 32);
  ctx.stroke();

  const sway = Math.sin(time * 1.2) * 1.2;
  ctx.fillStyle = "#121821";
  ctx.beginPath();
  ctx.roundRect(pos.x - 27 + sway, pos.y - 66, 54, 32, 3);
  ctx.fill();
  ctx.strokeStyle = "#3f4a5a";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(pos.x - 23 + sway, pos.y - 62, 46, 24);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  for (let i = 0; i < 3; i++) {
    const width = 12 + Math.abs(Math.sin(time * 2 + i)) * 22;
    ctx.fillRect(pos.x - 20 + sway, pos.y - 58 + i * 6, width, 2);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 * @param {number} time
 */
export function drawWarRoomPanel(ctx, pos, time) {
  const preset = officeScreenPresets.getPreset("war_room_main_panel");
  const color = PANEL_PRESET_COLORS[preset] || "#38bdf8";
  const label = officeScreenPresets.getPresetDefinition(preset)?.name || "Orquestração";

  drawShadow(ctx, pos, 46, 14);

  ctx.fillStyle = "#1a202b";
  ctx.beginPath();
  ctx.moveTo(pos.x - 48, pos.y - 18);
  ctx.lineTo(pos.x + 48, pos.y - 18);
  ctx.lineTo(pos.x + 48, pos.y - 86);
  ctx.lineTo(pos.x - 48, pos.y - 86);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#485568";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#060b12";
  ctx.fillRect(pos.x - 43, pos.y - 81, 86, 58);

  const glow = 0.55 + Math.sin(time * 2.4) * 0.15;
  ctx.fillStyle = color;
  ctx.globalAlpha = glow;
  ctx.fillRect(pos.x - 40, pos.y - 78, 80, 3);
  ctx.globalAlpha = 1;

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? color : "rgba(148, 163, 184, 0.55)";
    ctx.fillRect(pos.x - 38, pos.y - 68 + i * 12, 22 + i * 8, 4);
  }

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label.toUpperCase(), pos.x, pos.y - 24);

  ctx.fillStyle = "#111820";
  ctx.fillRect(pos.x - 5, pos.y - 18, 10, 12);
  ctx.fillRect(pos.x - 20, pos.y - 6, 40, 3);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 */
export function drawWarRoomChair(ctx, pos) {
  drawChairBody(ctx, pos, "#00d2ff");
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 * @param {number} time
 */
export function drawWarRoomConsole(ctx, pos, time) {
  drawShadow(ctx, pos, 36, 16);
  ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - 22, 32, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dfe6e9";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - 22, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 2;
  ctx.stroke();

  const pulse = 0.45 + Math.sin(time * 4) * 0.25;
  ctx.fillStyle = `rgba(168, 85, 247, ${pulse})`;
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - 24, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}
