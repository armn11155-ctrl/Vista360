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

// ── Leer versión del package.json ─────────────────────
const APP_VERSION: string = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_APP_VERSION ?? "1.0";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

async function registerWebAuthn(user: User): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credential = (await navigator.credentials.create({
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
    if (credential) {
      const id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem("v360-webauthn-credential", id);
      localStorage.setItem("v360-webauthn-uid", user.uid);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [loadingFace, setLoadingFace] = useState(false);
  const [error, setError] = useState("");
  const [credentialStored, setCredentialStored] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  // ── Sincronizar theme-color con fondo oscuro del login ──
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#07101F");
    document.documentElement.style.background = "#07101F";
    document.body.style.background = "#07101F";
  }, []);

  // ── Detectar soporte y credencial guardada ──
  useEffect(() => {
    setWebAuthnSupported(!!window.PublicKeyCredential);
    setCredentialStored(!!localStorage.getItem("v360-webauthn-credential"));
  }, []);

  /* ── Face ID ────────────────────────────────────── */
  const handleFaceID = async () => {
    setLoadingFace(true);
    setError("");
    try {
      if (!webAuthnSupported) {
        setError("Tu dispositivo no soporta Face ID / biometría.");
        return;
      }

      const storedId = localStorage.getItem("v360-webauthn-credential");

      // Sin credencial previa → guiar al usuario
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
        const currentUser = auth.currentUser;
        if (currentUser) {
          sessionStorage.setItem("v360-session", "1");
          onLoginSuccess(currentUser);
        } else {
          // Token expirado — limpiar y pedir Google
          localStorage.removeItem("v360-webauthn-credential");
          localStorage.removeItem("v360-webauthn-uid");
          setCredentialStored(false);
          setError("Sesión expirada. Ingresa con Google para renovarla.");
        }
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === "NotAllowedError") {
        setError("Verificación cancelada o fallida.");
      } else {
        setError("Face ID no pudo verificarte. Intenta con Google.");
      }
    } finally {
      setLoadingFace(false);
    }
  };

  /* ── Google login ───────────────────────────────── */
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

      // Registrar Face ID si aún no está guardado para este usuario
      const storedUid = localStorage.getItem("v360-webauthn-uid");
      if (webAuthnSupported && storedUid !== user.uid) {
        const registered = await registerWebAuthn(user);
        setCredentialStored(registered);
      }

      sessionStorage.setItem("v360-session", "1");
      onLoginSuccess(user);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana de Google antes de terminar.");
      } else if (e.code === "auth/popup-blocked") {
        setError("Tu navegador bloqueó la ventana. Permite popups e intenta de nuevo.");
      } else if (e.code === "auth/operation-not-allowed") {
        setError("Google Sign-In no está habilitado en Firebase Console → Authentication.");
      } else if (e.code?.includes("api-key-not-valid")) {
        setError("⚙️ API key no válida. Verifica las Variables de Entorno en Cloudflare Pages.");
      } else {
        setError("Error: " + (e.message || "no se pudo iniciar sesión"));
      }
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 998,
        background: "#07101F", // fallback mientras anima
        opacity: 0,
        animation: "loginAppear 0.45s ease-out 0.05s forwards",
      }}
    >
      <style>{`
        @keyframes loginAppear { from { opacity:0 } to { opacity:1 } }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0   rgba(37,99,235,0.45); }
          70%  { box-shadow: 0 0 0 12px rgba(37,99,235,0);   }
          100% { box-shadow: 0 0 0 0   rgba(37,99,235,0);    }
        }
        .btn-faceid:active  { transform: scale(0.97); }
        .btn-google:active  { opacity: 0.7 !important; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          ZONA AZUL — ocupa todo hasta la tarjeta blanca
      ═══════════════════════════════════════════════ */}
      <div
        style={{
          flex: "0 0 62%",
          // Continúa el fondo incluyendo el área del status bar
          background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Safe-area para que el logo no quede detrás del notch
          paddingTop: "max(16px, env(safe-area-inset-top))",
          paddingLeft: 24,
          paddingRight: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Halos de profundidad */}
        <div style={{
          position: "absolute", top: "-25%", right: "-20%",
          width: "65%", height: "65%",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", left: "-15%",
          width: "55%", height: "50%",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{
          marginBottom: 44,
          filter: "drop-shadow(0 0 28px rgba(37,99,235,0.32))",
          position: "relative", zIndex: 1,
        }}>
          <Logo360 width={220} />
        </div>

        {/* Saludo */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.72)",
            fontWeight: 400,
            letterSpacing: 0.3,
            marginBottom: 6,
          }}>
            Hola,
          </div>
          <div style={{
            fontSize: 33,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.6px",
            textShadow: "0 2px 18px rgba(0,0,0,0.45)",
          }}>
            Alan Martínez
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          TARJETA BLANCA — esquinas redondeadas arriba
      ═══════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          marginTop: -2,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 34,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          boxShadow: "0 -6px 36px rgba(0,0,0,0.14)",
        }}
      >
        {/* Config error banner */}
        {!API_KEY_OK && (
          <div style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10,
            color: "#92400E",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "center",
          }}>
            ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* en Cloudflare Pages.
          </div>
        )}

        {/* ── Botón Face ID — SIEMPRE VISIBLE ── */}
        <button
          className="btn-faceid"
          onClick={handleFaceID}
          disabled={loadingFace || loading}
          style={{
            width: "100%",
            padding: "16px 20px",
            background: (loadingFace) ? "#1A2E55" : "#0D1629",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 50,
            fontSize: 16,
            fontWeight: 700,
            cursor: (loadingFace || loading) ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 11,
            animation: (!loadingFace && credentialStored) ? "pulseRing 2.8s ease-out infinite" : undefined,
            transition: "background 0.2s, transform 0.12s",
            marginBottom: 18,
            letterSpacing: 0.1,
          }}
        >
          {loadingFace ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <circle cx="9" cy="10.5" r="1.1" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="10.5" r="1.1" fill="currentColor" stroke="none"/>
              <path d="M8.5 15.5c.9 1.2 2.2 1.8 3.5 1.8s2.6-.6 3.5-1.8"/>
              <path d="M9.5 7.5C10.2 6.6 11 6.2 12 6.2s1.8.4 2.5 1.3"/>
            </svg>
          )}
          {loadingFace ? "Verificando..." : "Ingresar con Face ID"}
        </button>

        {/* ── Google — enlace/botón secundario ── */}
        <button
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading || loadingFace}
          style={{
            width: "100%",
            padding: "11px 20px",
            background: "transparent",
            color: "#0D1629",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            opacity: (loading || loadingFace) ? 0.5 : 1,
            transition: "opacity 0.2s",
            textDecoration: "underline",
            textDecorationColor: "rgba(13,22,41,0.3)",
            textUnderlineOffset: 3,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          {loading ? "Iniciando sesión..." : "Ingresar con cuenta de Google"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.22)",
            borderRadius: 10,
            color: "#B91C1C",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* ── Versión — esquina inferior, gris pequeño ── */}
        <div style={{
          marginTop: "auto",
          paddingTop: 16,
          textAlign: "center",
          fontSize: 11,
          color: "#9CA3AF",
          letterSpacing: 0.2,
        }}>
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
