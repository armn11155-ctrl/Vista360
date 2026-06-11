import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps { done: () => void; }

const BG = "#07101F";

function Splash({ done }: SplashProps) {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
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
        /* Mismo gradiente exacto que LoginScreen */
        background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: fade ? 0 : 1,
        transition: fade ? "opacity 0.5s ease" : "none",
      }}
    >
      {/* ── Halos: mismas posiciones/tamaños/opacidades que LoginScreen ── */}
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

      {/* ── Logo centrado en pantalla completa ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "env(safe-area-inset-top, 0px)",
        position: "relative",
      }}>
        <div style={{
          filter: "drop-shadow(0 0 28px rgba(37,99,235,.32))",
          position: "relative",
          zIndex: 1,
          opacity: show ? 1 : 0,
        }}>
          <Logo360 width={310} />
        </div>
      </div>
    </div>
  );
}

export default Splash;
