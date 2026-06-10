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

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

async function registerWebAuthn(user: User): Promise<void> {
  if (!window.PublicKeyCredential) return;
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
    }
  } catch {
    /* silencioso — no es crítico */
  }
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [loadingFace, setLoadingFace] = useState(false);
  const [error, setError] = useState("");
  const [faceAvailable, setFaceAvailable] = useState(false);

  useEffect(() => {
    const credentialId = localStorage.getItem("v360-webauthn-credential");
    const supported = !!window.PublicKeyCredential;
    setFaceAvailable(supported && !!credentialId);
  }, []);

  /* ── Face ID ────────────────────────────────────── */
  const handleFaceID = async () => {
    setLoadingFace(true);
    setError("");
    try {
      const storedId = localStorage.getItem("v360-webauthn-credential");
      if (!storedId) throw new Error("no-credential");

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
          setError("Sesión expirada. Ingresa con Google.");
          setFaceAvailable(false);
        }
      }
    } catch (e) {
      const err = e as { message?: string };
      if (err.message === "no-credential") {
        setError("Face ID no registrado. Ingresa con Google primero.");
      } else {
        setError("Face ID falló. Intenta con Google.");
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

      /* Intentar registrar Face ID si aún no está guardado */
      const storedUid = localStorage.getItem("v360-webauthn-uid");
      if (window.PublicKeyCredential && storedUid !== user.uid) {
        await registerWebAuthn(user);
        setFaceAvailable(!!localStorage.getItem("v360-webauthn-credential"));
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
        setError("⚙️ API key de Firebase no válida. Verifica las Variables de Entorno en Cloudflare Pages.");
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
        opacity: 0,
        animation: "loginAppear 0.45s ease-out 0.05s forwards",
      }}
    >
      <style>{`
        @keyframes loginAppear { from { opacity:0 } to { opacity:1 } }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
          70% { box-shadow: 0 0 0 14px rgba(37,99,235,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
        }
      `}</style>

      {/* ── ZONA AZUL (top) ─────────────────────────────── */}
      <div
        style={{
          flex: "0 0 62%",
          background: "linear-gradient(170deg, #07101F 0%, #0D1629 55%, #111E35 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "max(20px, env(safe-area-inset-top))",
          paddingLeft: 24,
          paddingRight: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Halos decorativos */}
        <div style={{
          position: "absolute", top: "-25%", right: "-20%",
          width: "65%", height: "65%",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.2) 0%, transparent 70%)",
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
          marginBottom: 40,
          filter: "drop-shadow(0 0 30px rgba(37,99,235,0.3))",
        }}>
          <Logo360 width={220} />
        </div>

        {/* Saludo */}
        <div style={{
          fontSize: 15,
          color: "rgba(255,255,255,0.75)",
          fontWeight: 400,
          letterSpacing: 0.2,
          marginBottom: 6,
        }}>
          Hola,
        </div>
        <div style={{
          fontSize: 32,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: "-0.5px",
          textShadow: "0 2px 16px rgba(0,0,0,0.4)",
        }}>
          Alan Martínez
        </div>
      </div>

      {/* ── TARJETA BLANCA (bottom) ──────────────────────── */}
      <div
        style={{
          flex: "0 0 38%",
          background: "#FFFFFF",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center",
          paddingLeft: 28,
          paddingRight: 28,
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          paddingTop: 32,
          boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Config error banner */}
        {!API_KEY_OK && (
          <div style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 10,
            color: "#92400E",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "center",
          }}>
            ⚠️ <strong>Sin variables de entorno.</strong> Configura VITE_FIREBASE_* y haz nuevo deploy.
          </div>
        )}

        {/* Botón Face ID — solo si hay credencial registrada */}
        {faceAvailable && (
          <button
            onClick={handleFaceID}
            disabled={loadingFace || loading}
            style={{
              width: "100%",
              padding: "16px 20px",
              background: loadingFace ? "#1E3A6E" : "#0D1629",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 50,
              fontSize: 16,
              fontWeight: 700,
              cursor: loadingFace ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              animation: !loadingFace ? "pulseRing 2.5s ease-out infinite" : undefined,
              transition: "background 0.2s",
              marginBottom: 20,
            }}
          >
            {loadingFace ? (
              <span style={{ fontSize: 20 }}>⌛</span>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <path d="M8 15.5s1.5 2 4 2 4-2 4-2" />
                <path d="M9.5 7C10 6 11 5.5 12 5.5s2 .5 2.5 1.5" />
              </svg>
            )}
            {loadingFace ? "Verificando..." : "Ingresar con Face ID"}
          </button>
        )}

        {/* Botón Google — primario si no hay Face ID, enlace si hay */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading || loadingFace}
          style={{
            width: "100%",
            padding: faceAvailable ? "10px 20px" : "16px 20px",
            background: faceAvailable ? "transparent" : "#0D1629",
            color: faceAvailable ? "#0D1629" : "#FFFFFF",
            border: "none",
            borderRadius: faceAvailable ? 8 : 50,
            fontSize: faceAvailable ? 15 : 16,
            fontWeight: faceAvailable ? 600 : 700,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textDecoration: faceAvailable ? "underline" : "none",
            textDecorationColor: "rgba(13,22,41,0.35)",
            opacity: (loading || loadingFace) ? 0.55 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {!faceAvailable && (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
          )}
          {loading ? "Iniciando sesión..." : "Ingresar con cuenta de Google"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 10,
            color: "#B91C1C",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "center",
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Versión */}
      <div style={{
        position: "absolute",
        bottom: "max(10px, calc(env(safe-area-inset-bottom) + 4px))",
        left: 0, right: 0,
        fontSize: 11,
        color: "rgba(255,255,255,0.22)",
        textAlign: "center",
      }}>
        Vista360 v1.0 · © 2026
      </div>
    </div>
  );
}

export default LoginScreen;
