import { useState, useEffect, useCallback } from "react";
import { signInWithPopup, signOut, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
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
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_APP_VERSION ?? "1.0";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  splashActive?: boolean;
  /** Callback con el DOMRect del logo — Splash lo usa para alinear su animación al píxel */
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

// ══════════════════════════════════════════════════════════════════
// DESKTOP LOGIN
// ══════════════════════════════════════════════════════════════════
interface DesktopLoginProps {
  onLoginSuccess: (user: User) => void;
}

function DesktopLogin({ onLoginSuccess }: DesktopLoginProps) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [remember, setRemember]   = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [loadingG, setLoadingG]   = useState(false);
  const [error, setError]         = useState("");

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

  const validateUser = (user: User) => {
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email ?? "")) {
      signOut(auth);
      setError(`Acceso denegado. ${user.email} no está autorizado.`);
      return false;
    }
    return true;
  };

  /* ── Email + Password ── */
  const handleEmailLogin = async () => {
    if (!email.trim() || !password) { setError("Completa usuario y contraseña."); return; }
    setLoading(true);
    setError("");
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!validateUser(result.user)) { setLoading(false); return; }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(result.user);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential")
        setError("Usuario o contraseña incorrectos.");
      else if (e.code === "auth/invalid-email")
        setError("El formato del correo no es válido.");
      else if (e.code === "auth/too-many-requests")
        setError("Demasiados intentos. Intenta más tarde.");
      else if (e.code?.includes("api-key-not-valid"))
        setError("⚙️ API key no válida. Verifica Variables de Entorno en Cloudflare Pages.");
      else
        setError("No se pudo iniciar sesión. Verifica tus credenciales.");
      setLoading(false);
    }
  };

  /* ── Google ── */
  const handleGoogleLogin = async () => {
    setLoadingG(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!validateUser(result.user)) { setLoadingG(false); return; }
      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(result.user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user")      setError("Cerraste la ventana de Google antes de terminar.");
      else if (e.code === "auth/popup-blocked")         setError("Tu navegador bloqueó la ventana. Permite popups.");
      else if (e.code === "auth/operation-not-allowed") setError("Google Sign-In no habilitado en Firebase Console.");
      else if (e.code?.includes("api-key-not-valid"))   setError("⚙️ API key no válida. Verifica Variables de Entorno en Cloudflare Pages.");
      else setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      setLoadingG(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && !loadingG) handleEmailLogin();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "#F8FAFF",
    border: "1.5px solid #E2E8F0",
    borderRadius: 12,
    fontSize: 15,
    color: "#0D1629",
    outline: "none",
    transition: "border-color .2s, box-shadow .2s",
    boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #07101F 0%, #0D1629 50%, #111E35 100%)",
      padding: "40px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        .v360-input:focus { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,.15) !important; }
        .v360-btn-primary { transition: background .2s, transform .12s, box-shadow .2s; }
        .v360-btn-primary:hover:not(:disabled) { background: #1D4ED8 !important; box-shadow: 0 4px 20px rgba(37,99,235,.45) !important; }
        .v360-btn-primary:active:not(:disabled) { transform: scale(.98); }
        .v360-btn-google { transition: background .15s, box-shadow .15s; }
        .v360-btn-google:hover:not(:disabled) { background: #F1F5F9 !important; box-shadow: 0 2px 12px rgba(0,0,0,.10) !important; }
        .v360-btn-google:active:not(:disabled) { background: #E2E8F0 !important; }
        .v360-showpass { transition: color .15s; }
        .v360-showpass:hover { color: #2563EB !important; }
      `}</style>

      {/* Halos de fondo */}
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "500px", height: "500px",
        background: "radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", left: "-10%", width: "450px", height: "450px",
        background: "radial-gradient(ellipse, rgba(37,99,235,.12) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Tarjeta principal */}
      <div style={{
        width: "100%",
        maxWidth: 460,
        background: "#FFFFFF",
        borderRadius: 24,
        boxShadow: "0 24px 80px rgba(0,0,0,.28), 0 4px 20px rgba(0,0,0,.14)",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Cabecera con logo */}
        <div style={{
          background: "linear-gradient(160deg, #07101F 0%, #0D1629 60%, #111E35 100%)",
          padding: "40px 40px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-30%", right: "-20%", width: "200px", height: "200px",
            background: "radial-gradient(ellipse, rgba(37,99,235,.22) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ filter: "drop-shadow(0 0 24px rgba(37,99,235,.35))", position: "relative", zIndex: 1 }}>
            <Logo360 width={180} />
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 14, color: "rgba(255,255,255,.55)", letterSpacing: .3, position: "relative", zIndex: 1 }}>
            Plataforma de gestión empresarial
          </p>
        </div>

        {/* Formulario */}
        <div style={{ padding: "36px 40px 32px" }}>

          {!API_KEY_OK && (
            <div style={{ marginBottom: 20, padding: "10px 14px",
              background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)",
              borderRadius: 10, color: "#92400E", fontSize: 12, lineHeight: 1.5, textAlign: "center" }}>
              ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.
            </div>
          )}

          <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: "#0D1629", letterSpacing: "-0.4px" }}>
            Iniciar sesión
          </h2>

          {/* Campo Usuario */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Usuario
            </label>
            <input
              className="v360-input"
              type="email"
              placeholder="correo@empresa.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={handleKey}
              disabled={loading || loadingG}
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          {/* Campo Contraseña */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="v360-input"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={handleKey}
                disabled={loading || loadingG}
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button
                className="v360-showpass"
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: "#9CA3AF", lineHeight: 1 }}
              >
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Mantener recordado */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setRemember(v => !v)}
              style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                border: remember ? "none" : "2px solid #D1D5DB",
                background: remember ? "#2563EB" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .18s, border .18s",
                cursor: "pointer",
              }}
            >
              {remember && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.3 }}
                  onClick={() => setRemember(v => !v)}>
              Mantener recordado
            </span>
          </label>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px",
              background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.22)",
              borderRadius: 10, color: "#B91C1C", fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {/* Botón Ingresar */}
          <button
            className="v360-btn-primary"
            onClick={handleEmailLogin}
            disabled={loading || loadingG}
            style={{
              width: "100%", padding: "14px 20px",
              background: loading ? "#1D4ED8" : "#2563EB",
              color: "#FFF", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700, letterSpacing: ".2px",
              cursor: (loading || loadingG) ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              opacity: loadingG ? 0.55 : 1,
              boxShadow: "0 2px 12px rgba(37,99,235,.3)",
            }}
          >
            {loading
              ? <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ animation: "v360spin .8s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Ingresando...
                </>
              : "Ingresar"
            }
          </button>

          {/* Separador */}
          <div style={{ display: "flex", alignItems: "center", margin: "22px 0", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>o continúa con</span>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </div>

          {/* Botón Google */}
          <button
            className="v360-btn-google"
            onClick={handleGoogleLogin}
            disabled={loading || loadingG}
            style={{
              width: "100%", padding: "13px 20px",
              background: "#FFFFFF", color: "#374151",
              border: "1.5px solid #E2E8F0", borderRadius: 12,
              fontSize: 15, fontWeight: 600,
              cursor: (loading || loadingG) ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              opacity: loading ? 0.55 : 1,
              boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            }}
          >
            {loadingG
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.3" strokeLinecap="round" style={{ animation: "v360spin .8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              : <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,12.955,4,4,12.955,4,24s8.955,20,20,20,20-8.955,20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4,16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
            }
            {loadingG ? "Conectando con Google..." : "Iniciar con Google"}
          </button>

          {/* Versión */}
          <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#9CA3AF", letterSpacing: .2 }}>
            v{APP_VERSION}
          </div>
        </div>
      </div>

      <style>{`@keyframes v360spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MOBILE LOGIN (sin cambios)
// ══════════════════════════════════════════════════════════════════
function LoginScreen({ onLoginSuccess, splashActive = false, onLogoReady }: LoginScreenProps) {
  const isDesktop = useIsDesktop();

  // Si es escritorio, renderizar layout dedicado
  if (isDesktop) {
    return <DesktopLogin onLoginSuccess={onLoginSuccess} />;
  }

  // ── Estado móvil ──
  const [loading, setLoading]         = useState(false);
  const [loadingFace, setLoadingFace] = useState(false);
  const [error, setError]             = useState("");
  const [credentialStored, setCredentialStored]   = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  const [entered, setEntered] = useState(!splashActive);
  useEffect(() => {
    if (!splashActive && !entered) setEntered(true);
  }, [splashActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const logoRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !onLogoReady) return;
    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) onLogoReady(rect);
    });
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
        const currentUser = await new Promise<User | null>((resolve) => {
          if (auth.currentUser) { resolve(auth.currentUser); return; }
          let resolved = false;
          const { onAuthStateChanged } = require("firebase/auth") as typeof import("firebase/auth");
          const unsub = onAuthStateChanged(auth, (u) => {
            if (!resolved) { resolved = true; unsub(); resolve(u); }
          });
          setTimeout(() => { if (!resolved) { resolved = true; unsub(); resolve(null); } }, 3000);
        });

        if (currentUser) {
          sessionStorage.setItem("v360-session", "1");
          onLoginSuccess(currentUser);
        } else {
          localStorage.removeItem("v360-webauthn-credential");
          localStorage.removeItem("v360-webauthn-uid");
          setCredentialStored(false);
          setError("Sesión cerrada. Ingresa con Google para reactivar Face ID.");
        }
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === "NotAllowedError") setError("Verificación cancelada.");
      else setError("Face ID no pudo verificarte. Intenta con Google.");
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

  /* ── Render móvil ── */
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", flexDirection: "column",
      zIndex: 998,
      background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
      opacity: splashActive ? 0 : 1,
      pointerEvents: splashActive ? "none" : "auto",
    }}>
      <style>{`
        @keyframes pulseRing {
          0%  {box-shadow:0 0 0 0    rgba(37,99,235,.45);}
          70% {box-shadow:0 0 0 14px rgba(37,99,235,0);}
          100%{box-shadow:0 0 0 0    rgba(37,99,235,0);}
        }
        .v360-faceid:active { transform:scale(.97); }
        .v360-google:active { opacity:.55!important; }
      `}</style>

      <div style={{
        position: "absolute", top: "12%", right: "-20%",
        width: "65%", height: "65%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.18) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", left: "-15%",
        width: "55%", height: "50%",
        background: "radial-gradient(ellipse, rgba(37,99,235,.13) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ZONA AZUL */}
      <div style={{
        flex: "0 0 62%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingTop: "env(safe-area-inset-top)",
        position: "relative",
      }}>
        <div
          ref={logoRef}
          style={{
            marginBottom: 44,
            filter: "drop-shadow(0 0 28px rgba(37,99,235,.32))",
            position: "relative", zIndex: 1,
          }}
        >
          <Logo360 width={220}/>
        </div>

        <div style={{
          position: "relative", zIndex: 1, textAlign: "center",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(10px)",
          transition: entered ? "opacity 0.35s ease-out 0.05s, transform 0.35s ease-out 0.05s" : "none",
        }}>
          <div style={{fontSize:16,color:"rgba(255,255,255,.72)",fontWeight:400,marginBottom:6}}>Hola,</div>
          <div style={{fontSize:33,fontWeight:800,color:"#FFF",letterSpacing:"-0.6px",textShadow:"0 2px 18px rgba(0,0,0,.45)"}}>
            Alan Martínez
          </div>
        </div>
      </div>

      {/* TARJETA BLANCA */}
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
        position: "relative", zIndex: 1,
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(28px)",
        transition: entered ? "opacity 0.45s ease-out 0.15s, transform 0.45s ease-out 0.15s" : "none",
      }}>

        {!API_KEY_OK && (
          <div style={{marginBottom:14,padding:"10px 14px",
            background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.35)",
            borderRadius:10,color:"#92400E",fontSize:12,lineHeight:1.5,textAlign:"center"}}>
            ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.
          </div>
        )}

        {/* Face ID */}
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

        {/* Google */}
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

        {error && (
          <div style={{marginTop:14,padding:"10px 14px",
            background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.22)",
            borderRadius:10,color:"#B91C1C",fontSize:12,lineHeight:1.5,textAlign:"center"}}>
            {error}
          </div>
        )}

        <div style={{marginTop:"auto",paddingTop:16,textAlign:"center",fontSize:11,color:"#9CA3AF",letterSpacing:.2}}>
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
