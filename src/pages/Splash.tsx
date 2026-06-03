import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

const BG = "#010b18";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const cvs   = useRef<HTMLCanvasElement>(null);
  const [show, setShow]   = useState(false);   // logo visible
  const [sub,  setSub]    = useState(false);   // subtitle
  const [fade, setFade]   = useState(false);
  const doneRef = useRef(done);
  useEffect(()=>{ doneRef.current=done; },[done]);
  const sf = useRef(false);

  // ── theme-color ─────────────────────────────────────────
  useEffect(() => {
    const set = (c:string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}
      m.setAttribute("content",c);document.documentElement.style.background=c;document.body.style.background=c;
    };
    set(BG);
    return ()=>{set(T.bg);document.documentElement.style.background="";document.body.style.background="";};
  },[]);

  // ── audio ────────────────────────────────────────────────
  useEffect(()=>{
    const go=()=>unlockAudio().then(()=>{if(sf.current)return;sf.current=true;soundSplash();}).catch(()=>{});
    window.addEventListener("touchstart",go,{once:true,passive:true});
    window.addEventListener("mousedown",go,{once:true});
    return ()=>{window.removeEventListener("touchstart",go);window.removeEventListener("mousedown",go);};
  },[]);

  /* ── canvas ocean ─────────────────────────────────────── */
  useEffect(()=>{
    const canvas = cvs.current; if (!canvas) return;
    const ctx    = canvas.getContext("2d")!;
    let id: number;
    const rs = ()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    rs(); window.addEventListener("resize",rs);

    /* Estrellas */
    const STARS = Array.from({length:90},()=>({
      x: Math.random(), y: Math.random()*0.40,
      r: 0.4+Math.random()*1.1, p: Math.random()*Math.PI*2,
    }));

    /* Destellos en el agua (caustics) */
    const CAUS = Array.from({length:28},()=>{
      const row = Math.random();
      return {
        x: Math.random(), y: 0.46+row*0.54,
        rx:18+Math.random()*55, ry:4+Math.random()*12,
        p: Math.random()*Math.PI*2, sp:0.15+Math.random()*0.4,
      };
    });

    /* Partículas de espuma */
    const FOAM = Array.from({length:18},()=>{
      const side = Math.random()<0.5?-1:1;
      return {
        ox:side*(0.04+Math.random()*0.12), oy:-0.01+Math.random()*0.03,
        r:1+Math.random()*2, p:Math.random()*Math.PI*2, sp:0.6+Math.random()*0.5,
      };
    });

    /* Olas — altura en Y dado X y tiempo */
    function wy(x:number, baseY:number, t:number, amp=1):number{
      return baseY
        +Math.sin(x*0.007 +t*0.50)*24*amp
        +Math.sin(x*0.015 -t*0.38+1.2)*13*amp
        +Math.sin(x*0.031 +t*0.80+2.5)*7*amp
        +Math.sin(x*0.004 +t*0.18)*32*amp;
    }

    const fl={logo:false,sub:false,fd:false,dn:false};
    let t0=0;

    function draw(ts:number){
      if(!t0)t0=ts;
      const el=ts-t0, t=el/1000;
      const W=canvas!.width, H=canvas!.height, cx=W/2;

      /* ─ Cielo ─ */
      const sky=ctx.createLinearGradient(0,0,0,H*0.50);
      sky.addColorStop(0,"#000810");
      sky.addColorStop(0.55,"#011628");
      sky.addColorStop(1,"#052040");
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.50);

      /* Estrellas */
      STARS.forEach(s=>{
        const tw=0.35+0.65*Math.abs(Math.sin(t*1.4+s.p));
        ctx.fillStyle=`rgba(210,225,255,${(tw*0.85).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2); ctx.fill();
      });

      /* ─ Océano (fondo) ─ */
      const horizY=H*0.44;
      const sea=ctx.createLinearGradient(0,horizY,0,H);
      sea.addColorStop(0,  "#0e3468");
      sea.addColorStop(0.18,"#082242");
      sea.addColorStop(0.55,"#051530");
      sea.addColorStop(1,  "#020b1e");
      ctx.fillStyle=sea; ctx.fillRect(0,horizY,W,H-horizY);

      /* Caustics */
      ctx.save(); ctx.globalCompositeOperation="screen";
      CAUS.forEach(c=>{
        const cx2=c.x*W+Math.sin(t*c.sp+c.p)*18;
        const cy2=c.y*H+Math.sin(t*c.sp*1.3+c.p+1)*9;
        const a=0.028+0.038*Math.abs(Math.sin(t*c.sp*0.7+c.p));
        const g=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,c.rx);
        g.addColorStop(0,`rgba(40,120,210,${a.toFixed(3)})`)
        g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.ellipse(cx2,cy2,c.rx,c.ry,0,0,Math.PI*2); ctx.fill();
      });
      ctx.restore();

      /* ─ Capas de olas ─ */
      const WAVE_COLS=[
        "rgba(14,52,118,0.28)","rgba(18,65,138,0.22)","rgba(25,80,155,0.16)",
        "rgba(32,100,172,0.11)","rgba(55,135,195,0.07)",
      ];
      for(let lyr=WAVE_COLS.length-1;lyr>=0;lyr--){
        ctx.beginPath();
        for(let x=0;x<=W;x+=3){
          const y=wy(x,horizY,t)+lyr*4;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
        ctx.fillStyle=WAVE_COLS[lyr]; ctx.fill();
      }

      /* Bordes brillantes en las crestas */
      for(let i=0;i<3;i++){
        ctx.beginPath();
        for(let x=0;x<=W;x+=3){
          const y=wy(x,horizY,t+i*0.25);
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.strokeStyle=`rgba(120,200,255,${(0.07-i*0.02).toFixed(2)})`;
        ctx.lineWidth=1; ctx.stroke();
      }

      /* ─ Reflejo del logo en el agua ─ */
      if(show){
        const logoSurfY=wy(cx,horizY,t);
        const refGrad=ctx.createLinearGradient(0,logoSurfY+10,0,logoSurfY+110);
        refGrad.addColorStop(0,"rgba(80,160,255,0.22)");
        refGrad.addColorStop(1,"rgba(80,160,255,0)");
        ctx.fillStyle=refGrad;
        ctx.beginPath(); ctx.ellipse(cx,logoSurfY+55,80,30,0,0,Math.PI*2); ctx.fill();

        /* Espuma alrededor del logo */
        FOAM.forEach(f=>{
          const fx=cx+f.ox*W+Math.sin(t*f.sp+f.p)*6;
          const fy=logoSurfY+f.oy*H+Math.cos(t*f.sp*1.2+f.p)*4;
          const fa=0.25+0.35*Math.abs(Math.sin(t*f.sp+f.p));
          ctx.fillStyle=`rgba(200,230,255,${fa.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(fx,fy,f.r,0,Math.PI*2); ctx.fill();
        });

        /* Anillos de onda que emanan del logo */
        for(let r=0;r<3;r++){
          const phase=(t*0.5+r*0.33)%1;
          const radius=40+phase*120;
          const alpha=(1-phase)*0.12;
          ctx.strokeStyle=`rgba(80,160,255,${alpha.toFixed(3)})`;
          ctx.lineWidth=1;
          ctx.beginPath(); ctx.ellipse(cx,logoSurfY+6,radius,radius*0.28,0,0,Math.PI*2); ctx.stroke();
        }
      }

      /* ─ Brillo en el horizonte ─ */
      const hg=ctx.createLinearGradient(0,horizY-20,0,horizY+25);
      hg.addColorStop(0,"rgba(0,0,0,0)");
      hg.addColorStop(0.5,"rgba(15,70,155,0.18)");
      hg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=hg; ctx.fillRect(0,horizY-20,W,45);

      /* ─ Viñeta ─ */
      const vig=ctx.createRadialGradient(cx,H*0.5,H*0.2,cx,H*0.5,H*0.82);
      vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.62)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      /* ─ Flags ─ */
      if(el>1300&&!fl.logo){fl.logo=true;setShow(true);}
      if(el>1900&&!fl.sub) {fl.sub =true;setSub(true); }
      if(el>4400&&!fl.fd)  {fl.fd  =true;setFade(true);}
      if(el>5000&&!fl.dn)  {fl.dn  =true;doneRef.current();}

      id=requestAnimationFrame(draw);
    }

    id=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(id);window.removeEventListener("resize",rs);};
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  return(
    <div style={{position:"fixed",inset:0,zIndex:999,background:BG,overflow:"hidden",
      opacity:fade?0:1,transition:fade?"opacity 0.7s cubic-bezier(.4,0,.2,1)":"none"}}>
      <canvas ref={cvs} style={{position:"absolute",inset:0,display:"block"}}/>

      <style>{`
        @keyframes oceanBob{
          0%,100%{transform:translate(-50%,-50%) translateY(0px) rotate(-0.4deg);}
          50%     {transform:translate(-50%,-50%) translateY(-14px) rotate(0.4deg);}
        }
        @keyframes fadeRise{
          from{opacity:0;transform:translate(-50%,-50%) translateY(30px);}
          to  {opacity:1;transform:translate(-50%,-50%) translateY(0px);}
        }
      `}</style>

      {/* Logo flotando en el horizonte */}
      <div style={{
        position:"absolute", left:"50%", top:"44%",
        transform:"translate(-50%,-50%)",
        opacity:show?1:0,
        animation:show?"fadeRise 1.2s cubic-bezier(0.2,1,0.35,1) forwards, oceanBob 4s ease-in-out 1.2s infinite":"none",
        filter:"drop-shadow(0 6px 24px rgba(0,140,255,0.55)) drop-shadow(0 0 50px rgba(0,100,200,0.35))",
        willChange:"transform",
      }}>
        <Logo360 width={200}/>
      </div>

      {/* Subtítulo */}
      <div style={{
        position:"absolute", left:"50%", top:"calc(44% + 80px)",
        transform:"translateX(-50%)",
        fontFamily:'"DM Sans",system-ui,sans-serif', fontWeight:300,
        fontSize:"clamp(0.55rem,1.3vw,0.80rem)", letterSpacing:"0.58em",
        textTransform:"uppercase" as const, color:"rgba(140,200,255,0.80)",
        textShadow:"0 0 16px rgba(0,140,255,0.5)",
        opacity:sub?1:0, transition:sub?"opacity 1s ease":"none",
        whiteSpace:"nowrap",
      }}>
        · Vista360 ·
      </div>
    </div>
  );
}

export default Splash;
