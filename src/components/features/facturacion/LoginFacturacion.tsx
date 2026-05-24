// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState } from "react";
import { T } from "../../../config/theme";
import { EMISOR } from "../../../config/constants";

// ── Endpoint de la API de facturación ─────────────────────────────
// Configura VITE_FACTURACION_API_URL en tu .env
const API_URL = (import.meta.env.VITE_FACTURACION_API_URL ?? "").replace(/\/$/, "");

interface LoginFacturacionProps {
  onLoginSuccess: (token: string, user: { nombre: string; email: string; rol: string }) => void;
}

export default function LoginFacturacion({ onLoginSuccess }: LoginFacturacionProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Validación controlada (evita el error nativo del navegador
  //    "The string did not match the expected pattern.") ──────────
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const puedeEnviar = emailValido && password.length >= 6;

  const handleSubmit = async () => {
    if (!puedeEnviar) return;
    if (!API_URL) {
      setError("VITE_FACTURACION_API_URL no está configurado en el .env");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Credenciales inválidas. Intenta de nuevo.");
        return;
      }

      // Guardamos el JWT en localStorage para uso posterior
      localStorage.setItem("facturacion_token", data.token);
      localStorage.setItem("facturacion_user", JSON.stringify(data.user));

      onLoginSuccess(data.token, data.user);
    } catch (e) {
      setError("No se pudo conectar con el servidor de facturación. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  // Enter key submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && puedeEnviar && !loading) handleSubmit();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "#F8FAFF",
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    fontSize: 15,
    color: T.text,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.18s",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: T.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 6,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(145deg, #0D1B3E 0%, #1A2F6B 50%, #0D1B3E 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Halos decorativos */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%",
        width: "55%", height: "55%",
        background: "radial-gradient(ellipse, rgba(37,99,235,0.22) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-15%", left: "-10%",
        width: "50%", height: "50%",
        background: "radial-gradient(ellipse, rgba(37,99,235,0.16) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          borderRadius: 20,
          padding: "32px 28px 28px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        {/* Logo + nombre sistema */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#FFF", fontWeight: 900, fontSize: 16, letterSpacing: "-0.5px" }}>8M</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: T.text, lineHeight: 1.2 }}>8 Millas</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Sistema de Facturación Electrónica</div>
          </div>
        </div>

        {/* Título */}
        <div style={{ fontWeight: 800, fontSize: 26, color: T.text, marginBottom: 4 }}>Bienvenido</div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 28 }}>
          Ingresa tus credenciales para continuar
        </div>

        {/* Campo email */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Correo electrónico</label>
          {/* Usamos type="text" para evitar la validación nativa del navegador
              y aplicamos nuestra propia validación por regex */}
          <input
            type="text"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={handleKeyDown}
            placeholder="usuario@empresa.pe"
            style={{
              ...inputStyle,
              borderColor: email && !emailValido ? T.red : T.border,
            }}
          />
          {email && !emailValido && (
            <div style={{ fontSize: 11, color: T.red, marginTop: 4, paddingLeft: 4 }}>
              Ingresa un correo electrónico válido
            </div>
          )}
        </div>

        {/* Campo contraseña */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              style={{
                ...inputStyle,
                paddingRight: 48,
                borderColor: T.border,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: T.muted, padding: 4, display: "flex",
              }}
              tabIndex={-1}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Error del servidor */}
        {error && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", marginBottom: 16,
              background: "#FEF2F2", border: "1.5px solid #FECACA",
              borderRadius: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* Botón ingresar */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!puedeEnviar || loading}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: puedeEnviar && !loading
              ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)"
              : "#CBD5E1",
            color: "#FFF",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: puedeEnviar && !loading ? "pointer" : "not-allowed",
            transition: "background 0.18s, transform 0.1s",
            boxShadow: puedeEnviar ? "0 6px 20px rgba(37,99,235,0.35)" : "none",
            letterSpacing: 0.2,
          }}
        >
          {loading ? "Verificando..." : "Ingresar al sistema"}
        </button>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            fontSize: 11,
            color: T.muted,
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          {EMISOR.razonSocial || "8 Millas S.A.C."} · RUC {EMISOR.ruc || "20601234567"} · {EMISOR.ciudad || "Huánuco, Perú"}
        </div>
      </div>
    </div>
  );
}
