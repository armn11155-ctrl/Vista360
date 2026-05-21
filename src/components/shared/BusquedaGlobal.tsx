// BusquedaGlobal — App-15.tsx líneas 10146-10295
import React, { useState, useMemo } from "react";
import { T } from "../../config/theme";
import type { Panel, Cliente, Contrato } from "../../types";

interface BusquedaGlobalProps {
  open: boolean; onClose: () => void;
  paneles: Panel[]; clientes: Cliente[]; contratos: Contrato[];
  onNavigate: (tab: string) => void;
}

export default function BusquedaGlobal({ open, onClose, paneles, clientes, onNavigate }: BusquedaGlobalProps) {
  const [q, setQ] = useState("");
  if (!open) return null;
  const lq = q.toLowerCase();
  const results = q.length < 2 ? [] : [
    ...paneles.filter(p => p.nombre.toLowerCase().includes(lq)).map(p => ({ label:p.nombre, sub:p.ciudad, tab:"paneles" })),
    ...clientes.filter(c => c.empresa.toLowerCase().includes(lq)).map(c => ({ label:c.empresa, sub:c.sector||"", tab:"crm" })),
  ];
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:400 }}/>
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:401, padding:"12px 16px",
        paddingTop:"max(12px,env(safe-area-inset-top))",
        background:T.white, boxShadow:"0 8px 32px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar paneles, clientes, contratos…"
            style={{ flex:1, padding:"10px 14px", border:"1px solid "+T.border,
              borderRadius:12, fontSize:14, fontFamily:"inherit", outline:"none" }}/>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.muted }}>✕</button>
        </div>
        {results.map((r, i) => (
          <button key={i} onClick={() => { onNavigate(r.tab); onClose(); setQ(""); }}
            style={{ display:"flex", flexDirection:"column", width:"100%", padding:"10px 4px",
              background:"none", border:"none", borderBottom:"1px solid "+T.border,
              cursor:"pointer", textAlign:"left" }}>
            <span style={{ fontSize:14, fontWeight:600, color:T.text }}>{r.label}</span>
            <span style={{ fontSize:12, color:T.muted }}>{r.sub}</span>
          </button>
        ))}
        {q.length >= 2 && results.length === 0 && (
          <div style={{ padding:"16px 4px", fontSize:13, color:T.muted }}>Sin resultados para "{q}"</div>
        )}
      </div>
    </>
  );
}
