import React from "react";
import { T } from "../../config/theme";
import { BOTTOM_TABS_LIST, NAV_TAB_IDS } from "../../config/constants";

const BTM_ICONS: Record<string, React.ReactNode> = {
  hoy:       <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  paneles:   <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>,
  contratos: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  crm:       <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
};

interface BottomTabBarProps {
  activeTab: string;
  onTabClick: (tab: string) => void;
  onScanPress: () => void;
}

export default function BottomTabBar({ activeTab, onTabClick, onScanPress }: BottomTabBarProps) {
  return (
    <div style={{ position:"fixed", bottom:"calc(env(safe-area-inset-bottom) + 4px)",
      left:12, right:12, zIndex:100, pointerEvents:"none" }}>
      <div role="tablist" aria-label="Navegación principal" style={{
        display:"flex", alignItems:"center", padding:"6px 6px", maxWidth:480, margin:"0 auto",
        pointerEvents:"auto", background:T.white, border:"1px solid rgba(229,231,235,0.9)",
        borderRadius:28, boxShadow:"0 8px 28px rgba(15,23,41,0.14), 0 2px 8px rgba(15,23,41,0.06)",
      }}>
        {BOTTOM_TABS_LIST.map(t => {
          if (t.id === "__add__") return (
            <div key="add" style={{ flex:1, display:"flex", justifyContent:"center" }}>
              <button aria-label="Agregar gasto" onClick={onScanPress} style={{
                width:54, height:54, borderRadius:"50%",
                background:"linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
                border:"3px solid rgba(255,255,255,0.95)", cursor:"pointer",
                touchAction:"manipulation", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 8px 24px rgba(37,99,235,0.42)", marginTop:-28,
              }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          );
          const active = activeTab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active} aria-label={t.label}
              tabIndex={active?0:-1} onClick={() => onTabClick(t.id)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:3, background:active?"rgba(37,99,235,0.08)":"none",
                border:"none", cursor:"pointer", touchAction:"manipulation",
                color:active?T.accent:"#9CA3AF", padding:"6px 4px", minHeight:48,
                borderRadius:18, margin:"0 2px", transition:"background 0.18s, color 0.18s" }}>
              <div style={{ transition:"transform 0.18s cubic-bezier(.34,1.56,.64,1)",
                transform:active?"scale(1.12)":"scale(1)" }}>
                {BTM_ICONS[t.id]}
              </div>
              <span style={{ fontSize:10, fontWeight:active?700:500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
