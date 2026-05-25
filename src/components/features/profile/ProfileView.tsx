import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import type { Contrato, Panel, Cliente, Gasto } from "../../../types";

import { T } from "../../../config/theme";
import { db } from "../../../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

interface Props {
  user: User;
  userName: string;
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  gastos: Gasto[];
  loading: boolean;
  error: string | null;
  confirmLogout: boolean;
  setConfirmLogout: (v: boolean) => void;
  onLogout: () => Promise<void>;
}

type ServiceStatus = "checking" | "ok" | "error";

export function ProfileView({ user, userName, confirmLogout, setConfirmLogout, onLogout }: Props) {
  const [firestoreStatus, setFirestoreStatus] = useState<ServiceStatus>("checking");
  const [storageStatus, setStorageStatus] = useState<ServiceStatus>("checking");

  useEffect(() => {
    // Check Firestore
    getDocs(collection(db, "paneles"))
      .then(() => setFirestoreStatus("ok"))
      .catch(() => setFirestoreStatus("error"));

    // Check Firebase Storage
    const storage = getStorage();
    getDownloadURL(ref(storage, "ping.txt"))
      .then(() => setStorageStatus("ok"))
      .catch(err => {
        // storage/object-not-found means storage IS reachable, file just doesn't exist
        if (err?.code === "storage/object-not-found") {
          setStorageStatus("ok");
        } else {
          setStorageStatus("error");
        }
      });
  }, []);

  const userPhoto =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=128&bold=true`;

  const DARK = "#0E1835";

  const dot = (status: ServiceStatus) => {
    const color = status === "ok" ? "#22C55E" : status === "error" ? T.red : T.amber;
    return (
      <div
        style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }}
      />
    );
  };

  const label = (status: ServiceStatus) =>
    status === "ok" ? "Conectado" : status === "error" ? "Error de conexión" : "Verificando…";

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ── Hero ── */}
      <div
        style={{
          background: "linear-gradient(135deg,#0E1835 0%,#0A1228 100%)",
          padding: "28px 20px 24px",
          borderBottom: "1px solid rgba(59,110,248,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 18,
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
          alt="Foto de perfil"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            {userName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <span
              style={{
                background: "rgba(37,99,235,0.25)",
                color: "#93C5FD",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              🏢 8 Millas
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {/* ── Servicios ── */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Servicios conectados
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {/* Firestore */}
          <div
            style={{
              background: DARK,
              border: "1px solid rgba(79,124,255,0.15)",
              borderRadius: 16,
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,160,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🔥
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Firebase Firestore</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Base de datos principal
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {dot(firestoreStatus)}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    firestoreStatus === "ok"
                      ? "#22C55E"
                      : firestoreStatus === "error"
                        ? T.red
                        : T.amber,
                }}
              >
                {label(firestoreStatus)}
              </span>
            </div>
          </div>

          {/* Storage */}
          <div
            style={{
              background: DARK,
              border: "1px solid rgba(79,124,255,0.15)",
              borderRadius: 16,
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(37,99,235,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🗄️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Firebase Storage</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Almacenamiento de fotos
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {dot(storageStatus)}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    storageStatus === "ok"
                      ? "#22C55E"
                      : storageStatus === "error"
                        ? T.red
                        : T.amber,
                }}
              >
                {label(storageStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Cerrar sesión ── */}
        <button
          onClick={() => setConfirmLogout(true)}
          style={{
            width: "100%",
            padding: "15px",
            background: "rgba(239,68,68,0.08)",
            color: T.red,
            border: "1px solid rgba(239,68,68,0.2)",
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
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
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
