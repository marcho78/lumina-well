import { useState } from "react";
import { OrbChip } from "@/components/lumina/OrbChip";
import { useGame } from "@/game/store";
import type { Orb } from "@/game/types";

const rose: Orb = { color: 0, type: "orb", special: null, hp: 1 };
const sand: Orb = { color: 1, type: "orb", special: null, hp: 1 };
const moss: Orb = { color: 2, type: "orb", special: null, hp: 1 };
const iceC: Orb = { color: 3, type: "orb", special: null, hp: 1 };
const iceShell: Orb = { color: 3, type: "ice", special: null, hp: 2 };
const stone: Orb = { color: -1, type: "stone", special: null, hp: 99 };
const line: Orb = { color: 0, type: "orb", special: "row", hp: 1 };
const bomb: Orb = { color: 2, type: "orb", special: "bomb", hp: 1 };
const nova: Orb = { color: 3, type: "orb", special: "nova", hp: 1 };

type Cell = Orb | "ghost" | null;

function MiniWell({ cells, caption }: { cells: Cell[][]; caption?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="help-well">
        {cells.flatMap((row, r) =>
          row.map((cell, c) => (
            <div key={`${r}-${c}`} className="help-cell">
              {cell === "ghost" ? (
                <span className="help-ghost">
                  <OrbChip orb={iceC} size={28} />
                </span>
              ) : cell ? (
                <OrbChip orb={cell} size={32} />
              ) : null}
            </div>
          )),
        )}
      </div>
      {caption ? <p className="help-cap">{caption}</p> : null}
    </div>
  );
}

const STEPS = [
  {
    title: "Drop",
    body: "The Next light sits above the well. Tap a column. It falls to the dashed circle — that ring is the landing spot, not a hole.",
    visual: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="help-cap">Next</span>
          <div className="help-next">
            <OrbChip orb={iceC} size={44} />
          </div>
        </div>
        <MiniWell
          cells={[
            [null, "ghost", null],
            [moss, iceC, rose],
            [rose, sand, moss],
          ]}
          caption="Dashed ring = where Next lands"
        />
      </div>
    ),
  },
  {
    title: "Match",
    body: "Three or more of the same color touching (up, down, left, right) burst. Diagonals do not count.",
    visual: (
      <MiniWell
        cells={[
          [null, iceC, null],
          [moss, iceC, rose],
          [sand, iceC, moss],
        ]}
        caption="Three ice lights in a column burst"
      />
    ),
  },
  {
    title: "Cascade",
    body: "Lights fall into the gaps. New matches chain. Combos score more. Clear the target before moves run out.",
    visual: (
      <div className="flex w-full items-center justify-center gap-4">
        <MiniWell
          cells={[
            [null, null, null],
            [rose, iceC, moss],
            [rose, sand, moss],
          ]}
        />
        <span className="help-cap">then</span>
        <MiniWell
          cells={[
            [null, null, null],
            [null, iceC, null],
            [rose, sand, moss],
          ]}
          caption="Burst · fall · chain"
        />
      </div>
    ),
  },
  {
    title: "Blockers & specials",
    body: "Ice needs two hits. Stone never matches and never falls. Four of a kind leave a line, five a bomb, six a nova.",
    visual: (
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-end justify-center gap-6">
          <figure className="help-fig">
            <OrbChip orb={iceShell} size={44} />
            <figcaption>Ice</figcaption>
          </figure>
          <figure className="help-fig">
            <OrbChip orb={stone} size={44} />
            <figcaption>Stone</figcaption>
          </figure>
        </div>
        <div className="flex items-end justify-center gap-6">
          <figure className="help-fig">
            <OrbChip orb={line} size={40} />
            <figcaption>Line</figcaption>
          </figure>
          <figure className="help-fig">
            <OrbChip orb={bomb} size={40} />
            <figcaption>Bomb</figcaption>
          </figure>
          <figure className="help-fig">
            <OrbChip orb={nova} size={40} />
            <figcaption>Nova</figcaption>
          </figure>
        </div>
      </div>
    ),
  },
  {
    title: "Tools",
    body: "Shuffle the incoming lights. Crush one light on the board. Nova bursts every light of the Next color.",
    visual: (
      <div className="flex w-full justify-center gap-3">
        <div className="help-tool">
          <span>↻</span>
          Shuffle
        </div>
        <div className="help-tool">
          <span>+</span>
          Crush
        </div>
        <div className="help-tool">
          <span>✦</span>
          Nova
        </div>
      </div>
    ),
  },
];

export function HelpScreen() {
  const go = useGame((s) => s.go);
  const prev = useGame((s) => s.prevScreen);
  const start = useGame((s) => s.start);
  const save = useGame((s) => s.save);
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const page = STEPS[step];
  const backTo = prev === "play" || prev === "pause" ? "pause" : prev === "settings" ? "settings" : "menu";

  return (
    <section className="home relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-6 pt-3">
      <header className="home-top">
        <button type="button" className="home-icon" aria-label="Back" onClick={() => go(backTo)}>
          ‹
        </button>
        <span className="home-realm">How to Play</span>
        <span className="help-step">
          {step + 1} / {STEPS.length}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
        <h2 className="shop-title">{page.title}</h2>
        <div className="w-full">{page.visual}</div>
        <p className="help-body">{page.body}</p>
      </div>

      <div className="help-dots">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Step ${i + 1}`}
            onClick={() => setStep(i)}
            className={i === step ? "on" : undefined}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="ceremony-ghost" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
          ‹  Back
        </button>
        {last ? (
          <button
            type="button"
            className="home-cta"
            onClick={() => {
              if (backTo === "menu" && save.stats.plays === 0) start(1, "campaign");
              else go(backTo);
            }}
          >
            {backTo === "menu" && save.stats.plays === 0 ? "Enter the Well ▸" : "Got it"}
          </button>
        ) : (
          <button type="button" className="home-cta" onClick={() => setStep((n) => n + 1)}>
            Next ▸
          </button>
        )}
      </div>
    </section>
  );
}
