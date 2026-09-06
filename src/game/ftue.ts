import { COLS, ROWS } from "./constants";
import { applyCascade, columnTop, detonate, gravity } from "./engine";
import type { Orb, Session } from "./types";

function makeOrb(color: number, extra?: Partial<Orb>): Orb {
  return { color, type: "orb", special: null, hp: 1, ...extra };
}

export const FTUE_COL = 2;

export type FtueBeat =
  | "next"
  | "burst"
  | "cascade"
  | "four"
  | "line"
  | "five"
  | "nova"
  | "crush"
  | "shuffle"
  | "hud";

export const FTUE_ORDER: FtueBeat[] = [
  "next",
  "burst",
  "cascade",
  "four",
  "line",
  "five",
  "nova",
  "crush",
  "shuffle",
  "hud",
];

export function ftueIndex(beat: FtueBeat | undefined) {
  const i = FTUE_ORDER.indexOf(beat as FtueBeat);
  return i < 0 ? 0 : i;
}

export type FtueMeta = {
  title: string;
  body: string;
  guideCol: number | null;
  guideCell: { r: number; c: number } | null;
  hold: boolean;
  action: "look" | "drop" | "crush" | "shuffle" | "read";
  wrong: string;
};

function blank(): (Orb | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function paint(b: (Orb | null)[][], r: number, row: (number | null)[]) {
  row.forEach((color, c) => {
    if (color === null) return;
    b[r][c] = makeOrb(color);
  });
}

function dummy(): Session {
  return {
    spec: {
      colors: 4,
      ice: false,
      stone: false,
      target: 9999,
      moves: 12,
      fill: 0,
      world: 0,
      mode: "campaign",
      level: 1,
      seed: 1,
      ftue: true,
    },
    board: blank(),
    queue: [],
    score: 0,
    moves: 12,
    combo: 0,
    maxCombo: 0,
    cleared: 0,
    drops: 0,
    won: false,
    lost: false,
    tools: { shuffle: 0, crush: 0, nova: 0 },
    ftueBeat: "next",
  };
}

export function applyLesson(session: Session, beat: FtueBeat): FtueMeta {
  session.ftueBeat = beat;
  session.combo = 0;
  session.tools = { shuffle: 0, crush: 0, nova: 0 };
  const b = blank();
  let meta: FtueMeta;

  switch (beat) {
    case "next":
    case "burst": {
      paint(b, 6, [2, 1, 3, 0, 2, 1]);
      paint(b, 7, [1, 2, 3, 1, 0, 2]);
      session.queue = [makeOrb(3)];
      meta =
        beat === "next"
          ? {
              title: "Next",
              body: "This is NEXT — the light you are about to drop.",
              guideCol: null,
              guideCell: null,
              hold: false,
              action: "look",
              wrong: "This is NEXT. Wait a beat, then drop.",
            }
          : {
              title: "Drop",
              body: "Tap the glowing column. Three of the same color that touch will BURST.",
              guideCol: 2,
              guideCell: null,
              hold: false,
              action: "drop",
              wrong: "Tap the glowing column so NEXT lands on the two matching lights.",
            };
      break;
    }
    case "cascade": {
      // Column 0 is empty top-to-bottom so NEXT lands on the floor beside two ice.
      // Burst those three, then the two roses above fall into a new group of three.
      paint(b, 6, [null, 0, 0, 2, 1, 2]);
      paint(b, 7, [null, 3, 3, 0, 1, 2]);
      session.queue = [makeOrb(3)];
      meta = {
        title: "Cascade",
        body: "The three ice vanish. Then the two above fall into the leftover.",
        guideCol: 0,
        guideCell: null,
        hold: false,
        action: "drop",
        wrong: "Drop on the glowing column — the dashed ring sits on the floor.",
      };
      break;
    }
    case "four": {
      paint(b, 6, [1, 2, null, 1, 2, 3]);
      paint(b, 7, [0, 0, null, 0, 1, 2]);
      session.queue = [makeOrb(0)];
      meta = {
        title: "Four",
        body: "Four of a color leaves a LINE charm. Drop on the glowing column.",
        guideCol: 2,
        guideCell: null,
        hold: false,
        action: "drop",
        wrong: "Drop on the glowing column to make a group of four.",
      };
      break;
    }
    case "line": {
      paint(b, 6, [1, 2, 0, null, 2, 3]);
      paint(b, 7, [0, 1, 2, null, 0, 1]);
      session.queue = [makeOrb(0, { special: "row" })];
      meta = {
        title: "Line",
        body: "NEXT is a LINE. Drop it — the whole row it lands on clears.",
        guideCol: 3,
        guideCell: null,
        hold: false,
        action: "drop",
        wrong: "Drop the LINE on the glowing column.",
      };
      break;
    }
    case "five": {
      paint(b, 6, [1, 2, null, 1, 2, 3]);
      paint(b, 7, [0, 0, null, 0, 0, 1]);
      session.queue = [makeOrb(0)];
      meta = {
        title: "Five",
        body: "Five of a color leaves a NOVA. Drop on the glowing column.",
        guideCol: 2,
        guideCell: null,
        hold: false,
        action: "drop",
        wrong: "Drop on the glowing column to make a group of five.",
      };
      break;
    }
    case "nova": {
      paint(b, 6, [2, 0, 1, 2, 0, 1]);
      paint(b, 7, [0, 1, 2, 0, 1, 0]);
      session.queue = [makeOrb(0, { special: "nova" })];
      meta = {
        title: "Nova",
        body: "NEXT is a NOVA. Drop it — every light of that color bursts.",
        guideCol: 3,
        guideCell: null,
        hold: false,
        action: "drop",
        wrong: "Drop the NOVA on the glowing column.",
      };
      break;
    }
    case "crush": {
      paint(b, 6, [1, 3, 0, 1, 3, 2]);
      paint(b, 7, [0, 1, 2, 3, 0, 1]);
      b[7][2] = makeOrb(2, { type: "ice", hp: 2 });
      session.queue = [makeOrb(1)];
      session.tools = { shuffle: 0, crush: 1, nova: 0 };
      meta = {
        title: "Crush",
        body: "Ice takes two hits. Tap CRUSH, then tap the marked ice.",
        guideCol: 2,
        guideCell: { r: 7, c: 2 },
        hold: false,
        action: "crush",
        wrong: "Tap Crush, then the marked ice — don’t drop.",
      };
      break;
    }
    case "shuffle": {
      paint(b, 6, [0, 1, 2, 0, 1, 2]);
      paint(b, 7, [1, 2, 0, 1, 2, 0]);
      session.queue = [makeOrb(3)];
      session.tools = { shuffle: 1, crush: 0, nova: 0 };
      meta = {
        title: "Shuffle",
        body: "NEXT doesn’t match anything. Tap SHUFFLE to change it.",
        guideCol: null,
        guideCell: null,
        hold: false,
        action: "shuffle",
        wrong: "Tap Shuffle — dropping this NEXT won’t help.",
      };
      break;
    }
    case "hud": {
      session.queue = [makeOrb(0)];
      meta = {
        title: "The Well",
        body: "The gold bar is your score in a real well — fill it to clear. The number on the right is drops you have left.",
        guideCol: null,
        guideCell: null,
        hold: true,
        action: "read",
        wrong: "",
      };
      break;
    }
  }

  gravity(b);
  if (meta.guideCell) {
    const cell = b[meta.guideCell.r][meta.guideCell.c];
    if (!cell || (beat === "crush" && cell.type !== "ice")) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (b[r][c]?.type === "ice") meta.guideCell = { r, c };
        }
      }
    }
  }
  session.board = b;
  return meta;
}

export function nextBeat(beat: FtueBeat | undefined): FtueBeat | null {
  const i = ftueIndex(beat);
  return FTUE_ORDER[i + 1] ?? null;
}

export const HOLD: Record<string, { title: string; body: string }> = {
  burst: {
    title: "Burst",
    body: "Three or more of the same color that touch vanish. That’s a burst — you score.",
  },
  cascade: {
    title: "Cascade",
    body: "Lights fell into the gaps and burst again. Chains score more.",
  },
  four: {
    title: "Four",
    body: "Four left a LINE charm on the well. Next you’ll drop one.",
  },
  line: {
    title: "Line",
    body: "The line cleared a whole row. A column charm does the same down a column.",
  },
  five: {
    title: "Five",
    body: "Five left a NOVA. Next you’ll drop one.",
  },
  nova: {
    title: "Nova",
    body: "The nova burst every light of that color. Rare, and it swings a well.",
  },
  crush: {
    title: "Crush",
    body: "Crush smashes one light. Ice needs two hits — or one Crush.",
  },
  shuffle: {
    title: "Shuffle",
    body: "Shuffle rerolls NEXT when it’s useless. You only get a few.",
  },
};

function hasSpecial(board: (Orb | null)[][], kind: Orb["special"]) {
  return board.some((row) => row.some((o) => o?.special === kind));
}

function simulateDrop(session: Session, col: number) {
  const gem = session.queue[0];
  if (!gem) return { ok: false, detail: "no next", waves: 0, det: 0 };
  const top = columnTop(session.board, col);
  if (top === 0) return { ok: false, detail: "column full", waves: 0, det: 0 };
  const row = top - 1;
  session.board[row][col] = { ...gem };
  let det = 0;
  if (gem.special) det = detonate(session, row, col, gem.special, gem.color).length;
  let waves = 0;
  while (applyCascade(session, 0)) waves++;
  return { ok: true, detail: `land r${row} waves ${waves} det ${det}`, waves, det, row };
}

export function qcLessons() {
  const rows: { beat: string; ok: boolean; detail: string }[] = [];
  const dropBeats: FtueBeat[] = ["burst", "cascade", "four", "line", "five", "nova"];
  for (const beat of dropBeats) {
    const s = dummy();
    const meta = applyLesson(s, beat);
    const pre = dummy();
    pre.board = s.board.map((row) => row.map((o) => (o ? { ...o } : null)));
    pre.spec = s.spec;
    const already = applyCascade(pre, 0);
    if (already) {
      rows.push({ beat, ok: false, detail: "board already has a match" });
      continue;
    }
    if (meta.guideCol == null) {
      rows.push({ beat, ok: false, detail: "missing guide col" });
      continue;
    }
    const sim = simulateDrop(s, meta.guideCol);
    const needWaves = beat === "cascade" ? 2 : beat === "line" || beat === "nova" ? 0 : 1;
    const needDet = beat === "line" || beat === "nova";
    const specialOk =
      beat === "four"
        ? hasSpecial(s.board, "row") || hasSpecial(s.board, "col")
        : beat === "five"
          ? hasSpecial(s.board, "nova")
          : true;
    const expectFloor = beat === "cascade" || beat === "four" || beat === "line" || beat === "five";
    const ok =
      sim.ok &&
      sim.waves >= needWaves &&
      (!needDet || sim.det > 0) &&
      specialOk &&
      (!expectFloor || sim.row === 7);
    rows.push({
      beat,
      ok,
      detail: `${sim.detail}; special=${specialOk}; landFloor=${sim.row === 7}`,
    });
  }

  const crush = dummy();
  const crushMeta = applyLesson(crush, "crush");
  const ice = crushMeta.guideCell && crush.board[crushMeta.guideCell.r][crushMeta.guideCell.c];
  rows.push({
    beat: "crush",
    ok: Boolean(ice && ice.type === "ice"),
    detail: ice ? `ice at r${crushMeta.guideCell?.r} c${crushMeta.guideCell?.c}` : "no ice",
  });

  const shuf = dummy();
  applyLesson(shuf, "shuffle");
  rows.push({
    beat: "shuffle",
    ok: shuf.tools.shuffle === 1 && shuf.queue[0]?.color === 3,
    detail: `shuffle ${shuf.tools.shuffle} next ${shuf.queue[0]?.color}`,
  });

  return rows;
}
