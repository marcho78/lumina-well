let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor({ latencyHint: "interactive" });
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function beep(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number, enabled = true) {
  if (!enabled) return;
  const audio = unlockAudio();
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), audio.currentTime + dur);
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur);
}

export function chord(freqs: number[], enabled = true) {
  freqs.forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.04, undefined, enabled), i * 40));
}

export function haptic(ms: number, enabled = true) {
  if (enabled && navigator.vibrate) navigator.vibrate(ms);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
