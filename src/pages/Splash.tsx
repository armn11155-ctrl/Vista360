import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const BG = "#00020c";
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
      m.setAttribute("content",c); document.documentElement.style.background=c; document.body.style.background=c;
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
    const ctx = canvas.getContext("2d")!;
    let id: number;
    const rs = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    rs(); window.addEventListener("resize", rs);

    // ── Semilla de estrellas (generadas una sola vez) ──────────────
    const SM = Array.from({ length:320 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.35 + Math.random()*1.3,
      a: 0.25 + Math.random()*0.65,
      sp: 0.6 + Math.random()*2.2,
      ph: Math.random()*Math.PI*2,
      col: Math.random()<0.12 ? "180,210,255" : Math.random()<0.08 ? "255,238,195" : "255,255,255",
    }));

    const MD = Array.from({ length:40 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 1.8 + Math.random()*3.5,
      a: 0.55 + Math.random()*0.4,
      sp: 0.25 + Math.random()*0.9,
      ph: Math.random()*Math.PI*2,
      col: Math.random()<0.25 ? "150,195,255" : "255,255,255",
      gr: 2.5 + Math.random()*2,
    }));

    const LG = Array.from({ length:14 }, () => ({
      x: 0.05 + Math.random()*0.90,
      y: 0.05 + Math.random()*0.90,
      r: 5 + Math.random()*9,
      a: 0.75 + Math.random()*0.25,
      sp: 0.15 + Math.random()*0.4,
      ph: Math.random()*Math.PI*2,
      col: Math.random()<0.28 ? "160,200,255" : Math.random()<0.12 ? "255,235,160" : "255,255,255",
      spikes: Math.random() < 0.6,
    }));

    // ── Nebulosas (gradientes fijas muy tenues) ────────────────────
    const NEB = [
      { x:0.22, y:0.30, rx:0.32, ry:0.22, col:"50,80,180",  a:0.055 },
      { x:0.75, y:0.65, rx:0.28, ry:0.20, col:"80,30,140",  a:0.040 },
      { x:0.50, y:0.15, rx:0.25, ry:0.15, col:"20,60,160",  a:0.035 },
    ];

    // ── Estrella fugaz ─────────────────────────────────────────────
    let shoot = { active:false, x:0,y:0, vx:0,vy:0, life:0, maxLife:0 };
    let nextShoot = 3.2;

    const fl = { logo:false, sub:false, fd:false, dn:false };
    let t0 = 0;

    function drawSmall(t: number) {
      const W=canvas!.width, H=canvas!.height;
      SM.forEach(s => {
        const tw = 0.30 + 0.70*Math.abs(Math.sin(t*s.sp+s.ph));
        ctx.fillStyle = `rgba(${s.col},${(s.a*tw).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
      });
    }

    function drawMedium(t: number) {
      const W=canvas!.width, H=canvas!.height;
      MD.forEach(s => {
        const tw = 0.45 + 0.55*Math.abs(Math.sin(t*s.sp+s.ph));
        const a  = s.a*tw;
        const gx = s.x*W, gy = s.y*H;
        const g = ctx.createRadialGradient(gx,gy,0, gx,gy, s.r*s.gr);
        g.addColorStop(0, `rgba(${s.col},${(a).toFixed(2)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,gy,s.r*s.gr,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${(a*0.95).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(gx,gy,s.r*0.35,0,Math.PI*2); ctx.fill();
      });
    }

    function drawLarge(t: number) {
      const W=canvas!.width, H=canvas!.height;
      LG.forEach(s => {
        const tw = 0.60 + 0.40*Math.abs(Math.sin(t*s.sp+s.ph));
        const a  = s.a*tw;
        const gx = s.x*W, gy = s.y*H;
        // Halo exterior grande
        const h1=ctx.createRadialGradient(gx,gy,0, gx,gy, s.r*7);
        h1.addColorStop(0, `rgba(${s.col},${(a*0.35).toFixed(2)})`);
        h1.addColorStop(0.35,`rgba(${s.col},${(a*0.10).toFixed(2)})`);
        h1.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle=h1; ctx.beginPath(); ctx.arc(gx,gy,s.r*7,0,Math.PI*2); ctx.fill();
        // Halo interior
        const h2=ctx.createRadialGradient(gx,gy,0, gx,gy, s.r*2.2);
        h2.addColorStop(0, `rgba(${s.col},${(a*0.90).toFixed(2)})`);
        h2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle=h2; ctx.beginPath(); ctx.arc(gx,gy,s.r*2.2,0,Math.PI*2); ctx.fill();
        // Núcleo
        ctx.fillStyle=`rgba(255,255,255,${a.toFixed(2)})`;
        ctx.beginPath(); ctx.arc(gx,gy,s.r*0.25,0,Math.PI*2); ctx.fill();
        // Spikes en cruz
        if (s.spikes) {
          ctx.save();
          ctx.strokeStyle=`rgba(255,255,255,${(a*0.30).toFixed(2)})`;
          ctx.lineWidth=0.6;
          [0,Math.PI/2,Math.PI/4,Math.PI*3/4].forEach(ang => {
            const len=s.r*6*tw;
            ctx.beginPath();
            ctx.moveTo(gx-Math.cos(ang)*1,gy-Math.sin(ang)*1);
            ctx.lineTo(gx+Math.cos(ang)*len,gy+Math.sin(ang)*len);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx-Math.cos(ang)*1,gy-Math.sin(ang)*1);
            ctx.lineTo(gx-Math.cos(ang)*len,gy-Math.sin(ang)*len);
            ctx.stroke();
          });
          ctx.restore();
        }
      });
    }

    function draw(ts: number) {
      if (!t0) t0=ts;
      const el=ts-t0, t=el/1000;
      const W=canvas!.width, H=canvas!.height;

      // Fondo espacio
      ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);

      // Nebulosas
      NEB.forEach(n => {
        ctx.save();
        ctx.scale(1, n.ry/n.rx);
        const g=ctx.createRadialGradient(n.x*W,n.y*H/( n.ry/n.rx),0, n.x*W,n.y*H/(n.ry/n.rx),n.rx*W);
        g.addColorStop(0,`rgba(${n.col},${n.a})`);
        g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(n.x*W,n.y*H/(n.ry/n.rx),n.rx*W,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });

      drawSmall(t);
      drawMedium(t);
      drawLarge(t);

      // Estrella fugaz
      if (t > nextShoot && !shoot.active) {
        const edge = Math.random()<0.5;
        shoot = {
          active:true,
          x: edge ? 0 : Math.random()*W,
          y: edge ? Math.random()*H*0.5 : 0,
          vx:(2+Math.random()*3)*W*0.001,
          vy:(1+Math.random()*2)*H*0.001,
          life:0, maxLife:60+Math.random()*40,
        };
        nextShoot = t + 2.5 + Math.random()*4;
      }
      if (shoot.active) {
        shoot.life++;
        const prog=shoot.life/shoot.maxLife;
        const alpha=(1-prog)*0.85;
        const tailLen=80+prog*40;
        ctx.save();
        ctx.strokeStyle=`rgba(220,235,255,${alpha.toFixed(2)})`;
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(shoot.x,shoot.y);
        ctx.lineTo(shoot.x-shoot.vx*tailLen,shoot.y-shoot.vy*tailLen);
        ctx.stroke();
        ctx.restore();
        shoot.x+=shoot.vx*3; shoot.y+=shoot.vy*3;
        if (shoot.life>=shoot.maxLife) shoot.active=false;
      }

      // Viñeta suave
      const vig=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.82);
      vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,8,0.65)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      // Flags
      if(el>1800&&!fl.logo){fl.logo=true;setShow(true);if(isAudioReady()&&!sf.current){sf.current=true;soundSplash();}}
      if(el>2400&&!fl.sub) {fl.sub=true;setSub(true);}
      if(el>5200&&!fl.fd)  {fl.fd=true;setFade(true);}
      if(el>5900&&!fl.dn)  {fl.dn=true;doneRef.current();}

      id=requestAnimationFrame(draw);
    }
    id=requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize",rs); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position:"fixed",inset:0,zIndex:999,background:BG,overflow:"hidden",
      opacity:fade?0:1,transition:fade?"opacity 0.8s ease":"none" }}>
      <canvas ref={cvs} style={{ position:"absolute",inset:0,display:"block" }}/>
      <style>{`
        @keyframes starAppear{from{opacity:0;transform:translate(-50%,-50%) scale(0.6);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
        @keyframes starFloat{0%,100%{transform:translate(-50%,-50%) translateY(0);}50%{transform:translate(-50%,-50%) translateY(-8px);}}
      `}</style>
      <div style={{ position:"absolute",left:"50%",top:"50%",
        opacity:show?1:0,
        animation:show?"starAppear 1.4s cubic-bezier(0.2,1,0.35,1) forwards,starFloat 5s ease-in-out 1.4s infinite":"none",
        filter:"drop-shadow(0 0 50px rgba(140,190,255,0.70)) drop-shadow(0 0 120px rgba(80,130,255,0.35))",
        willChange:"transform",
      }}>
        <Logo360 width={220}/>
      </div>
      <div style={{ position:"absolute",left:"50%",top:"calc(50% + 85px)",transform:"translateX(-50%)",
        fontFamily:'"DM Sans",system-ui,sans-serif',fontWeight:300,
        fontSize:"clamp(0.55rem,1.3vw,0.78rem)",letterSpacing:"0.60em",
        textTransform:"uppercase",color:"rgba(180,210,255,0.75)",
        textShadow:"0 0 18px rgba(100,160,255,0.5)",
        opacity:sub?1:0,transition:"opacity 1s ease",whiteSpace:"nowrap",
      }}>· Vista 360 ·</div>
    </div>
  );
}

export default Splash;
