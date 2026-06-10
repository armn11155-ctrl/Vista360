import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  // Arranca en true: el logo ya está visible desde el primer frame,
  // sin hueco respecto al pre-splash del HTML estático.
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const sf = useRef(false);

  // ── useLayoutEffect: corre ANTES de que el browser pinte ──────
  // Elimina el pre-splash y fija colores sin ningún frame de diferencia.
  useLayoutEffect(() => {
    // Quitar el pre-splash del HTML estático — React ya toma el control
    const pre = document.getElementById("pre-splash");
    if (pre) pre.remove();

    let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute("content", "#000000");
    document.documentElement.style.background = "#000000";
    document.body.style.background = "#000000";

    return () => {
      m.setAttribute("content", "#0E1A3B");
      document.documentElement.style.background = "#0E1A3B";
      document.body.style.background = "#0E1A3B";
    };
  }, []);

  // ── Audio unlock ──────────────────────────────────────────────
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

  // ── Timer de salida ───────────────────────────────────────────
  useEffect(() => {
    if (isAudioReady() && !sf.current) { sf.current = true; soundSplash(); }

    // Fade-out a los 2800ms → done() a los 3300ms
    const fadeTimer = setTimeout(() => {
      setFade(true);
      setTimeout(() => doneRef.current(), 500);
    }, 2800);

    return () => clearTimeout(fadeTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
        zIndex: 999,
        background: "#000",
        overflow: "hidden",
        opacity: fade ? 0 : 1,
        transition: fade ? "opacity 0.5s ease" : "none",
      }}
    >
      {/* Imagen de fondo — Tierra desde el espacio */}
      <img
        src="/splash-bg.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "calc(-1 * env(safe-area-inset-top, 0px))",
          left: 0,
          width: "100%",
          height: "calc(100% + env(safe-area-inset-top, 0px))",
          objectFit: "cover",
          objectPosition: "center bottom",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Logo — visible desde el primer frame, sin animación de entrada */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: "env(safe-area-inset-top, 0px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: "38%",
          opacity: show ? 1 : 0,
        }}
      >
        <Logo360 width={310} />
      </div>
    </div>
  );
}

export default Splash;
