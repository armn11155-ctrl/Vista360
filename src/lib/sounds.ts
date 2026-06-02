// ── sounds.ts — Sonidos UI con Web Audio API (sin archivos externos) ──
// Inspirado en el lenguaje sonoro de Apple: limpio, armónico, tonal.

let _ctx: AudioContext | null = null;

// ── Desbloqueo: llamar desde el primer gesto del usuario ──────────
export const unlockAudio = (): Promise<void> => {
  try {
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_ctx.state === "suspended") {
      return _ctx.resume();
    }
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
};

const getCtx = (): AudioContext => {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
};

const play = (build: (ctx: AudioContext, out: GainNode) => void) => {
  try {
    const ctx = getCtx();
    const run = () => {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.4, ctx.currentTime);
      master.connect(ctx.destination);
      build(ctx, master);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch {
    /* silencioso */
  }
};

// ─────────────────────────────────────────────────────────────────
// SPLASH — Mac startup chime
// El clásico "bong" de Mac: acorde de La mayor (A-C#-E),
// ataque instantáneo, sustain largo con decay suave.
// Dura exactamente 2.4s para coincidir con el final del splash.
// ─────────────────────────────────────────────────────────────────
export const soundSplash = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Reverb sintético — sala grande y cálida
    const revLen = Math.floor(ctx.sampleRate * 2.5);
    const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = revBuf.getChannelData(c);
      for (let i = 0; i < revLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.6));
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = revBuf;
    const revGain = ctx.createGain();
    revGain.gain.setValueAtTime(0.35, now);
    reverb.connect(revGain);
    revGain.connect(out);

    // Acorde La mayor: La3 · La4 · Do#5 · Mi5
    const notes = [
      { f: 220.0, vol: 0.55, decay: 2.4 },
      { f: 440.0, vol: 0.45, decay: 2.2 },
      { f: 554.37, vol: 0.3, decay: 1.9 },
      { f: 659.25, vol: 0.22, decay: 1.6 },
      { f: 880.0, vol: 0.12, decay: 1.2 },
    ];

    notes.forEach(({ f, vol, decay }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(vol, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, now + decay);
      osc.connect(env);
      env.connect(out);
      env.connect(reverb);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    });
  });

// ─────────────────────────────────────────────────────────────────
// DELETE — Funk de macOS: dos tonos descendentes, seco
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
// SAVE — Glass: campana + shimmer + micro-reverb
// ─────────────────────────────────────────────────────────────────
export const soundSave = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

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
// SUCCESS — Glass de macOS: campana cristalina
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
// CREATE — Hero de macOS: acorde ascendente
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

// ─────────────────────────────────────────────────────────────────
// MESSAGE — Ping suave para mensajes / notificaciones de chat.
// Dos sinusoides ascendentes: nota base (Do5) + quinta (Sol5).
// Ataque rápido, decay medio — discreto pero audible.
// ─────────────────────────────────────────────────────────────────
export const soundMessage = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Micro-reverb muy corto
    const revLen = Math.floor(ctx.sampleRate * 0.25);
    const revBuf = ctx.createBuffer(1, revLen, ctx.sampleRate);
    const revData = revBuf.getChannelData(0);
    for (let i = 0; i < revLen; i++)
      revData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    const reverb = ctx.createConvolver();
    reverb.buffer = revBuf;
    const revGain = ctx.createGain();
    revGain.gain.setValueAtTime(0.12, now);
    reverb.connect(revGain);
    revGain.connect(out);

    // Do5 (523 Hz) + Sol5 (784 Hz) con ligero stagger
    const notes = [
      { f: 523.25, vol: 0.38, start: 0,     decay: 0.45 },
      { f: 783.99, vol: 0.28, start: 0.055, decay: 0.38 },
    ];

    notes.forEach(({ f, vol, start, decay }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + start);
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + start + decay);
      osc.connect(env);
      env.connect(out);
      env.connect(reverb);
      osc.start(now + start);
      osc.stop(now + start + decay + 0.02);
    });
  });

// ─────────────────────────────────────────────────────────────────
// SEND — Whoosh ligero: mensaje enviado (más sutil que soundCreate)
// ─────────────────────────────────────────────────────────────────
export const soundSend = () =>
  play((ctx, out) => {
    const now = ctx.currentTime;

    // Tono ascendente rápido
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    env.gain.setValueAtTime(0.0, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);

    // Shimmer tenue
    const sh = ctx.createOscillator();
    const shEnv = ctx.createGain();
    sh.type = "sine";
    sh.frequency.setValueAtTime(1760, now + 0.06);
    shEnv.gain.setValueAtTime(0.0, now);
    shEnv.gain.linearRampToValueAtTime(0.07, now + 0.075);
    shEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sh.connect(shEnv);
    shEnv.connect(out);
    sh.start(now + 0.06);
    sh.stop(now + 0.3);
  });
