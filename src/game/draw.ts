import { COLS, COLORS, ROWS } from "./constants";
import type { Orb, Session } from "./types";
import { columnTop } from "./engine";

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function markSpecial(g: CanvasRenderingContext2D, x: number, y: number, rad: number, special: NonNullable<Orb["special"]>) {
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = Math.max(1.5, rad * 0.14);
  g.lineCap = "round";
  g.beginPath();
  const s = rad * 0.42;
  if (special === "row") {
    g.moveTo(x - s, y);
    g.lineTo(x + s, y);
  } else if (special === "col") {
    g.moveTo(x, y - s);
    g.lineTo(x, y + s);
  } else if (special === "bomb") {
    g.moveTo(x - s, y);
    g.lineTo(x + s, y);
    g.moveTo(x, y - s);
    g.lineTo(x, y + s);
  } else {
    g.moveTo(x, y - s);
    g.lineTo(x, y + s);
    g.moveTo(x - s, y);
    g.lineTo(x + s, y);
    g.moveTo(x - s * 0.7, y - s * 0.7);
    g.lineTo(x + s * 0.7, y + s * 0.7);
    g.moveTo(x + s * 0.7, y - s * 0.7);
    g.lineTo(x - s * 0.7, y + s * 0.7);
  }
  g.stroke();
}

export function drawOrb(g: CanvasRenderingContext2D, x: number, y: number, rad: number, orb: Orb, ghost = false) {
  const r = Math.max(4, rad);
  g.save();
  g.globalAlpha = ghost ? 0.78 : 1;

  if (orb.type === "stone") {
    g.beginPath();
    g.arc(x, y, r * 0.9, 0, Math.PI * 2);
    g.fillStyle = "#2a2a33";
    g.fill();
    g.strokeStyle = "#6a6a74";
    g.lineWidth = Math.max(1, r * 0.08);
    g.stroke();
    g.beginPath();
    g.strokeStyle = "#8a8a94";
    g.lineWidth = Math.max(1, r * 0.06);
    g.moveTo(x - r * 0.28, y - r * 0.12);
    g.lineTo(x + r * 0.22, y + r * 0.3);
    g.moveTo(x + r * 0.18, y - r * 0.28);
    g.lineTo(x - r * 0.1, y + r * 0.22);
    g.stroke();
    g.restore();
    return;
  }

  const pal = COLORS[Math.max(0, orb.color)] ?? COLORS[0];
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();

  const grd = g.createRadialGradient(x - r * 0.28, y - r * 0.3, r * 0.05, x + r * 0.08, y + r * 0.12, r);
  grd.addColorStop(0, pal.fill[0]);
  grd.addColorStop(0.5, pal.fill[1]);
  grd.addColorStop(1, pal.fill[2]);
  g.fillStyle = grd;
  g.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);

  g.beginPath();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.ellipse(x - r * 0.26, y - r * 0.3, r * 0.22, r * 0.12, -0.45, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.save();
  g.globalAlpha = ghost ? 0.55 : 1;
  g.beginPath();
  g.arc(x, y, r - 0.5, 0, Math.PI * 2);
  g.strokeStyle = pal.fill[2];
  g.lineWidth = Math.max(1, r * 0.06);
  g.stroke();

  if (orb.type === "ice") {
    g.beginPath();
    g.arc(x, y, r * 0.78, 0, Math.PI * 2);
    g.strokeStyle = "rgba(236,246,252,0.9)";
    g.lineWidth = Math.max(1.25, r * 0.08);
    g.stroke();
  }
  if (orb.special) markSpecial(g, x, y, r, orb.special);
  g.restore();
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  session: Session,
  cell: number,
  pad: number,
  hoverCol: number,
  selectingCrush: boolean,
  animating: boolean,
  flashCol = -1,
) {
  const w = COLS * cell;
  const h = ROWS * cell;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, Math.min(16, cell * 0.28));
  ctx.fillStyle = "#121214";
  ctx.fill();
  ctx.strokeStyle = "rgba(244,244,245,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const rad = Math.max(6, cell / 2 - pad);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * cell;
      const y = r * cell;
      ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.04)";
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      const orb = session.board[r][c];
      if (orb) drawOrb(ctx, x + cell / 2, y + cell / 2, rad, orb);
    }
  }
  if (selectingCrush) {
    ctx.fillStyle = "rgba(212,122,122,0.08)";
    ctx.fillRect(0, 0, w, h);
  }
  if (flashCol >= 0 && flashCol < COLS) {
    ctx.fillStyle = "rgba(212,122,122,0.28)";
    ctx.fillRect(flashCol * cell, 0, cell, ROWS * cell);
  }
  const ghostCol = hoverCol >= 0 ? hoverCol : 2;
  if (!animating && !session.won && !session.lost && !selectingCrush && session.queue[0]) {
    const top = columnTop(session.board, ghostCol);
    if (top > 0) {
      ctx.fillStyle = "rgba(200,204,212,0.1)";
      ctx.fillRect(ghostCol * cell, 0, cell, ROWS * cell);
      const cx = ghostCol * cell + cell / 2;
      const cy = (top - 1) * cell + cell / 2;
      const next = session.queue[0];
      drawOrb(ctx, cx, cy, rad, next, true);
      const pal = COLORS[Math.max(0, next.color)] ?? COLORS[0];
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 1, 0, Math.PI * 2);
      ctx.strokeStyle = pal.fill[0];
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
