import { useEffect, useState } from "react";
import { realmName, useGame } from "@/game/store";

function CountUp({
  value,
  delay = 1100,
  duration = 1400,
  format,
}: {
  value: number;
  delay?: number;
  duration?: number;
  format: (n: number) => string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    setN(0);
    let raf = 0;
    const startAt = performance.now() + delay;
    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startAt) / duration);
      const e = 1 - (1 - t) ** 3;
      setN(Math.round(value * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, duration]);
  return <span className="ceremony-num">{format(n)}</span>;
}

export function CeremonyResult() {
  const session = useGame((s) => s.session);
  const result = useGame((s) => s.lastResult);
  const next = useGame((s) => s.next);
  const retry = useGame((s) => s.retry);
  const go = useGame((s) => s.go);
  if (!session || !result) return null;
  const title =
    session.spec.mode === "daily"
      ? "Daily Well"
      : session.spec.mode === "endless"
        ? `Endless ${session.spec.level}`
        : realmName(session.spec.level);
  const win = result.win;
  const stars = Math.max(0, Math.min(3, result.stars));
  const grade = ["No Stars", "One Star", "Two Stars", "Three Stars"][stars];
  const cta =
    session.spec.mode === "daily" ? "Atelier ▸" : win ? "Next Well ▸" : "Try Again ▸";
  return (
    <section className="ceremony-veil relative z-10 flex min-h-0 flex-1 items-center justify-center px-4">
      <div className={win ? "ceremony-frame" : "ceremony-frame dark"}>
        <div className="ceremony-inner">
          <span className="ceremony-mote a" />
          <span className="ceremony-mote b" />
          <span className="ceremony-mote c" />

          <div className="ceremony-kicker">
            <i />
            <span>{win ? "✦  Well Cleared  ✦" : "✦  The Well Went Dark  ✦"}</span>
            <i />
          </div>

          <h2 className="ceremony-title">{title}</h2>

          <div className="ceremony-stars" aria-label={grade}>
            {[0, 1, 2].map((i) => {
              const earned = i < result.stars;
              return (
                <div key={i} className={i === 1 ? "star-col mid" : "star-col"}>
                  <span className={earned ? "medallion on" : "medallion off"}>
                    <span className={earned ? "glyph lit" : "glyph dim"} style={{ animationDelay: `${350 + i * 200}ms` }}>
                      ★
                    </span>
                  </span>
                  <span className={earned ? "star-idx on" : "star-idx"}>{i + 1}</span>
                </div>
              );
            })}
          </div>
          <p className="ceremony-grade">{grade}</p>

          {win && result.newBest && <div className="ceremony-badge">New Best</div>}

          <div className="ceremony-stats">
            <div className="ceremony-stat hero">
              <span>Score</span>
              <b />
              <CountUp value={session.score} format={(n) => n.toLocaleString()} />
            </div>
            <div className="ceremony-stat">
              <span>Best Combo</span>
              <b />
              <CountUp value={session.maxCombo} format={(n) => `×${n}`} />
            </div>
            <div className="ceremony-stat">
              <span>Burst</span>
              <b />
              <CountUp value={session.cleared} format={(n) => n.toLocaleString()} />
            </div>
            {win && result.reward > 0 && (
              <div className="ceremony-shards">
                <span>Shards</span>
                <CountUp value={result.reward} format={(n) => `◆  +${n}`} />
              </div>
            )}
          </div>

          <div className="ceremony-actions">
            <button type="button" className="ceremony-cta" onClick={next}>
              {cta}
            </button>
            <div className="ceremony-second">
              <button type="button" className="ceremony-ghost" onClick={retry}>
                ↻  Retry
              </button>
              <button type="button" className="ceremony-ghost" onClick={() => go("realms")}>
                ❖  Realms
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
