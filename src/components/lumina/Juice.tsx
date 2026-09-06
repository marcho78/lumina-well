import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReelNumber({
  value,
  places = 4,
  duration = 1100,
  className,
  prefix = "",
}: {
  value: number;
  places?: number;
  duration?: number;
  className?: string;
  prefix?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    setN(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - t) ** 3;
      setN(Math.round(value * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const chars = String(Math.max(0, n)).padStart(places, "0").slice(-places);
  return (
    <span className={cn("reel-row", className)}>
      {prefix ? <span className="reel-prefix">{prefix}</span> : null}
      {chars.split("").map((d, i) => (
        <span key={`${i}-${places}`} className="reel-window">
          <span className="reel-strip" style={{ transform: `translateY(${-Number(d) * 10}%)` }}>
            {Array.from({ length: 10 }, (_, k) => (
              <span key={k}>{k}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

export function HeldStars({ n, size = 40 }: { n: number; size?: number }) {
  return (
    <div className="held-stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("star-socket", i < n && "lit")}
          style={{ animationDelay: `${220 + i * 240}ms` }}
        >
          <Star
            size={size}
            strokeWidth={1.5}
            className={i < n ? "fill-sand text-sand" : "text-subtle"}
          />
        </span>
      ))}
    </div>
  );
}
