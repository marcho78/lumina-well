import { useCallback, useEffect } from "react";
import {
  ChevronLeft,
  CircleHelp,
  Crosshair,
  Gem,
  Infinity as InfinityIcon,
  Pause,
  RefreshCw,
  Settings,
  Sparkle,
  Star,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardCanvas } from "@/components/lumina/BoardCanvas";
import { CeremonyResult } from "@/components/lumina/CeremonyResult";
import { HelpScreen } from "@/components/lumina/HelpScreen";
import { ReelNumber } from "@/components/lumina/Juice";
import { OrbChip } from "@/components/lumina/OrbChip";
import { SparkField } from "@/components/lumina/SparkField";
import { CAMPAIGN, COLORS, LEVELS_PER_REALM, REALMS, UPGRADES } from "@/game/constants";
import { FTUE_ORDER, ftueIndex, qcLessons } from "@/game/ftue";
import { dailyLevel, dayKey } from "@/game/rng";
import { realmName, realmUnlocked, starsOfRealm, useGame } from "@/game/store";
import type { Orb, Screen } from "@/game/types";
import { unlockAudio } from "@/game/audio";
import { cn } from "@/lib/utils";

function ShardMark({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-accent", className)}>
      <Gem className="size-3.5" aria-hidden />
      {n}
    </span>
  );
}

function NextTray({
  queue,
  caption,
  danger = false,
  highlight = false,
  onActivate,
}: {
  queue: Orb[];
  caption?: string | null;
  danger?: boolean;
  highlight?: boolean;
  onActivate?: () => void;
}) {
  const next = queue[0];
  const rest = queue.slice(1);
  return (
    <div className="play-tray">
      <div className="flex items-end justify-center gap-5">
        {next && (
          <button
            type="button"
            className="flex flex-col items-center gap-1"
            onClick={onActivate}
            disabled={!onActivate}
          >
            <span className={highlight ? "play-cap on" : "play-cap"}>Next</span>
            <div className={cn("play-orb next", (highlight || (caption && !danger)) && "lumina-pulse")}>
              <OrbChip orb={next} size={52} />
            </div>
          </button>
        )}
        {rest.map((orb, i) => (
          <div key={`${i}-${orb.color}-${orb.special ?? "n"}`} className="flex flex-col items-center gap-1">
            <span className="play-cap">{i === 0 ? "Then" : "After"}</span>
            <div className="play-orb">
              <OrbChip orb={orb} size={36} />
            </div>
          </div>
        ))}
      </div>
      {caption ? <p className={cn("play-hint", danger && "danger")}>{caption}</p> : null}
    </div>
  );
}

function ScreenShell({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section className={cn("relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-3", className)} onClick={onClick}>
      {children}
    </section>
  );
}

function TopBar({
  left,
  title,
  right,
}: {
  left: React.ReactNode;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex h-11 shrink-0 items-center justify-between gap-3">
      {left}
      {title ? <h2 className="font-display text-lg tracking-wide">{title}</h2> : <span />}
      {right ?? <span className="w-11" />}
    </header>
  );
}

function WellEmblem({ className }: { className?: string }) {
  return (
    <div className={cn("home-well", className)} aria-hidden>
      <i className="ring r1" />
      <i className="ring r2" />
      <i className="ring r3" />
      <i className="core" />
      <div className="orbit">
        <i className="spark s1" />
        <i className="spark s2" />
        <i className="spark s3" />
      </div>
    </div>
  );
}

function BootScreen() {
  const go = useGame((s) => s.go);
  const startTutorial = useGame((s) => s.startTutorial);
  const ftue = useGame((s) => s.save.ftue);
  const enter = () => {
    if (ftue !== "done") startTutorial();
    else go("menu");
  };
  useEffect(() => {
    const t = window.setTimeout(enter, 700);
    return () => window.clearTimeout(t);
  }, [ftue]);
  return (
    <ScreenShell className="home cursor-pointer items-center justify-center" onClick={enter}>
      <span className="home-mote a" />
      <span className="home-mote b" />
      <WellEmblem className="boot-well" />
      <span className="home-ornament">✦  ✦  ✦</span>
      <h1 className="home-word">LUMINA</h1>
      <p className="home-tag">The Well of Lights</p>
      <div className="boot-rail">
        <i />
      </div>
    </ScreenShell>
  );
}

function MenuScreen() {
  const save = useGame((s) => s.save);
  const start = useGame((s) => s.start);
  const startTutorial = useGame((s) => s.startTutorial);
  const go = useGame((s) => s.go);
  const cleared = Object.values(save.stars).filter(Boolean).length;
  const starSum = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const well = Math.min(save.current, CAMPAIGN);
  const realmIdx = Math.min(REALMS.length - 1, Math.floor((well - 1) / LEVELS_PER_REALM));
  const realm = REALMS[realmIdx];
  const { c: realmClears } = starsOfRealm(save, realmIdx);
  const dailyOpen = save.daily.key !== dayKey() || !save.daily.cleared;
  return (
    <ScreenShell className="home">
      <span className="home-mote a" />
      <span className="home-mote b" />
      <span className="home-mote c" />
      <span className="home-mote d" />
      <header className="home-top">
        <div className="home-icons">
          <button type="button" className="home-icon" aria-label="Settings" onClick={() => go("settings")}>
            ⚙
          </button>
          <button type="button" className="home-icon" aria-label="How to play" onClick={() => go("help")}>
            ?
          </button>
        </div>
        <span className="home-wallet">◆ {save.shards}</span>
      </header>

      <div className="home-title">
        <span className="home-ornament">✦  ✦  ✦</span>
        <h1 className="home-word">LUMINA</h1>
        <p className="home-tag">Drop · Cascade · Ascend</p>
      </div>

      <WellEmblem />

      <div className="home-read">
        <span className="home-realm">{realm.name}</span>
        <div className="home-bar" aria-hidden>
          <i style={{ width: `${(realmClears / LEVELS_PER_REALM) * 100}%` }} />
        </div>
        <span className="home-well-n">
          Well {well} of {CAMPAIGN}
        </span>
      </div>

      <div className="home-strip">
        <span>
          <b>{cleared}</b>
          <small>Wells</small>
        </span>
        <span>
          <b>{starSum}</b>
          <small>Stars</small>
        </span>
        <span>
          <b>×{save.stats.bestCombo || 1}</b>
          <small>Combo</small>
        </span>
      </div>

      <nav className="home-nav">
        <button type="button" className="home-cta" onClick={() => start(well, "campaign")}>
          {save.stats.plays ? `Continue · Well ${well} ▸` : "Enter the Well ▸"}
        </button>
        <button type="button" className="home-realms" onClick={() => go("realms")}>
          ❖  Realms
        </button>
        <div className="home-modes">
          <button type="button" className="home-mode" onClick={() => start(1, "endless")}>
            ∞  Endless
          </button>
          <button type="button" className="home-mode" onClick={() => start(dailyLevel(), "daily")}>
            ☀  Daily Well
            {dailyOpen && <span className="home-dot" />}
          </button>
        </div>
        <div className="home-foot">
          <button type="button" onClick={() => go("atelier")}>
            ◆  Workshop
          </button>
          <button type="button" onClick={() => startTutorial()}>
            How to Play
          </button>
        </div>
      </nav>
    </ScreenShell>
  );
}

function RealmsScreen() {
  const save = useGame((s) => s.save);
  const go = useGame((s) => s.go);
  const setViewingRealm = useGame((s) => s.setViewingRealm);
  const here = Math.min(REALMS.length - 1, Math.floor((Math.min(save.current, CAMPAIGN) - 1) / LEVELS_PER_REALM));
  const fill = `${(here / Math.max(1, REALMS.length - 1)) * 100}%`;
  return (
    <ScreenShell className="home">
      <header className="home-top">
        <button type="button" className="home-icon" aria-label="Back" onClick={() => go("menu")}>
          ‹
        </button>
        <span className="home-realm">The Path</span>
        <span className="home-wallet">◆ {save.shards}</span>
      </header>
      <h2 className="shop-title">Realms</h2>
      <p className="shop-lead">Twelve realms. Forty wells each. Walk the path to the Source.</p>
      <div className="realm-map">
        <i className="realm-spine" style={{ ["--fill" as string]: fill }} />
        {REALMS.map((realm, i) => {
          const locked = !realmUnlocked(save, i);
          const { s, c } = starsOfRealm(save, i);
          const on = i === here && !locked;
          const done = c >= LEVELS_PER_REALM;
          return (
            <button
              key={realm.name}
              type="button"
              disabled={locked}
              onClick={() => {
                setViewingRealm(i);
                go("levels");
              }}
              className={[
                "realm-stop",
                i % 2 === 0 ? "left" : "right",
                locked ? "lock" : "",
                on ? "here" : "",
                done ? "done" : "",
              ].join(" ")}
            >
              <span className="realm-node" aria-hidden>
                <i />
              </span>
              <span className="realm-card">
                <span className="realm-name">{locked ? "Sealed" : realm.name}</span>
                <span className="realm-blurb">{locked ? "Clear the realm above to unseal." : realm.blurb}</span>
                {!locked && (
                  <span className="realm-meta">
                    <span className="realm-bar">
                      <i style={{ width: `${(c / LEVELS_PER_REALM) * 100}%` }} />
                    </span>
                    <em>
                      {c}/{LEVELS_PER_REALM} · ★ {s}
                    </em>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

function LevelsScreen() {
  const save = useGame((s) => s.save);
  const go = useGame((s) => s.go);
  const start = useGame((s) => s.start);
  const viewingRealm = useGame((s) => s.viewingRealm);
  const realm = REALMS[viewingRealm];
  const { s, c } = starsOfRealm(save, viewingRealm);
  const base = viewingRealm * LEVELS_PER_REALM + 1;
  return (
    <ScreenShell className="home">
      <header className="home-top">
        <button type="button" className="home-icon" aria-label="Back" onClick={() => go("realms")}>
          ‹
        </button>
        <span className="home-realm">{realm.name}</span>
        <span className="home-wallet">
          {c}/{LEVELS_PER_REALM}
        </span>
      </header>
      <div className="plaque level-plaque min-h-0 w-full flex-1">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-[0.28em] text-sand">Wells</p>
          <span className="flex items-center gap-1 text-sand">
            <Star className="size-3.5 fill-sand text-sand" />
            <ReelNumber value={s} places={3} duration={800} className="text-lg" />
          </span>
        </div>
        <div className="level-grid">
          {Array.from({ length: LEVELS_PER_REALM }, (_, i) => {
            const lvl = base + i;
            const locked = lvl > save.farthest;
            const stars = save.stars[lvl] || 0;
            const current = lvl === save.current;
            return (
              <button
                key={lvl}
                disabled={locked}
                onClick={() => start(lvl, "campaign")}
                className={cn("level-tile", current && "current", stars > 0 && "cleared")}
              >
                {i + 1}
                <span className="level-stars">
                  {[1, 2, 3].map((k) => (
                    <Star key={k} className={cn("size-2.5", k <= stars ? "on" : "off")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </ScreenShell>
  );
}

function PlayScreen() {
  const session = useGame((s) => s.session);
  const go = useGame((s) => s.go);
  const drop = useGame((s) => s.drop);
  const crushAt = useGame((s) => s.crushAt);
  const shuffle = useGame((s) => s.shuffle);
  const fireNova = useGame((s) => s.fireNova);
  const toggleCrush = useGame((s) => s.toggleCrush);
  const resolving = useGame((s) => s.resolving);
  const selectingCrush = useGame((s) => s.selectingCrush);
  const banner = useGame((s) => s.banner);
  const floats = useGame((s) => s.floats);
  const lastBursts = useGame((s) => s.lastBursts);
  const falling = useGame((s) => s.falling);
  const hint = useGame((s) => s.hint);
  const flashCol = useGame((s) => s.flashCol);
  const land = useGame((s) => s.land);
  const coachTitle = useGame((s) => s.coachTitle);
  const coachBody = useGame((s) => s.coachBody);
  const guideCol = useGame((s) => s.guideCol);
  const guideCell = useGame((s) => s.guideCell);
  const ftueHold = useGame((s) => s.ftueHold);
  const ftueAdvance = useGame((s) => s.ftueAdvance);
  const shake = useGame((s) => s.save.settings.shake);
  const onDrop = useCallback((col: number) => void drop(col), [drop]);
  const onCrush = useCallback((c: number, r: number) => void crushAt(c, r), [crushAt]);
  const onLanded = useCallback(() => void land(), [land]);
  if (!session) return null;
  const ftue = Boolean(session.spec.ftue);
  const lesson = ftueIndex(session.ftueBeat as import("@/game/ftue").FtueBeat);
  const lessonMax = FTUE_ORDER.length - 1;
  const pct = ftue
    ? Math.min(100, (Math.max(1, lesson) / lessonMax) * 100)
    : Math.min(100, (session.score / session.spec.target) * 100);
  const title = ftue
    ? coachTitle || "The First Drop"
    : session.spec.mode === "daily"
      ? "Daily Well"
      : session.spec.mode === "endless"
        ? `Endless ${session.spec.level}`
        : `${realmName(session.spec.level)} ${((session.spec.level - 1) % LEVELS_PER_REALM) + 1}`;
  const caption = ftue
    ? null
    : hint
      ? hint
      : selectingCrush
        ? "Tap the marked ice"
        : session.drops < 3
          ? "Tap a column — Next lands on the dashed ring."
          : null;
  const teachHud = ftue && session.ftueBeat === "hud";
  const showCrush = !ftue || session.ftueBeat === "crush";
  const showShuffle = !ftue || session.ftueBeat === "shuffle";
  const showTools = !ftue || session.ftueBeat === "crush" || session.ftueBeat === "shuffle";
  return (
    <ScreenShell className="home play px-4">
      <header className="play-hud">
        <div className="play-title">{title}</div>
        <div className={teachHud ? "play-rail teach" : "play-rail"}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="play-hud-row">
          <button type="button" className="home-icon" aria-label="Pause" onClick={() => go("pause")}>
            Ⅱ
          </button>
          <div className={teachHud ? "play-score teach" : "play-score"}>
            {ftue ? (
              <>
                <b>
                  {Math.max(1, lesson)} / {lessonMax}
                </b>
                <span> Lesson</span>
              </>
            ) : (
              <>
                <b>{session.score.toLocaleString()}</b>
                <span> / {session.spec.target.toLocaleString()}</span>
              </>
            )}
          </div>
          <div className={cn("play-moves", session.moves <= 5 && "low", teachHud && "teach")}>
            {session.moves}
            <small>Moves</small>
          </div>
        </div>
      </header>
      <NextTray
        queue={session.queue}
        danger={Boolean(hint)}
        caption={caption}
        highlight={ftue && !ftueHold && session.ftueBeat !== "crush" && session.ftueBeat !== "shuffle" && session.ftueBeat !== "hud"}
        onActivate={
          ftue && !resolving
            ? () => {
                if (ftueHold) ftueAdvance();
                else if (session.ftueBeat === "crush" || session.ftueBeat === "shuffle") return;
                else if (guideCol != null) void drop(guideCol);
              }
            : undefined
        }
      />
      {ftue && (hint || coachBody) ? (
        <div className={hint ? "ftue-coach danger" : "ftue-coach"}>
          <span>{hint ? "Can't drop there" : coachTitle}</span>
          <p>{hint || coachBody}</p>
        </div>
      ) : null}
      <BoardCanvas
        session={session}
        selectingCrush={selectingCrush}
        resolving={resolving}
        bursts={lastBursts}
        falling={falling}
        flashCol={flashCol}
        guideCol={guideCol}
        guideCell={guideCell}
        onDrop={onDrop}
        onCrush={onCrush}
        onLanded={onLanded}
        className={
          shake && resolving && (session.combo > 1 || lastBursts.some((b) => b.kind === "nova" || b.kind === "bomb" || b.kind === "crush"))
            ? "shake-well"
            : undefined
        }
      >
        {floats.map((f) => (
          <span
            key={f.id}
            className="float-pts pointer-events-none absolute text-sm"
            style={{ left: `${((f.c + 0.35) / 6) * 100}%`, top: `${((f.r + 0.1) / 8) * 100}%` }}
          >
            +{f.n}
          </span>
        ))}
        {banner && <div className="combo-banner pointer-events-none absolute inset-x-0 top-8 text-center">{banner}</div>}
        {ftueHold && !hint ? (
          <div className="ftue-hold" onClick={ftueAdvance} role="presentation">
            <span className="ftue-next">Next ▸</span>
          </div>
        ) : null}
      </BoardCanvas>
      {showTools && (
      <footer className={showCrush && showShuffle && !ftue ? "play-tools" : "play-tools one"}>
        {showShuffle && (
        <button
          type="button"
          className={ftue && session.ftueBeat === "shuffle" && !ftueHold ? "play-tool teach" : "play-tool"}
          disabled={session.tools.shuffle <= 0 || resolving}
          onClick={shuffle}
        >
          <span>↻</span>
          <strong>Shuffle</strong>
          <em>{session.tools.shuffle}</em>
        </button>
        )}
        {showCrush && (
        <button
          type="button"
          className={
            selectingCrush
              ? "play-tool on"
              : ftue && session.ftueBeat === "crush" && !ftueHold
                ? "play-tool teach"
                : "play-tool"
          }
          disabled={session.tools.crush <= 0 || resolving}
          onClick={toggleCrush}
        >
          <span>+</span>
          <strong>Crush</strong>
          <em>{session.tools.crush}</em>
        </button>
        )}
        {!ftue && (
        <button type="button" className="play-tool" disabled={session.tools.nova <= 0 || resolving} onClick={() => void fireNova()}>
          <span>✦</span>
          <strong>Nova</strong>
          <em>{session.tools.nova}</em>
        </button>
        )}
      </footer>
      )}
    </ScreenShell>
  );
}

function PauseScreen() {
  const go = useGame((s) => s.go);
  const retry = useGame((s) => s.retry);
  return (
    <ScreenShell className="home items-center justify-center">
      <div className="ceremony-frame mx-auto w-full">
        <div className="ceremony-inner text-center">
          <div className="ceremony-kicker">
            <i />
            <span>The Well</span>
            <i />
          </div>
          <h2 className="ceremony-title">Paused</h2>
          <p className="shop-lead mx-auto text-center">The well holds its breath.</p>
          <div className="ceremony-actions">
            <button type="button" className="ceremony-cta" onClick={() => go("play")}>
              Resume
            </button>
            <button type="button" className="ceremony-ghost" onClick={() => go("help")}>
              How to Play
            </button>
            <button type="button" className="ceremony-ghost" onClick={retry}>
              Restart Well
            </button>
            <button type="button" className="ceremony-ghost" onClick={() => go("menu")}>
              Leave
            </button>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function AtelierScreen() {
  const save = useGame((s) => s.save);
  const go = useGame((s) => s.go);
  const buy = useGame((s) => s.buy);
  const hint = useGame((s) => s.hint);
  return (
    <ScreenShell className="home">
      <header className="home-top">
        <button type="button" className="home-icon" aria-label="Back" onClick={() => go("menu")}>
          ‹
        </button>
        <span className="home-wallet">◆ {save.shards}</span>
      </header>
      <div className="shop-head">
        <p className="home-realm">The Atelier</p>
        <h2 className="shop-title">Workshop</h2>
        <p className="shop-lead">Spend shards here. What you buy stays with you in every well.</p>
        {hint && <p className="shop-hint">{hint}</p>}
      </div>
      <div className="shop-list">
        {UPGRADES.map((u) => {
          const lv = save.upgrades[u.key];
          const maxed = lv >= u.max;
          const cost = maxed ? 0 : u.cost[lv];
          const poor = !maxed && save.shards < cost;
          return (
            <button
              key={u.key}
              type="button"
              disabled={maxed}
              onClick={() => buy(u.key)}
              className={poor ? "shop-row poor" : "shop-row"}
            >
              <span className="shop-copy">
                <span className="shop-name">{u.name}</span>
                <span className="shop-desc">{u.desc}</span>
                <span className="shop-pips" aria-label={`${lv} of ${u.max}`}>
                  {Array.from({ length: u.max }, (_, i) => (
                    <i key={i} className={i < lv ? "on" : undefined} />
                  ))}
                </span>
              </span>
              <span className={maxed ? "shop-cost max" : "shop-cost"}>{maxed ? "Maxed" : `◆  ${cost}`}</span>
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="set-row">
      <span>{label}</span>
      <span className={on ? "set-switch on" : "set-switch"} aria-hidden>
        <i />
      </span>
    </button>
  );
}

function SettingsScreen() {
  const save = useGame((s) => s.save);
  const go = useGame((s) => s.go);
  const setSetting = useGame((s) => s.setSetting);
  const reset = useGame((s) => s.reset);
  return (
    <ScreenShell className="home items-center justify-center">
      <div className="ceremony-frame w-full">
        <div className="ceremony-inner">
          <div className="ceremony-kicker">
            <i />
            <span>The Well</span>
            <i />
          </div>
          <h2 className="shop-title">Settings</h2>
          <div className="set-list">
            <ToggleRow label="Sound" on={save.settings.sfx} onChange={(v) => setSetting("sfx", v)} />
            <ToggleRow label="Haptics" on={save.settings.haptic} onChange={(v) => setSetting("haptic", v)} />
            <ToggleRow label="Screen shake" on={save.settings.shake} onChange={(v) => setSetting("shake", v)} />
          </div>
          <div className="ceremony-actions">
            <button type="button" className="ceremony-ghost" onClick={() => go("help")}>
              How to Play
            </button>
            <button
              type="button"
              className="ceremony-ghost set-reset"
              onClick={() => {
                if (window.confirm("Erase every star, shard, and well?")) reset();
              }}
            >
              Reset progress
            </button>
            <button type="button" className="ceremony-cta" onClick={() => go("menu")}>
              Done
            </button>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

export function LuminaApp() {
  const screen = useGame((s) => s.screen);
  const hydrate = useGame((s) => s.hydrate);
  const session = useGame((s) => s.session);
  const start = useGame((s) => s.start);
  const drop = useGame((s) => s.drop);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    unlockAudio();
    (window as unknown as { __LUMINA: unknown }).__LUMINA = {
      getSession: () => useGame.getState().session,
      start: (level: number, mode: "campaign" | "endless" | "daily") => useGame.getState().start(level, mode),
      startTutorial: () => useGame.getState().startTutorial(),
      skipFtue: (beat: string) => useGame.getState().skipFtue(beat as import("@/game/ftue").FtueBeat),
      ftueAdvance: () => useGame.getState().ftueAdvance(),
      qc: () => qcLessons(),
      drop: (col: number) => {
        void useGame.getState().drop(col);
      },
      crush: (c: number, r: number) => {
        void useGame.getState().crushAt(c, r);
      },
      shuffle: () => useGame.getState().shuffle(),
      toggleCrush: () => useGame.getState().toggleCrush(),
      ftue: () => {
        const s = useGame.getState();
        return {
          beat: s.session?.ftueBeat,
          hold: s.ftueHold,
          title: s.coachTitle,
          screen: s.screen,
          tools: s.session?.tools,
        };
      },
      result: (win = true, stars = 3) => {
        const st = useGame.getState();
        if (!st.session) st.start(1, "campaign");
        const session = useGame.getState().session;
        if (!session) return;
        const n = Math.max(0, Math.min(3, stars));
        useGame.setState({
          session: { ...session, score: 695, maxCombo: 1, cleared: 3, won: win, lost: !win },
          lastResult: { win, stars: win ? n : 0, reward: win ? 56 : 0, newBest: win && n === 3 },
          screen: "result",
          resolving: false,
        });
      },
      go: (s: Screen) => useGame.getState().go(s),
      palette: COLORS,
    };
  }, [session, start, drop]);

  return (
    <div className="flex min-h-dvh justify-center bg-bg text-fg">
      <div className="lumina-stage relative flex h-dvh w-full max-w-md flex-col overflow-hidden">
        <div className="vignette pointer-events-none absolute inset-0 z-[1]" />
        <div className="grain pointer-events-none absolute inset-0 z-[2]" />
        <SparkField />
        {screen === "boot" && <BootScreen />}
        {screen === "menu" && <MenuScreen />}
        {screen === "realms" && <RealmsScreen />}
        {screen === "levels" && <LevelsScreen />}
        {screen === "play" && <PlayScreen />}
        {screen === "result" && <CeremonyResult />}
        {screen === "pause" && <PauseScreen />}
        {screen === "atelier" && <AtelierScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "help" && <HelpScreen />}
      </div>
    </div>
  );
}
