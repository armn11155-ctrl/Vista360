import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const BG = "#0D1629";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logoVisible, setLogoVisible] = useState(false);
  const [subVisible,  setSubVisible]  = useState(false);
  const [fadeOut,     setFadeOut]     = useState(false);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const soundFired = useRef(false);

  useEffect(() => {
    const set = (c: string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name","theme-color"); document.head.appendChild(m); }
      m.setAttribute("content", c); document.documentElement.style.background = c; document.body.style.background = c;
    };
    set(BG);
    return () => { set(T.bg); document.documentElement.style.background=""; document.body.style.background=""; };
  }, []);

  useEffect(() => {
    const go = () => unlockAudio().then(() => { if (soundFired.current) return; soundFired.current=true; soundSplash(); }).catch(()=>{});
    window.addEventListener("touchstart", go, { once:true, passive:true });
    window.addEventListener("mousedown",  go, { once:true });
    return () => { window.removeEventListener("touchstart",go); window.removeEventListener("mousedown",go); };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    /* ─── Paleta: tonos azul elegante + blanco ─────────────────── */
    const PALETTE: [number,number,number][] = [[79,124,255],[0,212,255],[155,187,255],[96,165,250],[180,210,255]];
    const WHITE: [number,number,number] = [255,255,255];

    /* ─── Líneas en espiral de Arquímedes ──────────────────────── */
    const N = 52;
    const TURNS = 2.5;
    const W0 = canvas.width, H0 = canvas.height;
    const MAX_R = Math.min(W0, H0) * 0.44;

    const lines = Array.from({ length: N }, (_, i) => {
      const p = i / N;
      const angle  = p * TURNS * Math.PI * 2;
      const r      = MAX_R * 0.06 + p * MAX_R * 0.82;
      const isW    = Math.random() < 0.18;
      const color  = isW ? WHITE : PALETTE[Math.floor(Math.random() * PALETTE.length)];
      return {
        baseAngle: angle,
        r,
        length : (18 + p * 58) * (0.7 + Math.random() * 0.6),
        color,
        thick  : 0.5 + p * 0.9 + (Math.random() < 0.2 ? 0.8 : 0),
        alpha  : 0.30 + Math.random() * 0.50,
        delay  : i * 12,              // 0 → 612 ms escalonado
      };
    });

    /* ─── Timing total ≈ 3.8 s ─────────────────────────────────
       GROW ends : 850 + 612 + 38 = 1500 ms
       SPIN ends : 1500 + 1000    = 2500 ms
       CONV ends : 2500 +  500    = 3000 ms
       logo at   : 3000 ms  (inmediato tras convergencia)
       fade at   : 3000 + 350     = 3350 ms
       done()    : 3000 + 800     = 3800 ms
    ─────────────────────────────────────────────────────────── */
    const T_GROW_L  = 850;
    const LAST_DLY  = lines[N - 1].delay;   // 612 ms
    const T_GROW_END = T_GROW_L + LAST_DLY + 38;  // 1500
    const T_SPIN    = 1000;
    const T_SPIN_END = T_GROW_END + T_SPIN;        // 2500
    const T_CONV    = 500;
    const T_CONV_END = T_SPIN_END + T_CONV;        // 3000

    const eOut = (t: number) => 1 - (1 - t) ** 3;
    const eIO  = (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const eIn  = (t: number) => t ** 2;

    const fl = { logo:false, sub:false, fade:false, done:false };
    let totalRot = 0;  // rotación acumulada para la fase convergencia

    /* ─── Dibuja una línea con doble glow ──────────────────────── */
    function gl(x1:number, y1:number, x2:number, y2:number,
                r:number, g:number, b:number, a:number, tk:number) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = `rgba(${r},${g},${b},1)`;
      ctx.shadowBlur  = 26; ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(a*0.9,0.55)})`;
      ctx.lineWidth   = tk * 3;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.shadowBlur  = 7;  ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(a*4,1)})`;
      ctx.lineWidth   = tk * 0.6;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.restore();
    }

    /* ─── Bloom central ────────────────────────────────────────── */
    function bloom(cx:number, cy:number, intensity:number) {
      ctx.save();
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,140*intensity+20);
      g.addColorStop(0,   `rgba(255,255,255,${intensity*0.45})`);
      g.addColorStop(0.25,`rgba(79,124,255,${intensity*0.35})`);
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0,0,canvas!.width,canvas!.height);
      ctx.restore();
    }

    /* ─── Loop principal ───────────────────────────────────────── */
    let start = 0;
    function draw(ts: number) {
      if (!start) start = ts;
      const el = ts - start;
      const W  = canvas!.width, H = canvas!.height;
      const cx = W / 2, cy = H / 2;

      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

      /* Reglas de fondo ultra-sutiles */
      ctx.lineWidth = 0.35; ctx.strokeStyle = "rgba(79,124,255,0.03)";
      const ls = Math.max(Math.floor(H/36), 16);
      for (let y = ls; y < H; y += ls) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      ctx.save();
      ctx.translate(cx, cy);

      if (el < T_GROW_END) {
        /* ── FASE 1: GROW ─── */
        lines.forEach(line => {
          const le = el - line.delay; if (le <= 0) return;
          const t  = Math.min(le / T_GROW_L, 1);
          const len = eOut(t) * line.length;
          const x1 = Math.cos(line.baseAngle) * line.r;
          const y1 = Math.sin(line.baseAngle) * line.r;
          const x2 = Math.cos(line.baseAngle) * (line.r + len);
          const y2 = Math.sin(line.baseAngle) * (line.r + len);
          const [r,g,b] = line.color;
          gl(x1,y1,x2,y2,r,g,b,line.alpha,line.thick);
        });

      } else if (el < T_SPIN_END) {
        /* ── FASE 2: SPIN (espiral) ─── */
        const spinT   = (el - T_GROW_END) / T_SPIN;
        const spinA   = eIO(spinT) * Math.PI * 2.8;  // ~1.4 vueltas
        totalRot      = spinA;
        ctx.rotate(spinA);

        lines.forEach(line => {
          const shrink = eIn(spinT);
          const len = line.length * (1 - shrink * 0.45);
          const r   = line.r * (1 - shrink * 0.1);
          const x1  = Math.cos(line.baseAngle) * r;
          const y1  = Math.sin(line.baseAngle) * r;
          const x2  = Math.cos(line.baseAngle) * (r + len);
          const y2  = Math.sin(line.baseAngle) * (r + len);
          const a   = line.alpha * (1 - spinT * 0.35);
          const [ri,g,b] = line.color;
          gl(x1,y1,x2,y2,ri,g,b,a,line.thick);
        });

      } else if (el < T_CONV_END) {
        /* ── FASE 3: CONVERGE ─── */
        const ct  = (el - T_SPIN_END) / T_CONV;
        const et  = eIO(ct);
        ctx.rotate(totalRot + et * Math.PI * 0.6);

        lines.forEach(line => {
          const r   = line.r   * (1 - et);
          const len = line.length * (1 - et);
          if (len < 1) return;
          const x1 = Math.cos(line.baseAngle) * r;
          const y1 = Math.sin(line.baseAngle) * r;
          const x2 = Math.cos(line.baseAngle) * (r + len);
          const y2 = Math.sin(line.baseAngle) * (r + len);
          const a  = line.alpha * (1 - et);
          const [ri,g,b] = line.color;
          gl(x1,y1,x2,y2,ri,g,b,a,line.thick);
        });
      }

      ctx.restore();

      /* Bloom central — crece desde converge */
      if (el > T_SPIN_END) {
        const bt = Math.min((el - T_SPIN_END) / (T_CONV + 200), 1);
        bloom(cx, cy, eIO(bt));
      }

      /* Viñeta */
      const vig = ctx.createRadialGradient(cx,cy,H*0.05,cx,cy,H*0.88);
      vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.5)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      /* Flags de UI */
      if (el > T_CONV_END      && !fl.logo) { fl.logo=true; setLogoVisible(true); }
      if (el > T_CONV_END+180  && !fl.sub)  { fl.sub =true; setSubVisible(true);  }
      if (el > T_CONV_END+350  && !fl.fade) { fl.fade=true; setFadeOut(true);      }
      if (el > T_CONV_END+800  && !fl.done) { fl.done=true; doneRef.current();     }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position:"fixed",inset:0,zIndex:999,background:BG,overflow:"hidden",
      opacity:fadeOut?0:1,transition:fadeOut?"opacity 0.65s cubic-bezier(.4,0,.2,1)":"none" }}>
      <canvas ref={canvasRef} style={{ position:"absolute",inset:0,display:"block" }}/>
      <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",pointerEvents:"none",userSelect:"none" }}>

        <div style={{
          opacity  : logoVisible ? 1 : 0,
          transform: logoVisible ? "scale(1) translateY(0)" : "scale(0.75) translateY(18px)",
          transition: logoVisible
            ? "opacity 1.1s ease, transform 1.2s cubic-bezier(0.2,1,0.35,1)" : "none",
          filter: "drop-shadow(0 0 44px rgba(79,124,255,0.65)) drop-shadow(0 0 16px rgba(255,255,255,0.25))",
        }}>
          <Logo360 width={220}/>
        </div>

        <div style={{
          width     : logoVisible ? "min(300px,54vw)" : 0,
          height    : 1,
          background: "linear-gradient(90deg,transparent,rgba(79,124,255,0.7),rgba(255,255,255,0.4),transparent)",
          margin    : "20px auto 16px",
          transition: logoVisible ? "width 1.1s cubic-bezier(0.4,0,0.2,1) 0.15s" : "none",
        }}/>

        <div style={{
          fontFamily   : '"DM Sans",system-ui,sans-serif',
          fontWeight   : 300,
          fontSize     : "clamp(0.56rem,1.4vw,0.82rem)",
          letterSpacing: "0.58em",
          textTransform: "uppercase" as const,
          color        : "#9BBBFF",
          textShadow   : "0 0 14px rgba(79,124,255,0.6)",
          opacity      : subVisible ? 1 : 0,
          transition   : subVisible ? "opacity 0.9s ease 0.3s" : "none",
        }}>
          · Vista360 ·
        </div>
      </div>
    </div>
  );
}

export default Splash;
