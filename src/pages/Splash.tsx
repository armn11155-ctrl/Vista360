import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const [show, setShow] = useState(false);
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
    set("#0a2a78");
    return () => { set(T.bg); document.documentElement.style.background=""; document.body.style.background=""; };
  }, []);

  // audio
  useEffect(() => {
    const go = () => unlockAudio().then(() => { if (sf.current) return; sf.current=true; soundSplash(); }).catch(()=>{});
    window.addEventListener("touchstart", go, { once:true, passive:true });
    window.addEventListener("mousedown",  go, { once:true });
    return () => { window.removeEventListener("touchstart",go); window.removeEventListener("mousedown",go); };
  }, []);

  // Timers
  useEffect(() => {
    const t1 = setTimeout(() => {
      setShow(true);
      if (isAudioReady() && !sf.current) { sf.current=true; soundSplash(); }
    }, 300);
    const t2 = setTimeout(() => setFade(true), 2800);
    const t3 = setTimeout(() => doneRef.current(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, overflow: "hidden",
      opacity: fade ? 0 : 1,
      transition: fade ? "opacity 0.7s ease" : "none",
    }}>
      {/* Imagen de fondo */}
      <img
        src="/splash-bg.jpg"
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      {/* Logo centrado */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.88)",
        transition: "opacity 0.8s ease, transform 0.8s cubic-bezier(0.2,1,0.4,1)",
      }}>
        <Logo360 width={220}/>
      </div>
    </div>
  );
}

export default Splash;
