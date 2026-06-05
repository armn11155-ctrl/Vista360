import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // ── Status bar negro durante todo el Splash ─────────────────
  // useLayoutEffect → corre ANTES del primer paint (no useEffect).
  // data-splash en <html> señaliza a useHeaderShell que no toque
  // el theme-color mientras el Splash esté activo.
  useLayoutEffect(() => {
    document.documentElement.dataset.splash = "true";

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
      delete document.documentElement.dataset.splash;
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

  // ── Timers: aparecer logo → salir ─────────────────────────────
  useEffect(() => {
    if (isAudioReady() && !sf.current) { sf.current = true; soundSplash(); }

    // Logo aparece tras 400ms
    const showTimer = setTimeout(() => setShow(true), 400);

    // Fade-out a los 3.2s → done()
    const fadeTimer = setTimeout(() => {
      setFade(true);
      setTimeout(() => doneRef.current(), 700);
    }, 2600);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
    };
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
        transition: fade ? "opacity 0.7s ease" : "none",
      }}
    >
      {/* Franja negra sobre el status bar — tapa cualquier color
           de la imagen que se filtre en el safe-area-inset-top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "env(safe-area-inset-top, 50px)",
          background: "#000000",
          zIndex: 2,
        }}
      />

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

      {/* Logo centrado en el espacio negro superior */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: "env(safe-area-inset-top, 0px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Subir ligeramente para quedar en la zona negra de la imagen
          paddingBottom: "38%",
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.78)",
          transition: "opacity 1s ease, transform 1s cubic-bezier(0.2,1,0.4,1)",
        }}
      >
        <Logo360 width={310} />
      </div>
    </div>
  );
}

export default Splash;
