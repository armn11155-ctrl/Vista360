// ── sounds.ts — Sonidos UI con Web Audio API (sin archivos externos) ──
// Inspirado en el lenguaje sonoro de Apple: limpio, armónico, tonal.

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

// ─────────────────────────────────────────────────────────────────
// SPLASH — Chime de bienvenida tipo Apple startup
// Inspirado en el "dong" del Mac: tono puro + resonancia etérea
// ─────────────────────────────────────────────────────────────────
export const soundSplash = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Reverb artificial con convolver (sala pequeña)
    const bufLen = ctx.sampleRate * 1.5;
    const reverbBuf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = reverbBuf.getChannelData(c);
      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3.5);
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbBuf;
    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(0.28, now);
    reverb.connect(reverbGain);
    reverbGain.connect(out);

    // Tono fundamental — La4 (440 Hz), largo y suave
    const fundamentalFreq = 440;
    const fundamental = ctx.createOscillator();
    const fundEnv = ctx.createGain();
    fundamental.type = "sine";
    fundamental.frequency.setValueAtTime(fundamentalFreq, now);
    fundEnv.gain.setValueAtTime(0.0, now);
    fundEnv.gain.linearRampToValueAtTime(0.55, now + 0.04); // ataque suave
    fundEnv.gain.setValueAtTime(0.55, now + 0.12);
    fundEnv.gain.exponentialRampToValueAtTime(0.001, now + 2.8); // cola larga
    fundamental.connect(fundEnv);
    fundEnv.connect(out);
    fundEnv.connect(reverb);
    fundamental.start(now);
    fundamental.stop(now + 3.0);

    // 2ª armónica — Mi5 (660 Hz), más baja, entra ligerísimo después
    const harm2 = ctx.createOscillator();
    const harm2Env = ctx.createGain();
    harm2.type = "sine";
    harm2.frequency.setValueAtTime(660, now);
    harm2Env.gain.setValueAtTime(0.0, now);
    harm2Env.gain.linearRampToValueAtTime(0.22, now + 0.06);
    harm2Env.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    harm2.connect(harm2Env);
    harm2Env.connect(out);
    harm2Env.connect(reverb);
    harm2.start(now + 0.02);
    harm2.stop(now + 2.5);

    // 3ª armónica — La5 (880 Hz), brillo cristalino
    const harm3 = ctx.createOscillator();
    const harm3Env = ctx.createGain();
    harm3.type = "sine";
    harm3.frequency.setValueAtTime(880, now);
    harm3Env.gain.setValueAtTime(0.0, now);
    harm3Env.gain.linearRampToValueAtTime(0.13, now + 0.05);
    harm3Env.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    harm3.connect(harm3Env);
    harm3Env.connect(out);
    harm3Env.connect(reverb);
    harm3.start(now + 0.03);
    harm3.stop(now + 2.0);

    // 4ª armónica — Mi6 (1320 Hz), shimmer lejano
    const harm4 = ctx.createOscillator();
    const harm4Env = ctx.createGain();
    harm4.type = "sine";
    harm4.frequency.setValueAtTime(1320, now);
    harm4Env.gain.setValueAtTime(0.0, now);
    harm4Env.gain.linearRampToValueAtTime(0.06, now + 0.04);
    harm4Env.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    harm4.connect(harm4Env);
    harm4Env.connect(out);
    harm4Env.connect(reverb);
    harm4.start(now + 0.04);
    harm4.stop(now + 1.2);

    // Sub-bass suave — La3 (220 Hz), solo el inicio, da "peso"
    const sub = ctx.createOscillator();
    const subEnv = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(220, now);
    subEnv.gain.setValueAtTime(0.0, now);
    subEnv.gain.linearRampToValueAtTime(0.3, now + 0.035);
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subEnv);
    subEnv.connect(out);
    sub.start(now);
    sub.stop(now + 0.5);
  });

// ─────────────────────────────────────────────────────────────────
// DELETE — Funk de macOS: dos tonos descendentes, rápido y seco
// ─────────────────────────────────────────────────────────────────
export const soundDelete = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

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

// ─────────────────────────────────────────────────────────────────
// SAVE — Glass de macOS mejorado: campana + shimmer + micro-reverb
// Más rico que el success puro; específico para "guardado"
// ─────────────────────────────────────────────────────────────────
export const soundSave = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Micro-reverb
    const bufLen = ctx.sampleRate * 0.6;
    const revBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const revData = revBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++)
      revData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 4);
    const reverb = ctx.createConvolver();
    reverb.buffer = revBuf;
    const revGain = ctx.createGain();
    revGain.gain.setValueAtTime(0.18, now);
    reverb.connect(revGain);
    revGain.connect(out);

    // Campana — Mi5 + La5 + Mi6: acorde mayor puro
    const freqs = [659.25, 880, 1318.5];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.038);
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(0.42 - i * 0.09, now + i * 0.038 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.038 + 0.75);
      osc.connect(env);
      env.connect(out);
      env.connect(reverb);
      osc.start(now + i * 0.038);
      osc.stop(now + i * 0.038 + 0.8);
    });

    // Shimmer (Mi7 — 2637 Hz), muy suave, brillo de cristal
    const shimmer = ctx.createOscillator();
    const shimEnv = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(2637, now);
    shimEnv.gain.setValueAtTime(0.06, now);
    shimEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    shimmer.connect(shimEnv);
    shimEnv.connect(out);
    shimmer.start(now);
    shimmer.stop(now + 0.4);
  });

// ─────────────────────────────────────────────────────────────────
// SUCCESS — Glass de macOS: campana cristalina, armónica
// ─────────────────────────────────────────────────────────────────
export const soundSuccess = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    const freqs = [880, 1320, 1760];
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

// ─────────────────────────────────────────────────────────────────
// CREATE — Hero de macOS: acorde ascendente, positivo y limpio
// ─────────────────────────────────────────────────────────────────
export const soundCreate = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

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

// ─────────────────────────────────────────────────────────────────
// ERROR — tono descendente disonante
// ─────────────────────────────────────────────────────────────────
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
