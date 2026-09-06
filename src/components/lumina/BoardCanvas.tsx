import { useEffect, useRef } from "react";
import { COLS, COLORS, ROWS } from "@/game/constants";
import { drawBoard, drawOrb } from "@/game/draw";
import type { BurstEvent } from "@/game/engine";
import type { Falling } from "@/game/store";
import type { Session } from "@/game/types";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; col: string; r: number };

export function BoardCanvas({
  session,
  selectingCrush,
  resolving,
  bursts,
  falling,
  flashCol,
  onDrop,
  onCrush,
  onLanded,
}: {
  session: Session;
  selectingCrush: boolean;
  resolving: boolean;
  bursts: BurstEvent[];
  falling: Falling | null;
  flashCol: number | null;
  onDrop: (col: number) => void;
  onCrush: (col: number, row: number) => void;
  onLanded: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const cellRef = useRef(48);
  const dprRef = useRef(1);
  const hoverRef = useRef(-1);
  const particles = useRef<Particle[]>([]);
  const burstKey = useRef("");
  const sessionRef = useRef(session);
  const crushRef = useRef(selectingCrush);
  const resolvingRef = useRef(resolving);
  const fallingRef = useRef(falling);
  const flashRef = useRef(flashCol);
  const onDropRef = useRef(onDrop);
  const onCrushRef = useRef(onCrush);
  const onLandedRef = useRef(onLanded);
  const motion = useRef({ id: 0, t: 0, from: -0.85, to: 0, dur: 0.3, landed: 0 });

  sessionRef.current = session;
  crushRef.current = selectingCrush;
  resolvingRef.current = resolving;
  fallingRef.current = falling;
  flashRef.current = flashCol;
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
      const dpr = dprRef.current;
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fx.width, fx.height);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.current = particles.current.filter((p) => p.life > 0);
      particles.current.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 90 * dt;
        p.life -= dt * 1.8;
        fctx.globalAlpha = Math.max(0, p.life);
        fctx.fillStyle = p.col;
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fctx.fill();
      });
      fctx.globalAlpha = 1;
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
    const key = bursts.map((b) => `${b.r},${b.c}`).join("|");
    if (key && key !== burstKey.current) {
      const prevLen = burstKey.current ? burstKey.current.split("|").length : 0;
      const list = bursts.slice(prevLen);
      const cell = cellRef.current;
      (list.length ? list : bursts.slice(-8)).forEach(({ r, c, color }) => {
        const pal = COLORS[Math.max(0, color)] ?? COLORS[0];
        const x = (c + 0.5) * cell;
        const y = (r + 0.5) * cell;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 22 + Math.random() * 60;
          particles.current.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 18,
            life: 1,
            col: pal.fill[1],
            r: 1.1 + Math.random() * 1.4,
          });
        }
      });
    }
    burstKey.current = key;
  }, [bursts]);

  return (
    <div ref={wrapRef} className="relative mx-auto flex h-full w-full max-w-md items-center justify-center">
      <div className="relative">
        <canvas ref={boardRef} className="touch-none block" />
        <canvas ref={fxRef} className="pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}
