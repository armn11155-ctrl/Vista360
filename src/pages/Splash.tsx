import { useEffect, useRef, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

function Splash({ done }: SplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [show,    setShow]  = useState(false);
  const [fade,    setFade]  = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const doneRef = useRef(done);
  useEffect(() => { doneRef.current = done; }, [done]);
  const sf = useRef(false);

  // ── Status bar: transparente para que el video se vea bajo él ──
  useEffect(() => {
    const set = (c: string) => {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!m) {
        m = document.createElement("meta");
        m.setAttribute("name", "theme-color");
        document.head.appendChild(m);
      }
      m.setAttribute("content", c);
      document.documentElement.style.background = c;
      document.body.style.background = c;
    };
    // Color transparente/oscuro para que el status bar no tape el video
    set("#000000");
    return () => {
      set(T.bg);
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  // ── Audio unlock ───────────────────────────────────────────────
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

  // ── Video + timers ─────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Fallback garantizado: si el video falla, la app igual carga
    const fallback = setTimeout(() => doneRef.current(), 12000);

    // Mostrar logo al empezar a reproducir
    const onPlay = () => {
      setVideoOk(true);
      setTimeout(() => setShow(true), 200);
      if (isAudioReady() && !sf.current) { sf.current = true; soundSplash(); }
    };

    // Al terminar el video → fade → done()
    const onEnded = () => {
      setFade(true);
      setTimeout(() => { doneRef.current(); clearTimeout(fallback); }, 700);
    };

    // Si el video tarda más de 10s, igual salimos
    const maxTimer = setTimeout(() => {
      setFade(true);
      setTimeout(() => { doneRef.current(); clearTimeout(fallback); }, 700);
    }, 10500);

    video.addEventListener("playing", onPlay);
    video.addEventListener("ended",   onEnded);

    // Iniciar reproducción
    video.play().catch(() => {
      // Si autoplay falla (sin gesto del usuario), mostrar imagen estática
      setShow(true);
      setTimeout(() => {
        setFade(true);
        setTimeout(() => { doneRef.current(); clearTimeout(fallback); }, 700);
      }, 2500);
    });

    return () => {
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("ended",   onEnded);
      clearTimeout(fallback);
      clearTimeout(maxTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: "fixed",
        // Extendemos hasta fuera del safe-area para cubrir status bar
        top: 0, left: 0, right: 0, bottom: 0,
        // Usar margin negativo + padding para cubrir safe areas en iOS
        marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
        zIndex: 999,
        background: "#000",
        overflow: "hidden",
        opacity: fade ? 0 : 1,
        transition: fade ? "opacity 0.7s ease" : "none",
      }}
    >
      {/* Video de fondo — cubre TODO incluyendo status bar */}
      <video
        ref={videoRef}
        src="/splash-video.mp4"
        muted
        playsInline          // imprescindible en iOS para autoplay
        preload="auto"
        disablePictureInPicture
        style={{
          position: "absolute",
          // Extender arriba para cubrir el status bar
          top: "calc(-1 * env(safe-area-inset-top, 0px))",
          left: 0,
          width: "100%",
          // Añadir altura del status bar al alto total
          height: "calc(100% + env(safe-area-inset-top, 0px))",
          objectFit: "cover",
          objectPosition: "center top",
        }}
      />

      {/* Logo — centrado dentro del área visual (respeta safe area) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // Padding top para que el logo no quede bajo el status bar
          paddingTop: "env(safe-area-inset-top, 0px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.82)",
          transition: "opacity 0.9s ease, transform 0.9s cubic-bezier(0.2,1,0.4,1)",
        }}
      >
        <Logo360 width={260} />
      </div>
    </div>
  );
}

export default Splash;
