import React, { useEffect, useState } from "react";
import { T } from "../config/theme";
import { Logo360 } from "../components/layout/Logo360";

interface SplashProps { done: () => void; }

export default function Splash({ done }: SplashProps) {
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    const t1 = setTimeout(() => setOpacity(0), 1800);
    const t2 = setTimeout(() => done(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"linear-gradient(160deg,#0A0F1E 0%,#131D30 50%,#0A0F1E 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      opacity, transition:"opacity 0.4s ease",
    }}>
      <div style={{ filter:"drop-shadow(0 0 40px rgba(37,99,235,0.4))", marginBottom:24 }}>
        <Logo360 width={220}/>
      </div>
      <div style={{
        fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:700,
        color:"rgba(255,255,255,0.5)", letterSpacing:5, textTransform:"uppercase",
      }}>
        Gestión de Paneles Publicitarios
      </div>
    </div>
  );
}
