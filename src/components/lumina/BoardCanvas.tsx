import { useEffect, useRef, type ReactNode } from "react";
import { COLS, COLORS, ROWS } from "@/game/constants";
import { drawBoard, drawOrb } from "@/game/draw";
import type { BurstEvent } from "@/game/engine";
import type { Falling } from "@/game/store";
import type { Session } from "@/game/types";

type Spark = { k: "spark"; x: number; y: number; vx: number; vy: number; life: number; col: string; r: number };
type Ring = { k: "ring"; x: number; y: number; life: number; max: number; col: string; from: number; to: number; w: number };
type Beam = { k: "beam"; axis: "h" | "v"; i: number; life: number; max: number; col: string };
type Flash = { k: "flash"; life: number; max: number; col: string; a: number };
type Ray = { k: "ray"; x: number; y: number; ang: number; life: number; max: number; col: string; len: number };
type Shard = { k: "shard"; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; len: number; ang: number; spin: number };
type Fx = Spark | Ring | Beam | Flash | Ray | Shard;

function palOf(color: number) {
  return COLORS[Math.max(0, color)] ?? COLORS[0];
}

function spawnFx(fx: Fx[], events: BurstEvent[], cell: number) {
  if (!events.length) return;
  const kinds = new Set(events.map((e) => e.kind ?? "burst"));
  const gold = "rgba(240,217,168,0.95)";
  const addSparks = (x: number, y: number, col: string, n: number, speed: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.45 + Math.random());
      fx.push({
        k: "spark",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 24,
        life: 0.7 + Math.random() * 0.35,
        col,
        r: 1.4 + Math.random() * 2.2,
      });
    }
  };

  if (kinds.has("nova")) {
    fx.push({ k: "flash", life: 0.55, max: 0.55, col: "rgba(240,217,168,1)", a: 0.42 });
    const cx = (COLS * cell) / 2;
    const cy = (ROWS * cell) / 2;
    fx.push({ k: "ring", x: cx, y: cy, life: 0.7, max: 0.7, col: gold, from: 12, to: Math.max(cx, cy) * 1.2, w: 5 });
    for (let i = 0; i < 14; i++) {
      fx.push({
        k: "ray",
        x: cx,
        y: cy,
        ang: (i / 14) * Math.PI * 2,
        life: 0.65,
        max: 0.65,
        col: gold,
        len: Math.max(cx, cy) * 0.9,
      });
    }
    events.forEach(({ r, c, color }) => {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      const pal = palOf(color);
      fx.push({ k: "ring", x, y, life: 0.5, max: 0.5, col: pal.fill[0], from: 6, to: cell * 1.1, w: 3 });
      addSparks(x, y, pal.fill[1], 14, 90);
    });
    return;
  }

  if (kinds.has("row") || kinds.has("col")) {
    const first = events[0];
    const pal = palOf(first.color);
    if (kinds.has("row")) fx.push({ k: "beam", axis: "h", i: first.r, life: 0.5, max: 0.5, col: pal.fill[0] });
    if (kinds.has("col")) fx.push({ k: "beam", axis: "v", i: first.c, life: 0.5, max: 0.5, col: pal.fill[0] });
    events.forEach(({ r, c, color }) => {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      addSparks(x, y, palOf(color).fill[1], 10, 70);
      fx.push({ k: "ring", x, y, life: 0.38, max: 0.38, col: gold, from: 4, to: cell * 0.7, w: 2 });
    });
    return;
  }

  if (kinds.has("bomb")) {
    const first = events[Math.floor(events.length / 2)] ?? events[0];
    const x = (first.c + 0.5) * cell;
    const y = (first.r + 0.5) * cell;
    fx.push({ k: "flash", life: 0.28, max: 0.28, col: "rgba(240,217,168,1)", a: 0.28 });
    fx.push({ k: "ring", x, y, life: 0.5, max: 0.5, col: gold, from: 8, to: cell * 2.4, w: 4 });
    events.forEach(({ r, c, color }) => addSparks((c + 0.5) * cell, (r + 0.5) * cell, palOf(color).fill[1], 12, 80));
    return;
  }

  if (kinds.has("crush")) {
    events.forEach(({ r, c, color, ice }) => {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      const pal = palOf(color);
      const frost = ice ? "rgba(236,248,255,1)" : gold;
      fx.push({
        k: "flash",
        life: ice ? 0.55 : 0.28,
        max: ice ? 0.55 : 0.28,
        col: ice ? "rgba(210,236,255,1)" : gold,
        a: ice ? 0.72 : 0.32,
      });
      fx.push({ k: "ring", x, y, life: 0.42, max: 0.42, col: frost, from: 8, to: cell * 1.6, w: 7 });
      fx.push({ k: "ring", x, y, life: 0.62, max: 0.62, col: ice ? "rgba(160,210,240,0.95)" : gold, from: 16, to: cell * 3.2, w: 5 });
      fx.push({ k: "ring", x, y, life: 0.82, max: 0.82, col: gold, from: 24, to: cell * 5.2, w: 3 });
      const rays = ice ? 18 : 10;
      for (let i = 0; i < rays; i++) {
        fx.push({
          k: "ray",
          x,
          y,
          ang: (i / rays) * Math.PI * 2,
          life: ice ? 0.7 : 0.4,
          max: ice ? 0.7 : 0.4,
          col: ice ? (i % 2 ? frost : gold) : gold,
          len: cell * (ice ? 4.2 : 2.4),
        });
      }
      addSparks(x, y, ice ? "#f4fbff" : pal.fill[1], ice ? 36 : 16, ice ? 180 : 90);
      addSparks(x, y, ice ? pal.fill[0] : pal.fill[1], ice ? 20 : 8, ice ? 120 : 70);
      const n = ice ? 42 : 16;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (ice ? 160 : 80) * (0.45 + Math.random());
        fx.push({
          k: "shard",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 70,
          life: ice ? 0.95 : 0.5,
          max: ice ? 0.95 : 0.5,
          col: ice ? (i % 3 === 0 ? gold : i % 3 === 1 ? "#ffffff" : "#cfe8f8") : pal.fill[0],
          len: ice ? 14 + Math.random() * 16 : 6 + Math.random() * 8,
          ang: a,
          spin: (Math.random() - 0.5) * 18,
        });
      }
    });
    return;
  }

  events.forEach(({ r, c, color }) => {
    const x = (c + 0.5) * cell;
    const y = (r + 0.5) * cell;
    const pal = palOf(color);
    addSparks(x, y, pal.fill[1], 10, 64);
    fx.push({ k: "ring", x, y, life: 0.32, max: 0.32, col: pal.fill[0], from: 4, to: cell * 0.62, w: 2.2 });
  });
}

export function BoardCanvas({
  session,
  selectingCrush,
  resolving,
  bursts,
  falling,
  flashCol,
  guideCol = null,
  guideCell = null,
  onDrop,
  onCrush,
  onLanded,
  children,
  className,
}: {
  session: Session;
  selectingCrush: boolean;
  resolving: boolean;
  bursts: BurstEvent[];
  falling: Falling | null;
  flashCol: number | null;
  guideCol?: number | null;
  guideCell?: { r: number; c: number } | null;
  onDrop: (col: number) => void;
  onCrush: (col: number, row: number) => void;
  onLanded: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const cellRef = useRef(48);
  const dprRef = useRef(1);
  const hoverRef = useRef(-1);
  const fxItems = useRef<Fx[]>([]);
  const burstKey = useRef("");
  const sessionRef = useRef(session);
  const crushRef = useRef(selectingCrush);
  const resolvingRef = useRef(resolving);
  const fallingRef = useRef(falling);
  const flashRef = useRef(flashCol);
  const guideRef = useRef(guideCol);
  const guideCellRef = useRef(guideCell);
  const onDropRef = useRef(onDrop);
  const onCrushRef = useRef(onCrush);
  const onLandedRef = useRef(onLanded);
  const motion = useRef({ id: 0, t: 0, from: -0.85, to: 0, dur: 0.3, landed: 0 });

  sessionRef.current = session;
  crushRef.current = selectingCrush;
  resolvingRef.current = resolving;
  fallingRef.current = falling;
  flashRef.current = flashCol;
  guideRef.current = guideCol;
  guideCellRef.current = guideCell;
  onDropRef.current = onDrop;
  onCrushRef.current = onCrush;
  onLandedRef.current = onLanded;

  useEffect(() => {
    const wrap = wrapRef.current;
    const board = boardRef.current;
    const fx = fxRef.current;
    if (!wrap || !board || !fx) return;
    const bctx = board.getContext("2d", { alpha: false });
    const fctx = fx.getContext("2d", { alpha: true });
    if (!bctx || !fctx) return;
    let raf = 0;
    let last = performance.now();
    let alive = true;

    const layout = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      const cell = Math.max(28, Math.floor(Math.min(wrap.clientWidth / COLS, wrap.clientHeight / ROWS)));
      cellRef.current = cell;
      const w = COLS * cell;
      const h = ROWS * cell;
      for (const c of [board, fx]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }
    };

    const paint = () => {
      const cell = cellRef.current;
      const pad = Math.max(3, Math.round(cell * 0.08));
      drawBoard(
        bctx,
        sessionRef.current,
        cell,
        pad,
        hoverRef.current,
        crushRef.current,
        resolvingRef.current,
        flashRef.current ?? -1,
        guideRef.current ?? -1,
        guideCellRef.current,
      );
      const fall = fallingRef.current;
      if (fall) {
        if (motion.current.id !== fall.id) {
          const from = -0.85;
          const dist = fall.row - from;
          motion.current = {
            id: fall.id,
            t: 0,
            from,
            to: fall.row,
            dur: Math.max(0.28, 0.14 + dist * 0.05),
            landed: 0,
          };
        }
        const m = motion.current;
        const u = Math.min(1, m.t / m.dur);
        const e = u * u;
        const y = m.from + (m.to - m.from) * e;
        const rad = Math.max(6, cell / 2 - pad);
        const x = (fall.col + 0.5) * cell;
        bctx.save();
        bctx.beginPath();
        bctx.rect(0, 0, COLS * cell, ROWS * cell);
        bctx.clip();
        drawOrb(bctx, x, (y + 0.5) * cell, rad, fall.orb);
        bctx.restore();
      }
    };

    const drawFx = (dt: number) => {
      const cell = cellRef.current;
      const w = COLS * cell;
      const h = ROWS * cell;
      const dpr = dprRef.current;
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fx.width, fx.height);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fxItems.current = fxItems.current.filter((p) => p.life > 0);
      for (const p of fxItems.current) {
        p.life -= dt;
        const t = Math.max(0, p.life);
        if (p.k === "spark") {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 110 * dt;
          fctx.globalAlpha = Math.min(1, t * 1.6);
          fctx.fillStyle = p.col;
          fctx.beginPath();
          fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          fctx.fill();
        } else if (p.k === "ring") {
          const u = 1 - t / p.max;
          const rad = p.from + (p.to - p.from) * u;
          fctx.globalAlpha = (1 - u) * 0.9;
          fctx.strokeStyle = p.col;
          fctx.lineWidth = p.w * (1 - u * 0.5);
          fctx.beginPath();
          fctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          fctx.stroke();
        } else if (p.k === "beam") {
          const u = 1 - t / p.max;
          fctx.globalAlpha = (1 - u) * 0.85;
          const grd =
            p.axis === "h"
              ? fctx.createLinearGradient(0, 0, w, 0)
              : fctx.createLinearGradient(0, 0, 0, h);
          grd.addColorStop(0, "rgba(240,217,168,0)");
          grd.addColorStop(0.5, p.col);
          grd.addColorStop(1, "rgba(240,217,168,0)");
          fctx.fillStyle = grd;
          if (p.axis === "h") fctx.fillRect(0, p.i * cell + cell * 0.28, w, cell * 0.44);
          else fctx.fillRect(p.i * cell + cell * 0.28, 0, cell * 0.44, h);
        } else if (p.k === "flash") {
          const u = 1 - t / p.max;
          fctx.globalAlpha = p.a * (1 - u);
          fctx.fillStyle = p.col;
          fctx.fillRect(0, 0, w, h);
        } else if (p.k === "ray") {
          const u = 1 - t / p.max;
          fctx.globalAlpha = (1 - u) * 0.7;
          fctx.strokeStyle = p.col;
          fctx.lineWidth = 2.2 * (1 - u);
          fctx.beginPath();
          fctx.moveTo(p.x, p.y);
          fctx.lineTo(p.x + Math.cos(p.ang) * p.len * u, p.y + Math.sin(p.ang) * p.len * u);
          fctx.stroke();
        } else if (p.k === "shard") {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 220 * dt;
          p.ang += p.spin * dt;
          const u = 1 - t / p.max;
          fctx.save();
          fctx.translate(p.x, p.y);
          fctx.rotate(p.ang);
          fctx.globalAlpha = (1 - u) * 0.95;
          fctx.strokeStyle = p.col;
          fctx.lineWidth = 3.6;
          fctx.beginPath();
          fctx.moveTo(-p.len / 2, 0);
          fctx.lineTo(p.len / 2, 0);
          fctx.stroke();
          fctx.restore();
        }
      }
      fctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const fall = fallingRef.current;
      if (fall) {
        if (motion.current.id !== fall.id) {
          const from = -0.85;
          const dist = fall.row - from;
          motion.current = {
            id: fall.id,
            t: 0,
            from,
            to: fall.row,
            dur: Math.max(0.28, 0.14 + dist * 0.05),
            landed: 0,
          };
        }
        const m = motion.current;
        m.t += dt;
        if (m.t >= m.dur && m.landed !== fall.id) {
          m.t = m.dur;
          m.landed = fall.id;
          onLandedRef.current();
        }
      }
      drawFx(dt);
      paint();
      raf = requestAnimationFrame(tick);
    };

    const colFrom = (clientX: number) => {
      const rect = board.getBoundingClientRect();
      return Math.max(0, Math.min(COLS - 1, Math.floor((clientX - rect.left) / cellRef.current)));
    };
    const rowFrom = (clientY: number) => {
      const rect = board.getBoundingClientRect();
      return Math.max(0, Math.min(ROWS - 1, Math.floor((clientY - rect.top) / cellRef.current)));
    };

    const onMove = (e: PointerEvent) => {
      hoverRef.current = colFrom(e.clientX);
    };
    const onLeave = () => {
      hoverRef.current = -1;
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const col = colFrom(e.clientX);
      hoverRef.current = col;
      if (crushRef.current) onCrushRef.current(col, rowFrom(e.clientY));
      else onDropRef.current(col);
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    board.addEventListener("pointermove", onMove);
    board.addEventListener("pointerleave", onLeave);
    board.addEventListener("pointerdown", onDown);
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      board.removeEventListener("pointermove", onMove);
      board.removeEventListener("pointerleave", onLeave);
      board.removeEventListener("pointerdown", onDown);
    };
  }, []);

  useEffect(() => {
    const key = bursts.map((b) => `${b.kind ?? "b"}:${b.r},${b.c}`).join("|");
    if (key && key !== burstKey.current) {
      spawnFx(fxItems.current, bursts, cellRef.current);
    }
    burstKey.current = key;
  }, [bursts]);

  return (
    <div ref={wrapRef} className="play-stage">
      <div className={className ? `play-well ${className}` : "play-well"}>
        <canvas ref={boardRef} className="touch-none block" />
        <canvas ref={fxRef} className="pointer-events-none absolute inset-0" />
        {children}
      </div>
    </div>
  );
}