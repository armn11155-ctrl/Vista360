import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const BG = "#00020c";
interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const cvs   = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState(false);
  const [sub,  setSub]  = useState(false);
  const [fade, setFade] = useState(false);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const sf = useRef(false);

  // theme-color
  useEffect(() => {
    const set = (c: string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name","theme-color"); document.head.appendChild(m); }
      m.setAttribute("content", c);
      document.documentElement.style.background = c;
      document.body.style.background = c;
    };
    set(BG);
    return () => { set(T.bg); document.documentElement.style.background = ""; document.body.style.background = ""; };
  }, []);

  // audio
  useEffect(() => {
    const go = () => unlockAudio().then(() => { if (sf.current) return; sf.current = true; soundSplash(); }).catch(() => {});
    window.addEventListener("touchstart", go, { once: true, passive: true });
    window.addEventListener("mousedown",  go, { once: true });
    return () => { window.removeEventListener("touchstart", go); window.removeEventListener("mousedown", go); };
  }, []);

  // canvas
  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let rafId = 0;

    // ── FALLBACK: si algo falla, done() se llama igualmente ─────────
    const fallback = setTimeout(() => doneRef.current(), 7000);

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Estrellas pequeñas
    const SM = Array.from({ length: 280 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      a: 0.2 + Math.random() * 0.6,
      sp: 0.5 + Math.random() * 2,
      ph: Math.random() * Math.PI * 2,
      col: Math.random() < 0.12 ? "180,210,255" : "255,255,255",
    }));

    // Estrellas medianas con halo
    const MD = Array.from({ length: 38 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 2 + Math.random() * 3.5,
      a: 0.5 + Math.random() * 0.4,
      sp: 0.2 + Math.random() * 0.8,
      ph: Math.random() * Math.PI * 2,
      gr: 2.5 + Math.random() * 2,
      col: Math.random() < 0.2 ? "150,195,255" : "255,255,255",
    }));

    // Estrellas grandes con spikes (las "bien bonitas")
    const LG = Array.from({ length: 12 }, () => ({
      x: 0.06 + Math.random() * 0.88,
      y: 0.06 + Math.random() * 0.88,
      r: 5 + Math.random() * 9,
      a: 0.75 + Math.random() * 0.25,
      sp: 0.12 + Math.random() * 0.35,
      ph: Math.random() * Math.PI * 2,
      col: Math.random() < 0.28 ? "160,200,255" : Math.random() < 0.1 ? "255,235,160" : "255,255,255",
      spikes: Math.random() < 0.65,
    }));

    // Estrella fugaz
    let shootX = 0, shootY = 0, shootVx = 0, shootVy = 0;
    let shootLife = 0, shootMax = 0, shootActive = false;
    let nextShoot = 2.5;

    const fl = { logo: false, sub: false, fd: false, dn: false };
    let t0 = 0;

    function draw(ts: number) {
      try {
        if (!t0) t0 = ts;
        const el = ts - t0;
        const t  = el / 1000;
        const W  = canvas.width;
        const H  = canvas.height;

        // Fondo espacio
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        // Nebulosa sutil (sin scale para evitar bugs de transform)
        const nebData = [
          { x: 0.22, y: 0.32, r: 340, col: "40,70,170", a: 0.06 },
          { x: 0.75, y: 0.62, r: 280, col: "70,25,130", a: 0.04 },
        ];
        nebData.forEach(n => {
          const g = ctx.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, n.r);
          g.addColorStop(0, `rgba(${n.col},${n.a})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        });

        // Estrellas pequeñas
        SM.forEach(s => {
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * s.sp + s.ph));
          ctx.fillStyle = `rgba(${s.col},${(s.a * tw).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Estrellas medianas con glow
        MD.forEach(s => {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * s.sp + s.ph));
          const a  = s.a * tw;
          const gx = s.x * W, gy = s.y * H;
          const g  = ctx.createRadialGradient(gx, gy, 0, gx, gy, s.r * s.gr);
          g.addColorStop(0, `rgba(${s.col},${a.toFixed(2)})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(gx, gy, s.r * s.gr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${(a * 0.95).toFixed(2)})`;
          ctx.beginPath(); ctx.arc(gx, gy, s.r * 0.3, 0, Math.PI * 2); ctx.fill();
        });

        // Estrellas grandes con halos y spikes
        LG.forEach(s => {
          const tw = 0.6 + 0.4 * Math.abs(Math.sin(t * s.sp + s.ph));
          const a  = s.a * tw;
          const gx = s.x * W, gy = s.y * H;
          // Halo exterior
          const h1 = ctx.createRadialGradient(gx, gy, 0, gx, gy, s.r * 7);
          h1.addColorStop(0, `rgba(${s.col},${(a * 0.35).toFixed(2)})`);
          h1.addColorStop(0.35, `rgba(${s.col},${(a * 0.10).toFixed(2)})`);
          h1.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = h1; ctx.beginPath(); ctx.arc(gx, gy, s.r * 7, 0, Math.PI * 2); ctx.fill();
          // Halo interior
          const h2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, s.r * 2.2);
          h2.addColorStop(0, `rgba(${s.col},${(a * 0.92).toFixed(2)})`);
          h2.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = h2; ctx.beginPath(); ctx.arc(gx, gy, s.r * 2.2, 0, Math.PI * 2); ctx.fill();
          // Núcleo
          ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(gx, gy, s.r * 0.25, 0, Math.PI * 2); ctx.fill();
          // Spikes en cruz y diagonal
          if (s.spikes) {
            ctx.strokeStyle = `rgba(255,255,255,${(a * 0.28).toFixed(2)})`;
            ctx.lineWidth = 0.6;
            const angles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
            angles.forEach(ang => {
              const len = s.r * 6 * tw;
              ctx.beginPath();
              ctx.moveTo(gx - Math.cos(ang) * 1, gy - Math.sin(ang) * 1);
              ctx.lineTo(gx + Math.cos(ang) * len, gy + Math.sin(ang) * len);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(gx - Math.cos(ang) * 1, gy - Math.sin(ang) * 1);
              ctx.lineTo(gx - Math.cos(ang) * len, gy - Math.sin(ang) * len);
              ctx.stroke();
            });
          }
        });

        // Estrella fugaz
        if (t > nextShoot && !shootActive) {
          const fromLeft = Math.random() < 0.5;
          shootX    = fromLeft ? -20 : W + 20;
          shootY    = Math.random() * H * 0.55;
          shootVx   = fromLeft ? (3 + Math.random() * 3) : -(3 + Math.random() * 3);
          shootVy   = (1 + Math.random() * 2);
          shootLife = 0; shootMax = 55 + Math.random() * 35;
          shootActive = true;
          nextShoot = t + 2.5 + Math.random() * 4;
        }
        if (shootActive) {
          shootLife++;
          const prog  = shootLife / shootMax;
          const alpha = (1 - prog) * 0.85;
          const tail  = 80;
          ctx.strokeStyle = `rgba(220,235,255,${alpha.toFixed(2)})`;
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.moveTo(shootX, shootY);
          ctx.lineTo(shootX - shootVx * tail * 0.4, shootY - shootVy * tail * 0.4);
          ctx.stroke();
          shootX += shootVx * 3; shootY += shootVy * 3;
          if (shootLife >= shootMax) shootActive = false;
        }

        // Viñeta
        const vig = ctx.createRadialGradient(W/2, H/2, H * 0.22, W/2, H/2, H * 0.84);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,12,0.65)");
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

        // Flags de UI
        if (el > 1800 && !fl.logo) {
          fl.logo = true; setShow(true);
          if (isAudioReady() && !sf.current) { sf.current = true; soundSplash(); }
        }
        if (el > 2500 && !fl.sub)  { fl.sub = true; setSub(true);   }
        if (el > 5200 && !fl.fd)   { fl.fd  = true; setFade(true);  }
        if (el > 5900 && !fl.dn)   { fl.dn  = true; doneRef.current(); clearTimeout(fallback); }

      } catch (err) {
        console.error("[Splash] draw error:", err);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(fallback);
      window.removeEventListener("resize", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, background: BG, overflow: "hidden",
      opacity: fade ? 0 : 1, transition: fade ? "opacity 0.8s ease" : "none",
    }}>
      <canvas ref={cvs} style={{ position: "absolute", inset: 0, display: "block" }} />
      <style>{`
        @keyframes starAppear {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.65); }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        }
        @keyframes starFloat {
          0%,100% { transform:translate(-50%,-50%) translateY(0px);   }
          50%      { transform:translate(-50%,-50%) translateY(-9px);  }
        }
      `}</style>

      {/* Logo */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        opacity: show ? 1 : 0,
        animation: show
          ? "starAppear 1.4s cubic-bezier(0.2,1,0.35,1) forwards, starFloat 5s ease-in-out 1.4s infinite"
          : "none",
        filter: "drop-shadow(0 0 55px rgba(140,190,255,0.72)) drop-shadow(0 0 120px rgba(80,130,255,0.38))",
        willChange: "transform",
      }}>
        <Logo360 width={220} />
      </div>

      {/* Subtítulo */}
      <div style={{
        position: "absolute", left: "50%", top: "calc(50% + 88px)",
        transform: "translateX(-50%)",
        fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 300,
        fontSize: "clamp(0.54rem,1.25vw,0.78rem)", letterSpacing: "0.60em",
        textTransform: "uppercase", color: "rgba(180,210,255,0.75)",
        textShadow: "0 0 18px rgba(100,160,255,0.5)",
        opacity: sub ? 1 : 0, transition: "opacity 1s ease", whiteSpace: "nowrap",
      }}>
        · Vista 360 ·
      </div>
    </div>
  );
}

export default Splash;
