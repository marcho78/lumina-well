import { create } from "zustand";
import { CAMPAIGN, LEVELS_PER_REALM, REALMS, UPGRADES } from "./constants";
import { beep, chord, haptic, shatter, unlockAudio } from "./audio";
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
import { applyLesson, HOLD, nextBeat, type FtueBeat } from "./ftue";
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
  coachTitle: string | null;
  coachBody: string | null;
  guideCol: number | null;
  guideCell: { r: number; c: number } | null;
  ftueHold: boolean;
  persist: () => void;
  hydrate: () => void;
  go: (s: Screen) => void;
  start: (level: number, mode: Mode, opts?: { tutorial?: boolean }) => void;
  startTutorial: () => void;
  skipFtue: (beat: FtueBeat) => void;
  ftueAdvance: () => void;
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
let coachTimer = 0;
let ftueAction: "look" | "drop" | "crush" | "shuffle" | "read" = "look";
let ftueWrong = "";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function applyBeat(session: Session, beat: FtueBeat) {
  const meta = applyLesson(session, beat);
  ftueAction = meta.action;
  ftueWrong = meta.wrong;
  return {
    session: cloneSession(session),
    coachTitle: meta.title,
    coachBody: meta.body,
    guideCol: meta.guideCol,
    guideCell: meta.guideCell,
    ftueHold: meta.hold,
    selectingCrush: false,
    hint: null,
    flashCol: null,
    falling: null,
    banner: null,
  };
}

async function afterFtueResolve(
  get: () => GameStore,
  set: (p: Partial<GameStore>) => void,
  waves: number,
  detonated: boolean,
) {
  const session = get().session;
  if (!session?.spec.ftue) return;
  const beat = (session.ftueBeat || "burst") as FtueBeat;
  const ok =
    beat === "crush"
      ? detonated
      : beat === "cascade"
        ? waves >= 2
        : beat === "line" || beat === "nova"
          ? detonated || waves >= 1
          : waves >= 1;
  if (!ok) {
    set({
      ...applyBeat(session, beat),
      coachTitle: "Try that again",
      coachBody: ftueWrong || "Same color, touching. Drop NEXT on the glowing column.",
      resolving: false,
    });
    return;
  }
  const hold = HOLD[beat];
  set({
    session: cloneSession(session),
    coachTitle: hold?.title ?? "Good",
    coachBody: hold?.body ?? "Tap Next to continue.",
    guideCol: null,
    guideCell: null,
    ftueHold: true,
    resolving: false,
  });
}

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

function specialBanner(events: BurstEvent[]) {
  if (events.some((b) => b.kind === "nova")) return "NOVA";
  if (events.some((b) => b.kind === "bomb")) return "BURST";
  if (events.some((b) => b.kind === "row" || b.kind === "col")) return "LINE";
  if (events.some((b) => b.kind === "crush")) return "SHATTER";
  return null;
}

function fxWait(events: BurstEvent[], ftue: boolean) {
  if (events.some((b) => b.kind === "nova")) return 780;
  if (events.some((b) => b.kind === "crush")) return events.some((b) => b.ice) ? 920 : 620;
  if (events.some((b) => b.kind === "row" || b.kind === "col" || b.kind === "bomb")) return 560;
  return ftue ? 420 : 220;
}

async function resolveBoard(
  get: () => GameStore,
  set: (p: Partial<GameStore>) => void,
  extra?: BurstEvent[],
  opts?: { skipFx?: boolean },
) {
  const sfx = get().save.settings.sfx;
  const hap = get().save.settings.haptic;
  const bonus = get().save.upgrades.bonus;
  let waves = 0;
  const session = get().session;
  if (!session) return;
  if (extra?.length && !opts?.skipFx) {
    const label = specialBanner(extra);
    if (extra.some((b) => b.kind === "nova")) chord([520, 660, 880, 1040], sfx);
    else if (extra.some((b) => b.kind === "row" || b.kind === "col")) beep(640, 0.16, "sine", 0.06, 920, sfx);
    else if (extra.some((b) => b.kind === "crush")) shatter(sfx);
    else beep(500, 0.12, "triangle", 0.05, 720, sfx);
    haptic(extra.some((b) => b.kind === "nova" || b.kind === "crush") ? 28 : 16, hap);
    set({ lastBursts: extra.slice(-40), banner: label });
    await wait(fxWait(extra, Boolean(session.spec.ftue)));
  }
  while (true) {
    const cur = get().session;
    if (!cur) return;
    const step: CascadeResult | null = applyCascade(cur, bonus);
    if (!step) {
      if (countLights(cur.board) < 16 && !cur.spec.ftue) {
        const added = rainLights(cur, 20);
        if (added) {
          set({ session: cloneSession(cur), banner: "the well fills" });
          await wait(200);
          continue;
        }
      }
      break;
    }
    waves++;
    get().save.stats.bestCombo = Math.max(get().save.stats.bestCombo, step.combo);
    beep(380 + step.combo * 90, 0.12, "triangle", 0.05, 680 + step.combo * 40, sfx);
    haptic(10 + step.combo * 8, hap);
    const floats = [
      ...get().floats,
      { id: floatId++, n: step.scoreGain, r: step.bursts[0]?.r ?? 3, c: step.bursts[0]?.c ?? 2 },
    ].slice(-8);
    set({
      session: cloneSession(cur),
      lastBursts: step.bursts.slice(-40),
      banner: cur.spec.ftue ? specialBanner(step.bursts) ?? step.banner : step.banner,
      floats,
    });
    await wait(fxWait(step.bursts, Boolean(cur.spec.ftue)));
  }
  const done = get().session;
  if (!done) return;
  if (done.spec.ftue) {
    await afterFtueResolve(get, set, waves, (extra?.length ?? 0) > 0);
    return;
  }
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
    const firstTutorial = session.spec.ftue && save.ftue !== "done";
    if (session.spec.ftue) save.ftue = "done";
    if (session.spec.ftue && !firstTutorial) {
      chord([523, 659, 784, 1046], save.settings.sfx);
    } else {
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
    }
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
  coachTitle: null,
  coachBody: null,
  guideCol: null,
  guideCell: null,
  ftueHold: false,
  persist: () => persistSave(get().save),
  hydrate: () => {
    const save = loadSave();
    set({ save, screen: save.ftue === "done" ? "menu" : "boot" });
  },
  go: (s) => set({ screen: s, prevScreen: get().screen === "pause" ? get().prevScreen : get().screen }),
  setViewingRealm: (n) => set({ viewingRealm: n }),
  start: (level, mode, opts) => {
    unlockAudio();
    const save = get().save;
    const tutorial = Boolean(opts?.tutorial) || (save.ftue !== "done" && mode === "campaign" && level === 1);
    if (!tutorial) save.stats.plays++;
    persistSave(save);
    const session = createSession(level, mode, save, tutorial);
    if (coachTimer) window.clearTimeout(coachTimer);
    const lesson = tutorial ? applyBeat(session, "next") : null;
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
      coachTitle: lesson?.coachTitle ?? null,
      coachBody: lesson?.coachBody ?? null,
      guideCol: lesson?.guideCol ?? null,
      guideCell: lesson?.guideCell ?? null,
      ftueHold: false,
    });
    if (tutorial) {
      coachTimer = window.setTimeout(() => {
        const cur = get().session;
        if (!cur?.spec.ftue || cur.ftueBeat !== "next") return;
        set(applyBeat(cur, "burst"));
      }, 1600);
    }
  },
  startTutorial: () => get().start(1, "campaign", { tutorial: true }),
  skipFtue: (beat) => {
    if (coachTimer) window.clearTimeout(coachTimer);
    get().start(1, "campaign", { tutorial: true });
    if (coachTimer) window.clearTimeout(coachTimer);
    const session = get().session;
    if (!session) return;
    set({ ...applyBeat(session, beat), resolving: false, lastBursts: [], floats: [], falling: null });
  },
  ftueAdvance: () => {
    const session = get().session;
    if (!session?.spec.ftue || !get().ftueHold) return;
    const nxt = nextBeat(session.ftueBeat as FtueBeat);
    if (!nxt) {
      session.won = true;
      finish(get, set, true);
      return;
    }
    if (coachTimer) window.clearTimeout(coachTimer);
    set({ ...applyBeat(session, nxt), floats: [], lastBursts: [] });
  },
  drop: async (col) => {
    const { session, resolving, selectingCrush, save, falling, ftueHold } = get();
    if (!session || session.won || session.lost || selectingCrush) return;
    if (session.spec.ftue) {
      if (ftueHold) {
        get().ftueAdvance();
        return;
      }
      if (ftueAction !== "drop") {
        deny(get, set, ftueWrong || "Not a drop — use the tool below.", col);
        return;
      }
      if (get().guideCol != null && col !== get().guideCol) {
        deny(get, set, ftueWrong || "Drop on the glowing column.", col);
        return;
      }
    }
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
    const gem = session.queue.shift();
    if (!gem) return;
    if (!session.spec.ftue) session.queue.push(randomGem(session.spec));
    else if (session.queue.length === 0) session.queue.push({ ...gem });
    const row = top - 1;
    session.drops++;
    if (!session.spec.ftue) session.moves--;
    save.stats.drops++;
    haptic(8, save.settings.haptic);
    beep(420 + gem.color * 40, 0.08, "sine", 0.05, undefined, save.settings.sfx);
    if (coachTimer) window.clearTimeout(coachTimer);
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
    const { session, save, ftueHold, guideCell } = get();
    if (!session || session.tools.crush <= 0) return;
    if (session.spec.ftue) {
      if (ftueHold) {
        get().ftueAdvance();
        return;
      }
      if (ftueAction !== "crush") {
        deny(get, set, "Crush isn’t the lesson right now");
        return;
      }
      if (guideCell && (guideCell.c !== c || guideCell.r !== r)) {
        deny(get, set, "Tap the marked ice", c);
        return;
      }
    }
    const cell = session.board[r][c];
    if (!cell) {
      deny(get, set, "No light there to crush", c);
      return;
    }
    if (cell.type === "stone") {
      deny(get, set, "Stone cannot be crushed", c);
      return;
    }
    const extra: BurstEvent[] = [{ r, c, color: Math.max(0, cell.color), kind: "crush", ice: cell.type === "ice" }];
    const ice = cell.type === "ice";
    shatter(save.settings.sfx);
    haptic(ice ? 40 : 22, save.settings.haptic);
    set({
      selectingCrush: false,
      resolving: true,
      lastBursts: extra,
      banner: ice ? "SHATTER" : "CRUSH",
      hint: null,
    });
    await wait(ice ? 880 : 520);
    const cur = get().session;
    if (!cur) return;
    if (cur.board[r][c]) {
      cur.board[r][c] = null;
      gravity(cur.board);
      cur.tools.crush = Math.max(0, cur.tools.crush - 1);
    }
    set({ session: cloneSession(cur) });
    await resolveBoard(get, set, extra, { skipFx: true });
    if (get().session?.spec.ftue) return;
    if (!get().session?.won && !get().session?.lost) set({ resolving: false });
  },
  shuffle: () => {
    const { session, resolving, ftueHold } = get();
    if (!session || session.tools.shuffle <= 0 || resolving) return;
    if (session.spec.ftue) {
      if (ftueHold || ftueAction !== "shuffle") return;
      session.tools.shuffle = 0;
      session.queue = [{ color: 0, type: "orb", special: null, hp: 1 }];
      beep(520, 0.1, "sine", 0.05, undefined, get().save.settings.sfx);
      const hold = HOLD.shuffle;
      set({
        session: cloneSession(session),
        coachTitle: hold.title,
        coachBody: hold.body,
        ftueHold: true,
        guideCol: null,
      });
      return;
    }
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
    const { session, resolving, ftueHold } = get();
    if (!session || session.tools.crush <= 0 || resolving) return;
    if (session.spec.ftue) {
      if (ftueHold || ftueAction !== "crush") return;
      set({
        selectingCrush: true,
        hint: null,
        coachTitle: "Crush",
        coachBody: "Now tap the marked ice.",
      });
      return;
    }
    set({ selectingCrush: !get().selectingCrush });
  },
  retry: () => {
    const s = get().session;
    if (!s) return;
    if (s.spec.ftue) get().startTutorial();
    else get().start(s.spec.level, s.spec.mode);
  },
  next: () => {
    const s = get().session;
    if (!s) return;
    if (s.spec.ftue) {
      const save = get().save;
      save.stats.plays = Math.max(1, save.stats.plays);
      persistSave(save);
      set({ save: { ...save, stats: { ...save.stats } }, screen: "menu", session: null });
      return;
    }
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
