import { COLS, COLORS, ROWS } from "./constants";
import type { Orb, Session } from "./types";
import { columnTop, previewCues, type CueGroup } from "./engine";

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

function drawCueGroups(ctx: CanvasRenderingContext2D, groups: CueGroup[], cell: number, rad: number) {
  if (!groups.length) return;
  const t = performance.now();
  const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t / 260));
  const bob = 4 + 3 * Math.sin(t / 220);

  for (const group of groups) {
    if (!group.cells.length) continue;
    ctx.save();
    if (group.kind === "row") {
      const r = group.cells[0].r;
      const sameRow = group.cells.every((c) => c.r === r);
      if (sameRow) {
        const minC = Math.min(...group.cells.map((c) => c.c));
        const maxC = Math.max(...group.cells.map((c) => c.c));
        const y = r * cell + cell / 2;
        ctx.strokeStyle = `rgba(240,217,168,${0.35 + pulse * 0.4})`;
        ctx.lineWidth = Math.max(3, cell * 0.08);
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(217,184,120,0.55)";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(minC * cell + cell * 0.18, y);
        ctx.lineTo(maxC * cell + cell * 0.82, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    for (const { r, c } of group.cells) {
      const cx = c * cell + cell / 2;
      const cy = r * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + (group.kind === "cascade" ? 7 : 5), 0, Math.PI * 2);
      if (group.kind === "cascade") {
        ctx.strokeStyle = `rgba(232,176,176,${0.45 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
      } else if (group.kind === "crush") {
        ctx.strokeStyle = `rgba(240,217,168,${0.7 + pulse * 0.3})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
      } else {
        ctx.strokeStyle = `rgba(240,217,168,${0.55 + pulse * 0.45})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (group.kind === "nova") {
      for (const { r, c } of group.cells) {
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(240,217,168,${0.18 + pulse * 0.2})`;
        ctx.lineWidth = 6;
        ctx.stroke();
      }
    }

    if (group.falls) {
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -(t / 30) % 8;
      ctx.strokeStyle = `rgba(232,176,176,${0.55 + pulse * 0.35})`;
      ctx.fillStyle = `rgba(232,176,176,${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      for (const { from, to } of group.falls) {
        const x = from.c * cell + cell / 2;
        const y1 = from.r * cell + cell * 0.78;
        const y2 = to.r * cell + cell * 0.18 + bob;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - 7, y2 - 9);
        ctx.lineTo(x, y2);
        ctx.lineTo(x + 7, y2 - 9);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([4, 4]);
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
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
  guideCol = -1,
  guideCell: { r: number; c: number } | null = null,
) {
  const w = COLS * cell;
  const h = ROWS * cell;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, Math.min(16, cell * 0.28));
  ctx.fillStyle = "#0c0b09";
  ctx.fill();
  ctx.strokeStyle = "rgba(217,184,120,0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const rad = Math.max(6, cell / 2 - pad);
  const cues = previewCues(session, guideCol >= 0 ? guideCol : null, guideCell);
  const marked = new Set(cues.flatMap((g) => g.cells.map((t) => `${t.r},${t.c}`)));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * cell;
      const y = r * cell;
      ctx.fillStyle = (r + c) % 2 ? "rgba(217,184,120,0.035)" : "rgba(217,184,120,0.07)";
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      const orb = session.board[r][c];
      if (orb) drawOrb(ctx, x + cell / 2, y + cell / 2, rad, orb);
    }
  }
  if (selectingCrush) {
    ctx.fillStyle = "rgba(212,122,122,0.08)";
    ctx.fillRect(0, 0, w, h);
  }
  if (guideCol >= 0 && guideCol < COLS) {
    ctx.fillStyle = "rgba(217,184,120,0.12)";
    ctx.fillRect(guideCol * cell, 0, cell, ROWS * cell);
  }
  if (flashCol >= 0 && flashCol < COLS) {
    ctx.fillStyle = "rgba(212,122,122,0.28)";
    ctx.fillRect(flashCol * cell, 0, cell, ROWS * cell);
  }
  if (marked.size) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marked.has(`${r},${c}`)) continue;
        ctx.fillStyle = "rgba(8,7,6,0.42)";
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
  drawCueGroups(ctx, cues, cell, rad);
  const ghostCol = guideCol >= 0 ? guideCol : hoverCol >= 0 ? hoverCol : 2;
  if (!animating && !session.won && !session.lost && !selectingCrush && session.queue[0]) {
    const top = columnTop(session.board, ghostCol);
    if (top > 0) {
      ctx.fillStyle = "rgba(217,184,120,0.12)";
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
  if (guideCell) {
    const cx = guideCell.c * cell + cell / 2;
    const cy = guideCell.r * cell + cell / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,207,150,0.95)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
