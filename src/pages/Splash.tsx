import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const SPLASH_BG = "#0D1629";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logoVisible, setLogoVisible]     = useState(false);
  const [subVisible,  setSubVisible]      = useState(false);
  const [fadeOut,     setFadeOut]         = useState(false);
  const doneRef    = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const soundFired = useRef(false);

  useEffect(() => {
    const set = (c: string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name","theme-color"); document.head.appendChild(m); }
      m.setAttribute("content", c);
      document.documentElement.style.background = c;
      document.body.style.background = c;
    };
    set(SPLASH_BG);
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

    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    /* ── Paleta: 3 tonos del tema Vista360 con glow ── */
    const PALETTE: [number,number,number][] = [
      [79,  124, 255],  // #4F7CFF  azul principal
      [0,   212, 255],  // #00D4FF  cyan acento
      [155, 187, 255],  // #9BBBFF  azul suave
    ];

    const N = 30;
    const lines = Array.from({ length: N }, (_, i) => ({
      yRatio: i / (N - 1),
      thick : Math.random() < 0.25 ? 1.6 : 0.8,
      alpha : 0.18 + Math.random() * 0.30,
      delay : i * 30 + Math.random() * 50,
      hue   : PALETTE[Math.floor(Math.random() * PALETTE.length)],
      dots  : (() => {
        const d: number[] = [];
        if (Math.random() < 0.55) d.push(0.06 + Math.random() * 0.28);
        if (Math.random() < 0.40) d.push(0.55 + Math.random() * 0.35);
        return d;
      })(),
    }));

    const T_GROW=800, T_HOLD=100, T_COMPRESS=800;
    const LAST_DELAY = lines[N-1].delay;
    const eOut = (t:number) => 1-(1-t)**3;
    const eIO  = (t:number) => t<0.5 ? 4*t**3 : 1-(-2*t+2)**3/2;

    type Ph = "grow"|"hold"|"compress"|"done";
    let phase:Ph="grow", phaseStart=0;
    const fl = {logo:false,sub:false,sound:false,fade:false,done:false};

    /* Dibuja una línea con glow de dos capas */
    function glowLine(sx:number, ex:number, ly:number, r:number, g:number, b:number, a:number, thick:number) {
      if (ex <= sx) return;
      // Capa exterior: halo ancho
      ctx.save();
      ctx.shadowColor = `rgba(${r},${g},${b},1)`;
      ctx.shadowBlur  = 28;
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(a*1.1,0.55)})`;
      ctx.lineWidth   = thick * 3;
      ctx.beginPath(); ctx.moveTo(sx,ly); ctx.lineTo(ex,ly); ctx.stroke();
      // Núcleo brillante
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(a*4,1)})`;
      ctx.lineWidth   = thick * 0.65;
      ctx.beginPath(); ctx.moveTo(sx,ly); ctx.lineTo(ex,ly); ctx.stroke();
      ctx.restore();
    }

    /* Nodo brillante sobre la línea */
    function glowDot(dx:number, ly:number, r:number, g:number, b:number, a:number) {
      ctx.save();
      ctx.shadowColor = `rgba(${r},${g},${b},1)`;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = `rgba(255,255,255,${Math.min(a*5,1)})`;
      ctx.beginPath(); ctx.arc(dx,ly,2.8,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function draw(ts:number) {
      if (!phaseStart) phaseStart=ts;
      const el=ts-phaseStart, W=canvas!.width, H=canvas!.height, cx=W/2, cy=H/2;

      ctx.fillStyle=SPLASH_BG; ctx.fillRect(0,0,W,H);

      // Líneas de regla estáticas (muy sutiles)
      const ls=Math.max(Math.floor(H/34),18);
      ctx.lineWidth=0.4; ctx.strokeStyle="rgba(79,124,255,0.04)";
      for(let y=ls;y<H;y+=ls){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      lines.forEach(line=>{
        const baseY=line.yRatio*H;
        let sx:number,ex:number,ly:number,a:number;

        if(phase==="grow"){
          const le=el-line.delay; if(le<=0)return;
          const t=Math.min(le/T_GROW,1);
          sx=0; ex=eOut(t)*(W+80); ly=baseY; a=line.alpha;
        } else if(phase==="hold"){
          sx=0; ex=W+80; ly=baseY; a=line.alpha;
        } else if(phase==="compress"){
          const t=Math.min(el/T_COMPRESS,1), et=eIO(t);
          sx=et*(cx-60); ex=W+80-et*(W+80-cx-60);
          ly=baseY-(baseY-cy)*et*0.21;
          a=line.alpha*(et>0.62?1-(et-0.62)/0.38:1);
        } else { return; }

        if(a<0.004)return;
        const [r,g,b]=line.hue;
        glowLine(sx,ex,ly,r,g,b,a,line.thick);
        if(a>0.04) line.dots.forEach(ratio=>glowDot(sx+(ex-sx)*ratio,ly,r,g,b,a));
      });

      // Viñeta
      const vig=ctx.createRadialGradient(cx,cy,H*0.04,cx,cy,H*0.82);
      vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.5)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      // Halo central al comprimir
      if(phase==="compress"||phase==="done"){
        const ct=phase==="done"?1:Math.min(el/T_COMPRESS,1);
        const ga=eIO(ct)*0.12;
        const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(W,H)*0.38);
        glow.addColorStop(0,`rgba(79,124,255,${ga})`);
        glow.addColorStop(1,"rgba(79,124,255,0)");
        ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
      }

      if(phase==="grow"&&el>T_GROW+LAST_DELAY+50){ phase="hold"; phaseStart=ts; }
      else if(phase==="hold"&&el>T_HOLD){
        phase="compress"; phaseStart=ts;
        if(isAudioReady()&&!fl.sound){fl.sound=true;soundFired.current=true;soundSplash();}
      } else if(phase==="compress"){
        const ct=el/T_COMPRESS;
        if(ct>0.35&&!fl.logo){fl.logo=true;setLogoVisible(true);}
        if(ct>0.55&&!fl.sub){fl.sub=true;setSubVisible(true);}
        if(ct>=1){phase="done";phaseStart=ts;}
      } else if(phase==="done"){
        if(el>700&&!fl.fade){fl.fade=true;setFadeOut(true);}
        if(el>1200&&!fl.done){fl.done=true;doneRef.current();}
      }
      animId=requestAnimationFrame(draw);
    }
    animId=requestAnimationFrame(draw);
    return ()=>{ cancelAnimationFrame(animId); window.removeEventListener("resize",resize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:SPLASH_BG,overflow:"hidden",
      opacity:fadeOut?0:1,transition:fadeOut?"opacity 0.6s cubic-bezier(.4,0,.2,1)":"none"}}>
      <canvas ref={canvasRef} style={{position:"absolute",inset:0,display:"block"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",pointerEvents:"none",userSelect:"none"}}>
        <div style={{
          opacity:logoVisible?1:0,
          transform:logoVisible?"scale(1) translateY(0)":"scale(0.8) translateY(16px)",
          transition:logoVisible?"opacity 1.1s ease,transform 1.1s cubic-bezier(0.2,1,0.35,1)":"none",
          filter:"drop-shadow(0 0 40px rgba(79,124,255,0.6)) drop-shadow(0 0 14px rgba(0,212,255,0.4))",
        }}>
          <Logo360 width={220}/>
        </div>
        <div style={{
          width:logoVisible?"min(280px,55vw)":0, height:1,
          background:"linear-gradient(90deg,transparent,rgba(79,124,255,0.6),transparent)",
          margin:"20px auto 16px",
          transition:logoVisible?"width 1.05s cubic-bezier(0.4,0,0.2,1) 0.2s":"none",
        }}/>
        <div style={{
          fontFamily:'"DM Sans",system-ui,sans-serif',fontWeight:300,
          fontSize:"clamp(0.58rem,1.5vw,0.85rem)",letterSpacing:"0.55em",
          textTransform:"uppercase" as const,color:"#9BBBFF",
          opacity:subVisible?1:0,transition:subVisible?"opacity 0.9s ease 0.35s":"none",
        }}>
          · Vista360 ·
        </div>
      </div>
    </div>
  );
}

export default Splash;
