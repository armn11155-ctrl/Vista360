// Contratos — extraído de App-15.tsx líneas 2716-3251
import React, { useState, useMemo } from "react";
import { fb } from "../../../services/firestore";
import { T } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { validate, fmt, fmtF, dias, haptic } from "../../../lib/utils";
import { Modal, FieldGroup, Badge, Card, Pagination, Spinner } from "../../ui";
import { usePagination } from "../../../hooks/usePagination";
import type { Contrato, Panel, Cliente } from "../../../types";

interface ContratosProps {
  contratos: Contrato[]; setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  paneles: Panel[]; clientes: Cliente[]; loading: boolean;
  setTab: (tab: string) => void; onModalChange: (open: boolean) => void;
}

// PLACEHOLDER — reemplazar con el código de App-15.tsx líneas 2716-3251
export default function Contratos({ contratos, paneles, clientes, loading }: ContratosProps) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 16 }}>📄 Contratos</div>
      {loading ? <Spinner/> : contratos.map(c => {
        const cliente = clientes.find(cl => cl.id === c.cliente_id);
        const panel   = paneles.find(p => p.id === c.panel_id);
        return (
          <Card key={c.id}>
            <div style={{ fontWeight: 700 }}>{cliente?.empresa || "—"}</div>
            <div style={{ fontSize: 13, color: T.muted }}>{panel?.nombre} · {fmt(c.monto)}/mes</div>
            <div style={{ fontSize: 12, color: T.muted }}>Hasta: {c.fin}</div>
            <Badge color={c.pagado ? T.green : T.amber} ch={c.pagado ? "Pagado" : "Pendiente"}/>
          </Card>
        );
      })}
    </div>
  );
}
