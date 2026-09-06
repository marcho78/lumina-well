import { useEffect, useRef } from "react";
import { drawOrb } from "@/game/draw";
import type { Orb } from "@/game/types";

export function OrbChip({ orb, size = 36 }: { orb: Orb; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.clearRect(0, 0, size, size);
    drawOrb(g, size / 2, size / 2, size * 0.42, orb);
  }, [orb, size]);
  return <canvas ref={ref} className="block shrink-0" aria-hidden />;
}
