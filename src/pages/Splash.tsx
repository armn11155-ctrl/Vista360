import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const BG = "#030e3a";
interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState(false);
  const [sub,  setSub]  = useState(false);
  const [fade, setFade] = useState(false);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const sf = useRef(false);

  useEffect(() => {
    const set = (c: string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name","theme-color"); document.head.appendChild(m); }
      m.setAttribute("content", c);
      document.documentElement.style.background = c;
      document.body.style.background = c;
    };
    set(BG);
    return () => { set(T.bg); document.documentElement.style.background=""; document.body.style.background=""; };
  }, []);

  useEffect(() => {
    const go = () => unlockAudio().then(() => { if (sf.current) return; sf.current=true; soundSplash(); }).catch(()=>{});
    window.addEventListener("touchstart", go, { once:true, passive:true });
    window.addEventListener("mousedown",  go, { once:true });
    return () => { window.removeEventListener("touchstart",go); window.removeEventListener("mousedown",go); };
  }, []);

  useEffect(() => {
    const canvas = cvs.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let rafId = 0;
    const fallback = setTimeout(() => doneRef.current(), 8000);

    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    const easeOut = (t: number) => 1-(1-t)**3;
    const easeIO  = (t: number) => t<0.5 ? 4*t**3 : 1-(-2*t+2)**3/2;

    const fl = { logo:false, sub:false, fd:false, dn:false };
    let t0 = 0;

    function draw(ts: number) {
      try {
        if (!t0) t0 = ts;
        const el  = ts - t0;
        const t   = el / 1000;
        const W   = canvas.width, H = canvas.height;
        const cx  = W / 2,        cy = H / 2;
        const BASE = Math.min(W, H);

        // ── Intro animation progress ─────────────────────────
        const introT  = Math.min(t / 2.0, 1);
        const intro   = easeIO(introT);           // 0→1 en 2 s
        const breath  = 1 + Math.sin(t * 0.60) * 0.014; // respiración suave

        // ── Fondo: gradiente radial azul profundo ─────────────
        const bgX = W * 0.62, bgY = H * 0.28;
        const bg  = ctx.createRadialGradient(bgX, bgY, 0, W*0.5, H*0.5, Math.max(W,H)*0.95);
        bg.addColorStop(0,   "#1a72d8");
        bg.addColorStop(0.18,"#1058b8");
        bg.addColorStop(0.42,"#0a3a8a");
        bg.addColorStop(0.68,"#061a60");
        bg.addColorStop(1,   "#020c3a");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        // ── Esfera grande (primer plano, abajo-centro) ────────
        const sR = BASE * 0.56 * breath;
        const sX = cx + BASE * (W > H ? -0.04 : 0);
        const sY = cy + BASE * (W > H ?  0.20 : 0.28);
        const sS = sR * (0.25 + intro * 0.75);   // escala intro

        // Gradiente interno: highlight arriba-izquierda
        const hlX = sX - sS * 0.28, hlY = sY - sS * 0.32;
        const sG  = ctx.createRadialGradient(hlX, hlY, sS*0.04, sX, sY, sS);
        sG.addColorStop(0,    "#80c8ff");
        sG.addColorStop(0.15, "#48a8f0");
        sG.addColorStop(0.35, "#2280d8");
        sG.addColorStop(0.60, "#1050a8");
        sG.addColorStop(0.82, "#062070");
        sG.addColorStop(1,    "#020c40");

        ctx.save();
        ctx.globalAlpha = intro;
        ctx.beginPath(); ctx.arc(sX, sY, sS, 0, Math.PI*2);
        ctx.fillStyle = sG; ctx.fill();

        // Borde luminoso de la esfera
        ctx.beginPath(); ctx.arc(sX, sY, sS, 0, Math.PI*2);
        const edgeG = ctx.createLinearGradient(sX-sS, sY-sS, sX+sS, sY+sS);
        edgeG.addColorStop(0,   "rgba(120,200,255,0.40)");
        edgeG.addColorStop(0.5, "rgba(60,140,255,0.12)");
        edgeG.addColorStop(1,   "rgba(20,80,200,0.25)");
        ctx.strokeStyle = edgeG;
        ctx.lineWidth   = 2.2;
        ctx.stroke();
        ctx.restore();

        // ── Anillo / Toroide (fondo, arriba) ─────────────────
        const rX  = cx + BASE * (W > H ?  0.06 : 0);
        const rY  = cy + BASE * (W > H ? -0.22 : -0.30);
        const rRx = BASE * 0.31 * breath;
        const rRy = BASE * 0.135 * breath;
        const rS  = 0.25 + intro * 0.75;  // factor escala intro

        ctx.save();
        ctx.globalAlpha = intro;

        // Cuerpo del anillo (zona visible entre borde externo e interno)
        const rGx = rX - rRx * rS * 0.22;
        const rGy = rY - rRy * rS * 0.55;
        const rG  = ctx.createRadialGradient(rGx, rGy, 0, rX, rY, rRx * rS);
        rG.addColorStop(0,   "#3a90e8");
        rG.addColorStop(0.30,"#1a60c8");
        rG.addColorStop(0.60,"#0a3898");
        rG.addColorStop(0.85,"#051a68");
        rG.addColorStop(1,   "#020d40");

        // Dibujar donut con even-odd fill
        ctx.beginPath();
        ctx.ellipse(rX, rY, rRx*rS, rRy*rS, 0, 0, Math.PI*2, false);
        ctx.ellipse(rX, rY, rRx*rS*0.52, rRy*rS*0.52, 0, 0, Math.PI*2, true);
        ctx.fillStyle = rG;
        ctx.fill("evenodd");

        // Agujero oscuro del anillo
        const hG = ctx.createRadialGradient(rX, rY, 0, rX, rY, rRx*rS*0.52);
        hG.addColorStop(0, "#010410");
        hG.addColorStop(1, "#02091e");
        ctx.beginPath(); ctx.ellipse(rX, rY, rRx*rS*0.52, rRy*rS*0.52, 0, 0, Math.PI*2);
        ctx.fillStyle = hG; ctx.fill();

        // Borde exterior del anillo
        ctx.beginPath(); ctx.ellipse(rX, rY, rRx*rS, rRy*rS, 0, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(100,185,255,0.32)";
        ctx.lineWidth   = 1.8;
        ctx.stroke();

        // Borde interior del anillo (borde del agujero)
        ctx.beginPath(); ctx.ellipse(rX, rY, rRx*rS*0.52, rRy*rS*0.52, 0, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(60,120,220,0.25)";
        ctx.lineWidth   = 1.2;
        ctx.stroke();

        ctx.restore();

        // ── Arco de barrido (elemento izquierdo del ref.) ─────
        ctx.save();
        ctx.globalAlpha = intro * 0.38;
        ctx.beginPath();
        ctx.arc(cx - W*0.62, cy + H*0.08, W*0.72, -0.18, 0.52);
        ctx.strokeStyle = "rgba(140,210,255,0.50)";
        ctx.lineWidth   = 2.0;
        ctx.stroke();
        // Segundo arco más interior
        ctx.beginPath();
        ctx.arc(cx - W*0.58, cy + H*0.10, W*0.66, -0.15, 0.48);
        ctx.strokeStyle = "rgba(100,180,255,0.20)";
        ctx.lineWidth   = 1.2;
        ctx.stroke();
        ctx.restore();

        // ── Destellos de luz moviéndose sobre la esfera ───────
        if (intro > 0.3) {
          const glA  = t * 0.28;
          const glX  = sX + Math.cos(glA) * sS * 0.32 - sS*0.10;
          const glY  = sY + Math.sin(glA) * sS * 0.22 - sS*0.20;
          const glR  = sS * 0.38;
          const glG  = ctx.createRadialGradient(glX, glY, 0, glX, glY, glR);
          glG.addColorStop(0, `rgba(220,240,255,${0.13 * (intro-0.3)/0.7})`);
          glG.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glG;
          ctx.beginPath(); ctx.arc(glX, glY, glR, 0, Math.PI*2); ctx.fill();
        }

        // ── Reflejo secundario en la esfera (parte inferior) ──
        if (intro > 0.5) {
          const refX = sX + sS*0.10, refY = sY + sS*0.42;
          const refG = ctx.createRadialGradient(refX, refY, 0, refX, refY, sS*0.28);
          refG.addColorStop(0, `rgba(60,150,255,${0.18 * (intro-0.5)/0.5})`);
          refG.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = refG;
          ctx.beginPath(); ctx.arc(refX, refY, sS*0.28, 0, Math.PI*2); ctx.fill();
        }

        // ── Viñeta perimetral ─────────────────────────────────
        const vig = ctx.createRadialGradient(cx, cy, BASE*0.20, cx, cy, BASE*0.90);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,4,20,0.58)");
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

        // ── Flags UI ──────────────────────────────────────────
        if (el > 2000 && !fl.logo) {
          fl.logo = true; setShow(true);
          if (isAudioReady() && !sf.current) { sf.current=true; soundSplash(); }
        }
        if (el > 2700 && !fl.sub)  { fl.sub=true;  setSub(true);  }
        if (el > 5400 && !fl.fd)   { fl.fd=true;   setFade(true); }
        if (el > 6200 && !fl.dn)   { fl.dn=true;   doneRef.current(); clearTimeout(fallback); }

      } catch(e) { console.error("[Splash]",e); }
      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafId); clearTimeout(fallback); window.removeEventListener("resize",resize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:999, background:BG, overflow:"hidden",
      opacity:fade?0:1, transition:fade?"opacity 0.9s ease":"none",
    }}>
      <canvas ref={cvs} style={{ position:"absolute", inset:0, display:"block" }}/>

      <style>{`
        @keyframes sphereAppear {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.70); }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        }
        @keyframes sphereFloat {
          0%,100% { transform:translate(-50%,-50%) translateY(0px)  rotate(-0.2deg); }
          50%      { transform:translate(-50%,-50%) translateY(-8px) rotate(0.2deg); }
        }
      `}</style>

      {/* Logo centrado entre esfera y anillo */}
      <div style={{
        position:"absolute", left:"50%",
        top: "50%",
        opacity: show ? 1 : 0,
        animation: show
          ? "sphereAppear 1.3s cubic-bezier(0.2,1,0.35,1) forwards, sphereFloat 5s ease-in-out 1.3s infinite"
          : "none",
        filter: "drop-shadow(0 0 40px rgba(60,140,255,0.80)) drop-shadow(0 0 90px rgba(30,100,220,0.45))",
        willChange: "transform",
      }}>
        <Logo360 width={220}/>
      </div>

      {/* Subtítulo */}
      <div style={{
        position:"absolute", left:"50%", top:"calc(50% + 88px)",
        transform:"translateX(-50%)",
        fontFamily:'"DM Sans",system-ui,sans-serif', fontWeight:300,
        fontSize:"clamp(0.54rem,1.25vw,0.78rem)", letterSpacing:"0.60em",
        textTransform:"uppercase", color:"rgba(160,210,255,0.80)",
        textShadow:"0 0 20px rgba(80,160,255,0.55)",
        opacity:sub?1:0, transition:"opacity 1s ease", whiteSpace:"nowrap",
      }}>
        · Vista 360 ·
      </div>
    </div>
  );
}

export default Splash;
