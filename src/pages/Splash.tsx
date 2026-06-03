import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

/** Debe coincidir con T.dark */
const SPLASH_BG = "#0D1629";

interface SplashProps {
  done: () => void;
}

function Splash({ done }: SplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logoVisible, setLogoVisible]       = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [fadeOut, setFadeOut]               = useState(false);

  const doneRef     = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);

  const soundFired = useRef(false);

  // ── Clava el theme-color al color del splash ──────────────────
  useEffect(() => {
    const setTheme = (color: string) => {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", color);
      document.documentElement.style.background = color;
      document.body.style.background = color;
    };
    setTheme(SPLASH_BG);
    return () => {
      setTheme(T.bg);
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  // ── Desbloqueo de audio + disparo en gesto (iOS / PWA) ───────
  useEffect(() => {
    const onGesture = () => {
      unlockAudio()
        .then(() => {
          if (soundFired.current) return;
          soundFired.current = true;
          soundSplash();
        })
        .catch(() => {});
    };
    window.addEventListener("touchstart", onGesture, { once: true, passive: true });
    window.addEventListener("mousedown",  onGesture, { once: true });
    return () => {
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("mousedown",  onGesture);
    };
  }, []);

  // ── Animación canvas + timers ─────────────────────────────────
  // Dependencias vacías [] → corre UNA sola vez. Accedemos a done
  // exclusivamente a través de doneRef para no reiniciar la animación.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    /* ── Líneas ────────────────────────────────────────────────── */
    const N = 26;
    // Seed fija: generamos todo UNA sola vez al montar
    const lines = Array.from({ length: N }, (_, i) => ({
      yRatio: i / (N - 1),
      thick : Math.random() < 0.22 ? 1.35 : 0.6,
      alpha : 0.07 + Math.random() * 0.24,
      // Retraso escalonado: 0 → ~850 ms
      delay : i * 32 + Math.random() * 50,
      // Dos tonos de azul del tema (#2563EB accent, #60A5FA blue-400)
      hue   : Math.random() < 0.65
        ? ([37,  99, 235] as [number, number, number])  // blue-600
        : ([96, 165, 250] as [number, number, number]), // blue-400
      dots  : (() => {
        const d: number[] = [];
        if (Math.random() < 0.52) d.push(0.07 + Math.random() * 0.30);
        if (Math.random() < 0.34) d.push(0.58 + Math.random() * 0.33);
        return d;
      })(),
    }));

    /* ── Timing ────────────────────────────────────────────────── */
    // Grow ends: T_GROW + last_delay + 50 ≈ 800+850+50 = 1700 ms
    // Hold ends: 1700+100 = 1800 ms
    // Compress:  1800 → 2600 ms (800 ms)
    //   logo at: 1800 + 800*0.35 ≈ 2080 ms
    //   sub  at: 1800 + 800*0.55 ≈ 2240 ms
    // Fade at:   2600 + 700      = 3300 ms
    // Done at:   2600 + 1200     = 3800 ms  ← igual que la versión anterior
    const T_GROW     = 800;
    const T_HOLD     = 100;
    const T_COMPRESS = 800;
    const LAST_DELAY = lines[N - 1].delay;

    const eOut = (t: number) => 1 - (1 - t) ** 3;
    const eIO  = (t: number) =>
      t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

    type Phase = "grow" | "hold" | "compress" | "done";
    let phase      : Phase = "grow";
    let phaseStart = 0;
    const flags = { logo: false, sub: false, sound: false, fade: false, done: false };

    /* ── Render loop ───────────────────────────────────────────── */
    function draw(ts: number) {
      if (!phaseStart) phaseStart = ts;
      const el = ts - phaseStart;
      const W  = canvas!.width, H = canvas!.height;
      const cx = W / 2,         cy = H / 2;

      // Fondo base
      ctx.fillStyle = SPLASH_BG;
      ctx.fillRect(0, 0, W, H);

      // Líneas de contabilidad estáticas (muy sutiles)
      const lStep = Math.max(Math.floor(H / 34), 18);
      ctx.lineWidth   = 0.5;
      ctx.strokeStyle = "rgba(37,99,235,0.028)";
      for (let y = lStep; y < H; y += lStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Líneas animadas
      lines.forEach(line => {
        const baseY = line.yRatio * H;
        let sx: number, ex: number, ly: number, a: number;

        if (phase === "grow") {
          const le = el - line.delay;
          if (le <= 0) return;
          const t = Math.min(le / T_GROW, 1);
          sx = 0; ex = eOut(t) * (W + 80); ly = baseY; a = line.alpha;

        } else if (phase === "hold") {
          sx = 0; ex = W + 80; ly = baseY; a = line.alpha;

        } else if (phase === "compress") {
          const t  = Math.min(el / T_COMPRESS, 1);
          const et = eIO(t);
          // Bordes convergen al centro horizontalmente
          sx = et * (cx - 60);
          ex = W + 80 - et * (W + 80 - cx - 60);
          // Derive vertical suave hacia cy
          ly = baseY - (baseY - cy) * et * 0.21;
          // Desvanecimiento al final
          a  = line.alpha * (et > 0.62 ? 1 - (et - 0.62) / 0.38 : 1);

        } else { return; }

        if (ex <= sx || a < 0.004) return;

        const [r, g, b] = line.hue;
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.lineWidth   = line.thick;
        ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(ex, ly); ctx.stroke();

        // Puntos de acento
        if (a > 0.025) {
          line.dots.forEach(ratio => {
            const dx = sx + (ex - sx) * ratio;
            ctx.fillStyle = `rgba(147,197,253,${Math.min(a * 2.2, 0.52)})`;
            ctx.beginPath(); ctx.arc(dx, ly, 2.7, 0, Math.PI * 2); ctx.fill();
          });
        }
      });

      // Viñeta radial
      const vig = ctx.createRadialGradient(cx, cy, H * 0.04, cx, cy, H * 0.82);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      // Halo azul al comprimir
      if (phase === "compress" || phase === "done") {
        const ct = phase === "done" ? 1 : Math.min(el / T_COMPRESS, 1);
        const ga = eIO(ct) * 0.09;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.38);
        glow.addColorStop(0, `rgba(37,99,235,${ga})`);
        glow.addColorStop(1, "rgba(37,99,235,0)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      }

      /* ── Transiciones de fase ────────────────────────────────── */
      if (phase === "grow" && el > T_GROW + LAST_DELAY + 50) {
        phase = "hold"; phaseStart = ts;

      } else if (phase === "hold" && el > T_HOLD) {
        phase = "compress"; phaseStart = ts;
        // Sonido al iniciar compresión (contexto ya puede estar desbloqueado)
        if (isAudioReady() && !flags.sound) {
          flags.sound = true; soundFired.current = true; soundSplash();
        }

      } else if (phase === "compress") {
        const ct = el / T_COMPRESS;
        if (ct > 0.35 && !flags.logo) { flags.logo = true; setLogoVisible(true);     }
        if (ct > 0.55 && !flags.sub)  { flags.sub  = true; setSubtitleVisible(true); }
        if (ct >= 1)                   { phase = "done"; phaseStart = ts;             }

      } else if (phase === "done") {
        if (el > 700  && !flags.fade) { flags.fade = true; setFadeOut(true);       }
        if (el > 1200 && !flags.done) { flags.done = true; doneRef.current();      }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── JSX ─────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        position : "fixed",
        inset    : 0,
        zIndex   : 999,
        background: SPLASH_BG,
        overflow : "hidden",
        opacity  : fadeOut ? 0 : 1,
        transition: fadeOut ? "opacity 0.6s cubic-bezier(.4,0,.2,1)" : "none",
      }}
    >
      {/* Canvas de líneas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, display: "block" }}
      />

      {/* Overlay UI */}
      <div
        style={{
          position      : "absolute",
          inset         : 0,
          display       : "flex",
          flexDirection : "column",
          alignItems    : "center",
          justifyContent: "center",
          pointerEvents : "none",
          userSelect    : "none",
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity  : logoVisible ? 1 : 0,
            transform: logoVisible
              ? "scale(1) translateY(0)"
              : "scale(0.8) translateY(14px)",
            transition: logoVisible
              ? "opacity 1.1s ease, transform 1.1s cubic-bezier(0.2,1,0.35,1)"
              : "none",
            filter:
              "drop-shadow(0 0 32px rgba(37,99,235,0.45)) " +
              "drop-shadow(0 0 10px rgba(96,165,250,0.30))",
          }}
        >
          <Logo360 width={220} />
        </div>

        {/* Separador */}
        <div
          style={{
            width     : logoVisible ? "min(280px, 55vw)" : 0,
            height    : 1,
            background: "rgba(37,99,235,0.35)",
            margin    : "18px auto 15px",
            transition: logoVisible
              ? "width 1.05s cubic-bezier(0.4,0,0.2,1) 0.2s"
              : "none",
          }}
        />

        {/* Subtítulo */}
        <div
          style={{
            fontFamily  : '"DM Sans", system-ui, sans-serif',
            fontWeight  : 300,
            fontSize    : "clamp(0.58rem, 1.5vw, 0.85rem)",
            letterSpacing: "0.55em",
            textTransform: "uppercase",
            color       : "#60A5FA",
            opacity     : subtitleVisible ? 1 : 0,
            transition  : subtitleVisible ? "opacity 0.9s ease 0.35s" : "none",
          }}
        >
          · Facturación ·
        </div>
      </div>
    </div>
  );
}

export default Splash;
