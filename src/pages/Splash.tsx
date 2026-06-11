import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

const BG = "#07101F";

function Splash({ done }: SplashProps) {
  const [animating, setAnimating] = useState(false);
  const [closing,   setClosing]   = useState(false); // micro-fade 100ms
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const sf = useRef(false);

  useLayoutEffect(() => {
    const pre = document.getElementById("pre-splash");
    if (pre) pre.remove();

    let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute("content", BG);
    document.documentElement.style.background = BG;
    document.body.style.background = BG;

    return () => {
      m.setAttribute("content", "#0E1A3B");
      document.documentElement.style.background = "#0E1A3B";
      document.body.style.background = "#0E1A3B";
    };
  }, []);

  useEffect(() => {
    const go = () =>
      unlockAudio()
        .then(() => { if (sf.current) return; sf.current = true; soundSplash(); })
        .catch(() => {});
    window.addEventListener("touchstart", go, { once: true, passive: true });
    window.addEventListener("mousedown",  go, { once: true });
    return () => {
      window.removeEventListener("touchstart", go);
      window.removeEventListener("mousedown",  go);
    };
  }, []);

  useEffect(() => {
    if (isAudioReady() && !sf.current) { sf.current = true; soundSplash(); }

    // 1600ms → arranca la animación del logo hacia el login
    const t1 = setTimeout(() => setAnimating(true), 1600);

    // 2500ms → animación completa; inicia micro-fade de 100ms
    // A 100ms el cerebro no percibe "pantalla en negro/azul", pero
    // oculta el salto de 1 frame entre la posición del splash y la del login.
    const t2 = setTimeout(() => setClosing(true), 2500);

    // 2600ms → splash en opacity:0, se desmonta y monta el login
    const t3 = setTimeout(() => doneRef.current(), 2600);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
        zIndex: 999,
        background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
        overflow: "hidden",
        // Micro-fade: 100ms es imperceptible como "pantalla azul"
        // pero elimina el corte de 1 frame del logo
        opacity: closing ? 0 : 1,
        transition: closing ? "opacity 0.1s linear" : "none",
      }}
    >
      {/* Halos */}
      <div style={{
        position: "absolute", top: "12%", right: "-20%",
        width: "65%", height: "65%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", left: "-15%",
        width: "55%", height: "50%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.13) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          top: "38%", left: "50%",
          transformOrigin: "50% 50%",
          transform: animating
            ? "translate(-50%, calc(-50% - 7vh + env(safe-area-inset-top, 0px) / 2 - 56px)) scale(0.71)"
            : "translate(-50%, -50%) scale(1)",
          transition: animating
            ? "transform 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            : "none",
          filter: "drop-shadow(0 0 28px rgba(37,99,235,.32))",
          zIndex: 1,
        }}
      >
        <Logo360 width={310} />
      </div>
    </div>
  );
}

export default Splash;
