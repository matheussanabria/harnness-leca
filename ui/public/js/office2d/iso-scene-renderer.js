// @ts-check
// DAI HQ — Renderizador de Cenário, Chão, Paredes e Z-Sort Isométrico 2.5D
import { renderObjectSprite } from "./iso-object-renderers.js";

export class IsoSceneRenderer {
  renderFloor(ctx, gridW, gridH, toScreen) {
    const p0 = toScreen(0, 0);
    const p1 = toScreen(gridW, 0);
    const p2 = toScreen(gridW, gridH);
    const p3 = toScreen(0, gridH);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y + 20);
    ctx.lineTo(p1.x + 16, p1.y + 28);
    ctx.lineTo(p2.x, p2.y + 44);
    ctx.lineTo(p3.x - 16, p3.y + 28);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.filter = "blur(18px)";
    ctx.fill();
    ctx.restore();

    for (let x = 0; x < gridW; x++) {
      for (let y = 0; y < gridH; y++) {
        const pt1 = toScreen(x, y);
        const pt2 = toScreen(x + 1, y);
        const pt3 = toScreen(x + 1, y + 1);
        const pt4 = toScreen(x, y + 1);

        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.lineTo(pt3.x, pt3.y);
        ctx.lineTo(pt4.x, pt4.y);
        ctx.closePath();

        const isEven = (x + y) % 2 === 0;
        if (x >= 8 && y < 6) {
          ctx.fillStyle = isEven ? "#25282c" : "#1e2124";
        } else if (x >= 8 && y >= 6) {
          ctx.fillStyle = isEven ? "#4a3525" : "#3e2c1e";
        } else if (y >= 7) {
          ctx.fillStyle = isEven ? "#2e2b27" : "#262320";
        } else {
          ctx.fillStyle = isEven ? "#282623" : "#201e1c";
        }
        ctx.fill();

        ctx.strokeStyle = "#383531";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    const pLeft = toScreen(0, gridH);
    const pFront = toScreen(gridW, gridH);
    const pRight = toScreen(gridW, 0);

    ctx.fillStyle = "#1b1a18";
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.lineTo(pFront.x, pFront.y + 14);
    ctx.lineTo(pLeft.x, pLeft.y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#121110";
    ctx.beginPath();
    ctx.moveTo(pFront.x, pFront.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pRight.x, pRight.y + 14);
    ctx.lineTo(pFront.x, pFront.y + 14);
    ctx.closePath();
    ctx.fill();
  }

  renderWalls(ctx, gridW, gridH, toScreen) {
    const wallH = 130;
    const pOrigin = toScreen(0, 0);
    const pRight = toScreen(gridW, 0);
    const pBottom = toScreen(0, gridH);

    ctx.fillStyle = "#33312e";
    ctx.beginPath();
    ctx.moveTo(pBottom.x, pBottom.y);
    ctx.lineTo(pOrigin.x, pOrigin.y);
    ctx.lineTo(pOrigin.x, pOrigin.y - wallH);
    ctx.lineTo(pBottom.x, pBottom.y - wallH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#44413c";
    ctx.stroke();

    ctx.fillStyle = "#2a2825";
    ctx.beginPath();
    ctx.moveTo(pOrigin.x, pOrigin.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pRight.x, pRight.y - wallH);
    ctx.lineTo(pOrigin.x, pOrigin.y - wallH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#383531";
    ctx.stroke();

    const winP1 = toScreen(3, 0);
    const winP2 = toScreen(7, 0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(winP1.x, winP1.y - 35);
    ctx.lineTo(winP2.x, winP2.y - 35);
    ctx.lineTo(winP2.x, winP2.y - 105);
    ctx.lineTo(winP1.x, winP1.y - 105);
    ctx.closePath();
    const skyGrad = ctx.createLinearGradient(winP1.x, winP1.y - 105, winP1.x, winP1.y - 35);
    skyGrad.addColorStop(0, "#0a1128");
    skyGrad.addColorStop(1, "#1c2541");
    ctx.fillStyle = skyGrad;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 8; i++) {
      const sx = winP1.x + (winP2.x - winP1.x) * (0.15 + i * 0.11);
      const sy = winP1.y - 95 + Math.sin(i * 2.1) * 12;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.strokeStyle = "#4a4740";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  renderPlayer(ctx, player, toScreen, time) {
    const pos = toScreen(player.gx, player.gy);
    const isMoving = player.isMoving;
    const bounce = player.seated ? 0 : (isMoving ? Math.abs(Math.sin(player.animTimer)) * 3 : Math.sin(time * 2.5) * 1.5);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 14, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    const py = pos.y - 20 - bounce + (player.seated ? 6 : 0);
    const legSwing = isMoving ? Math.sin(player.animTimer) * 4 : 0;
    if (!player.seated) {
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(pos.x - 5, py + 14, 4, 8 + legSwing);
      ctx.fillRect(pos.x + 1, py + 14, 4, 8 - legSwing);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(pos.x - 6, py + 20 + legSwing, 5, 3);
      ctx.fillRect(pos.x + 1, py + 20 - legSwing, 5, 3);
    }

    ctx.fillStyle = "#d97757";
    ctx.beginPath();
    ctx.roundRect(pos.x - 8, py, 16, 15, 3);
    ctx.fill();

    ctx.fillStyle = "#f5f4ef";
    ctx.fillRect(pos.x - 2.5, py + 2, 5, 7);

    ctx.fillStyle = "#f8c291";
    ctx.beginPath();
    ctx.arc(pos.x, py - 6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2f3542";
    ctx.beginPath();
    ctx.arc(pos.x, py - 9, 8.5, Math.PI, 0, false);
    ctx.fill();

    ctx.fillStyle = "#2f3542";
    if (player.direction === "right") {
      ctx.fillRect(pos.x + 1, py - 7, 2, 2.5);
      ctx.fillRect(pos.x + 5, py - 7, 2, 2.5);
    } else if (player.direction === "left") {
      ctx.fillRect(pos.x - 5, py - 7, 2, 2.5);
      ctx.fillRect(pos.x - 1, py - 7, 2, 2.5);
    } else if (player.direction !== "up") {
      ctx.fillRect(pos.x - 3.5, py - 6.5, 2, 2.5);
      ctx.fillRect(pos.x + 1.5, py - 6.5, 2, 2.5);
    }

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(pos.x - 22, py - 26, 44, 13, 6);
    ctx.fill();
    ctx.strokeStyle = "#d97757";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(player.seated ? "SENTADO" : "VOCÊ", pos.x, py - 16);
    ctx.restore();
  }

  renderInteractionBubble(ctx, player, obj, toScreen) {
    const pos = toScreen(player.gx, player.gy);
    const by = pos.y - 68;
    const label = player.seated || !obj
      ? "[E] Levantar"
      : `[E] Interagir: ${obj.name.split('(')[0].trim()}`;

    ctx.save();
    ctx.fillStyle = "rgba(20, 20, 19, 0.92)";
    ctx.beginPath();
    ctx.roundRect(pos.x - 85, by, 170, 26, 8);
    ctx.fill();
    ctx.strokeStyle = "#d97757";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pos.x - 6, by + 26);
    ctx.lineTo(pos.x + 6, by + 26);
    ctx.lineTo(pos.x, by + 32);
    ctx.closePath();
    ctx.fillStyle = "rgba(20, 20, 19, 0.92)";
    ctx.fill();

    ctx.fillStyle = "#f5f4ef";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, pos.x, by + 17);
    ctx.restore();
  }

  renderObject(ctx, obj, isHovered, toScreen, time) {
    renderObjectSprite(ctx, obj, isHovered, toScreen, time);
  }
}
