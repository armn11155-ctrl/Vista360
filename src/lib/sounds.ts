// ── sounds.ts — Sonidos UI con Web Audio API (sin archivos externos) ──
// Imita los sonidos de macOS: delete (Funk), success (Glass), create (Hero)

let _ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
};

// Utilidad: encadena nodos y los conecta al destino
const play = (build: (ctx: AudioContext, out: GainNode) => void) => {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, ctx.currentTime);
    master.connect(ctx.destination);
    build(ctx, master);
  } catch {
    /* silencioso si el navegador bloquea */
  }
};

// ── DELETE — Funk de macOS: dos tonos descendentes, rápido y seco ──
export const soundDelete = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Primer golpe: tono grave corto
    const osc1 = ctx.createOscillator();
    const env1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(260, now);
    osc1.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    env1.gain.setValueAtTime(0.7, now);
    env1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(env1);
    env1.connect(out);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Segundo golpe: tono más grave, ligeramente después
    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(200, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(130, now + 0.28);
    env2.gain.setValueAtTime(0.0, now);
    env2.gain.setValueAtTime(0.55, now + 0.1);
    env2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(env2);
    env2.connect(out);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.32);

    // Clic seco inicial (ruido muy corto)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    const noiseEnv = ctx.createGain();
    noise.buffer = buf;
    noiseEnv.gain.setValueAtTime(0.4, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    noise.connect(noiseEnv);
    noiseEnv.connect(out);
    noise.start(now);
  });

// ── SUCCESS / SAVE — Glass de macOS: campana cristalina, armónica ──
export const soundSuccess = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    const freqs = [880, 1320, 1760]; // fundamental + 5ª + 8ª
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(0.45 - i * 0.1, now + i * 0.04 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.6);
      osc.connect(env);
      env.connect(out);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.65);
    });

    // Shimmer de alta frecuencia (brillo de campana)
    const shimmer = ctx.createOscillator();
    const shimEnv = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(3520, now);
    shimEnv.gain.setValueAtTime(0.08, now);
    shimEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    shimmer.connect(shimEnv);
    shimEnv.connect(out);
    shimmer.start(now);
    shimmer.stop(now + 0.3);
  });

// ── CREATE — Hero de macOS: acorde ascendente, positivo y limpio ──
export const soundCreate = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Acorde mayor ascendente: Do - Mi - Sol
    const chord = [523.25, 659.25, 783.99];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(0.38 - i * 0.05, now + i * 0.055 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.55);
      osc.connect(env);
      env.connect(out);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.6);
    });

    // Nota de cierre más aguda
    const top = ctx.createOscillator();
    const topEnv = ctx.createGain();
    top.type = "sine";
    top.frequency.setValueAtTime(1046.5, now + 0.18);
    topEnv.gain.setValueAtTime(0.0, now);
    topEnv.gain.linearRampToValueAtTime(0.22, now + 0.2);
    topEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    top.connect(topEnv);
    topEnv.connect(out);
    top.start(now + 0.18);
    top.stop(now + 0.68);
  });

// ── ERROR — tono descendente disonante ──
export const soundError = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
    env.gain.setValueAtTime(0.25, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + 0.3);
  });
