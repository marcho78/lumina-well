import { CAMPAIGN } from "./constants";
import type { SaveState } from "./types";

const KEY = "lumina.well.v1";
const VERSION = 1;

export function defaultSave(): SaveState {
  return {
    version: VERSION,
    shards: 0,
    farthest: 1,
    current: 1,
    stars: {},
    upgrades: { preview: 0, startShuffle: 0, startCrush: 0, startNova: 0, bonus: 0 },
    settings: { sfx: true, haptic: true, shake: true },
    stats: { plays: 0, clears: 0, bestCombo: 0, drops: 0 },
    daily: { key: "", cleared: false },
  };
}

export function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    return {
      ...defaultSave(),
      ...parsed,
      upgrades: { ...defaultSave().upgrades, ...parsed.upgrades },
      settings: { ...defaultSave().settings, ...parsed.settings },
      stats: { ...defaultSave().stats, ...parsed.stats },
      daily: { ...defaultSave().daily, ...parsed.daily },
      stars: parsed.stars ?? {},
      version: VERSION,
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota */
  }
}

export function clampCampaign(n: number) {
  return Math.min(CAMPAIGN, Math.max(1, n));
}
