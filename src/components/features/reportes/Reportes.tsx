// Reportes — migrado de App-15.tsx (líneas 8139-8803)
// Imports pre-configurados. Pegar código del original entre los imports y el export.
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { fb } from "../../../services/firestore";
import { T } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { fmt, fmtF, dias, mesLabel, validate, haptic } from "../../../lib/utils";
import { toNumber, toDate } from "../../../lib/converters";
import { Modal, FieldGroup, Badge, Tag, Card, SecTit, Pagination, Spinner, SwipeRow } from "../../ui";
import { usePagination } from "../../../hooks/usePagination";
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura } from "../../../types";

// TODO: Pegar aqui el cuerpo del componente desde App-15.tsx líneas 8139-8803
export default function Reportes(props: any) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 12 }}>Reportes</div>
      <div style={{ fontSize: 13, color: T.muted, background: "#EFF4FF", padding: 16, borderRadius: 12 }}>
        Copia el código desde App-15.tsx líneas 8139-8803 e insértalo aquí.
        Los imports ya están configurados.
      </div>
    </div>
  );
}
