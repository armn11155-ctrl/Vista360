import { useState, useEffect } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from "../../../config/firebase";
import { ALLOWED_EMAILS } from "../../../config/constants";
import { Logo360 } from "../../layout/Logo360";

const API_KEY_OK = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith("placeholder")
);
const APP_VERSION: string =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_APP_VERSION ?? "1.0";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

async function registerWebAuthn(user: User): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Vista360", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(user.uid),
          name: user.email ?? user.uid,
          displayName: "Alan Martínez",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential;
    if (cred) {
      const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem("v360-webauthn-credential", id);
      localStorage.setItem("v360-webauthn-uid", user.uid);
      return true;
    }
    return false;
  } catch { return false; }
}

// ── Ícono Face ID — SVG exacto ────────────────────────────────────────────
function FaceIDIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V8M8 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V16M21 8V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H16M21 16V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H16M7.5 8V9.5M16.5 8V9.5M11 12.6001C11.8 12.6001 12.5 11.9001 12.5 11.1001V8M15.2002 15.2C13.4002 17 10.5002 17 8.7002 15.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading]         = useState(false);
  const [loadingFace, setLoadingFace] = useState(false);
  const [error, setError]             = useState("");
  const [credentialStored, setCredentialStored]   = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  // ── Status bar: azul marino desde el arranque ──
  useEffect(() => {
    const BG = "#07101F";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", BG);
    document.documentElement.style.background = BG;
    document.body.style.background = BG;
    return () => {
      const m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (m) m.setAttribute("content", "#0E1A3B");
    };
  }, []);

  useEffect(() => {
    setWebAuthnSupported(!!window.PublicKeyCredential);
    setCredentialStored(!!localStorage.getItem("v360-webauthn-credential"));
  }, []);

  /* ── Face ID ── */
  const handleFaceID = async () => {
    setLoadingFace(true);
    setError("");
    try {
      if (!webAuthnSupported) {
        setError("Tu dispositivo no soporta Face ID / biometría.");
        return;
      }
      const storedId = localStorage.getItem("v360-webauthn-credential");
      if (!storedId) {
        setError("Primero ingresa con Google para activar Face ID en este dispositivo.");
        return;
      }
      const rawId = Uint8Array.from(atob(storedId), (c) => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: "public-key", id: rawId }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (assertion) {
        // Esperar a que Firebase restaure el usuario desde localStorage
        const currentUser = await new Promise<User | null>((resolve) => {
          // auth.currentUser puede estar disponible ya
          if (auth.currentUser) { resolve(auth.currentUser); return; }
          // Si no, esperar el primer disparo de onAuthStateChanged
          let resolved = false;
          const { onAuthStateChanged } = require("firebase/auth") as typeof import("firebase/auth");
          const unsub = onAuthStateChanged(auth, (u) => {
            if (!resolved) { resolved = true; unsub(); resolve(u); }
          });
          // Timeout de seguridad 3s
          setTimeout(() => { if (!resolved) { resolved = true; unsub(); resolve(null); } }, 3000);
        });

        if (currentUser) {
          sessionStorage.setItem("v360-session", "1");
          onLoginSuccess(currentUser);
        } else {
          // Sesión expirada (logout explícito previo) — limpiar credencial
          localStorage.removeItem("v360-webauthn-credential");
          localStorage.removeItem("v360-webauthn-uid");
          setCredentialStored(false);
          setError("Sesión cerrada. Ingresa con Google para reactivar Face ID.");
        }
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === "NotAllowedError") {
        setError("Verificación cancelada.");
      } else {
        setError("Face ID no pudo verificarte. Intenta con Google.");
      }
    } finally {
      setLoadingFace(false);
    }
  };

  /* ── Google ── */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email ?? "")) {
        await signOut(auth);
        setError(`Acceso denegado. ${user.email} no está autorizado.`);
        setLoading(false);
        return;
      }
      const storedUid = localStorage.getItem("v360-webauthn-uid");
      if (webAuthnSupported && storedUid !== user.uid) {
        const ok = await registerWebAuthn(user);
        setCredentialStored(ok);
      }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user")   setError("Cerraste la ventana de Google antes de terminar.");
      else if (e.code === "auth/popup-blocked")      setError("Tu navegador bloqueó la ventana. Permite popups.");
      else if (e.code === "auth/operation-not-allowed") setError("Google Sign-In no habilitado en Firebase Console.");
      else if (e.code?.includes("api-key-not-valid")) setError("⚙️ API key no válida. Verifica Variables de Entorno en Cloudflare Pages.");
      else setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      setLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", flexDirection: "column",
      zIndex: 998,
      background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
    }}>
      <style>{`
        @keyframes loginCardUp {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes loginGreetIn {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes loginLogoIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes pulseRing {
          0%  {box-shadow:0 0 0 0    rgba(37,99,235,.45);}
          70% {box-shadow:0 0 0 14px rgba(37,99,235,0);}
          100%{box-shadow:0 0 0 0    rgba(37,99,235,0);}
        }
        .v360-faceid:active { transform:scale(.97); }
        .v360-google:active { opacity:.55!important; }
      `}</style>

      {/* ══════════════════════════════════
          ZONA AZUL — 62% superior
          paddingTop = safe-area para el notch
          El fondo ya está en el div raíz,
          así que el status bar hereda el color
      ══════════════════════════════════ */}
      <div style={{
        flex: "0 0 62%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingTop: "env(safe-area-inset-top)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Halos */}
        <div style={{position:"absolute",top:"12%",right:"-20%",width:"65%",height:"65%",
          background:"radial-gradient(ellipse,rgba(37,99,235,.18) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"-20%",left:"-15%",width:"55%",height:"50%",
          background:"radial-gradient(ellipse,rgba(37,99,235,.13) 0%,transparent 70%)",pointerEvents:"none"}}/>

        {/* Logo: fade-in de 120ms sincronizado con el micro-fade del splash */}
        <div style={{marginBottom:44,filter:"drop-shadow(0 0 28px rgba(37,99,235,.32))",position:"relative",zIndex:1,
          opacity:0, animation:"loginLogoIn 0.12s linear forwards"}}>
          <Logo360 width={220}/>
        </div>

        {/* Saludo */}
        <div style={{position:"relative",zIndex:1,textAlign:"center",
          opacity:0, animation:"loginGreetIn 0.4s ease-out 0.15s forwards"}}>
          <div style={{fontSize:16,color:"rgba(255,255,255,.72)",fontWeight:400,marginBottom:6}}>Hola,</div>
          <div style={{fontSize:33,fontWeight:800,color:"#FFF",letterSpacing:"-0.6px",textShadow:"0 2px 18px rgba(0,0,0,.45)"}}>
            Alan Martínez
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          TARJETA BLANCA
      ══════════════════════════════════ */}
      <div style={{
        flex: 1,
        background: "#FFF",
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        display: "flex", flexDirection: "column",
        alignItems: "stretch",
        paddingLeft: 28, paddingRight: 28,
        paddingTop: 34,
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        boxShadow: "0 -6px 36px rgba(0,0,0,.14)",
        opacity: 0,
        animation: "loginCardUp 0.45s ease-out 0.25s forwards",
      }}>

        {!API_KEY_OK && (
          <div style={{marginBottom:14,padding:"10px 14px",
            background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.35)",
            borderRadius:10,color:"#92400E",fontSize:12,lineHeight:1.5,textAlign:"center"}}>
            ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.
          </div>
        )}

        {/* ── Botón Face ID ── */}
        <button
          className="v360-faceid"
          onClick={handleFaceID}
          disabled={loadingFace || loading}
          style={{
            width:"100%", padding:"15px 20px",
            background: loadingFace ? "#1A2E55" : "#0D1629",
            color:"#FFF", border:"none", borderRadius:50,
            fontSize:16, fontWeight:700,
            cursor:(loadingFace||loading)?"wait":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            animation:(!loadingFace && credentialStored)?"pulseRing 2.8s ease-out infinite":undefined,
            transition:"background .2s, transform .12s",
            marginBottom:18,
          }}
        >
          {loadingFace
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            : <FaceIDIcon size={24}/>
          }
          {loadingFace ? "Verificando..." : "Ingresar con Face ID"}
        </button>

        {/* ── Google ── */}
        <button
          className="v360-google"
          onClick={handleGoogleLogin}
          disabled={loading || loadingFace}
          style={{
            width:"100%", padding:"11px 20px",
            background:"transparent", color:"#0D1629",
            border:"none", borderRadius:8,
            fontSize:15, fontWeight:600,
            cursor:loading?"wait":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:9,
            opacity:(loading||loadingFace)?0.5:1,
            transition:"opacity .2s",
            textDecoration:"underline",
            textDecorationColor:"rgba(13,22,41,.3)",
            textUnderlineOffset:3,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{flexShrink:0}}>
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,12.955,4,4,12.955,4,24s8.955,20,20,20,20-8.955,20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          {loading ? "Iniciando sesión..." : "Ingresar con cuenta de Google"}
        </button>

        {/* Error */}
        {error && (
          <div style={{marginTop:14,padding:"10px 14px",
            background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.22)",
            borderRadius:10,color:"#B91C1C",fontSize:12,lineHeight:1.5,textAlign:"center"}}>
            {error}
          </div>
        )}

        {/* Versión */}
        <div style={{marginTop:"auto",paddingTop:16,textAlign:"center",fontSize:11,color:"#9CA3AF",letterSpacing:.2}}>
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
