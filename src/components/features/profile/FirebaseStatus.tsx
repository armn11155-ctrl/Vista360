import type { Contrato, Panel, Cliente, Gasto } from "../../../types";
import { T } from "../../../config/theme";

interface Props {
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  gastos: Gasto[];
  fbConnected: boolean;
  fbLoading: boolean;
  fbError: boolean;
}

export function FirebaseStatus({ contratos, paneles, clientes, gastos, fbError, fbLoading }: Props) {
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
