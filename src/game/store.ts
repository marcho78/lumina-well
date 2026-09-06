import { create } from "zustand";
import { CAMPAIGN, LEVELS_PER_REALM, REALMS, UPGRADES } from "./constants";
import { beep, chord, haptic, unlockAudio } from "./audio";
import {
  applyCascade,
  checkEnd,
  cloneSession,
  columnTop,
  countLights,
  createSession,
  detonate,
  gravity,
  rainLights,
  randomGem,
  starCount,
} from "./engine";
import { clampCampaign, defaultSave, loadSave, persistSave } from "./save";
import { dailyLevel, dayKey } from "./rng";
import type { BurstEvent, CascadeResult } from "./engine";
import type { Mode, SaveState, Screen, Session } from "./types";

export type FloatPts = { id: number; n: number; r: number; c: number };
export type Falling = { id: number; orb: import("./types").Orb; col: number; row: number };

type GameStore = {
  save: SaveState;
  screen: Screen;
  prevScreen: Screen;
  session: Session | null;
  viewingRealm: number;
  resolving: boolean;
  selectingCrush: boolean;
  banner: string | null;
  hint: string | null;
  flashCol: number | null;
  falling: Falling | null;
  floats: FloatPts[];
  lastBursts: BurstEvent[];
  lastResult: { win: boolean; stars: number; reward: number; newBest: boolean } | null;
  persist: () => void;
  hydrate: () => void;
  go: (s: Screen) => void;
  start: (level: number, mode: Mode) => void;
  drop: (col: number) => Promise<void>;
  land: () => Promise<void>;
  crushAt: (c: number, r: number) => Promise<void>;
  shuffle: () => void;
  fireNova: () => Promise<void>;
  toggleCrush: () => void;
  retry: () => void;
  next: () => void;
  buy: (key: keyof SaveState["upgrades"]) => void;
  setSetting: (k: keyof SaveState["settings"], v: boolean) => void;
  reset: () => void;
  setViewingRealm: (n: number) => void;
};

let floatId = 1;
let dropId = 1;
let hintTimer = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function deny(get: () => GameStore, set: (p: Partial<GameStore>) => void, msg: string, col?: number) {
  const save = get().save;
  beep(90, 0.12, "sawtooth", 0.04, undefined, save.settings.sfx);
  haptic(18, save.settings.haptic);
  if (hintTimer) window.clearTimeout(hintTimer);
  set({ hint: msg, flashCol: col ?? null });
  hintTimer = window.setTimeout(() => {
    if (get().hint === msg) set({ hint: null, flashCol: null });
  }, 1400);
}

async function resolveBoard(get: () => GameStore, set: (p: Partial<GameStore>) => void, extra?: BurstEvent[]) {
  const sfx = get().save.settings.sfx;
  const hap = get().save.settings.haptic;
  const bonus = get().save.upgrades.bonus;
  let bursts = extra ?? [];
  const session = get().session;
  if (!session) return;
  while (true) {
    const cur = get().session;
    if (!cur) return;
    const step: CascadeResult | null = applyCascade(cur, bonus);
    if (!step) {
      if (countLights(cur.board) < 16) {
        const added = rainLights(cur, 20);
        if (added) {
          set({ session: cloneSession(cur), banner: "the well fills" });
          await wait(200);
          continue;
        }
      }
      break;
    }
    bursts = bursts.concat(step.bursts);
    get().save.stats.bestCombo = Math.max(get().save.stats.bestCombo, step.combo);
    beep(380 + step.combo * 90, 0.12, "triangle", 0.05, 680 + step.combo * 40, sfx);
    haptic(10 + step.combo * 8, hap);
    const floats = [
      ...get().floats,
      { id: floatId++, n: step.scoreGain, r: step.bursts[0]?.r ?? 3, c: step.bursts[0]?.c ?? 2 },
    ].slice(-8);
    set({
      session: cloneSession(cur),
      lastBursts: bursts.slice(-40),
      banner: step.banner,
      floats,
    });
    await wait(170);
  }
  const done = get().session;
  if (!done) return;
  checkEnd(done);
  set({ session: cloneSession(done) });
  if (done.won || done.lost) {
    await wait(360);
    finish(get, set, done.won);
  }
}

function finish(get: () => GameStore, set: (p: Partial<GameStore>) => void, win: boolean) {
  const session = get().session;
  if (!session) return;
  const save = get().save;
  const stars = starCount(session);
  const level = session.spec.level;
  const mode = session.spec.mode;
  const prev = save.stars[level] || 0;
  const newBest = win && stars > prev;
  let reward = 0;
  if (win) {
    save.stats.clears++;
    if (mode === "campaign") {
      save.stars[level] = Math.max(prev, stars);
      if (level >= save.farthest) save.farthest = clampCampaign(level + 1);
      save.current = clampCampaign(level + 1);
      reward = 8 + stars * 6 + session.spec.world * 2 + Math.floor(session.combo);
      if (stars > prev) reward += (stars - prev) * 10;
    } else if (mode === "daily") {
      const key = dayKey();
      if (save.daily.key !== key || !save.daily.cleared) {
        reward = 40 + stars * 15;
        save.daily = { key, cleared: true };
      } else reward = 8;
    } else reward = 6 + stars * 4;
    save.shards += reward;
    chord([523, 659, 784, 1046], save.settings.sfx);
  } else {
    beep(140, 0.3, "sawtooth", 0.05, 70, save.settings.sfx);
  }
  persistSave(save);
  set({
    save: { ...save, stars: { ...save.stars }, stats: { ...save.stats } },
    lastResult: { win, stars, reward, newBest },
    screen: "result",
    resolving: false,
    selectingCrush: false,
  });
}

export const useGame = create<GameStore>((set, get) => ({
  save: defaultSave(),
  screen: "boot",
  prevScreen: "menu",
  session: null,
  viewingRealm: 0,
  resolving: false,
  selectingCrush: false,
  banner: null,
  hint: null,
  flashCol: null,
  falling: null,
  floats: [],
  lastBursts: [],
  lastResult: null,
  persist: () => persistSave(get().save),
  hydrate: () => set({ save: loadSave() }),
  go: (s) => set({ screen: s, prevScreen: get().screen === "pause" ? get().prevScreen : get().screen }),
  setViewingRealm: (n) => set({ viewingRealm: n }),
  start: (level, mode) => {
    unlockAudio();
    const save = get().save;
    save.stats.plays++;
    persistSave(save);
    const session = createSession(level, mode, save);
    set({
      save: { ...save, stats: { ...save.stats } },
      session,
      screen: "play",
      resolving: false,
      selectingCrush: false,
      banner: null,
      hint: null,
      flashCol: null,
      falling: null,
      floats: [],
      lastBursts: [],
      lastResult: null,
    });
  },
  drop: async (col) => {
    const { session, resolving, selectingCrush, save, falling } = get();
    if (!session || session.won || session.lost || selectingCrush) return;
    let top = columnTop(session.board, col);
    if (top === 0) {
      let hole = false;
      for (let r = 1; r < session.board.length; r++) {
        if (!session.board[r][col]) {
          hole = true;
          break;
        }
      }
      if (hole) {
        gravity(session.board);
        set({ session: cloneSession(session) });
        top = columnTop(session.board, col);
      }
    }
    if (top === 0) {
      deny(get, set, "No room at the top of this column", col);
      return;
    }
    if (resolving || falling) return;
    const gem = session.queue.shift()!;
    session.queue.push(randomGem(session.spec));
    const row = top - 1;
    session.moves--;
    session.drops++;
    save.stats.drops++;
    haptic(8, save.settings.haptic);
    beep(420 + gem.color * 40, 0.08, "sine", 0.05, undefined, save.settings.sfx);
    set({
      session: cloneSession(session),
      resolving: true,
      hint: null,
      flashCol: null,
      falling: { id: dropId++, orb: gem, col, row },
      save: { ...save, stats: { ...save.stats } },
    });
  },
  land: async () => {
    const { session, falling } = get();
    if (!session || !falling) return;
    session.board[falling.row][falling.col] = falling.orb;
    let extra: BurstEvent[] = [];
    if (falling.orb.special) extra = detonate(session, falling.row, falling.col, falling.orb.special, falling.orb.color);
    set({ session: cloneSession(session), falling: null });
    await resolveBoard(get, set, extra);
    if (!get().session?.won && !get().session?.lost) set({ resolving: false });
  },
  crushAt: async (c, r) => {
    const { session, save } = get();
    if (!session || session.tools.crush <= 0) return;
    const cell = session.board[r][c];
    if (!cell) {
      deny(get, set, "No light there to crush", c);
      return;
    }
    if (cell.type === "stone") {
      deny(get, set, "Stone cannot be crushed", c);
      return;
    }
    const color = cell.color;
    session.board[r][c] = null;
    gravity(session.board);
    session.tools.crush--;
    haptic(12, save.settings.haptic);
    set({ session: cloneSession(session), selectingCrush: false, resolving: true, lastBursts: [{ r, c, color }] });
    await resolveBoard(get, set, [{ r, c, color }]);
    if (!get().session?.won && !get().session?.lost) set({ resolving: false });
  },
  shuffle: () => {
    const { session, resolving } = get();
    if (!session || session.tools.shuffle <= 0 || resolving) return;
    session.tools.shuffle--;
    session.queue = session.queue.map(() => randomGem(session.spec));
    beep(520, 0.1, "sine", 0.05, undefined, get().save.settings.sfx);
    set({ session: cloneSession(session) });
  },
  fireNova: async () => {
    const { session, resolving } = get();
    if (!session || session.tools.nova <= 0 || resolving) return;
    const color = session.queue[0].color;
    session.tools.nova--;
    set({ session: cloneSession(session), resolving: true });
    const extra = detonate(session, 3, 3, "nova", color);
    set({ session: cloneSession(session) });
    await resolveBoard(get, set, extra);
    if (!get().session?.won && !get().session?.lost) set({ resolving: false });
  },
  toggleCrush: () => {
    const { session, resolving } = get();
    if (!session || session.tools.crush <= 0 || resolving) return;
    set({ selectingCrush: !get().selectingCrush });
  },
  retry: () => {
    const s = get().session;
    if (!s) return;
    get().start(s.spec.level, s.spec.mode);
  },
  next: () => {
    const s = get().session;
    if (!s) return;
    if (s.spec.mode === "daily") {
      set({ screen: "atelier" });
      return;
    }
    if (s.spec.mode === "endless") {
      get().start(s.spec.level + 1, "endless");
      return;
    }
    if (s.spec.level >= CAMPAIGN) {
      set({ screen: "menu" });
      return;
    }
    get().start(s.spec.level + 1, "campaign");
  },
  buy: (key) => {
    const save = get().save;
    const u = UPGRADES.find((x) => x.key === key);
    if (!u) return;
    const lv = save.upgrades[key];
    if (lv >= u.max) return;
    const cost = u.cost[lv];
    if (save.shards < cost) {
      deny(get, set, "Not enough shards");
      return;
    }
    save.shards -= cost;
    save.upgrades[key] = lv + 1;
    persistSave(save);
    chord([440, 554, 659], save.settings.sfx);
    set({ save: { ...save, upgrades: { ...save.upgrades } } });
  },
  setSetting: (k, v) => {
    const save = get().save;
    save.settings[k] = v;
    persistSave(save);
    set({ save: { ...save, settings: { ...save.settings } } });
  },
  reset: () => {
    const save = defaultSave();
    persistSave(save);
    set({ save, screen: "menu", session: null });
  },
}));

export function realmUnlocked(save: SaveState, ri: number) {
  if (ri === 0) return true;
  return save.farthest > ri * LEVELS_PER_REALM;
}

export function starsOfRealm(save: SaveState, ri: number) {
  let s = 0,
    c = 0;
  const a = ri * LEVELS_PER_REALM + 1;
  const b = a + LEVELS_PER_REALM - 1;
  for (let i = a; i <= b; i++) {
    const v = save.stars[i] || 0;
    s += v;
    if (v) c++;
  }
  return { s, c };
}

export function realmName(level: number) {
  return REALMS[Math.min(REALMS.length - 1, Math.floor((level - 1) / LEVELS_PER_REALM))].name;
}
