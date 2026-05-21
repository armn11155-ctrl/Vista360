// TrashModal — App-15.tsx líneas 9853-10068
import React, { useState } from "react";
import { fb } from "../../services/firestore";
import { T } from "../../config/theme";
import { toast, confirmAsync } from "../../context/UIContext";
import type { Panel, Cliente, Contrato, Proveedor } from "../../types";

interface TrashModalProps {
  open: boolean; onClose: () => void;
  contratos: Contrato[]; clientes: Cliente[]; paneles: Panel[]; proveedores: Proveedor[];
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setPaneles: React.Dispatch<React.SetStateAction<Panel[]>>;
  setProveedores: React.Dispatch<React.SetStateAction<Proveedor[]>>;
}

export default function TrashModal({ open, onClose, contratos, clientes, paneles, proveedores,
  setContratos, setClientes, setPaneles, setProveedores }: TrashModalProps) {
  const [tab, setTab] = useState("paneles");
  if (!open) return null;

  const deleted = {
    paneles:    paneles.filter(p => p.deleted),
    clientes:   clientes.filter(c => c.deleted),
    contratos:  contratos.filter(c => c.deleted),
    proveedores:proveedores.filter(p => p.deleted),
  };

  const restore = async (col: string, id: string, setter: Function) => {
    await fb.patch(col as any, id, { deleted: false, deletedAt: null });
    setter((prev: any[]) => prev.map(x => x.id===id ? { ...x, deleted:false } : x));
    toast.success("Elemento restaurado");
  };

  const tabs = ["paneles","clientes","contratos","proveedores"];
  const items = deleted[tab as keyof typeof deleted] as any[];

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:500 }}/>
      <div style={{ position:"fixed", inset:0, zIndex:501, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div style={{ background:T.white, borderRadius:20, width:"100%", maxWidth:480,
          maxHeight:"80vh", overflowY:"auto", padding:"24px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontSize:18, fontWeight:800, color:T.text }}>🗑️ Papelera</span>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.muted }}>✕</button>
          </div>
          <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:"6px 12px", background:tab===t?T.accent:"#F1F5F9",
                  color:tab===t?"#fff":T.text, border:"none", borderRadius:8, fontSize:12,
                  fontWeight:600, cursor:"pointer", textTransform:"capitalize" }}>
                {t} ({(deleted[t as keyof typeof deleted]).length})
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:T.muted, fontSize:14 }}>Papelera vacía</div>
          ) : items.map(item => (
            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"12px 0", borderBottom:"1px solid "+T.border }}>
              <span style={{ fontSize:14, color:T.text }}>{item.nombre||item.empresa||item.descripcion||item.id}</span>
              <button onClick={() => {
                const setters: any = { paneles:setPaneles, clientes:setClientes, contratos:setContratos, proveedores:setProveedores };
                restore(tab, item.id, setters[tab]);
              }} style={{ padding:"6px 12px", background:T.green, color:"#fff",
                border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Restaurar
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
