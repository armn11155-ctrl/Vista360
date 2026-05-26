import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import type { Gasto } from "../../../types";
import { T } from "../../../config/theme";
import { db } from "../../../config/firebase";
import { collection, getCountFromServer } from "firebase/firestore";

interface Props {
  user: User;
  userName: string;
  gastos: Gasto[];
  confirmLogout: boolean;
  setConfirmLogout: (v: boolean) => void;
  onLogout: () => Promise<void>;
}

interface FirebaseStatusProps {
  gastos: Gasto[];
  fbConnected: boolean;
  fbLoading: boolean;
  fbError: boolean;
}

export function FirebaseStatus(_: FirebaseStatusProps) {
  return null;
}

// Fórmula real de Firestore importada desde lib/firestoreSize.ts

export function ProfileView({
  user,
  userName,
  gastos,
  confirmLogout,
  setConfirmLogout,
  onLogout,
}: Props) {
  const [fbStatus, setFbStatus] = useState<"checking" | "ok" | "error">("checking");
  const [projectId] = useState(() => {
    try {
      return (db as any)._databaseId?.projectId || "base-de-datos-vista360";
    } catch {
      return "base-de-datos-vista360";
    }
  });

  useEffect(() => {
    getCountFromServer(collection(db, "paneles"))
      .then(() => setFbStatus("ok"))
      .catch(() => setFbStatus("error"));
  }, []);

  // ── Conteo REAL de documentos por colección (exacto, via SDK) ──
  const COLS_VISTA360 = [
    { nombre: "paneles", emoji: "", color: "#3B82F6" },
    { nombre: "contratos", emoji: "", color: "#22C55E" },
    { nombre: "clientes", emoji: "", color: "#A855F7" },
    { nombre: "gastos", emoji: "", color: T.white },
    { nombre: "proveedores", emoji: "", color: "#EC4899" },
    { nombre: "facturas", emoji: "", color: "#06B6D4" },
    { nombre: "sueldos", emoji: "", color: "#10B981" },
  ] as const;

  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [fsLoading, setFsLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      COLS_VISTA360.map(async c => {
        try {
          const snap = await getCountFromServer(collection(db, c.nombre));
          return [c.nombre, snap.data().count] as const;
        } catch {
          return [c.nombre, 0] as const;
        }
      }),
    ).then(results => {
      setDocCounts(Object.fromEntries(results));
      setFsLoading(false);
    });
  }, []);

  const totalDocs = Object.values(docCounts).reduce((a, b) => a + b, 0);
  const fotosCount = gastos.filter(g => (g as any).fotoUrl || (g as any).foto_url).length;

  const DARK = "#0E1835";
  const CARD_BG = "#ffffff";

  const userPhoto =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=128&bold=true`;

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ── Hero ── */}
      <div
        style={{
          background: "linear-gradient(135deg,#0E1835 0%,#0A1228 100%)",
          padding: "24px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: "1px solid rgba(59,110,248,0.15)",
        }}
      >
        <img
          src={userPhoto}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "3px solid #3B82F6",
            flexShrink: 0,
          }}
          alt="Foto"
        />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>
            {userName}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>8 Millas</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {user.email}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* ── Cerrar sesión ── */}
        <button
          onClick={() => setConfirmLogout(true)}
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "14px",
            background: CARD_BG,
            color: T.red,
            border: `1px solid rgba(239,68,68,0.25)`,
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>

        {/* ── Firebase & Alertas header card ── */}
        <div
          style={{
            background: "linear-gradient(135deg,#1E3A8A,#1E40AF)",
            borderRadius: 16,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          ></div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Firebase & Alertas</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              Base de datos, storage y notificaciones
            </div>
          </div>
        </div>

        {/* ── Status banner ── */}
        <div
          style={{
            background:
              fbStatus === "ok"
                ? "rgba(34,197,94,0.1)"
                : fbStatus === "error"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(245,158,11,0.1)",
            border: `1px solid ${fbStatus === "ok" ? "rgba(34,197,94,0.3)" : fbStatus === "error" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: fbStatus === "ok" ? "#22C55E" : fbStatus === "error" ? T.red : T.white,
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: fbStatus === "ok" ? "#16A34A" : fbStatus === "error" ? T.red : T.white,
              }}
            >
              {fbStatus === "ok"
                ? " Firebase conectado"
                : fbStatus === "error"
                  ? " Error de conexión"
                  : " Verificando…"}
            </span>
          </div>
          {fbStatus === "ok" && (
            <div style={{ fontSize: 12, color: "#15803D", marginLeft: 18 }}>
              Proyecto: {projectId} · Firestore + Storage activos
            </div>
          )}
        </div>

        {/* ── Firestore usage ── */}
        <div style={{ background: DARK, borderRadius: 18, padding: "18px 16px", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Uso de base de datos — Firebase Firestore
          </div>

          {/* Total bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              Documentos almacenados
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#22C55E" }}>
              {fsLoading ? "…" : totalDocs.toLocaleString("es-PE")}
            </span>
          </div>

          {/* Botón directo a Firebase Console — única fuente de verdad del almacenamiento */}
          <a
            href={`https://console.firebase.google.com/project/${projectId}/firestore/usage`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 14,
              textDecoration: "none",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                Ver almacenamiento real
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Firebase Console → Firestore → Uso
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          {/* Conteo real por colección */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}
          >
            {COLS_VISTA360.map(c => (
              <div
                key={c.nombre}
                style={{ background: CARD_BG, borderRadius: 14, padding: "14px 14px" }}
              >
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                  {c.emoji} {c.nombre}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>
                  {fsLoading ? "…" : (docCounts[c.nombre] ?? 0).toLocaleString("es-PE")}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                  {(docCounts[c.nombre] ?? 0) === 1 ? "documento" : "documentos"}
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 99,
                    background: "#E5E7EB",
                    marginTop: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      background: c.color,
                      width:
                        totalDocs > 0
                          ? `${Math.max(2, ((docCounts[c.nombre] ?? 0) / totalDocs) * 100)}%`
                          : "2%",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
              <b style={{ color: "rgba(255,255,255,0.7)" }}>
                Firebase Firestore (Plan Spark gratuito):
              </b>{" "}
              1 GiB almacenamiento · 50,000 lecturas/día · 20,000 escrituras/día · Sin límite de
              filas.
            </span>
          </div>
        </div>

        {/* ── Cloudinary ── */}
        <div style={{ background: DARK, borderRadius: 18, padding: "18px 16px", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Cloudinary — fotos de boletas
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              Fotos en Cloudinary
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#22C55E" }}>{fotosCount}</span>
          </div>
          <a
            href="https://console.cloudinary.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 8,
              textDecoration: "none",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                Ver almacenamiento real
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Cloudinary Console → Media Library
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            {fotosCount} foto{fotosCount !== 1 ? "s" : ""} de boletas · ~150 KB/foto comprimida
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
              <b style={{ color: "rgba(255,255,255,0.7)" }}>Cloudinary (Plan gratuito):</b> 25 GB de
              almacenamiento · Las fotos se comprimen a WebP ~25 KB antes de subir.
            </span>
          </div>
        </div>
      </div>

      {/* ── Confirmación logout ── */}
      {confirmLogout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 3000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "28px 24px 40px",
              width: "100%",
              maxWidth: 480,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: T.text }}>
              ¿Cerrar sesión?
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 28 }}>
              Tendrás que volver a iniciar sesión con Google.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: T.text,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onLogout}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: "none",
                  background: T.red,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
