import { CAMPAIGN, COLS, LEVELS_PER_REALM, ROWS } from "./constants";
import { mulberry32 } from "./rng";
import type { Cell, LevelSpec, Mode, Orb, SaveState, Session, Special } from "./types";

export function realmOf(level: number) {
  return Math.min(11, Math.floor((level - 1) / LEVELS_PER_REALM));
}

export function specFor(level: number, mode: Mode): LevelSpec {
  const seed = level * 9973 + (mode === "daily" ? 42 : 1);
  const world = realmOf(Math.min(level, CAMPAIGN));
  let colors = 4;
  if (world >= 3) colors = 5;
  if (world >= 8) colors = 6;
  if (mode === "endless") colors = Math.min(6, 4 + Math.floor((level - 1) / 8));
  const ice = world >= 1 || (mode === "endless" && level > 4);
  const stone = world >= 2 || (mode === "endless" && level > 10);
  const packed = world >= 4;
  const target = Math.round((mode === "endless" ? 480 : 400) + level * 50 + world * 80);
  let moves = 28 - Math.floor(world * 0.6) - Math.floor(((level - 1) % 40) / 12);
  if (mode === "endless") moves = Math.max(14, 24 - Math.floor(level / 6));
  moves = Math.max(12, Math.min(30, moves));
  const fill = packed ? 0.52 : 0.48 + (world > 5 ? 0.05 : 0);
  return { colors, ice, stone, target, moves, fill, world, mode, level, seed };
}

function emptyBoard(): (Orb | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function makeOrb(color: number, extra?: Partial<Orb>): Orb {
  return { color, type: "orb", special: null, hp: 1, ...extra };
}

export function randomGem(spec: LevelSpec): Orb {
  const color = Math.floor(Math.random() * spec.colors);
  let special: Special = null;
  const chance = spec.world >= 5 ? 0.06 : 0.03;
  if (Math.random() < chance) special = (["row", "col", "bomb"] as const)[Math.floor(Math.random() * 3)];
  if (spec.world >= 8 && Math.random() < 0.02) special = "nova";
  return makeOrb(color, { special });
}

export function findMatches(board: (Orb | null)[][]) {
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups: Cell[][] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell || cell.color < 0 || seen[r][c]) continue;
      const stack: [number, number][] = [[r, c]];
      const group: Cell[] = [];
      seen[r][c] = true;
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        group.push({ r: cr, c: cc });
        for (const [dr, dc] of dirs) {
          const nr = cr + dr,
            nc = cc + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen[nr][nc]) continue;
          const n = board[nr][nc];
          if (n && n.color === cell.color) {
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      if (group.length >= 3) groups.push(group);
    }
  }
  return groups;
}

export function gravity(board: (Orb | null)[][]) {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const orb = board[r][c];
      if (!orb) continue;
      if (orb.type === "stone") {
        write = r - 1;
        continue;
      }
      if (r !== write) {
        board[write][c] = orb;
        board[r][c] = null;
      }
      write--;
    }
  }
}

export type CueGroup = {
  kind: "burst" | "cascade" | "row" | "nova" | "crush";
  cells: Cell[];
  falls?: { from: Cell; to: Cell }[];
};

export function previewCues(
  session: Session,
  guideCol: number | null,
  guideCell: { r: number; c: number } | null,
): CueGroup[] {
  if (guideCell) return [{ kind: "crush", cells: [guideCell] }];
  if (guideCol == null || !session.queue[0]) return [];
  const gem = session.queue[0];
  const top = columnTop(session.board, guideCol);
  if (top === 0) return [];
  const row = top - 1;
  const board = session.board.map((line) => line.slice());
  board[row][guideCol] = { ...gem };

  if (gem.special === "row") {
    const cells: Cell[] = [];
    for (let c = 0; c < COLS; c++) if (board[row][c]) cells.push({ r: row, c });
    return [{ kind: "row", cells }];
  }
  if (gem.special === "col") {
    const cells: Cell[] = [];
    for (let r = 0; r < ROWS; r++) if (board[r][guideCol]) cells.push({ r, c: guideCol });
    return [{ kind: "row", cells }];
  }
  if (gem.special === "nova") {
    const cells: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]?.color === gem.color) cells.push({ r, c });
      }
    }
    return [{ kind: "nova", cells }];
  }

  const burst = findMatches(board).flat();
  if (!burst.length) return [];
  const n = burst.length;
  const groups: CueGroup[] = [{ kind: n >= 5 ? "nova" : n >= 4 ? "row" : "burst", cells: burst }];

  const pre = board.map((line) => line.slice());
  for (const t of burst) pre[t.r][t.c] = null;
  const origin = new Map<object, Cell>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const orb = pre[r][c];
      if (orb) origin.set(orb, { r, c });
    }
  }
  const post = pre.map((line) => line.slice());
  gravity(post);
  const cascadeAfter = findMatches(post).flat();
  if (cascadeAfter.length) {
    const cells: Cell[] = [];
    const falls: { from: Cell; to: Cell }[] = [];
    const seen = new Set<string>();
    for (const t of cascadeAfter) {
      const orb = post[t.r][t.c];
      const from = orb ? origin.get(orb) : undefined;
      if (!from) continue;
      const key = `${from.r},${from.c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push(from);
      if (from.r !== t.r || from.c !== t.c) falls.push({ from, to: t });
    }
    if (cells.length) groups.push({ kind: "cascade", cells, falls });
  }
  return groups;
}

export function columnTop(board: (Orb | null)[][], c: number) {
  for (let r = 0; r < ROWS; r++) if (board[r][c]) return r;
  return ROWS;
}

export function countLights(board: (Orb | null)[][]) {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell && cell.type !== "stone") n++;
  return n;
}

export function rainLights(session: Session, want = 22) {
  let added = 0;
  let guard = 0;
  const colors = Math.max(2, session.spec.colors);
  while (countLights(session.board) < want && guard++ < 48) {
    const open: number[] = [];
    for (let c = 0; c < COLS; c++) if (columnTop(session.board, c) > 1) open.push(c);
    if (!open.length) break;
    const c = open[Math.floor(Math.random() * open.length)];
    const row = columnTop(session.board, c) - 1;
    if (row < 0) break;
    let placed = false;
    for (let k = 0; k < colors; k++) {
      const color = (k + row + c) % colors;
      session.board[row][c] = makeOrb(color);
      if (!findMatches(session.board).length) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      session.board[row][c] = null;
      continue;
    }
    added++;
  }
  return added;
}

function fillBoard(spec: LevelSpec) {
  const b = emptyBoard();
  const rng = mulberry32(spec.seed);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const depth = r / ROWS;
      if (rng() > spec.fill + depth * 0.12) continue;
      if (spec.stone && rng() < 0.06 + spec.world * 0.008) {
        b[r][c] = makeOrb(-1, { type: "stone", hp: 99 });
        continue;
      }
      const color = Math.floor(rng() * spec.colors);
      const ice = spec.ice && rng() < 0.12 + spec.world * 0.01;
      b[r][c] = makeOrb(color, { type: ice ? "ice" : "orb", hp: ice ? 2 : 1 });
    }
  }
  gravity(b);
  let guard = 0;
  while (guard++ < 20) {
    const groups = findMatches(b);
    if (!groups.length) break;
    groups.flat().forEach(({ r, c }) => {
      b[r][c] = makeOrb(Math.floor(rng() * spec.colors));
    });
    gravity(b);
  }
  return b;
}

export function createSession(level: number, mode: Mode, save: SaveState, tutorial = false): Session {
  const spec = specFor(level, mode);
  const ftue = tutorial || (save.ftue !== "done" && mode === "campaign" && level === 1);
  if (ftue) {
    spec.ice = false;
    spec.stone = false;
    spec.colors = 4;
    spec.target = 9999;
    spec.moves = 12;
    spec.fill = 0;
    spec.ftue = true;
  }
  const preview = ftue ? 1 : 2 + (save.upgrades.preview > 0 ? 1 : 0);
  const session: Session = {
    spec,
    board: ftue ? emptyBoard() : fillBoard(spec),
    queue: ftue ? [makeOrb(3)] : Array.from({ length: preview }, () => randomGem(spec)),
    score: 0,
    moves: spec.moves,
    combo: 0,
    maxCombo: 0,
    cleared: 0,
    drops: 0,
    won: false,
    lost: false,
    tools: ftue
      ? { shuffle: 0, crush: 0, nova: 0 }
      : {
          shuffle: 2 + save.upgrades.startShuffle,
          crush: 1 + save.upgrades.startCrush,
          nova: save.upgrades.startNova,
        },
    ftueBeat: ftue ? "next" : undefined,
  };
  return session;
}

function chipNeighbors(board: (Orb | null)[][], hit: Set<string>) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  hit.forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    dirs.forEach(([dr, dc]) => {
      const nr = r + dr,
        nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
      const o = board[nr][nc];
      if (o && o.type === "ice") {
        o.hp--;
        if (o.hp <= 1) o.type = "orb";
      }
    });
  });
}

export type BurstKind = "burst" | "row" | "col" | "bomb" | "nova" | "crush";
export type BurstEvent = { r: number; c: number; color: number; kind?: BurstKind; ice?: boolean };
export type CascadeResult = {
  bursts: BurstEvent[];
  scoreGain: number;
  combo: number;
  banner: string | null;
};

const BANNER = ["CASCADE", "SURGE", "AURORA", "NOVA", "LUMINA"];

export function applyCascade(session: Session, bonus: number): CascadeResult | null {
  const groups = findMatches(session.board);
  if (!groups.length) {
    session.combo = 0;
    return null;
  }
  session.combo++;
  session.maxCombo = Math.max(session.maxCombo, session.combo);
  const hit = new Set<string>();
  const created: { r: number; c: number; orb: Orb }[] = [];
  groups.forEach((g) => {
    const color = session.board[g[0].r][g[0].c]!.color;
    g.forEach((p) => hit.add(`${p.r},${p.c}`));
    const mid = g[Math.floor(g.length / 2)];
    if (g.length >= 5) created.push({ r: mid.r, c: mid.c, orb: makeOrb(color, { special: "nova" }) });
    else if (g.length === 4) {
      const spec =
        Math.abs(g[0].r - g[g.length - 1].r) > Math.abs(g[0].c - g[g.length - 1].c) ? "col" : "row";
      created.push({ r: mid.r, c: mid.c, orb: makeOrb(color, { special: spec }) });
    }
  });
  const scoreGain = Math.round(
    (hit.size * 75 + groups.length * 30) * (1 + (session.combo - 1) * 0.5) * (1 + bonus * 0.06),
  );
  session.score += scoreGain;
  session.cleared += hit.size;
  const bursts: BurstEvent[] = [];
  hit.forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    const o = session.board[r][c];
    bursts.push({ r, c, color: o ? Math.max(0, o.color) : 0, kind: "burst" });
    if (!o) return;
    if (o.type === "ice" && o.hp > 1) {
      o.hp = 1;
      o.type = "orb";
    } else session.board[r][c] = null;
  });
  chipNeighbors(session.board, hit);
  created.forEach(({ r, c, orb }) => {
    if (!session.board[r][c]) session.board[r][c] = orb;
  });
  gravity(session.board);
  const banner = session.combo >= 2 ? `${BANNER[Math.min(BANNER.length - 1, session.combo - 2)]}  x${session.combo}` : null;
  return { bursts, scoreGain, combo: session.combo, banner };
}

export function detonate(session: Session, r: number, c: number, kind: Special, color: number): BurstEvent[] {
  if (!kind) return [];
  const targets: Cell[] = [];
  if (kind === "row") for (let i = 0; i < COLS; i++) targets.push({ r, c: i });
  if (kind === "col") for (let i = 0; i < ROWS; i++) targets.push({ r: i, c });
  if (kind === "bomb") {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr,
          nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) targets.push({ r: nr, c: nc });
      }
  }
  if (kind === "nova") {
    for (let rr = 0; rr < ROWS; rr++)
      for (let cc = 0; cc < COLS; cc++)
        if (session.board[rr][cc] && session.board[rr][cc]!.color === color) targets.push({ r: rr, c: cc });
  }
  session.score += targets.length * 55;
  const bursts: BurstEvent[] = targets.map((t) => ({ ...t, color, kind }));
  targets.forEach(({ r: rr, c: cc }) => {
    const o = session.board[rr][cc];
    if (!o || o.type === "stone") return;
    session.board[rr][cc] = null;
  });
  gravity(session.board);
  return bursts;
}

export function checkEnd(session: Session) {
  if (session.won || session.lost) return;
  if (session.spec.ftue) return;
  if (session.score >= session.spec.target) session.won = true;
  else if (session.moves <= 0) session.lost = true;
}

export function starCount(session: Session) {
  if (!session.won) return 0;
  const ratio = session.moves / session.spec.moves;
  if (ratio >= 0.4 || session.score >= session.spec.target * 1.35) return 3;
  if (ratio >= 0.18 || session.score >= session.spec.target * 1.12) return 2;
  return 1;
}

export function cloneSession(s: Session): Session {
  return {
    ...s,
    spec: { ...s.spec },
    board: s.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    queue: s.queue.map((o) => ({ ...o })),
    tools: { ...s.tools },
  };
}
