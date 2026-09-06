export type OrbType = "orb" | "ice" | "stone";
export type Special = "row" | "col" | "bomb" | "nova" | null;
export type Screen =
  | "boot"
  | "menu"
  | "realms"
  | "levels"
  | "play"
  | "result"
  | "pause"
  | "atelier"
  | "settings"
  | "help";
export type Mode = "campaign" | "endless" | "daily";

export type Orb = {
  color: number;
  type: OrbType;
  special: Special;
  hp: number;
};

export type Cell = { r: number; c: number };

export type LevelSpec = {
  colors: number;
  ice: boolean;
  stone: boolean;
  target: number;
  moves: number;
  fill: number;
  world: number;
  mode: Mode;
  level: number;
  seed: number;
};

export type Session = {
  spec: LevelSpec;
  board: (Orb | null)[][];
  queue: Orb[];
  score: number;
  moves: number;
  combo: number;
  maxCombo: number;
  cleared: number;
  drops: number;
  won: boolean;
  lost: boolean;
  tools: { shuffle: number; crush: number; nova: number };
};

export type SaveState = {
  version: number;
  shards: number;
  farthest: number;
  current: number;
  stars: Record<number, number>;
  upgrades: {
    preview: number;
    startShuffle: number;
    startCrush: number;
    startNova: number;
    bonus: number;
  };
  settings: { sfx: boolean; haptic: boolean; shake: boolean };
  stats: { plays: number; clears: number; bestCombo: number; drops: number };
  daily: { key: string; cleared: boolean };
};

export type UpgradeDef = {
  key: keyof SaveState["upgrades"];
  name: string;
  desc: string;
  max: number;
  cost: number[];
};
