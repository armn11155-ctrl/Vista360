import { useState, useEffect, useCallback } from "react";
import {
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from "../../../config/firebase";
import { ALLOWED_EMAILS } from "../../../config/constants";
import { Logo360 } from "../../layout/Logo360";
import { useIsDesktop } from "../../../hooks/useIsDesktop";

const API_KEY_OK = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith("placeholder")
);
const APP_VERSION: string =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_APP_VERSION ?? "1.0";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  splashActive?: boolean;
  onLogoReady?: (rect: DOMRect) => void;
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
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
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

function FaceIDIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V8M8 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V16M21 8V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H16M21 16V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H16M7.5 8V9.5M16.5 8V9.5M11 12.6001C11.8 12.6001 12.5 11.9001 12.5 11.1001V8M15.2002 15.2C13.4002 17 10.5002 17 8.7002 15.2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const IconChart = () => (
  <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
    <path d="M9 19V13M12 19V7M15 19V13M3 20H21" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconGrid = () => (
  <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2.2"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2.2"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2.2"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2.2"/>
  </svg>
);
const IconLock = () => (
  <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="#fff" strokeWidth="2.2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const FEATURES = [
  { Icon: IconChart, label: "Reportes en tiempo real",    sub: "Toma decisiones basadas en datos actuales." },
  { Icon: IconGrid,  label: "Gestión de paneles y mapas", sub: "Visualiza y administra tu información." },
  { Icon: IconLock,  label: "Acceso seguro y controlado", sub: "Protegemos tu información y la de tu empresa." },
];

// ══════════════════════════════════════════════════════════════
// DESKTOP LOGIN
// Fondo completo azul oscuro; tarjeta blanca flotante a la derecha
// ══════════════════════════════════════════════════════════════
function DesktopLogin({ onLoginSuccess }: { onLoginSuccess: (u: User) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [loadingG, setLoadingG] = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    document.body.style.background = "#07101F";
    document.documentElement.style.background = "#07101F";
  }, []);

  const checkAllowed = (user: User) => {
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email ?? "")) {
      signOut(auth);
      setError(`Acceso denegado. ${user.email} no está autorizado.`);
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError("Ingresa tu usuario y contraseña."); return; }
    setLoading(true); setError("");
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const r = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!checkAllowed(r.user)) { setLoading(false); return; }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(r.user);
    } catch (err) {
      const e = err as { code?: string };
      if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(e.code ?? ""))
        setError("Usuario o contraseña incorrectos.");
      else if (e.code === "auth/invalid-email")        setError("El formato del correo no es válido.");
      else if (e.code === "auth/too-many-requests")    setError("Demasiados intentos. Intenta más tarde.");
      else if (e.code?.includes("api-key-not-valid"))  setError("⚙️ API key no válida. Revisa las variables de entorno.");
      else setError("No se pudo iniciar sesión. Verifica tus credenciales.");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingG(true); setError("");
    try {
      const r = await signInWithPopup(auth, googleProvider);
      if (!checkAllowed(r.user)) { setLoadingG(false); return; }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(r.user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user")      setError("Cerraste la ventana de Google antes de terminar.");
      else if (e.code === "auth/popup-blocked")         setError("Tu navegador bloqueó la ventana. Permite popups.");
      else if (e.code === "auth/operation-not-allowed") setError("Google Sign-In no habilitado en Firebase Console.");
      else if (e.code?.includes("api-key-not-valid"))   setError("⚙️ API key no válida. Revisa las variables de entorno.");
      else setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      setLoadingG(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && !loadingG) handleLogin();
  };

  const busy = loading || loadingG;

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px 13px 44px",
    border: "1.5px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    fontSize: 14,
    color: "#F1F5F9",
    background: "rgba(255,255,255,0.06)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color .18s, box-shadow .18s",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <>
      <style>{`
        html, body { background: #07101F !important; }
        .v360d-inp:focus {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,.2) !important;
          background: rgba(59,130,246,.08) !important;
        }
        .v360d-btn-main { transition: background .18s, box-shadow .18s, transform .1s; }
        .v360d-btn-main:hover:not(:disabled) {
          background: #2C6FE0 !important;
          box-shadow: 0 6px 22px rgba(59,130,246,.5) !important;
        }
        .v360d-btn-main:active:not(:disabled) { transform: scale(.985); }
        .v360d-btn-g { transition: background .15s, border-color .15s, box-shadow .15s; }
        .v360d-btn-g:hover:not(:disabled) {
          background: rgba(255,255,255,.08) !important;
          border-color: rgba(255,255,255,.22) !important;
          box-shadow: 0 2px 10px rgba(0,0,0,.3) !important;
        }
        .v360d-btn-g:active:not(:disabled) { background: rgba(255,255,255,.04) !important; }
        .v360d-eye:hover { color: #3B82F6 !important; }
        @keyframes v360spin { to { transform: rotate(360deg); } }
        @keyframes v360fadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Wrapper: fondo azul completo ── */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "url('/login-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: "'DM Sans', sans-serif",
        zIndex: 998, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6% 0 0",
      }}>

        {/* Halo azul central */}
        <div style={{ position:"absolute", top:"-15%", right:"30%", width:"55%", height:"65%", background:"radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 65%)", pointerEvents:"none", zIndex:0 }}/>
        {/* Dots */}
        <div style={{ position:"absolute", top:"12%", left:"8%",      width:6, height:6, borderRadius:"50%", background:"rgba(255,255,255,.18)" }}/>
        <div style={{ position:"absolute", top:"28%", left:"14%",     width:4, height:4, borderRadius:"50%", background:"rgba(255,255,255,.11)" }}/>
        <div style={{ position:"absolute", bottom:"18%", right:"45%", width:5, height:5, borderRadius:"50%", background:"rgba(255,255,255,.14)" }}/>
        <div style={{ position:"absolute", top:"60%", left:"6%",      width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,.09)" }}/>

        {/* ── LEFT: branding centrado verticalmente ── */}
        <div style={{
          flex: "0 0 50%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 48px",
          position: "relative", zIndex: 1,
          animation: "v360fadeIn .5s ease-out both",
        }}>
          {/* Logo perfectamente centrado */}
          <div style={{ filter:"drop-shadow(0 0 32px rgba(37,99,235,.45))", marginBottom:32, textAlign:"center" }}>
            <Logo360 width={200} />
          </div>

          <p style={{ margin:"0 0 36px", fontSize:15, color:"rgba(255,255,255,.78)", lineHeight:1.6, textAlign:"center", textShadow:"0 2px 10px rgba(0,0,0,.55)" }}>
            Plataforma de gestión empresarial{" "}
            <strong style={{ color:"#fff", fontWeight:700 }}>integral</strong>
          </p>

          {/* Tarjetas sin emojis */}
          {FEATURES.map(({ Icon, label, sub }) => (
            <div key={label} style={{
              width: "100%", maxWidth: 380,
              display:"flex", alignItems:"flex-start", gap:14,
              marginBottom:12,
              background:"rgba(6,12,28,.58)",
              backdropFilter:"blur(8px)",
              WebkitBackdropFilter:"blur(8px)",
              border:"1px solid rgba(255,255,255,.12)",
              borderRadius:14, padding:"14px 16px",
              boxShadow:"0 8px 24px rgba(0,0,0,.30)",
            }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon />
              </div>
              <div>
                <div style={{ fontSize:13.5, color:"#fff", fontWeight:700, marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11.5, color:"rgba(255,255,255,.62)", lineHeight:1.4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── RIGHT: tarjeta blanca flotante ── */}
        <div style={{
          flex: "0 0 auto",
          width: "min(420px, 42%)",
          background: "rgba(10,18,32,.78)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 20,
          padding: "44px 40px",
          boxShadow: "0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)",
          position: "relative", zIndex: 1,
          animation: "v360fadeIn .45s ease-out .1s both",
          maxHeight: "90vh",
          overflowY: "auto",
        }}>
          <h1 style={{ margin:"0 0 8px", fontSize:26, fontWeight:800, color:"#F1F5F9", letterSpacing:"-.5px" }}>
            Bienvenido
          </h1>
          <div style={{ width:36, height:3, background:"#3B82F6", borderRadius:2, marginBottom:12 }}/>
          <p style={{ margin:"0 0 28px", fontSize:14, color:"#8B96AC" }}>
            Ingresa tus credenciales para continuar
          </p>

          {!API_KEY_OK && (
            <div style={{ marginBottom:18, padding:"10px 14px", background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.35)", borderRadius:10, color:"#FCD34D", fontSize:12, lineHeight:1.5 }}>
              ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.
            </div>
          )}

          {/* Usuario */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", marginBottom:7, fontSize:13, fontWeight:600, color:"#8B96AC" }}>Usuario</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#8B96AC", display:"flex", alignItems:"center", pointerEvents:"none" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              <input className="v360d-inp" type="email" placeholder="correo@empresa.com"
                value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={onKey} disabled={busy} autoComplete="email" style={inp}/>
            </div>
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block", marginBottom:7, fontSize:13, fontWeight:600, color:"#8B96AC" }}>Contraseña</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#8B96AC", display:"flex", alignItems:"center", pointerEvents:"none" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <input className="v360d-inp" type={showPass ? "text" : "password"} placeholder="••••••••"
                value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={onKey} disabled={busy} autoComplete="current-password"
                style={{ ...inp, paddingRight:46 }}/>
              <button className="v360d-eye" type="button" tabIndex={-1}
                onClick={() => setShowPass(v => !v)}
                style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, color:"#8B96AC", lineHeight:1, transition:"color .15s" }}>
                {showPass
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Recordado */}
          <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22, cursor:"pointer", userSelect:"none" }}>
            <div onClick={() => setRemember(v => !v)} style={{ width:19, height:19, borderRadius:6, flexShrink:0, background:remember?"#3B82F6":"transparent", border:remember?"none":"2px solid rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .18s, border-color .18s", cursor:"pointer" }}>
              {remember && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ fontSize:13, color:"#8B96AC" }} onClick={() => setRemember(v => !v)}>Mantener recordado</span>
          </label>

          {error && (
            <div style={{ marginBottom:16, padding:"10px 14px", background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, color:"#FCA5A5", fontSize:13, lineHeight:1.5 }}>
              {error}
            </div>
          )}

          {/* Botón Ingresar */}
          <button className="v360d-btn-main" onClick={handleLogin} disabled={busy}
            style={{ width:"100%", padding:"13px", background:"#3B82F6", color:"#FFF", border:"none", borderRadius:11, fontSize:15, fontWeight:700, cursor:busy?"wait":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:9, opacity:loadingG?.5:1, boxShadow:"0 3px 14px rgba(59,130,246,.4)" }}>
            {loading
              ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ animation:"v360spin .75s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Ingresando...</>
              : "Ingresar"
            }
          </button>

          <div style={{ display:"flex", alignItems:"center", margin:"18px 0", gap:12 }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.10)" }}/>
            <span style={{ fontSize:12, color:"#8B96AC", fontWeight:500 }}>o continúa con</span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.10)" }}/>
          </div>

          {/* Botón Google */}
          <button className="v360d-btn-g" onClick={handleGoogle} disabled={busy}
            style={{ width:"100%", padding:"12px", background:"rgba(255,255,255,0.05)", color:"#F1F5F9", border:"1.5px solid rgba(255,255,255,0.14)", borderRadius:11, fontSize:14, fontWeight:600, cursor:busy?"wait":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, opacity:loading?.5:1, boxShadow:"0 1px 4px rgba(0,0,0,.3)" }}>
            {loadingG
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B96AC" strokeWidth="2.3" strokeLinecap="round" style={{ animation:"v360spin .75s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              : <svg width="19" height="19" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,12.955,4,4,12.955,4,24s8.955,20,20,20,20-8.955,20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            }
            {loadingG ? "Conectando..." : "Iniciar con Google"}
          </button>
        </div>

        {/* Versión */}
        <div style={{ position:"absolute", bottom:20, left:"25%", fontSize:11, color:"rgba(255,255,255,.22)", letterSpacing:.3, zIndex:1 }}>
          v{APP_VERSION}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// MOBILE LOGIN
// ══════════════════════════════════════════════════════════════
function LoginScreen({ onLoginSuccess, splashActive = false, onLogoReady }: LoginScreenProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <DesktopLogin onLoginSuccess={onLoginSuccess} />;

  const [loading, setLoading]                     = useState(false);
  const [loadingFace, setLoadingFace]             = useState(false);
  const [error, setError]                         = useState("");
  const [credentialStored, setCredentialStored]   = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [entered, setEntered]                     = useState(!splashActive);

  useEffect(() => { if (!splashActive) setEntered(true); }, [splashActive]);

  const logoRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !onLogoReady) return;
    requestAnimationFrame(() => { const rect = node.getBoundingClientRect(); if (rect.width > 0) onLogoReady(rect); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleFaceID = async () => {
    setLoadingFace(true); setError("");
    try {
      if (!webAuthnSupported) { setError("Tu dispositivo no soporta Face ID / biometría."); return; }
      const storedId = localStorage.getItem("v360-webauthn-credential");
      if (!storedId) { setError("Primero ingresa con Google para activar Face ID en este dispositivo."); return; }
      const rawId = Uint8Array.from(atob(storedId), (c) => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: rawId }], userVerification: "required", timeout: 60000 } });
      if (assertion) {
        const currentUser = await new Promise<User | null>((resolve) => {
          if (auth.currentUser) { resolve(auth.currentUser); return; }
          let resolved = false;
          const unsub = onAuthStateChanged(auth, (u) => { if (!resolved) { resolved = true; unsub(); resolve(u); } });
          setTimeout(() => { if (!resolved) { resolved = true; unsub(); resolve(null); } }, 3000);
        });
        if (currentUser) { sessionStorage.setItem("v360-session", "1"); onLoginSuccess(currentUser); }
        else { localStorage.removeItem("v360-webauthn-credential"); localStorage.removeItem("v360-webauthn-uid"); setCredentialStored(false); setError("Sesión cerrada. Ingresa con Google para reactivar Face ID."); }
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === "NotAllowedError") setError("Verificación cancelada.");
      else setError("Face ID no pudo verificarte. Intenta con Google.");
    } finally { setLoadingFace(false); }
  };

  const handleGoogleLogin = async () => {
    setLoading(true); setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email ?? "")) { await signOut(auth); setError(`Acceso denegado. ${user.email} no está autorizado.`); setLoading(false); return; }
      const storedUid = localStorage.getItem("v360-webauthn-uid");
      if (webAuthnSupported && storedUid !== user.uid) { const ok = await registerWebAuthn(user); setCredentialStored(ok); }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user")      setError("Cerraste la ventana de Google antes de terminar.");
      else if (e.code === "auth/popup-blocked")         setError("Tu navegador bloqueó la ventana. Permite popups.");
      else if (e.code === "auth/operation-not-allowed") setError("Google Sign-In no habilitado en Firebase Console.");
      else if (e.code?.includes("api-key-not-valid"))   setError("⚙️ API key no válida. Verifica Variables de Entorno en Cloudflare Pages.");
      else setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, display:"flex", flexDirection:"column", zIndex:998, background:"linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)", opacity: splashActive ? 0 : 1, pointerEvents: splashActive ? "none" : "auto" }}>
      <style>{`
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)} 70%{box-shadow:0 0 0 14px rgba(37,99,235,0)} 100%{box-shadow:0 0 0 0 rgba(37,99,235,0)} }
        @keyframes v360spin { to { transform: rotate(360deg); } }
        .v360-faceid:active { transform: scale(.97); }
        .v360-google:active { opacity: .55 !important; }
      `}</style>
      <div style={{ position:"absolute", top:"12%", right:"-20%", width:"65%", height:"65%", background:"radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }}/>
      <div style={{ position:"absolute", bottom:"-20%", left:"-15%", width:"55%", height:"50%", background:"radial-gradient(ellipse, rgba(37,99,235,.13) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }}/>
      <div style={{ flex:"0 0 62%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:"env(safe-area-inset-top)", position:"relative" }}>
        <div ref={logoRef} style={{ marginBottom:44, filter:"drop-shadow(0 0 28px rgba(37,99,235,.32))", position:"relative", zIndex:1 }}>
          <Logo360 width={220} />
        </div>
        <div style={{ position:"relative", zIndex:1, textAlign:"center", opacity:entered?1:0, transform:entered?"translateY(0)":"translateY(10px)", transition:entered?"opacity 0.35s ease-out 0.05s, transform 0.35s ease-out 0.05s":"none" }}>
          <div style={{ fontSize:16, color:"rgba(255,255,255,.72)", fontWeight:400, marginBottom:6 }}>Hola,</div>
          <div style={{ fontSize:33, fontWeight:800, color:"#FFF", letterSpacing:"-0.6px", textShadow:"0 2px 18px rgba(0,0,0,.45)" }}>Alan Martínez</div>
        </div>
      </div>
      <div style={{ flex:1, background:"#FFFFFF", borderTopLeftRadius:30, borderTopRightRadius:30, borderTop: "1px solid rgba(30,58,138,0.08)", display:"flex", flexDirection:"column", alignItems:"stretch", paddingLeft:28, paddingRight:28, paddingTop:34, paddingBottom:"max(20px, env(safe-area-inset-bottom))", boxShadow:"0 -6px 36px rgba(0,0,0,.25)", position:"relative", zIndex:1, opacity:entered?1:0, transform:entered?"translateY(0)":"translateY(28px)", transition:entered?"opacity 0.45s ease-out 0.15s, transform 0.45s ease-out 0.15s":"none" }}>
        {!API_KEY_OK && (<div style={{ marginBottom:14, padding:"10px 14px", background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.35)", borderRadius:10, color:"#FCD34D", fontSize:12, lineHeight:1.5, textAlign:"center" }}>⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.</div>)}
        <button className="v360-faceid" onClick={handleFaceID} disabled={loadingFace || loading} style={{ width:"100%", padding:"15px 20px", background:loadingFace?"#1D4ED8":"#1E3A8A", color:"#FFF", border:"none", borderRadius:50, fontSize:16, fontWeight:700, cursor:(loadingFace||loading)?"wait":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, animation:(!loadingFace&&credentialStored)?"pulseRing 2.8s ease-out infinite":undefined, transition:"background .2s, transform .12s", marginBottom:18 }}>
          {loadingFace ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ animation:"v360spin .75s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> : <FaceIDIcon size={24} />}
          {loadingFace ? "Verificando..." : "Ingresar con Face ID"}
        </button>
        <button className="v360-google" onClick={handleGoogleLogin} disabled={loading||loadingFace} style={{ width:"100%", padding:"11px 20px", background:"transparent", color:"#0D1629", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor:loading?"wait":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:9, opacity:(loading||loadingFace)?0.5:1, transition:"opacity .2s", textDecoration:"underline", textDecorationColor:"rgba(13,22,41,.25)", textUnderlineOffset:3 }}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,12.955,4,4,12.955,4,24s8.955,20,20,20,20-8.955,20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          {loading ? "Iniciando sesión..." : "Ingresar con cuenta de Google"}
        </button>
        {error && (<div style={{ marginTop:14, padding:"10px 14px", background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, color:"#FCA5A5", fontSize:12, lineHeight:1.5, textAlign:"center" }}>{error}</div>)}
        <div style={{ marginTop:"auto", paddingTop:16, textAlign:"center", fontSize:11, color:"#B0BAD0", letterSpacing:.2 }}>v{APP_VERSION}</div>
      </div>
    </div>
  );
}

export default LoginScreen;

