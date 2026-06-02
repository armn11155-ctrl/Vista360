import { useEffect, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";
import { soundSplash } from "../lib/sounds";

/** Color del splash — debe coincidir con T.dark */
const SPLASH_BG = "#0D1629";

interface SplashProps {
  done: () => void;
}

function Splash({ done }: SplashProps) {
  const [f, setF] = useState(0);

  // ── Clava el theme-color al color del splash mientras está visible,
  //    y lo restaura al terminar para que useHeaderShell tome el control.
  useEffect(() => {
    const setTheme = (color: string) => {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", color);
      document.documentElement.style.background = color;
      document.body.style.background = color;
    };

    // Al montar: color del splash
    setTheme(SPLASH_BG);

    return () => {
      // Al desmontar: devuelve el color de la app (useHeaderShell lo
      // sobreescribirá enseguida con el color de la ruta activa)
      setTheme(T.bg);
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  useEffect(() => {
    const ts = [
      setTimeout(() => setF(1), 150), // outer ring + glow appears
      setTimeout(() => setF(2), 650), // inner ring + arc highlight sweeps
      setTimeout(() => {
        setF(3);
        soundSplash();
      }, 1300), // logo fade-in + chime
      setTimeout(() => setF(6), 3200), // begin fade out
      setTimeout(done, 3800),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 999,
        background: T.dark,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: f >= 6 ? 0 : 1,
        transition: f >= 6 ? "opacity .6s cubic-bezier(.4,0,.2,1)" : "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes spArcLoop{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes spArcLoopRev{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(-360deg)}}
        @keyframes spGlowPulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
        @keyframes spRingPulse{0%,100%{opacity:.18;transform:translate(-50%,-50%) scale(1)}50%{opacity:.42;transform:translate(-50%,-50%) scale(1.04)}}
        @keyframes spStarTwinkle{0%,100%{opacity:.15}50%{opacity:.55}}
      `}</style>

      {/* ─── Tiny twinkling dots ─── */}
      {[
        { x: 18, y: 22, d: 0 },
        { x: 82, y: 14, d: 1.5 },
        { x: 88, y: 78, d: 0.8 },
        { x: 12, y: 82, d: 2.2 },
        { x: 36, y: 8, d: 1.1 },
        { x: 64, y: 90, d: 0.4 },
        { x: 6, y: 48, d: 1.8 },
        { x: 94, y: 46, d: 0.6 },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: "#A8C0FF",
            boxShadow: "0 0 4px rgba(168,192,255,.7)",
            animation: `spStarTwinkle 3s ease-in-out ${s.d}s infinite`,
            opacity: f >= 1 ? 1 : 0,
            transition: "opacity 1s ease",
          }}
        />
      ))}

      {/* ─── Outermost ring (animated pulse) ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "160vmin",
          height: "160vmin",
          maxWidth: 1200,
          maxHeight: 1200,
          borderRadius: "50%",
          border: "1px solid rgba(140,180,255,.18)",
          boxShadow: "inset 0 0 80px rgba(80,120,255,.05)",
          opacity: f >= 1 ? 1 : 0,
          animation: f >= 1 ? "spRingPulse 4.5s ease-in-out infinite" : "none",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1.4s ease",
        }}
      />

      {/* ─── Middle large ring (animated pulse, delayed) ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "95vmin",
          height: "95vmin",
          maxWidth: 720,
          maxHeight: 720,
          borderRadius: "50%",
          border: "1px solid rgba(150,190,255,.22)",
          boxShadow: "inset 0 0 120px rgba(60,100,220,.08)",
          opacity: f >= 1 ? 1 : 0,
          animation: f >= 1 ? "spRingPulse 4.5s ease-in-out 0.8s infinite" : "none",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1.2s ease .15s",
        }}
      />

      {/* ─── Inner ring (logo container, animated pulse) ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "58vmin",
          height: "58vmin",
          maxWidth: 440,
          maxHeight: 440,
          borderRadius: "50%",
          border: "1px solid rgba(160,200,255,.28)",
          background:
            "radial-gradient(circle at 50% 50%, rgba(60,110,220,.28) 0%, rgba(30,60,140,.10) 55%, transparent 100%)",
          boxShadow: "inset 0 0 80px rgba(80,140,255,.14), 0 0 100px rgba(40,80,200,.25)",
          opacity: f >= 2 ? 1 : 0,
          animation: f >= 2 ? "spRingPulse 4.5s ease-in-out 1.6s infinite" : "none",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease",
        }}
      />

      {/* ─── Bright arc rotating (CW) ─── */}
      <svg
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "58vmin",
          height: "58vmin",
          maxWidth: 440,
          maxHeight: 440,
          opacity: f >= 2 ? 1 : 0,
          animation: f >= 2 ? "spArcLoop 8s linear infinite" : "none",
          transformOrigin: "center",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease .2s",
          filter: "drop-shadow(0 0 12px rgba(120,170,255,.7))",
        }}
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="spArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4F7CFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#9BBBFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#4F7CFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 14,50 A 36,36 0 0 1 86,50"
          fill="none"
          stroke="url(#spArc)"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </svg>

      {/* ─── Second bright arc rotating (CCW, outer ring) ─── */}
      <svg
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "95vmin",
          height: "95vmin",
          maxWidth: 720,
          maxHeight: 720,
          opacity: f >= 2 ? 0.7 : 0,
          animation: f >= 2 ? "spArcLoopRev 12s linear infinite" : "none",
          transformOrigin: "center",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease .3s",
          filter: "drop-shadow(0 0 10px rgba(120,170,255,.5))",
        }}
        viewBox="0 0 100 100"
      >
        <path
          d="M 18,50 A 32,32 0 0 1 82,50"
          fill="none"
          stroke="url(#spArc)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      </svg>

      {/* ─── Soft inner glow behind logo (stronger, centered) ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "42vmin",
          height: "42vmin",
          maxWidth: 340,
          maxHeight: 340,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(100,150,255,.32) 0%, rgba(60,100,220,.12) 45%, transparent 75%)",
          opacity: f >= 2 ? 1 : 0,
          animation: f >= 2 ? "spGlowPulse 3.5s ease-in-out infinite" : "none",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease",
          pointerEvents: "none",
        }}
      />

      {/* ─── Logo centrado ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) scale(${f >= 3 ? 1 : 0.85})`,
          zIndex: 5,
          opacity: f >= 3 ? 1 : 0,
          transition:
            "opacity .9s cubic-bezier(.34,1.28,.64,1), transform 1.1s cubic-bezier(.34,1.28,.64,1)",
          filter:
            "drop-shadow(0 0 28px rgba(120,170,255,.65)) drop-shadow(0 0 8px rgba(180,200,255,.4))",
        }}
      >
        <Logo360 width={220} />
      </div>
    </div>
  );
}

export default Splash;
