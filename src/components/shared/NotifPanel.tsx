// NotifPanel — extraído de App-15.tsx líneas 10723+
// Implementación completa en App-15.tsx — este es un placeholder funcional
import React, { useState, useMemo } from "react";
import { T } from "../../config/theme";
import { fmt } from "../../lib/utils";
import type { Contrato, Cliente, Panel, Gasto } from "../../types";

interface NotifPanelProps {
  open: boolean; onClose: () => void;
  contratos: Contrato[]; clientes: Cliente[]; paneles: Panel[]; gastos: Gasto[];
}

export default function NotifPanel({ open, onClose, contratos, clientes, paneles }: NotifPanelProps) {
  if (!open) return null;
  const hoyD = new Date();
  const notifs = useMemo(() => {
    const lista: {id:string;titulo:string;desc:string;tipo:string}[] = [];
    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000);
      if (d > 0 && d <= 30) {
        const cliente = clientes.find(cl => cl.id === c.cliente_id);
        lista.push({ id:"cv_"+c.id, tipo:"contrato",
          titulo:"Contrato por vencer — "+(cliente?.empresa||"Cliente"),
          desc:"Vence en "+d+" días · "+fmt(c.monto)+"/mes" });
      }
    });
    paneles.forEach(p => {
      const tieneActivo = contratos.some(c => c.panel_id===p.id && new Date(c.fin)>hoyD);
      if (!tieneActivo) lista.push({ id:"pl_"+p.id, tipo:"panel",
        titulo:"Panel libre — "+p.nombre, desc:"Sin contrato activo." });
    });
    return lista;
  }, [contratos, clientes, paneles]);

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:300 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(360px,100vw)",
        background:T.white, zIndex:301, overflowY:"auto",
        paddingTop:"max(20px,env(safe-area-inset-top))",
        boxShadow:"-4px 0 24px rgba(0,0,0,0.12)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px 16px", borderBottom:"1px solid "+T.border }}>
          <span style={{ fontSize:17, fontWeight:800, color:T.text }}>🔔 Notificaciones</span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.muted }}>✕</button>
        </div>
        {notifs.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:T.muted, fontSize:14 }}>Sin notificaciones</div>
        ) : notifs.map(n => (
          <div key={n.id} style={{ padding:"14px 20px", borderBottom:"1px solid "+T.border }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>{n.titulo}</div>
            <div style={{ fontSize:12, color:T.muted }}>{n.desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
