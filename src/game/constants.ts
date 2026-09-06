import type { UpgradeDef } from "./types";

export const COLS = 6;
export const ROWS = 8;
export const LEVELS_PER_REALM = 40;

export const COLORS = [
  { id: "rose", fill: ["#f3c4c8", "#c76b74", "#7a2e38"], glow: "#c76b74" },
  { id: "sand", fill: ["#efe0c4", "#c9a56a", "#7a5b28"], glow: "#c9a56a" },
  { id: "moss", fill: ["#cde6d6", "#6ea589", "#2f5c48"], glow: "#6ea589" },
  { id: "ice", fill: ["#d5e4ee", "#7aa0b8", "#35556a"], glow: "#7aa0b8" },
  { id: "slate", fill: ["#d8d6e2", "#8b88a0", "#454358"], glow: "#8b88a0" },
  { id: "pearl", fill: ["#f0eee6", "#c5c0b0", "#6f6a5c"], glow: "#c5c0b0" },
] as const;

export const REALMS = [
  { name: "Ember Hollow", hue: "#c76b74", blurb: "Four lights. Learn the drop." },
  { name: "Frost Veil", hue: "#7aa0b8", blurb: "Ice shells take two hits." },
  { name: "Thorn Garden", hue: "#6ea589", blurb: "Stone roots refuse to fall." },
  { name: "Storm Spire", hue: "#8b88a0", blurb: "A fifth color joins the choir." },
  { name: "The Abyss", hue: "#5a6a7a", blurb: "Less room. Meaner goals." },
  { name: "Prism Sanctum", hue: "#c5c0b0", blurb: "Specials awaken more often." },
  { name: "Ironworks", hue: "#a88888", blurb: "Packed boards. Tight moves." },
  { name: "Dreamtide", hue: "#7aa8a0", blurb: "Weird wells. Shifting ice." },
  { name: "Solar Forge", hue: "#c9a56a", blurb: "Pearl lights and nova seeds." },
  { name: "Night Market", hue: "#9a90a8", blurb: "Commerce of cascades." },
  { name: "Celestial", hue: "#90b0b8", blurb: "Nearly the source." },
  { name: "The Source", hue: "#e8e6e0", blurb: "Everything, all at once." },
] as const;

export const CAMPAIGN = REALMS.length * LEVELS_PER_REALM;

export const UPGRADES: UpgradeDef[] = [
  { key: "preview", name: "Long Sight", desc: "See a third incoming light.", max: 1, cost: [80] },
  { key: "startShuffle", name: "Spare Rerolls", desc: "+1 shuffle at the start of every well.", max: 3, cost: [40, 90, 160] },
  { key: "startCrush", name: "Glass Finger", desc: "+1 crush charge each well.", max: 3, cost: [50, 110, 180] },
  { key: "startNova", name: "Pocket Nova", desc: "+1 color-burst each well.", max: 2, cost: [120, 220] },
  { key: "bonus", name: "Bright Ledger", desc: "+6% score from every cascade.", max: 5, cost: [30, 60, 100, 150, 210] },
];
