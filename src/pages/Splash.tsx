import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo360 } from "../components/layout/Logo360";
import { isAudioReady, soundSplash, unlockAudio } from "../lib/sounds";

interface SplashProps {
  done: () => void;
  onReveal?: () => void;
  /** Devuelve el DOMRect del logo del LoginScreen para alinear el aterrizaje al píxel exacto */
  getLoginLogoRect?: () => DOMRect | null;
}

const BG = "#07101F";

// Transform fallback (CSS puro) si la medición no está lista aún
const FALLBACK_TRANSFORM =
  "translate(-50%, calc(-50% - 7vh + env(safe-area-inset-top, 0px) / 2 - 56px)) scale(0.71)";

function Splash({ done, onReveal, getLoginLogoRect }: SplashProps) {
  const [animating,       setAnimating]       = useState(false);
  const [closing,         setClosing]         = useState(false);
  const [targetTransform, setTargetTransform] = useState(FALLBACK_TRANSFORM);

  const doneRef          = useRef(done);
  const onRevealRef      = useRef(onReveal);
  const getLogoRectRef   = useRef(getLoginLogoRect);
  useEffect(() => { doneRef.current        = done;             }, [done]);
  useEffect(() => { onRevealRef.current    = onReveal;         }, [onReveal]);
  useEffect(() => { getLogoRectRef.current = getLoginLogoRect; }, [getLoginLogoRect]);
  const sf = useRef(false);

  useLayoutEffect(() => {
    // #pre-splash se elimina en useEffect (post-paint) — ver comentario allí.

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

  // Eliminar #pre-splash DESPUÉS del primer paint de React.
  // useLayoutEffect (pre-paint) mantiene ambos <img src="/logo.png"> en el DOM
  // simultáneamente → browser reutiliza imagen decodificada sin gap de 1 frame.
  // useEffect corre post-paint → para ese momento Logo360 ya está pintado.
  useEffect(() => {
    const pre = document.getElementById("pre-splash");
    if (pre) pre.remove();
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

    // ── t=1600ms: calcular posición EXACTA del logo del login y animar ──
    const t1 = setTimeout(() => {
      const rect = getLogoRectRef.current?.();
      if (rect && rect.width > 0) {
        // Centro del logo del login en coordenadas de viewport
        const targetCX = rect.left + rect.width  / 2;
        const targetCY = rect.top  + rect.height / 2;
        // Centro actual del splash logo: top=38%vh, left=50%vw
        const splashCX = window.innerWidth  * 0.5;
        const splashCY = window.innerHeight * 0.38;
        // Delta en píxeles que hay que añadir al translate(-50%,-50%)
        const dx = targetCX - splashCX;
        const dy = targetCY - splashCY;
        setTargetTransform(
          `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.71)`,
        );
      }
      // Si la medición no llegó, setTargetTransform ya tiene FALLBACK_TRANSFORM
      setAnimating(true);
    }, 1600);

    // ── t=2500ms: revelar login AL MISMO TIEMPO que el splash se cierra ──
    // El Login ya tiene opacity:1 antes de que el splash desaparezca (onReveal).
    // La transición del splash es solo 30ms — sub-umbral de percepción (~2 frames).
    // Como el fondo y el logo son visualmente idénticos, el resultado es imperceptible.
    const t2 = setTimeout(() => {
      onRevealRef.current?.();  // Login: opacity 0→1 instantáneo
      setClosing(true);          // Splash: opacity 1→0 en 30ms
    }, 2500);

    // ── t=2530ms: splash completamente transparente, desmontar ──
    const t3 = setTimeout(() => doneRef.current(), 2530);

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
        // 30ms ≈ 2 frames: imperceptible, pero oculta cualquier diferencia sub-pixel
        opacity: closing ? 0 : 1,
        transition: closing ? "opacity 0.03s linear" : "none",
      }}
    >
      {/* Halo superior — mismo que LoginScreen para continuidad visual */}
      <div style={{
        position: "absolute", top: "12%", right: "-20%",
        width: "65%", height: "65%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Halo inferior */}
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
          transform: animating ? targetTransform : "translate(-50%, -50%) scale(1)",
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
