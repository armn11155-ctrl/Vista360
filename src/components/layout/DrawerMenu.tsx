// DrawerMenu — extraído de App-15.tsx líneas 10296-10510
import React from "react";
import { T } from "../../config/theme";
import { Logo360 } from "./Logo360";

const MENU_DRAWER = [
  { id:"hoy",        label:"Inicio",      icon:"🏠" },
  { id:"paneles",    label:"Paneles",     icon:"📡" },
  { id:"contratos",  label:"Contratos",   icon:"📄" },
  { id:"historico",  label:"Histórico",   icon:"📅" },
  { id:"crm",        label:"Clientes",    icon:"👥" },
  { id:"gastos",     label:"Gastos",      icon:"💸" },
  { id:"proveedores",label:"Proveedores", icon:"🤝" },
  { id:"facturacion",label:"Facturación", icon:"🧾" },
  { id:"resultados", label:"Resultados",  icon:"📊" },
  { id:"reportes",   label:"Reportes",    icon:"📈" },
  { id:"capital",    label:"Capital",     icon:"💰" },
  { id:"mapa",       label:"Mapa",        icon:"🗺️" },
];

interface DrawerMenuProps {
  open: boolean; onClose: () => void; activeTab: string;
  onTabClick: (tab: string) => void; onTrashOpen: () => void;
  trashCount?: number; userName?: string; userInitials?: string;
}

export default function DrawerMenu({ open, onClose, activeTab, onTabClick, onTrashOpen, trashCount=0, userName="", userInitials="?" }: DrawerMenuProps) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200 }}/>
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:280,
        background:T.white, zIndex:201, overflowY:"auto",
        paddingTop:"max(24px,env(safe-area-inset-top))",
        paddingBottom:"max(24px,env(safe-area-inset-bottom))",
        boxShadow:"4px 0 24px rgba(0,0,0,0.12)" }}>
        <div style={{ padding:"0 20px 20px", borderBottom:"1px solid "+T.border, marginBottom:8 }}>
          <Logo360 width={140}/>
          <div style={{ marginTop:16, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:T.accent,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontWeight:700, fontSize:14, flexShrink:0 }}>
              {userInitials}
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {userName || "Usuario"}
            </div>
          </div>
        </div>
        {MENU_DRAWER.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => { onTabClick(item.id); onClose(); }}
              style={{ display:"flex", alignItems:"center", gap:12, width:"100%",
                padding:"12px 20px", background:active?"rgba(37,99,235,0.08)":"none",
                border:"none", cursor:"pointer", textAlign:"left",
                color:active?T.accent:T.text, fontWeight:active?700:500, fontSize:14,
                borderLeft:active?"3px solid "+T.accent:"3px solid transparent" }}>
              <span style={{ fontSize:18 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
        <div style={{ margin:"8px 20px", height:1, background:T.border }}/>
        <button onClick={() => { onTrashOpen(); onClose(); }}
          style={{ display:"flex", alignItems:"center", gap:12, width:"100%",
            padding:"12px 20px", background:"none", border:"none", cursor:"pointer",
            color:T.muted, fontSize:14, fontWeight:500 }}>
          <span style={{ fontSize:18 }}>🗑️</span>
          Papelera {trashCount>0 && <span style={{ marginLeft:4, background:T.red, color:"#fff",
            borderRadius:99, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{trashCount}</span>}
        </button>
      </div>
    </>
  );
}
