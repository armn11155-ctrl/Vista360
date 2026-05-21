import React, { useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../../../config/firebase";
import { T } from "../../../config/theme";
import { ALLOWED_EMAILS } from "../../../config/constants";
import { Logo360 } from "../../layout/Logo360";
import type { User } from "firebase/auth";

interface LoginScreenProps { onLoginSuccess: (user: User) => void; }

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true); setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email ?? "")) {
        await signOut(auth);
        setError(`Acceso denegado. El email ${user.email} no está autorizado.`);
        setLoading(false); return;
      }
      onLoginSuccess(user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user") setError("Cerraste la ventana de Google antes de terminar.");
      else if (e.code === "auth/popup-blocked") setError("Tu navegador bloqueó la ventana. Permite popups e intenta de nuevo.");
      else setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0,
      background:"linear-gradient(160deg,#0A0F1E 0%,#131D30 50%,#0A0F1E 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      zIndex:998, padding:"24px",
      paddingTop:"max(24px, env(safe-area-inset-top))",
      paddingBottom:"max(24px, env(safe-area-inset-bottom))" }}>
      <div style={{ marginBottom:32, filter:"drop-shadow(0 0 40px rgba(37,99,235,0.35))" }}>
        <Logo360 width={260}/>
      </div>
      <div style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:600,
        color:"rgba(255,255,255,0.65)", letterSpacing:4, textTransform:"uppercase",
        marginBottom:56, textAlign:"center" }}>
        Gestión de Paneles Publicitarios
      </div>
      <div style={{ width:"100%", maxWidth:380,
        background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:22, padding:"32px 28px",
        boxShadow:"0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize:22, fontWeight:800, color:T.white, textAlign:"center", marginBottom:8 }}>
          Bienvenido
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", textAlign:"center", marginBottom:28, lineHeight:1.5 }}>
          Inicia sesión con tu cuenta de Google para acceder a Vista360
        </div>
        <button onClick={handleGoogleLogin} disabled={loading} style={{
          width:"100%", padding:"14px 20px",
          background:loading?"rgba(255,255,255,0.5)":T.white, color:T.text,
          border:"none", borderRadius:12, fontSize:15, fontWeight:700,
          cursor:loading?"wait":"pointer", display:"flex", alignItems:"center",
          justifyContent:"center", gap:12, boxShadow:"0 8px 24px rgba(0,0,0,0.3)" }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          {loading ? "Iniciando sesión..." : "Continuar con Google"}
        </button>
        {error && (
          <div style={{ marginTop:16, padding:"10px 14px",
            background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
            borderRadius:10, color:"#FCA5A5", fontSize:12, lineHeight:1.4, textAlign:"center" }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ marginTop:24, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.06)",
          fontSize:11, color:"rgba(255,255,255,0.35)", textAlign:"center", lineHeight:1.6 }}>
          Acceso seguro vía Google OAuth<br/>8 Millas · Publicidad Exterior
        </div>
      </div>
      <div style={{ position:"absolute", bottom:"max(20px,calc(env(safe-area-inset-bottom)+12px))",
        fontSize:11, color:"rgba(255,255,255,0.25)", textAlign:"center" }}>
        Vista360 v1.0 · © 2026
      </div>
    </div>
  );
}
