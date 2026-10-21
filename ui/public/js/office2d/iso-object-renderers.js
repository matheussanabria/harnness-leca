// @ts-check
import * as Furniture from "./iso-furniture.js";
import {
  drawMonitorScreen,
  drawWarRoomChair,
  drawWarRoomConsole,
  drawWarRoomPanel,
  drawWorkstationChair
} from "./iso-parity-furniture.js";

/**
 * @typedef {(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, time: number, isHovered: boolean) => void} ObjectRenderer
 */

/** @type {Record<string, ObjectRenderer>} */
const RENDERERS = {
  workstation_chair: (ctx, pos, time) => drawWorkstationChair(ctx, pos, time),
  monitor_screen: (ctx, pos, time) => drawMonitorScreen(ctx, pos, time),
  codex_station: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#22c55e", "Codex", "codex", time),
  codex_desk: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#22c55e", "Codex", "codex", time),
  claude_station: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#d97757", "Claude Code", "claude", time),
  claude_desk: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#d97757", "Claude Code", "claude", time),
  gemini_station: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#5c87f2", "Gemini", "gemini", time),
  gemini_desk: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#5c87f2", "Gemini", "gemini", time),
  opencode_station: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#3cb371", "OpenCode", "opencode", time),
  opencode_desk: (ctx, pos, time) => Furniture.drawDesk(ctx, pos, "#3cb371", "OpenCode", "opencode", time),
  server_rack: (ctx, pos, time) => Furniture.drawServerRack(ctx, pos, time),
  war_room_main_panel: (ctx, pos, time) => drawWarRoomPanel(ctx, pos, time),
  war_room_user_chair: (ctx, pos) => drawWarRoomChair(ctx, pos),
  war_room_table_console: (ctx, pos, time) => drawWarRoomConsole(ctx, pos, time),
  meeting_table: (ctx, pos, time) => drawWarRoomConsole(ctx, pos, time),
  file_cabinet: (ctx, pos, time, isHovered) => Furniture.drawCabinet(ctx, pos, isHovered),
  whiteboard: (ctx, pos) => Furniture.drawWhiteboard(ctx, pos, "memory"),
  prototype_board: (ctx, pos) => Furniture.drawWhiteboard(ctx, pos, "prototype"),
  arcade_machine: (ctx, pos, time) => Furniture.drawArcade(ctx, pos, time),
  coffee_bar: (ctx, pos, time) => Furniture.drawCoffeeBar(ctx, pos, time),
  water_cooler: (ctx, pos) => Furniture.drawWaterCooler(ctx, pos),
  lounge_couch: (ctx, pos) => Furniture.drawSofa(ctx, pos),
  sofa: (ctx, pos) => Furniture.drawSofa(ctx, pos),
  plant: (ctx, pos, time) => Furniture.drawPlant(ctx, pos, time)
};

export const OBJECT_RENDERERS = Object.freeze(RENDERERS);

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id: string, gx: number, gy: number, gz?: number }} obj
 * @param {boolean} isHovered
 * @param {(gx: number, gy: number, gz?: number) => {x: number, y: number}} toScreen
 * @param {number} time
 * @returns {boolean}
 */
export function renderObjectSprite(ctx, obj, isHovered, toScreen, time) {
  const renderer = OBJECT_RENDERERS[obj.id];
  if (!renderer) return false;
  const pos = toScreen(obj.gx, obj.gy, obj.gz);
  ctx.save();
  if (isHovered) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 20, 32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(217, 119, 87, 0.25)";
    ctx.fill();
  }
  renderer(ctx, pos, time, isHovered);
  ctx.restore();
  return true;
}
