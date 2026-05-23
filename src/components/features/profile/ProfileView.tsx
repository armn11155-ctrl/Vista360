import type { User } from "firebase/auth";
import type { Contrato, Panel, Cliente, Gasto } from "../../../types";
import { T } from "../../../config/theme";

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


interface FirebaseStatusProps {
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  gastos: Gasto[];
  fbConnected: boolean;
  fbLoading: boolean;
  fbError: boolean;
}

export function FirebaseStatus({
  contratos,
  paneles,
  clientes,
  gastos,
  fbError,
  fbLoading,
}: FirebaseStatusProps) {
  const statusColor = fbError ? T.red : fbLoading ? T.amber : "#22C55E";
  const statusText = fbError ? "Error" : fbLoading ? "Conectando…" : "Conectado";

  return (
    <div
      style={{
        background: "#0E1835",
        borderRadius: 16,
        padding: 16,
        border: "1px solid rgba(59,110,248,0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Firebase · {statusText}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Contratos", value: contratos.length },
          { label: "Paneles", value: paneles.length },
          { label: "Clientes", value: clientes.length },
          { label: "Gastos", value: gastos.length },
        ].map(item => (
          <div
            key={item.label}
            style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileView({
  user,
  userName,
  contratos,
  paneles,
  clientes,
  gastos,
  loading,
  error,
  confirmLogout,
  setConfirmLogout,
  onLogout,
}: Props) {
  const userPhoto =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=64&bold=true`;

  return (
    <div className="v360-tab-panel v360-tab-padded">
      {/* ── Tarjeta de perfil ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          padding: "20px",
          background: "linear-gradient(135deg,#0E1835,#0A1228)",
          borderRadius: 20,
          border: "1px solid rgba(59,110,248,0.2)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
        }}
      >
        <img
          src={userPhoto}
          style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #3B82F6" }}
          alt="Foto de perfil"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{userName}</div>
          {user.email && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </div>
          )}
        </div>
      </div>

      {/* ── Botón cerrar sesión ── */}
      <button className="v360-btn-logout" onClick={() => setConfirmLogout(true)}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#EF4444"
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

      {/* ── Confirmación logout ── */}
      {confirmLogout && (
        <div className="v360-overlay">
          <div className="v360-confirm-box">
            <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>¿Cerrar sesión?</div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>
              Tendrás que volver a iniciar sesión con Google.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="v360-confirm-cancel" onClick={() => setConfirmLogout(false)}>
                Cancelar
              </button>
              <button className="v360-confirm-ok" onClick={onLogout}>
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado Firebase ── */}
      <FirebaseStatus
        contratos={contratos}
        paneles={paneles}
        clientes={clientes}
        gastos={gastos}
        fbConnected={!error && !loading}
        fbLoading={loading}
        fbError={!!error}
      />
    </div>
  );
}
