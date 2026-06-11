import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

const BG = "#07101F";

function Splash({ done }: SplashProps) {
  const [animating, setAnimating] = useState(false);
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

    // 1600ms: arranca la animación del logo hacia la posición del login
    const animTimer = setTimeout(() => setAnimating(true), 1600);

    // 2500ms: animación completa → desaparece el splash SIN fade
    // El login ya está renderizado debajo con el mismo fondo → transición invisible
    const doneTimer = setTimeout(() => doneRef.current(), 2500);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(doneTimer);
    };
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
        // Sin opacity/transition: el splash desaparece instantáneamente
        // cuando done() se llama, sin dejar pantalla azul visible
      }}
    >
      {/* ── Halos ── */}
      <div style={{
        position: "absolute",
        top: "12%", right: "-20%",
        width: "65%", height: "65%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: "-20%", left: "-15%",
        width: "55%", height: "50%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.13) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/*
        Logo: arranca al 38% del top, centrado.
        Animación al login:
          • translateY: se mueve exactamente a donde está el logo en LoginScreen.
            Fórmula: -(7vh - safe-area-inset-top/2 + 56px)
            Los 56px compensan el centrado del contenido (logo+saludo) dentro del 62%.
          • scale(0.71): 310px → 220px, el width exacto del logo en login.
      */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: "50%",
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
