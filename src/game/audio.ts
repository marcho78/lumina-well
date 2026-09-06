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

export function shatter(enabled = true) {
  if (!enabled) return;
  const audio = unlockAudio();
  if (!audio) return;
  const t0 = audio.currentTime;
  const dur = 0.22;
  const frames = Math.floor(audio.sampleRate * dur);
  const buf = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const hp = audio.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1600;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.28, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hp);
  hp.connect(g);
  g.connect(audio.destination);
  src.start(t0);
  const notes = [2400, 1860, 1480, 1120, 840, 520, 330];
  notes.forEach((f, i) => {
    setTimeout(() => beep(f, 0.14 + i * 0.02, i < 3 ? "square" : "triangle", 0.07, Math.max(70, f * 0.28), enabled), i * 32);
  });
}

export function haptic(ms: number, enabled = true) {
  if (enabled && navigator.vibrate) navigator.vibrate(ms);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
