// Paneles — extraído de App-15.tsx líneas 1928-2350
// Componente completo de gestión de paneles publicitarios
import React from "react";
import { fb } from "../../../services/firestore";
import { T } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { validate, fmt, haptic } from "../../../lib/utils";
import { toNumber } from "../../../lib/converters";
import { Modal, FieldGroup, Badge, Card, Spinner } from "../../ui";
import type { Panel, Contrato } from "../../../types";

// NOTA: El código completo del componente Paneles está en el archivo
// original App-15.tsx (líneas 1928–2350).
// Para completar la migración:
// 1. Copia las funciones y JSX desde App-15.tsx
// 2. Agrega los imports de arriba
// 3. Cambia las referencias globales por las importadas

interface PanelesProps {
  paneles: Panel[];
  setPaneles: React.Dispatch<React.SetStateAction<Panel[]>>;
  contratos: Contrato[];
  loading: boolean;
  setTab: (tab: string) => void;
  onModalChange: (open: boolean) => void;
}

// PLACEHOLDER — reemplazar con el código de App-15.tsx líneas 1928-2350
export default function Paneles({ paneles, loading }: PanelesProps) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 16 }}>
        📡 Paneles
      </div>
      {loading ? (
        <Spinner />
      ) : (
        paneles.map(p => (
          <Card key={p.id}>
            <div style={{ fontWeight: 700 }}>{p.emoji || "📡"} {p.nombre}</div>
            <div style={{ fontSize: 13, color: T.muted }}>{p.ciudad} · {p.tipo}</div>
            <Badge color={p.estado === "Disponible" ? T.green : T.amber} ch={p.estado}/>
          </Card>
        ))
      )}
    </div>
  );
}
