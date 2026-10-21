// @ts-check
// Projeção do Kanban Scrum no telão da Sala de Guerra (EP-05.06).
import { buildScrumProjection } from "../../office/war-screen-projection-model.js";

const COLUMNS = 6;
const LANE_GAP = 10;
const CARD_HEIGHT = 62;

function clipText(ctx, value, maxWidth) {
  const text = String(value || "");
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 3 && ctx.measureText(`${cut}...`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

function drawMetric(ctx, x, y, label, value, color) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fillRect(x, y, 150, 58);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, 150, 58);
  ctx.fillStyle = color;
  ctx.font = "bold 24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(value, x + 14, y + 32);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 14, y + 50);
}

function drawLane(ctx, lane, x, y, width, height) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = lane.color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = lane.color;
  ctx.fillRect(x, y, width, 44);
  ctx.globalAlpha = 1;

  ctx.fillStyle = lane.color;
  ctx.fillRect(x, y, 5, 44);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 15px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(clipText(ctx, lane.name.toUpperCase(), width - 94), x + 14, y + 27);

  ctx.fillStyle = lane.color;
  ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(`${lane.storyCount} | ${lane.points} pts`, x + width - 84, y + 27);

  const available = Math.max(1, Math.floor((height - 58) / (CARD_HEIGHT + 6)));
  const cards = lane.cards.slice(0, available);
  let cardY = y + 54;

  if (cards.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Nenhuma história nesta raia", x + 14, cardY + 24);
  }

  for (const card of cards) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.fillRect(x + 8, cardY, width - 16, CARD_HEIGHT);
    ctx.fillStyle = card.blocked ? "#ef4444" : lane.color;
    ctx.fillRect(x + 8, cardY, 4, CARD_HEIGHT);

    ctx.fillStyle = card.blocked ? "#fca5a5" : "#38bdf8";
    ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(card.key, x + 20, cardY + 19);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(clipText(ctx, card.title, width - 52), x + 20, cardY + 39);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`${card.points} pts${card.blocked ? " | IMPEDIDA" : ""}`, x + 20, cardY + 55);
    cardY += CARD_HEIGHT + 6;
  }

  if (lane.cards.length > cards.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`+${lane.cards.length - cards.length} histórias`, x + 14, y + height - 10);
  }
}

export function renderScrumProjection(ctx, x, y, width, height, scrumData) {
  const projection = buildScrumProjection(scrumData || {}, { maxCards: 6 });
  const { lanes = [], metrics = {}, sprintName, sprintGoal } = projection;

  ctx.fillStyle = "#060b14";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(`KANBAN SCRUM - ${String(sprintName || "").toUpperCase()}`, x + 10, y + 30);

  if (sprintGoal) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(clipText(ctx, sprintGoal, width - 700), x + 10, y + 52);
  }

  drawMetric(ctx, x + width - 640, y, "Histórias", String(metrics.stories || 0), "#38bdf8");
  drawMetric(ctx, x + width - 480, y, "Pontos", String(metrics.points || 0), "#a855f7");
  drawMetric(ctx, x + width - 320, y, "Conclusão", `${metrics.completion || 0}%`, "#22c55e");
  drawMetric(ctx, x + width - 160, y, "Impedidas", String(metrics.blockedStories || 0), "#ef4444");

  if (!lanes.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Nenhuma raia visível configurada para este projeto.", x + 10, y + 120);
    return;
  }

  const gridY = y + 78;
  const gridHeight = height - 88;
  const columns = Math.min(COLUMNS, lanes.length);
  const rows = Math.ceil(lanes.length / columns);
  const laneWidth = (width - LANE_GAP * (columns - 1)) / columns;
  const laneHeight = (gridHeight - LANE_GAP * (rows - 1)) / rows;

  lanes.forEach((lane, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const laneX = x + column * (laneWidth + LANE_GAP);
    const laneY = gridY + row * (laneHeight + LANE_GAP);
    drawLane(ctx, lane, laneX, laneY, laneWidth, laneHeight);
  });
}
