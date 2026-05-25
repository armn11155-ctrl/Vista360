import { useMemo } from "react";
import type { User } from "firebase/auth";
import type { Contrato, Panel, Cliente, Gasto } from "../../../types";
import { T } from "../../../config/theme";
import { fmt, fmtF, dias } from "../../../lib/utils";

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
  const statusText = fbError ? "Error de conexión" : fbLoading ? "Conectando…" : "Conectado";
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
  const DARK = "#0E1835";
  const hoyStr = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const activos = contratos.filter(c => !c.deleted && c.fin >= hoyStr);
    const ingresosMes = activos.filter(c => c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
    const pendiente = activos.filter(c => !c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
    const vencen30 = activos.filter(c => {
      const d = dias(c.fin);
      return d >= 0 && d <= 30;
    }).length;
    const panelsOcup = new Set(activos.filter(c => c.inicio <= hoyStr).map(c => c.panel_id)).size;
    const gastosMes = (() => {
      const m = new Date().toISOString().slice(0, 7);
      return gastos
        .filter(g => (g.fecha || "").startsWith(m))
        .reduce((a, g) => a + Number(g.monto || 0), 0);
    })();
    const utilidad = ingresosMes - gastosMes;
    return {
      activos: activos.length,
      ingresosMes,
      pendiente,
      vencen30,
      panelsOcup,
      gastosMes,
      utilidad,
    };
  }, [contratos, gastos, hoyStr]);

  const proximosVencer = useMemo(
    () =>
      contratos
        .filter(c => !c.deleted && c.fin >= hoyStr)
        .map(c => ({
          ...c,
          d: dias(c.fin),
          panel: paneles.find(p => p.id === c.panel_id),
          cliente: clientes.find(cl => cl.id === c.cliente_id),
        }))
        .filter(c => c.d <= 60)
        .sort((a, b) => a.d - b.d)
        .slice(0, 5),
    [contratos, paneles, clientes, hoyStr],
  );

  const userPhoto =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=128&bold=true`;

  const kpis = [
    { label: "Ingresado este mes", val: fmt(stats.ingresosMes), color: T.green, icon: "💰" },
    { label: "Por cobrar", val: fmt(stats.pendiente), color: T.amber, icon: "⏳" },
    { label: "Gastos del mes", val: fmt(stats.gastosMes), color: T.red, icon: "📤" },
    {
      label: "Utilidad neta",
      val: fmt(stats.utilidad),
      color: stats.utilidad >= 0 ? T.green : T.red,
      icon: "📈",
    },
    { label: "Contratos activos", val: String(stats.activos), color: T.accent, icon: "📋" },
    {
      label: "Paneles ocupados",
      val: `${stats.panelsOcup} / ${paneles.length}`,
      color: T.cyan,
      icon: "🏙️",
    },
    {
      label: "Vencen en 30 días",
      val: String(stats.vencen30),
      color: stats.vencen30 > 0 ? T.amber : T.muted,
      icon: "⚠️",
    },
    {
      label: "Clientes totales",
      val: String(clientes.filter(c => !c.deleted).length),
      color: T.purple,
      icon: "👥",
    },
  ];

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ── Hero banner ── */}
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
          alt="Foto"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            {userName}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
            {user.email}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
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
            <span
              style={{
                background: "rgba(16,185,129,0.2)",
                color: "#6EE7B7",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              ● Activo
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* ── KPIs ── */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Resumen del mes
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {kpis.map(k => (
            <div
              key={k.label}
              style={{
                background: DARK,
                border: "1px solid rgba(79,124,255,0.12)",
                borderRadius: 16,
                padding: "14px 14px",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                {loading ? "—" : k.val}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Próximos a vencer ── */}
        {proximosVencer.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Próximos a vencer
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {proximosVencer.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: DARK,
                    border: `1px solid ${c.d <= 7 ? "rgba(239,68,68,0.3)" : c.d <= 30 ? "rgba(245,158,11,0.25)" : "rgba(79,124,255,0.12)"}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background:
                        c.d <= 7
                          ? "rgba(239,68,68,0.15)"
                          : c.d <= 30
                            ? "rgba(245,158,11,0.15)"
                            : "rgba(37,99,235,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {c.d <= 7 ? "🚨" : c.d <= 30 ? "⚠️" : "📋"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.panel?.nombre || "Panel"} · {c.cliente?.empresa || "Cliente"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                      Vence {fmtF(c.fin)} · {fmt(Number(c.monto || 0))}/mes
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: c.d <= 7 ? T.red : c.d <= 30 ? T.amber : T.accent,
                      flexShrink: 0,
                    }}
                  >
                    {c.d}d
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Estado Firebase ── */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Estado del sistema
        </div>
        <FirebaseStatus
          contratos={contratos}
          paneles={paneles}
          clientes={clientes}
          gastos={gastos}
          fbConnected={!error && !loading}
          fbLoading={loading}
          fbError={!!error}
        />

        {/* ── Cerrar sesión ── */}
        <button
          onClick={() => setConfirmLogout(true)}
          style={{
            width: "100%",
            marginTop: 20,
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
