
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE — Vite + npm (firebase package instalado)
// ══════════════════════════════════════════════════════════════════
import { initializeApp }    from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey:            "AIzaSyCklWQStUPElsRfKH3icUZht-R321zgZY8",
  authDomain:        "base-de-datos-vista360.firebaseapp.com",
  projectId:         "base-de-datos-vista360",
  storageBucket:     "base-de-datos-vista360.firebasestorage.app",
  messagingSenderId: "421479773461",
  appId:             "1:421479773461:web:e38de4bfda177e232be51c",
};

// Inicializar Firebase con SDK modular
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const auth        = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// ── CLIENTE FIREBASE — SDK modular ──────────────────────────────
const fb = {
  async get(col) {
    try {
      const q    = query(collection(db, col), orderBy("createdAt","desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      try {
        const snap = await getDocs(collection(db, col));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) { return []; }
    }
  },
  async post(col, body) {
    const payload = { ...body, createdAt: serverTimestamp() };
    const ref     = await addDoc(collection(db, col), payload);
    return [{ ...body, id: ref.id }];
  },
  async patch(col, id, body) {
    await updateDoc(doc(db, col, id), body);
    return [{ ...body, id }];
  },
  // Borrado logico: marca el doc con deleted:true en vez de eliminarlo.
  // Pasa hardDelete:true solo si realmente quieres borrar para siempre (ej: gastos).
  async del(col, id, { hardDelete = false } = {}) {
    if (hardDelete) {
      await deleteDoc(doc(db, col, id));
    } else {
      await updateDoc(doc(db, col, id), {
        deleted:   true,
        deletedAt: serverTimestamp(),
      });
    }
  },
  async uploadImagen(path, file) {
    // Cloudinary unsigned upload — gratis 25GB, sin tarjeta
    const CLOUD_NAME = "djwhrurww";
    const PRESET     = "vista360_gastos";

    // Comprimir a WebP ~25KB antes de subir
    const webpBlob = await new Promise((res, rej) => {
      const img = new Image();
      const src = file instanceof File || file instanceof Blob ? URL.createObjectURL(file) : file;
      img.onload = () => {
        const w = Math.min(img.width, 1200);
        const h = Math.round(img.height * (w / img.width));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        c.toBlob(b => { URL.revokeObjectURL(src); b ? res(b) : rej(new Error("Blob vacío")); }, "image/webp", 0.72);
      };
      img.onerror = () => { URL.revokeObjectURL(src); rej(new Error("Imagen inválida")); };
      img.src = src;
    });

    const fd = new FormData();
    fd.append("file", webpBlob, "boleta.webp");
    fd.append("upload_preset", PRESET);
    fd.append("folder", "gastos");

    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: fd,
    });
    if (!resp.ok) throw new Error(`Cloudinary error: ${resp.status}`);
    const data = await resp.json();
    return data.secure_url;
  },
};

// ── CONSTANTES ───────────────────────────────────────────────────
const ESTADOS_CLI = ["Activo", "Por vencer", "Inactivo"];
const ESTADOS_PRO = ["En contacto", "Propuesta enviada", "Frío", "Perdido"];
const SECTORES    = ["Alimentación","Finanzas","Retail","Telecomunicaciones","Alimentos","Automotriz","Salud","Educación","Otro"];
const CIUDADES    = ["Lima","Arequipa","Trujillo","Chiclayo","Piura","Cusco","Iquitos","Huancayo","Tacna","Pucallpa","Huánuco","Otra"];
const CAT_GASTOS  = ["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"];
const CAT_PROVE   = ["Impresión","Materiales","Mantenimiento","Servicios","Transporte","Tecnología","Otro"];
const EMOJIS      = ["📡","🏙️","🌆","🛣️","🏬","🔄","🏪","🏢","🌉","🏟️"];

// ── DATOS DEL EMISOR (Vista360) ──────────────────────────────────
const EMISOR = {
  razonSocial: "8 MILLAS",
  ruc:         "20615629431",
  direccion:   "Jr. 28 de Julio Nro. 1279, Huánuco, Huánuco",
  ciudad:      "Huánuco",
  actividad:   "Publicidad (CIIU 7310)",
};

const hoy   = () => new Date();
const mesHoy= () => { const h=hoy(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`; };
const dias  = (f) => Math.ceil((new Date(f) - hoy()) / 86400000);
const fmt   = (n) => `S/ ${Number(n||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtF  = (s) => s ? new Date(s).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const mesLabel = (m) => new Date(m+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase());

// ── PALETA ───────────────────────────────────────────────────────
const C = {
  bg:"#F2F4F8", surface:"#FFFFFF", card:"#FFFFFF", border:"#E5E7EB",
  accent:"#2563EB", green:"#10B981", red:"#EF4444", amber:"#F59E0B",
  purple:"#7C3AED", cyan:"#0891B2", text:"#0F1729", muted:"#64748B", white:"#FFFFFF",
  sidebarBg:"#FFFFFF", contentBg:"#F2F4F8",
};
const eCol = (e) => ({"Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,"En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red}[e]||C.muted);
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};

// ── ATOMS ────────────────────────────────────────────────────────
const Badge  = ({color,ch})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Card   = ({children,style={}})=><div style={{background:"linear-gradient(145deg,rgba(14,24,42,0.95) 0%,rgba(8,14,26,0.98) 100%)",border:`1px solid rgba(79,124,255,0.13)`,borderRadius:16,padding:22,boxShadow:"0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",...style}}>{children}</div>;
const SecTit = ({ch})=><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>{ch}</div>;
const PgTit  = ({icon,title,sub})=><div style={{marginBottom:22}}><div style={{fontSize:22,fontWeight:800,color:"#0F1729",letterSpacing:"-0.5px"}}>{icon} {title}</div>{sub&&<div style={{fontSize:13,color:"#64748B",marginTop:3}}>{sub}</div>}</div>;
const Spinner= ()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:C.muted,fontSize:14,gap:10}}><div style={{width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>Cargando...</div>;


// ── INPUT FIELDS ─────────────────────────────────────────────────
const inp = (label,key,form,setForm,opts={})=>{
  const set=(v)=>setForm(f=>({...f,[key]:v}));
  const base={background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px",color:C.text,fontSize:16,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const onFocus=(e)=>{ setTimeout(()=>e.target.scrollIntoView({behavior:"smooth",block:"center"}),350); };
  const isNumeric = opts.numeric || opts.type==="number" || ["monto","precio","ruc","telefono","celular","dni"].some(k=>key.toLowerCase().includes(k));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>{label}</label>
      {opts.type==="select"
        ?<select value={form[key]||""} onChange={e=>set(e.target.value)} onFocus={onFocus} style={base}>
          {opts.options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        :opts.type==="textarea"
        ?<textarea value={form[key]||""} onChange={e=>set(e.target.value)} onFocus={onFocus} rows={3} placeholder={opts.ph||""} style={{...base,resize:"vertical"}}/>
        :<input type={opts.type||"text"} inputMode={isNumeric?"decimal":undefined} value={form[key]||""} placeholder={opts.ph||""} onChange={e=>set(e.target.value)} onFocus={onFocus} style={base}/>
      }
    </div>
  );
};

// ── MODAL BASE ───────────────────────────────────────────────────
function Modal({title,onClose,onSave,saveLabel="Guardar ✓",children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}>
        {/* Drag handle iOS */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:800,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:20,position:"sticky",bottom:0}}>
          <button onClick={onClose} style={{flex:1,padding:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontWeight:600,cursor:"pointer",fontSize:14,minHeight:46}}>Cancelar</button>
          <button onClick={onSave} style={{flex:2,padding:14,background:C.accent,border:"none",borderRadius:12,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer",minHeight:46}}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── FIELD GROUP — componente estable a nivel módulo ─────────────
// CRÍTICO: este componente debe estar fuera de funciones para que React
// no lo desmonte/remonte en cada render. Si está dentro, los inputs
// pierden foco al escribir (teclado se cierra dígito por dígito).
function FieldGroup({label,children}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</label>
      {children}
    </div>
  );
}

// ── LOGO — PNG real con fondo transparente ──────────────────────
// Logo Vista360 — usado en splash y app (separado del de 8 Millas que va en facturas)
const LOGO_VISTA360_B64 = "data:image/png;base64,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";

const LOGO_B64 = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAQABgADASIAAhEBAxEB/8QAHQABAAIBBQEAAAAAAAAAAAAAAAgJBwECBAUGA//EAGQQAQACAQMBBgIEBgsHDgwEBwABAgMEBREGBwgSITFBUWETInGBFDJCYpGhCRUWI1JygpKxsrMYJDQ1c9HTFyUzN0NjdIOToqO0wcMmNkRTVGRldZSk0tRFwsTwJyhGVYSV8f/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIRAxEAPwCGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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zNo4iZn5zHm6IByM2rz5rzbJkteZ97TzL4WtMzzMzLQAnzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==";
const DRAWER_LOGO_B64 = "data:image/png;base64,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";
const Logo360 = ({ width = 200, variant = "vista360" }) => (
  <img
    src={variant === "8millas" ? LOGO_B64 : LOGO_VISTA360_B64}
    alt={variant === "8millas" ? "8 Millas" : "Vista360"}
    width={width}
    style={{ display:"block", objectFit:"contain" }}
  />
);

// ── SPLASH ───────────────────────────────────────────────────────
function Splash({done}){
  const [f,setF]=useState(0);
  useEffect(()=>{
    const ts=[
      setTimeout(()=>setF(1), 150),   // outer ring + glow appears
      setTimeout(()=>setF(2), 650),   // inner ring + arc highlight sweeps
      setTimeout(()=>setF(3), 1300),  // logo fade-in + scale
      setTimeout(()=>setF(6), 3200),  // begin fade out
      setTimeout(done,        3800),
    ];
    return()=>ts.forEach(clearTimeout);
  },[]);

  return(
    <div style={{
      position:"absolute",
      top:0, right:0, bottom:0, left:0,
      zIndex:999,
      background:"#0E1A3B",
      display:"flex",alignItems:"center",justifyContent:"center",
      opacity:f>=6?0:1,
      transition:f>=6?"opacity .6s cubic-bezier(.4,0,.2,1)":"none",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes spArcLoop{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes spArcLoopRev{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(-360deg)}}
        @keyframes spGlowPulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
        @keyframes spRingPulse{0%,100%{opacity:.18;transform:translate(-50%,-50%) scale(1)}50%{opacity:.42;transform:translate(-50%,-50%) scale(1.04)}}
        @keyframes spStarTwinkle{0%,100%{opacity:.15}50%{opacity:.55}}
      `}</style>

      {/* ─── Tiny twinkling dots ─── */}
      {[
        {x:18,y:22,d:0},{x:82,y:14,d:1.5},{x:88,y:78,d:0.8},{x:12,y:82,d:2.2},
        {x:36,y:8,d:1.1},{x:64,y:90,d:0.4},{x:6,y:48,d:1.8},{x:94,y:46,d:0.6},
      ].map((s,i)=>(
        <div key={i} style={{
          position:"absolute",left:`${s.x}%`,top:`${s.y}%`,
          width:2,height:2,borderRadius:"50%",background:"#A8C0FF",
          boxShadow:"0 0 4px rgba(168,192,255,.7)",
          animation:`spStarTwinkle 3s ease-in-out ${s.d}s infinite`,
          opacity:f>=1?1:0,transition:"opacity 1s ease",
        }}/>
      ))}

      {/* ─── Outermost ring (animated pulse) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"50%",
        width:"160vmin",height:"160vmin",maxWidth:1200,maxHeight:1200,
        borderRadius:"50%",
        border:"1px solid rgba(140,180,255,.18)",
        boxShadow:"inset 0 0 80px rgba(80,120,255,.05)",
        opacity:f>=1?1:0,
        animation:f>=1?"spRingPulse 4.5s ease-in-out infinite":"none",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1.4s ease",
      }}/>

      {/* ─── Middle large ring (animated pulse, delayed) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"50%",
        width:"95vmin",height:"95vmin",maxWidth:720,maxHeight:720,
        borderRadius:"50%",
        border:"1px solid rgba(150,190,255,.22)",
        boxShadow:"inset 0 0 120px rgba(60,100,220,.08)",
        opacity:f>=1?1:0,
        animation:f>=1?"spRingPulse 4.5s ease-in-out 0.8s infinite":"none",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1.2s ease .15s",
      }}/>

      {/* ─── Inner ring (logo container, animated pulse) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"50%",
        width:"58vmin",height:"58vmin",maxWidth:440,maxHeight:440,
        borderRadius:"50%",
        border:"1px solid rgba(160,200,255,.28)",
        background:"radial-gradient(circle at 50% 50%, rgba(60,110,220,.28) 0%, rgba(30,60,140,.10) 55%, transparent 100%)",
        boxShadow:"inset 0 0 80px rgba(80,140,255,.14), 0 0 100px rgba(40,80,200,.25)",
        opacity:f>=2?1:0,
        animation:f>=2?"spRingPulse 4.5s ease-in-out 1.6s infinite":"none",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1s ease",
      }}/>

      {/* ─── Bright arc rotating (CW) ─── */}
      <svg style={{
        position:"absolute",left:"50%",top:"50%",
        width:"58vmin",height:"58vmin",maxWidth:440,maxHeight:440,
        opacity:f>=2?1:0,
        animation:f>=2?"spArcLoop 8s linear infinite":"none",
        transformOrigin:"center",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1s ease .2s",
        filter:"drop-shadow(0 0 12px rgba(120,170,255,.7))",
      }} viewBox="0 0 100 100">
        <defs>
          <linearGradient id="spArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4F7CFF" stopOpacity="0"/>
            <stop offset="50%" stopColor="#9BBBFF" stopOpacity="1"/>
            <stop offset="100%" stopColor="#4F7CFF" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M 14,50 A 36,36 0 0 1 86,50" fill="none" stroke="url(#spArc)" strokeWidth="0.7" strokeLinecap="round"/>
      </svg>

      {/* ─── Second bright arc rotating (CCW, outer ring) ─── */}
      <svg style={{
        position:"absolute",left:"50%",top:"50%",
        width:"95vmin",height:"95vmin",maxWidth:720,maxHeight:720,
        opacity:f>=2?0.7:0,
        animation:f>=2?"spArcLoopRev 12s linear infinite":"none",
        transformOrigin:"center",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1s ease .3s",
        filter:"drop-shadow(0 0 10px rgba(120,170,255,.5))",
      }} viewBox="0 0 100 100">
        <path d="M 18,50 A 32,32 0 0 1 82,50" fill="none" stroke="url(#spArc)" strokeWidth="0.5" strokeLinecap="round"/>
      </svg>

      {/* ─── Soft inner glow behind logo (stronger, centered) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"50%",
        width:"42vmin",height:"42vmin",maxWidth:340,maxHeight:340,
        borderRadius:"50%",
        background:"radial-gradient(circle, rgba(100,150,255,.32) 0%, rgba(60,100,220,.12) 45%, transparent 75%)",
        opacity:f>=2?1:0,
        animation:f>=2?"spGlowPulse 3.5s ease-in-out infinite":"none",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1s ease",
        pointerEvents:"none",
      }}/>

      {/* ─── Logo centrado ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"50%",
        transform:`translate(-50%,-50%) scale(${f>=3?1:0.85})`,
        zIndex:5,
        opacity:f>=3?1:0,
        transition:"opacity .9s cubic-bezier(.34,1.28,.64,1), transform 1.1s cubic-bezier(.34,1.28,.64,1)",
        filter:"drop-shadow(0 0 28px rgba(120,170,255,.65)) drop-shadow(0 0 8px rgba(180,200,255,.4))",
      }}>
        <Logo360 width={220}/>
      </div>
    </div>
  );
}

// ── DONUT / BARCHART ─────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════
// PANTALLAS
// ══════════════════════════════════════════════════════════════════



// ── MINI MAPA INTERACTIVO (formulario de paneles) ────────────────
// Mueve el pin → la dirección se llena sola via Nominatim
function MiniMapaPanel({lat,lng,nombre,foto,onMove}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const markerRef=useRef(null);
  const [ready,setReady]=useState(!!window.L);
  const [geocodingReverse,setGeocodingReverse]=useState(false);

  // Cargar Leaflet si no está ya
  useEffect(()=>{
    if(window.L){setReady(true);return;}
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload=()=>setReady(true);
    document.head.appendChild(s);
  },[]);

  // Geocodificación inversa — lat/lng → dirección legible
  const reverseGeocode=async(la,ln)=>{
    setGeocodingReverse(true);
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json&accept-language=es`);
      const d=await r.json();
      const addr=(d&&typeof d==="object"&&d.address)?d.address:{};
      const road=addr.road||addr.pedestrian||addr.suburb||"";
      const city=addr.city||addr.town||addr.county||addr.state||"";
      const short=road&&city?`${road}, ${city}`:(d&&d.display_name?d.display_name.split(",").slice(0,3).join(", "):`${la.toFixed(5)}, ${ln.toFixed(5)}`);
      onMove(la,ln,short);
    }catch(e){
      onMove(la,ln,`${la.toFixed(5)}, ${ln.toFixed(5)}`);
    }finally{
      setGeocodingReverse(false);
    }
  };

  // Inicializar mapa
  useEffect(()=>{
    if(!ready||!containerRef.current||mapRef.current) return;
    const map=window.L.map(containerRef.current,{center:[lat,lng],zoom:16,zoomControl:true,scrollWheelZoom:true});
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:"© OpenStreetMap",maxZoom:19
    }).addTo(map);

    const icon=window.L.divIcon({
      className:"",iconSize:[44,54],iconAnchor:[22,54],
      html:`<div style="display:flex;flex-direction:column;align-items:center;gap:0">
        <div style="width:40px;height:40px;border-radius:50%;background:white;border:3px solid #2563EB;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px #0005;cursor:grab">${foto}</div>
        <div style="width:2px;height:12px;background:#2563EB;margin-top:-2px"></div>
      </div>`,
    });
    const marker=window.L.marker([lat,lng],{icon,draggable:true}).addTo(map);
    marker.on("dragend",e=>{
      const p=e.target.getLatLng();
      reverseGeocode(p.lat,p.lng);
    });
    // También al hacer clic en el mapa, mueve el pin ahí
    map.on("click",e=>{
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat,e.latlng.lng);
    });
    markerRef.current=marker;
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;markerRef.current=null;};
  },[ready]);

  // Sincronizar si lat/lng cambian externamente
  useEffect(()=>{
    if(!mapRef.current||!markerRef.current) return;
    markerRef.current.setLatLng([lat,lng]);
    mapRef.current.setView([lat,lng],16);
  },[lat,lng]);

  return(
    <div style={{borderRadius:14,overflow:"hidden",border:`1px solid ${C.border}`,height:230,position:"relative"}}>
      {!ready&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.surface,color:C.muted,fontSize:13,zIndex:10}}>Cargando mapa…</div>}
      {geocodingReverse&&<div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",background:C.surface+"EE",borderRadius:8,padding:"5px 12px",fontSize:12,color:C.accent,zIndex:1000,fontWeight:600}}>📍 Obteniendo dirección…</div>}
      <div ref={containerRef} style={{height:"100%",width:"100%"}}/>
    </div>
  );
}

// ── GESTIÓN DE PANELES ───────────────────────────────────────────
function Paneles({paneles,setPaneles,loading,setTab,onModalChange}){
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);

  const empty={nombre:"",tipo:"LED",precio:0,estado:"Libre",foto:"📡",ciudad:"Lima",direccion:"",lat:"",lng:"",ancho:"",alto:"",iluminacion:"Sí",visibilidad:"",notas:""};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ setForm(empty); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(p)=>{ setForm({...p}); setModal(p); onModalChange?.(true); };

  const guardar=async()=>{
    if(!form.nombre.trim()) return alert("Escribe el nombre del panel");
    setSaving(true);
    const payload={nombre:form.nombre,tipo:form.tipo,precio:Number(form.precio)||0,estado:form.estado,foto:form.foto||"📡",ciudad:form.ciudad,direccion:form.direccion||"",lat:form.lat?String(form.lat):null,lng:form.lng?String(form.lng):null,ancho:form.ancho||"",alto:form.alto||"",iluminacion:form.iluminacion||"Sí",visibilidad:form.visibilidad||"",notas:form.notas||""};
    try{
      if(modal==="nuevo"){
        const r=await fb.post("paneles",payload);
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>[...p,saved]); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null); onModalChange?.(false);
        alert("✓ Panel guardado correctamente");
        if(payload.estado==="Ocupado"&&setTab) setTab("historico");
      } else {
        const r=await fb.patch("paneles",modal.id,payload);
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>p.map(x=>x.id===modal.id?saved:x)); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null); onModalChange?.(false);
        alert("✓ Panel actualizado correctamente");
        if(payload.estado==="Ocupado"&&setTab) setTab("historico");
      }
    }catch(e){ 
      setSaving(false); 
      alert("❌ Error al guardar:\n\n"+e.message); 
    }
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este panel? Los contratos asociados quedarán sin panel.")) return;
    await fb.del("paneles",id);
    setPaneles(p=>p.filter(x=>x.id!==id));
  };

  const libre=paneles.filter(p=>p.estado==="Libre").length;
  const ocup =paneles.filter(p=>p.estado==="Ocupado").length;

  // ── AUTOCOMPLETADO DE DIRECCIÓN EN TIEMPO REAL ──────────────────
  const [geocoding,setGeocoding]=useState(false);
  const [geocodeMsg,setGeocodeMsg]=useState("");
  const [sugerencias,setSugerencias]=useState([]);
  const [showSug,setShowSug]=useState(false);
  const debounceRef=useRef(null);

  const CITY_COORDS={
    "Lima":[-12.0464,-77.0428],"Arequipa":[-16.4090,-71.5375],"Trujillo":[-8.1116,-79.0288],
    "Chiclayo":[-6.7714,-79.8409],"Piura":[-5.1945,-80.6328],"Cusco":[-13.5320,-71.9675],
    "Iquitos":[-3.7491,-73.2538],"Huancayo":[-12.0651,-75.2049],"Tacna":[-18.0066,-70.2462],
    "Pucallpa":[-8.3791,-74.5539],"Huánuco":[-9.9306,-76.2422],"Cajamarca":[-7.1638,-78.5003],
    "Ica":[-14.0678,-75.7286],"Sullana":[-4.9044,-80.6855],"Juliaca":[-15.5000,-70.1333],
    "Ayacucho":[-13.1588,-74.2236],"Chimbote":[-9.0853,-78.5783],"Tumbes":[-3.5669,-80.4515],
    "Puno":[-15.8402,-70.0219],"Tarapoto":[-6.4850,-76.3722],"Moquegua":[-17.1942,-70.9329],
    "Moyobamba":[-6.0340,-76.9724],"Tingo María":[-9.2966,-75.9987],"Huaraz":[-9.5300,-77.5283],
    "Cerro de Pasco":[-10.6867,-76.2627],"Abancay":[-13.6385,-72.8805],"Andahuaylalas":[-13.6560,-73.3760],
    "Puerto Maldonado":[-12.5931,-69.1893],"Bagua":[-5.6519,-78.5267],"Chepen":[-7.2268,-79.4278],
  };

  // Buscar sugerencias en tiempo real mientras el usuario escribe
  const buscarSugerencias=useCallback(async(texto)=>{
    if(texto.length<3){ setSugerencias([]); return; }
    const query=`${texto}, ${form.ciudad||"Peru"}, Peru`;
    try{
      const r=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`);
      const d=await r.json();
      if(d.features?.length>0){
        const sug=d.features.map(f=>({
          label:[f.properties.name,f.properties.street,f.properties.city,f.properties.state].filter(Boolean).join(", "),
          lat:f.geometry.coordinates[1],
          lng:f.geometry.coordinates[0],
        }));
        setSugerencias(sug);
        setShowSug(true);
      } else { setSugerencias([]); }
    }catch(e){ setSugerencias([]); }
  },[form.ciudad]);

  const onDireccionChange=(val)=>{
    setForm(f=>({...f,direccion:val}));
    setGeocodeMsg("");
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(()=>buscarSugerencias(val),400);
  };

  const elegirSugerencia=(s)=>{
    setForm(f=>({...f,direccion:s.label,lat:s.lat.toFixed(6),lng:s.lng.toFixed(6)}));
    setGeocodeMsg(`✅ Ubicado: ${s.label}`);
    setSugerencias([]); setShowSug(false);
  };

  const geocodificar=async()=>{
    if(!form.direccion.trim()) return setGeocodeMsg("⚠️ Escribe una dirección primero");
    setGeocoding(true); setGeocodeMsg("🔍 Buscando..."); setSugerencias([]); setShowSug(false);
    const enc=encodeURIComponent(`${form.direccion}, ${form.ciudad||""}, Peru`);

    try{
      const r=await fetch(`https://photon.komoot.io/api/?q=${enc}&limit=1&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`);
      const d=await r.json();
      if(d.features?.length>0){
        const [lng,lat]=d.features[0].geometry.coordinates;
        const p=d.features[0].properties;
        setForm(f=>({...f,lat:lat.toFixed(6),lng:lng.toFixed(6)}));
        setGeocodeMsg(`✅ ${[p.name,p.street,p.city].filter(Boolean).join(", ")}`);
        setGeocoding(false); return;
      }
    }catch(e){}

    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=1&countrycodes=pe`,{headers:{"User-Agent":"Vista360/1.0","Accept-Language":"es"}});
      const d=await r.json();
      if(d.length>0){
        setForm(f=>({...f,lat:Number(d[0].lat).toFixed(6),lng:Number(d[0].lon).toFixed(6)}));
        setGeocodeMsg(`✅ ${d[0].display_name.split(",").slice(0,2).join(", ")}`);
        setGeocoding(false); return;
      }
    }catch(e){}

    const coords=CITY_COORDS[form.ciudad];
    if(coords){
      setForm(f=>({...f,lat:coords[0].toFixed(6),lng:coords[1].toFixed(6)}));
      setGeocodeMsg(`⚠️ Ubicado aprox. en ${form.ciudad}. Ajusta lat/lng si necesitas precisión.`);
    } else {
      setGeocodeMsg("❌ No encontrado. Prueba con la dirección más completa.");
    }
    setGeocoding(false);
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:22,fontWeight:800,color:"#0D1117",letterSpacing:"-0.02em"}}>Paneles</div>
        <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{paneles.length} paneles · {libre} libres · {ocup} ocupados</div>
      </div>
      <button onClick={openNew} style={{
        display:"inline-flex",alignItems:"center",gap:8,
        background:"#2563EB",border:"none",borderRadius:14,padding:"12px 18px",
        color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
        boxShadow:"0 6px 18px rgba(37,99,235,0.35)",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo Panel
      </button>
    </div>

    {loading?<Spinner/>:
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      {paneles.map(p=>{
        const ocupado=p.estado==="Ocupado";
        const stateColor=ocupado?"#EF4444":"#10B981";
        return (
        <div key={p.id} style={{
          position:"relative",overflow:"hidden",
          borderRadius:24,
          background:"linear-gradient(160deg,#0F1B36 0%,#0A1430 55%,#070E22 100%)",
          border:"1px solid rgba(255,255,255,0.06)",
          boxShadow:"0 14px 40px -18px rgba(8,12,30,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
          padding:20,
        }}>
          {/* Diagonal line texture */}
          <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.5,pointerEvents:"none"}}>
            <defs>
              <linearGradient id={`pl-${p.id}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#3B6BFF" stopOpacity="0.0"/>
                <stop offset="0.5" stopColor="#3B6BFF" stopOpacity="0.5"/>
                <stop offset="1" stopColor="#3B6BFF" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            {Array.from({length:14}).map((_,i)=>(
              <line key={i} x1={-100+i*70} y1="-50" x2={250+i*70} y2="450" stroke={`url(#pl-${p.id})`} strokeWidth={i%3===0?1.2:0.6} opacity={0.18+(i%3)*0.12}/>
            ))}
          </svg>

          <div style={{position:"relative"}}>
            {/* Top row: thumb + title + Libre pill */}
            <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
              <div style={{
                width:54,height:54,borderRadius:14,flexShrink:0,
                background:"linear-gradient(135deg,#5B8DEF,#243F8C)",
                display:"flex",alignItems:"center",justifyContent:"center",
                border:"1.5px solid rgba(255,255,255,0.18)",
                boxShadow:"0 6px 18px rgba(0,0,0,0.4)",
                fontSize:28,
              }}>{p.foto||"🏙️"}</div>
              <div style={{flex:1,minWidth:0,paddingTop:2}}>
                <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nombre}</div>
                <div style={{fontSize:13,color:"rgba(220,228,250,0.55)",marginTop:3}}>{p.ciudad}</div>
              </div>
              <div style={{
                padding:"6px 14px",borderRadius:999,
                border:`1.5px solid ${stateColor}`,
                color:stateColor,
                fontSize:13,fontWeight:700,
                background:"transparent",
                flexShrink:0,
              }}>{p.estado}</div>
            </div>

            {/* Address row */}
            {p.direccion&&(
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18,fontSize:13,color:"rgba(220,228,250,0.7)"}}>
                <span style={{fontSize:14}}>📍</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.direccion}</span>
              </div>
            )}

            {/* Tipo + Precio row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:14,alignItems:"stretch",marginBottom:18}}>
              <div style={{padding:"4px 4px"}}>
                <div style={{fontSize:11,color:"rgba(220,228,250,0.5)",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase"}}>Tipo</div>
                <div style={{fontSize:20,fontWeight:800,color:"#fff",marginTop:6,letterSpacing:"-0.01em"}}>{p.tipo}</div>
              </div>
              <div style={{
                borderRadius:14,
                border:"1px solid rgba(16,185,129,0.35)",
                background:"rgba(16,185,129,0.06)",
                padding:"10px 14px",
              }}>
                <div style={{fontSize:11,color:"#10B981",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase"}}>Precio/mes</div>
                <div style={{fontSize:22,fontWeight:800,color:"#10B981",marginTop:4,letterSpacing:"-0.02em",lineHeight:1}}>{fmt(p.precio)}</div>
              </div>
            </div>

            {/* Action row: white pill + circular trash */}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>openEdit(p)} style={{
                flex:1,
                display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"14px 20px",borderRadius:999,
                background:"#fff",border:"none",cursor:"pointer",
                color:"#2563EB",fontWeight:800,fontSize:15,
                fontFamily:"inherit",
                boxShadow:"0 4px 14px rgba(0,0,0,0.18)",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                Editar
              </button>
              <button onClick={()=>eliminar(p.id)} style={{
                width:50,height:50,borderRadius:"50%",flexShrink:0,
                background:"rgba(239,68,68,0.14)",
                border:"1px solid rgba(239,68,68,0.28)",
                cursor:"pointer",
                display:"inline-flex",alignItems:"center",justifyContent:"center",
                color:"#EF4444",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
        );
      })}
      {paneles.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#6B7280",background:"#fff",borderRadius:22,border:"1px dashed #E5E7EB"}}>Sin paneles registrados · <button onClick={openNew} style={{color:"#2563EB",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar el primero</button></div>}
    </div>}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Panel":"✏️ Editar Panel"} onClose={()=>{setModal(null);setGeocodeMsg("");onModalChange?.(false);}} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar Panel ✓"}>
        {/* Emoji selector */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>Ícono</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setForm(f=>({...f,foto:e}))}
                style={{width:40,height:40,borderRadius:8,border:`2px solid ${form.foto===e?C.accent:C.border}`,background:form.foto===e?C.accent+"22":"transparent",fontSize:20,cursor:"pointer"}}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {inp("Nombre del panel","nombre",form,setForm,{ph:"Panel Norte – Av. Principal"})}
          {inp("Ciudad","ciudad",form,setForm,{type:"select",options:CIUDADES})}
          {inp("Tipo","tipo",form,setForm,{type:"select",options:["LED","Lona"]})}
          {inp("Precio mensual ($)","precio",form,setForm,{type:"number"})}
          {inp("Estado","estado",form,setForm,{type:"select",options:["Libre","Ocupado"]})}
        </div>

        {/* Dimensiones e info física */}
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Información del panel</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {inp("Ancho (m)","ancho",form,setForm,{type:"number",ph:"ej: 4"})}
            {inp("Alto (m)","alto",form,setForm,{type:"number",ph:"ej: 3"})}
            {inp("Iluminación","iluminacion",form,setForm,{type:"select",options:["Sí","No"]})}
            {inp("Visibilidad","visibilidad",form,setForm,{ph:"ej: Alta, Media, Baja"})}
          </div>
          <div style={{marginTop:12}}>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Notas adicionales</label>
            <textarea
              value={form.notas||""}
              onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
              placeholder="Observaciones, características especiales, acceso, etc."
              rows={3}
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}
            />
          </div>
        </div>
        {/* Dirección con autocompletado en tiempo real */}
        <div style={{marginTop:12}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Dirección</label>
          <div style={{position:"relative"}}>
            <div style={{display:"flex",gap:8}}>
              <input
                value={form.direccion||""}
                onChange={e=>onDireccionChange(e.target.value)}
                placeholder="Av. Javier Prado Este 123, San Isidro…"
                autoComplete="off"
                style={{flex:1,background:C.surface,border:`1px solid ${showSug&&sugerencias.length>0?C.accent:C.border}`,borderRadius:showSug&&sugerencias.length>0?"10px 10px 0 0":"10px",padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",transition:"border .2s"}}
                onKeyDown={e=>{if(e.key==="Enter"){geocodificar();}if(e.key==="Escape"){setSugerencias([]);setShowSug(false);}}}
                onBlur={()=>setTimeout(()=>setShowSug(false),200)}
                onFocus={()=>sugerencias.length>0&&setShowSug(true)}
              />
              <button onClick={geocodificar} disabled={geocoding}
                style={{padding:"10px 16px",background:geocoding?C.border:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                {geocoding?"⏳":"📍 Ubicar"}
              </button>
            </div>
            {/* Dropdown sugerencias */}
            {showSug&&sugerencias.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:56,background:C.card,border:`1px solid ${C.accent}`,borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:999,overflow:"hidden",boxShadow:`0 8px 24px rgba(0,0,0,0.5)`}}>
                {sugerencias.map((s,i)=>(
                  <div key={i} onMouseDown={()=>elegirSugerencia(s)}
                    style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<sugerencias.length-1?`1px solid ${C.border}`:"none",fontSize:13,color:C.text,display:"flex",alignItems:"center",gap:8,transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{color:C.accent,flexShrink:0}}>📍</span>
                    <span style={{lineHeight:1.3}}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {geocodeMsg&&<div style={{marginTop:7,fontSize:12,color:geocodeMsg.startsWith("✅")?C.green:geocodeMsg.startsWith("⚠️")?C.amber:C.red,padding:"6px 10px",background:(geocodeMsg.startsWith("✅")?C.green:geocodeMsg.startsWith("⚠️")?C.amber:C.red)+"12",borderRadius:8}}>{geocodeMsg}</div>}
          {!geocodeMsg&&form.direccion&&form.direccion.length>=3&&!showSug&&<div style={{marginTop:6,fontSize:11,color:C.muted}}>💡 Escribe para ver sugerencias automáticas o presiona 📍 para ubicar</div>}
        </div>
        {/* Mini mapa interactivo — mueve el pin y la dirección se actualiza sola */}
        {(form.lat||form.lng)&&(
          <div style={{marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>📌 Ajusta el pin en el mapa</span>
              <button onClick={()=>setForm(f=>({...f,lat:"",lng:"",direccion:""}))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11}}>✕ Limpiar</button>
            </div>
            <MiniMapaPanel
              lat={Number(form.lat)}
              lng={Number(form.lng)}
              nombre={form.nombre||"Panel"}
              foto={form.foto||"📡"}
              onMove={(lat,lng,dir)=>setForm(f=>({...f,lat:lat.toFixed(6),lng:lng.toFixed(6),direccion:dir||f.direccion}))}
            />
            <div style={{marginTop:6,padding:"8px 12px",background:C.green+"12",border:`1px solid ${C.green}33`,borderRadius:8,fontSize:12,color:C.green}}>
              📍 {form.direccion||`${form.lat}, ${form.lng}`}
            </div>
            <div style={{marginTop:4,fontSize:11,color:C.muted,textAlign:"center"}}>Arrastra el marcador para ajustar — la dirección se actualiza automáticamente</div>
          </div>
        )}
        {!form.lat&&!form.lng&&(
          <div style={{marginTop:10,padding:"9px 13px",background:C.accent+"10",borderRadius:10,fontSize:12,color:C.muted}}>
            💡 Escribe la dirección y presiona <strong style={{color:C.accent}}>📍 Ubicar</strong> — luego ajusta el pin en el mapa si necesitas precisión.
          </div>
        )}
      </Modal>
    )}
  </div>);
}

// ── MAPA — Leaflet + OpenStreetMap (100% gratis) ─────────────────

function Mapa({paneles,clientes,contratos}){
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [sel,setSel]             = useState(null);
  const [leafletReady,setLeafletReady] = useState(false);

  const getInfo=(pid)=>{
    const c=contratos.find(x=>x.panel_id===pid);
    return c?{...c,cliente:clientes.find(x=>x.id===c.cliente_id)}:null;
  };

  const PERU_CENTER=[-9.19,-75.02];
  const cityCoords={
    "Lima":     [-12.0464,-77.0428],"Arequipa": [-16.409,-71.537],
    "Trujillo": [-8.112,-79.029],  "Chiclayo": [-6.771,-79.841],
    "Piura":    [-5.194,-80.633],  "Cusco":    [-13.532,-71.967],
    "Iquitos":  [-3.749,-73.254],  "Huancayo": [-12.065,-75.205],
    "Tacna":    [-18.006,-70.248], "Pucallpa": [-8.379,-74.554],
    "Otra":     [-9.19,-75.02],
  };

  useEffect(()=>{
    if(window.L){setLeafletReady(true);return;}
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload=()=>setLeafletReady(true);
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!leafletReady||!mapRef.current||leafletRef.current) return;
    const L=window.L;
    const map=L.map(mapRef.current,{center:PERU_CENTER,zoom:5,zoomControl:false});
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom:19,
    }).addTo(map);
    leafletRef.current=map;
    return()=>{map.remove();leafletRef.current=null;};
  },[leafletReady]);

  useEffect(()=>{
    if(!leafletRef.current||!window.L) return;
    const L=window.L;
    const map=leafletRef.current;
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    const bounds=[];
    paneles.forEach(p=>{
      let lat=p.lat?Number(p.lat):null;
      let lng=p.lng?Number(p.lng):null;
      if(!lat||!lng){
        const base=cityCoords[p.ciudad]||PERU_CENTER;
        lat=base[0]+(Math.random()-0.5)*0.06;
        lng=base[1]+(Math.random()-0.5)*0.06;
      }
      bounds.push([lat,lng]);
      const isSelected = sel?.panel?.id === p.id;
      const baseColor = p.estado==="Ocupado"?"#EF4444":"#10B981";
      const color = isSelected ? "#2563EB" : baseColor;
      const shadow = isSelected ? "rgba(37,99,235,0.55)" : (p.estado==="Ocupado"?"rgba(239,68,68,0.5)":"rgba(16,185,129,0.5)");
      const ringSize = isSelected ? 64 : 52;
      const innerSize = isSelected ? 44 : 40;
      const borderW = isSelected ? 4 : 3;
      const icon=L.divIcon({
        className:"",
        html:`<div style="position:relative;width:${ringSize}px;height:${ringSize}px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;background:${color}22;animation:markerPulse 2s ease-in-out infinite;"></div>
          ${isSelected?`<div style="position:absolute;width:${ringSize-8}px;height:${ringSize-8}px;border-radius:50%;border:2px solid ${color};opacity:0.5;"></div>`:""}
          <div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:white;border:${borderW}px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${isSelected?20:18}px;box-shadow:0 0 ${isSelected?22:16}px ${shadow};position:relative;z-index:1;">${p.foto||"🏙️"}</div>
        </div>`,
        iconSize:[ringSize,ringSize],iconAnchor:[ringSize/2,ringSize/2],
      });
      const marker=L.marker([lat,lng],{icon}).addTo(map);
      marker.on("click",()=>setSel(prev=>prev?.panel?.id===p.id?null:{panel:p,info:getInfo(p.id)}));
      markersRef.current.push(marker);
    });
    if(bounds.length===1) map.setView(bounds[0],14);
    else if(bounds.length>1 && !sel) map.fitBounds(bounds,{padding:[60,60],maxZoom:13});
  },[paneles,leafletReady,sel?.panel?.id]);

  const sinCoords=paneles.filter(p=>!p.lat||!p.lng);

  return(<div>
    <PgTit icon="🗺️" title="Mapa de Paneles" sub="OpenStreetMap · Clic en un pin para ver detalles"/>

    {sinCoords.length>0&&(
      <div style={{background:C.amber+"12",border:`1px solid ${C.amber}33`,borderRadius:12,padding:"10px 16px",marginBottom:14,fontSize:13,color:C.amber,display:"flex",gap:10,alignItems:"center"}}>
        ⚠️ <span><strong>{sinCoords.length} panel(es)</strong> sin coordenadas exactas — aparecen aproximados por ciudad. Ve a <strong>Paneles → Editar → 📍 Ubicar</strong> para precisarlos.</span>
      </div>
    )}

    <Card style={{padding:0,overflow:"hidden",position:"relative",borderRadius:20}}>
      <div style={{position:"absolute",top:16,left:16,zIndex:500,background:"#0F1729",borderRadius:22,padding:"10px 16px",display:"flex",gap:14,boxShadow:"0 6px 20px rgba(0,0,0,0.25)"}}>
        {[["#10B981","Libre"],["#EF4444","Ocupado"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
            <span style={{fontSize:13,color:"#FFFFFF",fontWeight:600}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:16,right:16,zIndex:500,background:"#0F1729",borderRadius:22,padding:"10px 16px",fontSize:13,color:"#FFFFFF",fontWeight:600,boxShadow:"0 6px 20px rgba(0,0,0,0.25)"}}>
        {paneles.length} panel{paneles.length!==1?"es":""}
      </div>

      {!leafletReady&&(
        <div style={{height:560,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,gap:10,background:"#070C18"}}>
          <div style={{width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          Cargando mapa...
        </div>
      )}
      <div ref={mapRef} style={{height:560,width:"100%",display:leafletReady?"block":"none"}}/>

      {/* ── Panel de detalle al hacer clic en un pin ── */}
      {sel&&(()=>{
        const p=sel.panel;
        const info=sel.info;
        const isOcup = p.estado === "Ocupado";
        const accentColor = isOcup ? "#EF4444" : "#3B82F6";
        const contrato=info;
        const diasVence=contrato?Math.ceil((new Date(contrato.fin)-new Date())/86400000):null;
        return(
          <div style={{
            position:"absolute",
            bottom:0,left:0,right:0,
            zIndex:500,
            background:"#0B1224",
            backdropFilter:"blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            padding:"14px 18px 22px",
            borderRadius:"22px 22px 0 0",
            boxShadow:"0 -20px 50px rgba(0,0,0,0.4)",
          }}>
            {/* Drag handle */}
            <div style={{
              width:42,height:5,borderRadius:3,
              background:"rgba(255,255,255,0.18)",
              margin:"0 auto 16px",
            }}/>

            {/* Header: thumbnail + title + address + close */}
            <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
              <div style={{
                width:64,height:64,borderRadius:14,
                background:"linear-gradient(155deg, rgba(59,130,246,0.18) 0%, rgba(15,28,55,0.6) 100%)",
                border:"1px solid rgba(59,130,246,0.28)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:30,flexShrink:0,
                boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06)",
              }}>
                {p.foto || "🏙️"}
              </div>
              <div style={{flex:1,minWidth:0,paddingTop:2}}>
                <div style={{
                  fontSize:18,fontWeight:800,
                  color:"#FFFFFF",
                  letterSpacing:"-0.4px",
                  lineHeight:1.2,
                  marginBottom:6,
                  whiteSpace:"nowrap",
                  overflow:"hidden",
                  textOverflow:"ellipsis",
                }}>
                  {p.nombre}
                </div>
                {p.direccion&&(
                  <div style={{
                    fontSize:13,
                    color:"rgba(255,255,255,0.55)",
                    display:"flex",alignItems:"center",gap:6,
                    fontWeight:500,
                  }}>
                    <span style={{fontSize:14}}>📍</span>
                    <span style={{
                      whiteSpace:"nowrap",
                      overflow:"hidden",
                      textOverflow:"ellipsis",
                    }}>{p.direccion}{p.ciudad?`, ${p.ciudad}`:""}</span>
                  </div>
                )}
              </div>
              <button
                onClick={()=>setSel(null)}
                style={{
                  width:36,height:36,borderRadius:"50%",
                  background:"rgba(255,255,255,0.08)",
                  border:"none",
                  color:"rgba(255,255,255,0.6)",
                  cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  flexShrink:0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Card de info */}
            {isOcup && contrato ? (
              <>
                {/* Card principal: Cliente + monto */}
                <div style={{
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius:16,
                  padding:"14px 16px",
                  display:"flex",alignItems:"center",gap:14,
                  marginBottom:8,
                }}>
                  <div style={{
                    width:54,height:54,borderRadius:12,
                    background:"linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    flexShrink:0,
                    boxShadow:"0 6px 16px rgba(239,68,68,0.35)",
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.5" stroke="white" strokeWidth="2"/>
                      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.3px",marginBottom:3}}>
                      Panel ocupado
                    </div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      Cliente: <span style={{color:"#FFFFFF",fontWeight:700}}>{contrato.cliente?.empresa||"—"}</span>
                    </div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:500,marginTop:1}}>
                      Facturando: <span style={{color:"#3B82F6",fontWeight:800}}>{fmt(contrato.monto)}/mes</span>
                    </div>
                  </div>
                </div>
                {/* Vence + Pago */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:14,
                    padding:"11px 14px",
                  }}>
                    <div style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.6}}>
                      Vence
                    </div>
                    <div style={{
                      fontSize:13.5,fontWeight:800,
                      color: diasVence>15?"#10B981":diasVence>0?"#FFFFFF":"#EF4444",
                    }}>
                      {diasVence>0?`en ${diasVence}d`:`hace ${Math.abs(diasVence)}d`}
                    </div>
                  </div>
                  <div style={{
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:14,
                    padding:"11px 14px",
                  }}>
                    <div style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.6}}>
                      Pago
                    </div>
                    <div style={{
                      fontSize:13.5,fontWeight:800,
                      color: contrato.pagado?"#10B981":"#FFFFFF",
                    }}>
                      {contrato.pagado?"✓ Cobrado":"⏳ Pendiente"}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:16,
                padding:"14px 16px",
                display:"flex",alignItems:"center",gap:14,
              }}>
                {/* Check azul */}
                <div style={{
                  width:54,height:54,borderRadius:12,
                  background:"linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  flexShrink:0,
                  boxShadow:"0 6px 16px rgba(37,99,235,0.45)",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5L10 17.5L19 7.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {/* Info de precio */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.3px",marginBottom:5}}>
                    Panel disponible
                  </div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:500,lineHeight:1.4}}>
                    Precio de lista: <span style={{color:"#FFFFFF",fontWeight:700}}>{fmt(p.precio)}/mes</span>
                  </div>
                  {p.precio>0 && (
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:500,lineHeight:1.4}}>
                      Anual estimado: <span style={{color:"#3B82F6",fontWeight:800}}>{fmt(p.precio*12)}</span>
                    </div>
                  )}
                </div>
                {/* Botones +/- */}
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                  <button
                    onClick={(e)=>{e.stopPropagation();leafletRef.current?.zoomIn();}}
                    style={{
                      width:36,height:30,borderRadius:9,
                      background:"rgba(255,255,255,0.08)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      color:"#FFFFFF",fontSize:18,fontWeight:600,
                      cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      lineHeight:1,
                    }}
                  >+</button>
                  <button
                    onClick={(e)=>{e.stopPropagation();leafletRef.current?.zoomOut();}}
                    style={{
                      width:36,height:30,borderRadius:9,
                      background:"rgba(255,255,255,0.08)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      color:"#FFFFFF",fontSize:20,fontWeight:600,
                      cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      lineHeight:1,
                    }}
                  >−</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </Card>
    <style>{`@keyframes markerPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:.1}}`}</style>
  </div>);
}

// ── CONTRATOS ────────────────────────────────────────────────────
function Contratos({contratos,setContratos,paneles,clientes,loading,setTab,onModalChange}){
  const [filtro,setFiltro]=useState("Activos");
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const closeBackdropRef=useRef(false);
  const modalOpenedAt=useRef(0);
  const sheetTouchedAt=useRef(0);
  const emptyC={panel_id:"",cliente_id:"",inicio:"",fin:"",monto:"",pagosMeses:{}};
  const [form,setForm]=useState(emptyC);

  // Generar lista de meses entre dos fechas
  const generarMeses=(inicio,fin)=>{
    if(!inicio||!fin) return [];
    const meses=[];
    const ini=new Date(inicio+"T12:00:00");
    const fnl=new Date(fin+"T12:00:00");
    let cur=new Date(ini.getFullYear(),ini.getMonth(),1);
    while(cur<=fnl){
      const key=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      const label=cur.toLocaleDateString("es-PE",{month:"short",year:"numeric"});
      meses.push({key,label});
      cur.setMonth(cur.getMonth()+1);
    }
    return meses;
  };

  const mesesForm=generarMeses(form.inicio,form.fin);

  const toggleMesPago=(key)=>{
    setForm(f=>({...f,pagosMeses:{...f.pagosMeses,[key]:!f.pagosMeses[key]}}));
  };

  const datos=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.panel&&c.cliente);

  let fil;
  if(filtro==="Activos") fil=datos.filter(c=>c.d>0).sort((a,b)=>a.d-b.d);
  else if(filtro==="Por vencer") fil=datos.filter(c=>c.d>0&&c.d<=60).sort((a,b)=>a.d-b.d);
  else fil=datos.filter(c=>c.d<=0).sort((a,b)=>b.d-a.d);

  const activos=datos.filter(c=>c.d>0).length;
  const porVencer=datos.filter(c=>c.d>0&&c.d<=60).length;
  const historicos=datos.filter(c=>c.d<=0).length;

  const openNew=()=>{ modalOpenedAt.current=Date.now(); closeBackdropRef.current=false; setForm(emptyC); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(c)=>{
    modalOpenedAt.current=Date.now();
    closeBackdropRef.current=false;
    const pm=c.pagosMeses||{};
    setForm({panel_id:c.panel_id,cliente_id:c.cliente_id,inicio:c.inicio||"",fin:c.fin||"",monto:c.monto||"",pagosMeses:pm});
    setModal(c); onModalChange?.(true);
  };

  const guardar=async()=>{
    if(!form.panel_id) return alert("Selecciona un panel");
    if(!form.cliente_id) return alert("Selecciona un cliente");
    if(!form.inicio||!form.fin) return alert("Ingresa fechas de inicio y fin");
    if(!form.monto||Number(form.monto)<=0) return alert("Ingresa un monto válido");
    if(new Date(form.fin)<new Date(form.inicio)) return alert("La fecha fin debe ser después del inicio");
    setSaving(true);
    const meses=generarMeses(form.inicio,form.fin);
    const pagosMeses=form.pagosMeses||{};
    const pagado=pagosMeses[meses[0]?.key]||false;
    const payloadFull={panel_id:form.panel_id,cliente_id:form.cliente_id,inicio:form.inicio,fin:form.fin,monto:Number(form.monto),pagado,pagosMeses};
    const payloadSimple={panel_id:form.panel_id,cliente_id:form.cliente_id,inicio:form.inicio,fin:form.fin,monto:Number(form.monto),pagado};
    try{
      let r;
      if(modal==="nuevo"){
        try{ [r]=await fb.post("contratos",payloadFull); }
        catch(e){ [r]=await fb.post("contratos",payloadSimple); }
        if(r) setContratos(p=>[...p,{...r,pagosMeses}]);
      } else {
        try{ [r]=await fb.patch("contratos",modal.id,payloadFull); }
        catch(e){ [r]=await fb.patch("contratos",modal.id,payloadSimple); }
        if(r) setContratos(p=>p.map(x=>x.id===modal.id?{...r,pagosMeses}:x));
      }
      setModal(null); onModalChange?.(false);
      // Navegar automáticamente a Histórico tras guardar
      if(setTab) setTab("historico");
    } catch(e){
      alert("Error al guardar: "+e.message);
    }
    setSaving(false);
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este contrato? Podrás recuperarlo desde Firebase si fue un error.")) return;
    await fb.del("contratos", id); // borrado lógico: deleted:true
    setContratos(p=>p.filter(c=>c.id!==id));
  };

  // Toggle pago mes desde la tarjeta (sin abrir modal)
  const togglePagoRapido=async(contrato,key)=>{
    const pm={...(contrato.pagosMeses||{}),[key]:!(contrato.pagosMeses||{})[key]};
    const pagado=pm[generarMeses(contrato.inicio,contrato.fin)[0]?.key]||false;
    const [r]=await fb.patch("contratos",contrato.id,{pagosMeses:pm,pagado});
    if(r) setContratos(p=>p.map(x=>x.id===contrato.id?{...x,pagosMeses:pm,pagado}:x));
  };

  const F=FieldGroup;
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const sel={...inp,cursor:"pointer"};

  const pagosMarcados=Object.values(form.pagosMeses||{}).filter(Boolean).length;

  return(<div>
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}
        onPointerDown={e=>{closeBackdropRef.current=e.target===e.currentTarget;}}
        onClick={e=>{
          // Protección contra "ghost click": ignora clicks en los primeros 500ms
          // tras abrir el modal (iOS dispara un click retrasado del botón que abrió el modal).
          if(Date.now()-modalOpenedAt.current<500) return;
          // Protección contra picker nativo (select, fecha): si el usuario tocó
          // la lámina del modal hace <900ms, ignora el click — es un click sintético
          // disparado al cerrar el picker de iOS, no una intención real de cerrar.
          if(Date.now()-sheetTouchedAt.current<900) return;
          if(closeBackdropRef.current){closeBackdropRef.current=false;setModal(null);onModalChange?.(false);}
        }}
      >
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onPointerDown={e=>{sheetTouchedAt.current=Date.now();e.stopPropagation();}}
          onPointerUp={e=>{sheetTouchedAt.current=Date.now();}}
          onClick={e=>e.stopPropagation()}
        >
          {/* Drag handle iOS */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modal==="nuevo"?"➕ Nuevo Contrato":"✏️ Editar Contrato"}</span>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <F label="Panel *">
            <select value={form.panel_id}
              onChange={e=>setForm(f=>({...f,panel_id:e.target.value}))}
              onPointerDown={e=>e.stopPropagation()}
              style={sel}>
              <option value="">— Selecciona un panel —</option>
              {paneles.map(p=><option key={p.id} value={p.id}>{p.foto} {p.nombre} · {p.ciudad} · {p.estado}</option>)}
            </select>
          </F>

          <F label="Cliente *">
            <select value={form.cliente_id}
              onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))}
              onPointerDown={e=>e.stopPropagation()}
              style={sel}>
              <option value="">— Selecciona un cliente —</option>
              {clientes.filter(c=>c.tipo==="Cliente").map(c=><option key={c.id} value={c.id}>{c.empresa} · {c.contacto}</option>)}
            </select>
          </F>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="Fecha inicio *">
              <input type="date" value={form.inicio}
                onChange={e=>setForm(f=>({...f,inicio:e.target.value,pagosMeses:{}}))}
                onPointerDown={e=>e.stopPropagation()}
                style={{...inp,colorScheme:"light",cursor:"pointer",fontSize:16}}/>
            </F>
            <F label="Fecha fin *">
              <input type="date" value={form.fin}
                onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))}
                onPointerDown={e=>e.stopPropagation()}
                style={{...inp,colorScheme:"light",cursor:"pointer",fontSize:16}}/>
            </F>
          </div>

          <F label="Monto mensual (S/) *">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={form.monto}
              onChange={e=>{
                const v=e.target.value.replace(/[^0-9.]/g,"");
                setForm(f=>({...f,monto:v}));
              }}
              onPointerDown={e=>e.stopPropagation()}
              placeholder="Ej: 1500"
              style={{...inp,fontSize:16}}
            />
          </F>

          {/* PAGOS POR MES */}
          {mesesForm.length>0&&(
            <F label={`Pagos por mes (${pagosMarcados}/${mesesForm.length} pagados)`}>
              <div style={{background:C.bg,borderRadius:12,padding:14,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
                  💡 Toca cada mes para marcarlo como <strong style={{color:C.green}}>Pagado</strong> o <strong style={{color:C.red}}>Pendiente</strong>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {mesesForm.map((m,i)=>{
                    const pagado=form.pagosMeses[m.key]||false;
                    return(
                      <button key={m.key} onClick={()=>toggleMesPago(m.key)}
                        style={{
                          padding:"10px 6px",borderRadius:10,
                          border:`2px solid ${pagado?C.green:C.border}`,
                          background:pagado?C.green+"22":C.surface,
                          cursor:"pointer",transition:"all .15s",textAlign:"center"
                        }}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3,fontWeight:600}}>Mes {i+1}</div>
                        <div style={{fontSize:12,fontWeight:700,color:pagado?C.green:C.muted,marginBottom:4}}>{m.label}</div>
                        <div style={{
                          fontSize:11,fontWeight:800,
                          color:pagado?C.green:C.red,
                          background:pagado?C.green+"18":C.red+"18",
                          borderRadius:6,padding:"3px 6px"
                        }}>
                          {pagado?"✓ Pagado":"○ Pendiente"}
                        </div>
                        {form.monto&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{fmt(form.monto)}</div>}
                      </button>
                    );
                  })}
                </div>
                {mesesForm.length>0&&form.monto&&(
                  <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:12}}>
                    <span style={{color:C.muted}}>Total cobrado:</span>
                    <span style={{fontWeight:800,color:C.green}}>{fmt(pagosMarcados*Number(form.monto))}</span>
                    <span style={{color:C.muted}}>Por cobrar:</span>
                    <span style={{fontWeight:800,color:C.red}}>{fmt((mesesForm.length-pagosMarcados)*Number(form.monto))}</span>
                  </div>
                )}
              </div>
            </F>
          )}

          {!form.inicio||!form.fin?
            <div style={{textAlign:"center",fontSize:12,color:C.muted,padding:"10px 0",marginBottom:16}}>
              📅 Selecciona las fechas para ver los meses de pago
            </div>:null
          }

          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",opacity:saving?.6:1}}>
              {saving?"Guardando...":modal==="nuevo"?"Crear Contrato":"Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── HEADER CARD: Contratos ── */}
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
      <div style={{
        width:54,height:54,borderRadius:14,background:"#EFF4FF",
        border:"1px solid #DDE6FF",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:22,fontWeight:800,color:"#0D1117",letterSpacing:"-0.02em"}}>Contratos</div>
        <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{contratos.length} contratos · {activos} activos</div>
      </div>
      <button onClick={openNew} style={{
        display:"inline-flex",alignItems:"center",gap:8,
        background:"#2563EB",border:"none",borderRadius:14,padding:"12px 18px",
        color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
        boxShadow:"0 6px 18px rgba(37,99,235,0.35)",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo Contrato
      </button>
    </div>

    {/* ── FILTER PILLS ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
      {[
        {label:"Activos",count:activos,icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>)},
        {label:"Por vencer",count:porVencer,icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>)},
        {label:"Históricos",count:historicos,icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h18M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M9 12h6"/><rect x="3" y="4" width="18" height="4" rx="1"/></svg>)},
      ].map(f=>{
        const isActive=filtro===f.label;
        return (
          <button key={f.label} onClick={()=>setFiltro(f.label)} style={{
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            padding:"14px 10px",borderRadius:16,
            background:isActive?"#EFF4FF":"#fff",
            border:`1px solid ${isActive?"#BFD3FF":"#E5E7EB"}`,
            color:isActive?"#2563EB":"#6B7280",
            fontWeight:isActive?700:600,fontSize:14,cursor:"pointer",
            transition:"all .18s",
          }}>
            <span style={{
              width:22,height:22,borderRadius:6,
              background:isActive?"#2563EB":"transparent",
              color:isActive?"#fff":"#9CA3AF",
              display:"inline-flex",alignItems:"center",justifyContent:"center",
            }}>{f.icon}</span>
            <span>{f.label}</span>
            <span style={{
              minWidth:24,padding:"2px 8px",borderRadius:999,
              background:isActive?"#2563EB":"#F0F1F5",
              color:isActive?"#fff":"#6B7280",
              fontSize:12,fontWeight:700,textAlign:"center",
            }}>{f.count}</span>
          </button>
        );
      })}
    </div>

    {loading?<Spinner/>:
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {fil.map(c=>{
        const msg=encodeURIComponent(`Hola ${c.cliente.contacto}, le recordamos que su contrato para *${c.panel.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`);
        const meses=generarMeses(c.inicio,c.fin);
        const pm=c.pagosMeses||{};
        const pagados=meses.filter(m=>pm[m.key]).length;
        return(
          <div key={c.id} style={{
            background:"#fff",borderRadius:22,
            border:"1px solid #E5E7EB",
            boxShadow:"0 1px 0 rgba(16,22,40,0.02), 0 8px 28px -16px rgba(16,22,40,0.18)",
            overflow:"hidden",
          }}>
            {/* Hero — dark blue with subtle wave */}
            <div style={{
              position:"relative",overflow:"hidden",
              background:"linear-gradient(135deg,#162449 0%,#0E1B3D 60%,#0A1530 100%)",
              padding:"18px 18px 20px",
              borderBottomLeftRadius:22,borderBottomRightRadius:22,
              marginBottom:-12,
            }}>
              <svg viewBox="0 0 380 200" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.5}}>
                {Array.from({length:18}).map((_,i)=>{
                  const t=i/17,dy=-8-t*90,dx=-t*30;
                  return <path key={i} d={`M${380+dx} ${200+dy} C ${320+dx} ${170+dy} ${260+dx} ${130+dy} ${180+dx} ${90+dy} S ${70+dx} ${40+dy} ${10+dx} ${20+dy}`}
                    fill="none" stroke={i<6?"#9DBBFF":i<12?"#4F86FF":"#1652E6"} strokeWidth="0.9" opacity={0.18+t*0.5}/>;
                })}
              </svg>
              <div style={{position:"relative",display:"flex",alignItems:"center",gap:14}}>
                <div style={{
                  width:56,height:56,borderRadius:14,flexShrink:0,
                  background:"linear-gradient(135deg,#5B8DEF,#2A4FB8)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:"2px solid rgba(255,255,255,0.18)",
                  boxShadow:"0 6px 18px rgba(0,0,0,0.4)",
                  fontSize:28,
                }}>{c.panel.foto||"🏙️"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.panel.nombre}</div>
                  <div style={{fontSize:13,color:"rgba(220,228,250,0.65)",marginTop:3}}>{c.cliente.empresa} · {c.cliente.contacto}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-0.02em",lineHeight:1}}>
                    {fmt(c.monto)}<span style={{fontSize:12,color:"rgba(220,228,250,0.55)",fontWeight:600}}>/mes</span>
                  </div>
                  <div style={{fontSize:12,color:"#10B981",fontWeight:700,marginTop:6}}>{fmt(pagados*Number(c.monto))} cobrado</div>
                </div>
              </div>
            </div>

            {/* White body */}
            <div style={{background:"#fff",borderRadius:22,padding:"18px 16px 14px",position:"relative",zIndex:1}}>
              {/* Action row */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                {/* Date pill */}
                <div style={{
                  display:"inline-flex",alignItems:"center",gap:8,
                  background:"#EFF4FF",border:"1px solid #DDE6FF",
                  borderRadius:12,padding:"8px 12px",color:"#2563EB",
                  fontSize:13,fontWeight:700,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>
                  <span>{fmtF(c.inicio)}</span>
                  <span style={{opacity:0.55}}>→</span>
                  <span>{fmtF(c.fin)}</span>
                </div>
                {/* Months pill */}
                <div style={{
                  display:"inline-flex",alignItems:"center",gap:7,
                  background:"#FFF7E6",border:"1px solid #FBE4B0",
                  borderRadius:12,padding:"8px 12px",color:"#C97A0E",
                  fontSize:13,fontWeight:700,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 11h20"/></svg>
                  {pagados}/{meses.length} meses
                </div>
                <div style={{flex:1}}/>
                {/* Action buttons */}
                <button onClick={()=>openEdit(c)} style={{width:42,height:42,borderRadius:11,border:"1px solid #E5E7EB",background:"#fff",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#6B7280"}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
                <button onClick={()=>eliminar(c.id)} style={{width:42,height:42,borderRadius:11,border:"1px solid #FECACA",background:"#FEF2F2",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#EF4444"}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <a href={`https://wa.me/${c.cliente.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                  style={{width:42,height:42,borderRadius:11,border:"1px solid #BBF7D0",background:"#F0FDF4",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#10B981",textDecoration:"none"}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                </a>
              </div>

              {/* Payment list */}
              {meses.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {meses.map(m=>{
                    const pag=pm[m.key]||false;
                    return(
                      <button key={m.key} onClick={()=>togglePagoRapido(c,m.key)} style={{
                        display:"flex",alignItems:"center",gap:12,
                        padding:"12px 14px",borderRadius:14,
                        background:"#F8FAFC",border:`1px solid ${pag?"#D1FAE5":"#E5E7EB"}`,
                        cursor:"pointer",textAlign:"left",width:"100%",
                        fontFamily:"inherit",
                      }}>
                        <span style={{
                          width:26,height:26,borderRadius:"50%",flexShrink:0,
                          display:"inline-flex",alignItems:"center",justifyContent:"center",
                          background:pag?"#10B981":"transparent",
                          border:pag?"none":"2px solid #D1D5DB",
                        }}>
                          {pag&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                        <span style={{flex:1,fontSize:15,fontWeight:700,color:pag?"#10B981":"#0D1117"}}>{m.label}</span>
                        <span style={{
                          padding:"5px 12px",borderRadius:999,fontSize:12,fontWeight:700,
                          background:pag?"#ECFDF5":"#F3F4F6",
                          color:pag?"#10B981":"#6B7280",
                        }}>{pag?"Pagado":"Pendiente"}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {fil.length===0&&(
        <div style={{textAlign:"center",padding:48,background:"#fff",borderRadius:22,border:"1px dashed #E5E7EB"}}>
          <div style={{
            width:64,height:64,borderRadius:18,background:"#EFF4FF",margin:"0 auto 14px",
            display:"flex",alignItems:"center",justifyContent:"center",color:"#2563EB",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"#0D1117",marginBottom:6}}>Sin contratos {filtro.toLowerCase()}</div>
          <button onClick={openNew} style={{marginTop:10,background:"#2563EB",border:"none",borderRadius:12,padding:"11px 20px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Crear primer contrato</button>
        </div>
      )}
    </div>}
  </div>);
}

// ── KPI CARD ESTILO FACTURACIÓN (dark navy + wave) ───────────────
const FactWave = ({ color = "#2563EB" }) => {
  const id = `fw-${color.replace("#","")}-${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position:"absolute", left:0, right:0, bottom:0, width:"100%", height:80, pointerEvents:"none", opacity:0.35 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0"/>
          <stop offset="0.5" stopColor={color} stopOpacity="0.55"/>
          <stop offset="1" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#${id})`} strokeWidth="1.2" fill="none"/>
      <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#${id})`} strokeWidth="0.8" fill="none" opacity="0.7"/>
      <path d="M0 100 Q140 60 280 90 T400 80" stroke={`url(#${id})`} strokeWidth="0.6" fill="none" opacity="0.5"/>
    </svg>
  );
};
const KPIDark = ({ label, value, valueColor="#FFFFFF", sub, accent="#2563EB", icon }) => (
  <div style={{
    position:"relative", overflow:"hidden",
    background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
    border:"1px solid rgba(79,124,255,0.18)",
    borderRadius:18, padding:"16px 16px 18px",
    boxShadow:"0 8px 24px rgba(8,12,28,0.45),inset 0 1px 0 rgba(255,255,255,0.04)",
    minHeight:138,
  }}>
    <FactWave color={accent}/>
    <div style={{ position:"relative", zIndex:2 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ fontSize:9.5, fontWeight:800, color:"#5B7FCC", letterSpacing:1.4, flex:1, lineHeight:1.3, textTransform:"uppercase" }}>{label}</div>
        <div style={{ width:38, height:38, borderRadius:10, border:`1px solid ${accent==="#10B981"?"rgba(16,185,129,0.4)":accent==="#F59E0B"?"rgba(245,158,11,0.4)":accent==="#EF4444"?"rgba(239,68,68,0.4)":"rgba(255,255,255,0.18)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize:26, fontWeight:900, color:valueColor, letterSpacing:"-0.8px", lineHeight:1, marginBottom:8, fontVariantNumeric:"tabular-nums", wordBreak:"break-word" }}>{value}</div>
      {sub && <div style={{ fontSize:10.5, color:"rgba(160,180,220,0.65)", fontWeight:500 }}>{sub}</div>}
    </div>
  </div>
);

// ── ICONOS SVG KPI (re-utilizables) ──────────────────────────────
const ICN = {
  users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#FFFFFF" strokeWidth="1.6"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  target: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#FFFFFF" strokeWidth="1.6"/><circle cx="12" cy="12" r="5" stroke="#FFFFFF" strokeWidth="1.6"/><circle cx="12" cy="12" r="1.5" fill="#FFFFFF"/></svg>,
  bolt: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#F59E0B" strokeWidth="1.6" strokeLinejoin="round" fill="none"/></svg>,
  cash: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#FFFFFF" strokeWidth="1.6"/><circle cx="12" cy="12.5" r="2.4" stroke="#FFFFFF" strokeWidth="1.6"/></svg>,
  hourglass: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 2H18M6 22H18M6 2V8C6 10 9 12 12 12C15 12 18 10 18 8V2M6 22V16C6 14 9 12 12 12C15 12 18 14 18 16V22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  down: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12L12 19L19 12" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  up: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7M21 7H15M21 7V13" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  check: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#10B981" strokeWidth="1.6"/><polyline points="8 12 11 15 16 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  archive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="4" rx="1" stroke="#FFFFFF" strokeWidth="1.6"/><path d="M5 8V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V8" stroke="#FFFFFF" strokeWidth="1.6"/><line x1="10" y1="12" x2="14" y2="12" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  panel: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="#FFFFFF" strokeWidth="1.6"/><line x1="12" y1="16" x2="12" y2="20" stroke="#FFFFFF" strokeWidth="1.6"/><line x1="8" y1="20" x2="16" y2="20" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  clock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="1.6"/><polyline points="12 7 12 12 15 14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ── CRM ──────────────────────────────────────────────────────────
function CRM({clientes,setClientes,contratos,loading,onModalChange}){
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [activeFilter,setActiveFilter]=useState("Todos");
  const [saving,setSaving]=useState(false);
  const [page,setPage]=useState(1);
  const perPage=10;
  const emptyC={tipo:"Prospecto",empresa:"",contacto:"",celular:"",email:"",ruc:"",ciudad:"Lima",sector:"Alimentación",estado:"En contacto",notas:""};
  const [form,setForm]=useState(emptyC);

  const openNew=()=>{ setForm(emptyC); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(r)=>{ setForm({...r}); setModal(r); onModalChange?.(true); };

  const guardar=async()=>{
    if(!form.empresa.trim()) return alert("Escribe el nombre de la empresa");
    setSaving(true);
    const payload={tipo:form.tipo,empresa:form.empresa,contacto:form.contacto,celular:form.celular,email:form.email,ruc:form.ruc,ciudad:form.ciudad,sector:form.sector,estado:form.estado,notas:form.notas};
    if(modal==="nuevo"){
      const [r]=await fb.post("clientes",payload);
      if(r) setClientes(p=>[...p,r]);
    } else {
      const [r]=await fb.patch("clientes",modal.id,payload);
      if(r) setClientes(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); setModal(null); onModalChange?.(false);
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este contacto? Podrás recuperarlo desde Firebase si fue un error.")) return;
    await fb.del("clientes", id); // borrado lógico: deleted:true
    setClientes(p=>p.filter(r=>r.id!==id));
  };

  const wa=(r)=>{ const msg=r.tipo==="Cliente"?`Hola ${r.contacto}, le contactamos desde Vista 360 para coordinar la renovación de su contrato. 🙌`:`Hola ${r.contacto}, somos Vista 360, paneles publicitarios en ${r.ciudad}. ¿Le interesaría conocer nuestras opciones? 📍`; window.open(`https://wa.me/${r.celular?.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); };

  const clis=clientes.filter(d=>d.tipo==="Cliente");
  const pros=clientes.filter(d=>d.tipo==="Prospecto");
  const propuestas=pros.filter(p=>p.estado==="Propuesta enviada");

  const filters=["Todos","Clientes","Prospectos","Activos","En riesgo"];
  const filtrado=useMemo(()=>clientes.filter(r=>{
    const q=buscar.toLowerCase();
    const matchQ=!q||[r.empresa,r.contacto,r.celular,r.ciudad].some(v=>v?.toLowerCase().includes(q));
    const matchF=activeFilter==="Todos"?true
      :activeFilter==="Clientes"?r.tipo==="Cliente"
      :activeFilter==="Prospectos"?r.tipo==="Prospecto"
      :activeFilter==="Activos"?r.estado==="Activo"
      :(r.estado==="Por vencer"||r.estado==="Inactivo");
    return matchQ&&matchF;
  }),[clientes,buscar,activeFilter]);

  const totalPages=Math.max(1,Math.ceil(filtrado.length/perPage));
  const paginated=filtrado.slice((page-1)*perPage,page*perPage);

  // Sparkline SVG
  const SparklineMini=({color,data,width=90,height=38})=>{
    const max=Math.max(...data),min=Math.min(...data);
    const pts=data.map((v,i)=>{
      const x=(i/(data.length-1))*width;
      const y=height-((v-min)/(max-min||1))*(height-4)-2;
      return`${x},${y}`;
    });
    const linePath=`M${pts[0]} L${pts.slice(1).join(" L")}`;
    const areaPath=`${linePath} L${width},${height} L0,${height} Z`;
    const id=`sp${color.replace("#","")}`;
    return(<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{overflow:"visible"}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={areaPath} fill={`url(#${id})`}/>
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1].split(",")[0]} cy={pts[pts.length-1].split(",")[1]} r="3" fill={color} style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
    </svg>);
  };

  // ── SPARKLINES CON DATOS REALES ─────────────────────────────────
  // Genera array de 12 puntos: acumulado de registros por mes
  // para los últimos 12 meses (mes actual incluido).
  //
  // Cómo funciona:
  //   1. Genera las 12 claves de mes: ["2024-06", "2024-07", ..., "2025-05"]
  //   2. Para cada registro busca su fecha de creación (createdAt viene de
  //      Firestore como Timestamp — se convierte a Date con .toDate()).
  //      Si no tiene createdAt, se asigna al mes actual como fallback.
  //   3. Cuenta cuántos registros del array tienen fecha <= fin de ese mes
  //      → acumulado real, la curva solo puede subir o mantenerse.
  const calcSparkline = (registros) => {
    // Genera las últimas 12 claves "YYYY-MM"
    const meses12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    // Convierte cada registro a una clave "YYYY-MM"
    const fechaRegistro = (r) => {
      if (!r.createdAt) return meses12[meses12.length - 1]; // fallback: mes actual
      // Firestore Timestamp tiene .toDate(); si ya es Date o string, lo maneja igual
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (isNaN(d)) return meses12[meses12.length - 1];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const fechas = registros.map(fechaRegistro);

    // Para cada mes del eje X cuenta cuántos registros tienen fecha <= ese mes
    return meses12.map(mes => fechas.filter(f => f <= mes).length);
  };

  // Sparklines de nuevos por mes para propuestas (más interesante ver el ritmo)
  const calcSparklineNuevosMes = (registros) => {
    const meses12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const fechaRegistro = (r) => {
      if (!r.createdAt) return meses12[meses12.length - 1];
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (isNaN(d)) return meses12[meses12.length - 1];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const fechas = registros.map(fechaRegistro);
    // Nuevos ese mes exacto (no acumulado)
    return meses12.map(mes => fechas.filter(f => f === mes).length);
  };

  const SPARK_CLI  = calcSparkline(clis);
  const SPARK_PRO  = calcSparkline(pros);
  const SPARK_PROP = calcSparklineNuevosMes(propuestas); // propuestas: ritmo mensual

  // Paleta compartida para avatares — solo azules/verdes/blanco · sin amarillo/morado
  const avatarPalette=[
    {from:"#2563EB",to:"#60A5FA",glow:"rgba(37,99,235,0.50)"},
    {from:"#059669",to:"#10B981",glow:"rgba(16,185,129,0.50)"},
    {from:"#1E40AF",to:"#3B82F6",glow:"rgba(59,130,246,0.50)"},
    {from:"#0EA5E9",to:"#7DD3FC",glow:"rgba(125,211,252,0.50)"},
    {from:"#DC2626",to:"#F87171",glow:"rgba(248,113,113,0.50)"},
    {from:"#0891B2",to:"#22D3EE",glow:"rgba(34,211,238,0.50)"},
    {from:"#3730A3",to:"#6366F1",glow:"rgba(99,102,241,0.50)"},
    {from:"#475569",to:"#94A3B8",glow:"rgba(148,163,184,0.50)"},
    {from:"#1F2937",to:"#4B5563",glow:"rgba(75,85,99,0.50)"},
    {from:"#0D9488",to:"#2DD4BF",glow:"rgba(45,212,191,0.50)"},
  ];

  // EMPRESA — cuadrado redondeado con inicial, como en la foto
  const AvatarEmpresa=({name,size=34})=>{
    const initial=(name||"?")[0].toUpperCase();
    const pal=avatarPalette[(name||"?").charCodeAt(0)%avatarPalette.length];
    return(
      <div style={{
        width:size,height:size,borderRadius:10,flexShrink:0,position:"relative",
        background:`linear-gradient(145deg,${pal.from},${pal.to})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:size*0.42,fontWeight:800,color:"#fff",
        boxShadow:`0 0 0 1.5px ${pal.from}55, 0 0 ${size*0.6}px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        letterSpacing:"-0.5px",textShadow:"0 1px 3px rgba(0,0,0,0.4)",
      }}>
        <div style={{position:"absolute",inset:0,borderRadius:10,background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 50%)",pointerEvents:"none"}}/>
        {initial}
      </div>
    );
  };

  // CONTACTO — círculo con foto real o iniciales con glow, como en la foto
  const AvatarContacto=({name,size=30})=>{
    const initials=(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const pal=avatarPalette[(name||"?").charCodeAt(0)%avatarPalette.length];
    return(
      <div style={{
        width:size,height:size,borderRadius:"50%",flexShrink:0,position:"relative",overflow:"hidden",
        background:`linear-gradient(145deg,${pal.from},${pal.to})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:size*0.36,fontWeight:800,color:"#fff",
        boxShadow:`0 0 0 2px ${pal.from}55, 0 0 ${size*0.55}px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.28)`,
        letterSpacing:"-0.5px",textShadow:"0 1px 3px rgba(0,0,0,0.4)",
      }}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"linear-gradient(160deg,rgba(255,255,255,0.22) 0%,transparent 55%)",pointerEvents:"none"}}/>
        {initials}
      </div>
    );
  };

  // Mantener AvatarCRM como alias de AvatarContacto para compatibilidad
  const AvatarCRM=({name,size=32})=><AvatarContacto name={name} size={size}/>;

  // Sin amarillo · "Por vencer" pasa a blanco (neutro)
  const estadoColorCRM=(e)=>({
    "Activo":C.green,"Por vencer":"#FFFFFF","Inactivo":C.muted,
    "En contacto":C.accent,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red,
  }[e]||"#FFFFFF");

  return(<div>
    <style>{`
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      @keyframes drawLine{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      .crm-row-hover:hover{background:rgba(37,99,235,0.05)!important;border-color:rgba(37,99,235,0.2)!important;}
      .crm-chip:hover{background:rgba(255,255,255,0.06)!important;border-color:rgba(255,255,255,0.15)!important;}
      .crm-btn:hover{opacity:0.88;transform:translateY(-1px);}
    `}</style>

    {/* ── HEADER ── */}
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:26,animation:"fadeUp 0.5s ease both"}}>
      <div>
        <h1 style={{fontSize:26,fontWeight:900,color:C.white,letterSpacing:"-0.8px",marginBottom:4}}>Clientes & Prospectos</h1>
        <p style={{fontSize:13,color:C.muted,fontWeight:500}}>CRM · {clientes.length} contactos</p>
      </div>
      <button className="crm-btn" onClick={openNew} style={{
        display:"flex",alignItems:"center",gap:8,
        background:"#2563EB",
        border:"none",borderRadius:12,padding:"10px 18px",cursor:"pointer",
        color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit",
        boxShadow:"0 4px 20px rgba(37,99,235,0.45),inset 0 1px 0 rgba(255,255,255,0.15)",
        transition:"all 0.15s ease",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo contacto
      </button>
    </div>

    {/* ── METRIC CARDS (estilo Facturación) ── */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20,animation:"fadeUp 0.5s ease both",animationDelay:"0.05s"}}>
      <KPIDark label="Clientes"    value={clis.length}       sub={`${clis.length} registrado${clis.length!==1?"s":""}`} accent="#2563EB" icon={ICN.users}/>
      <KPIDark label="Prospectos"  value={pros.length}       valueColor="#FFFFFF" sub="En pipeline"   accent="#2563EB" icon={ICN.target}/>
      <KPIDark label="Propuestas"  value={propuestas.length} valueColor="#FFFFFF" sub="Abiertas"      accent="#2563EB" icon={ICN.bolt}/>
      <KPIDark label="Total contactos" value={clientes.length} valueColor="#10B981" sub={`${clientes.filter(c=>c.estado==="Activo").length} activos`} accent="#10B981" icon={ICN.check}/>
    </div>
    {/* ── (cards antiguas eliminadas) ── */}

    {/* ── SEARCH ── */}
    <div style={{display:"flex",gap:12,marginBottom:14,animation:"fadeUp 0.5s ease both",animationDelay:"0.18s"}}>
      <div style={{flex:1,position:"relative"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPage(1);}}
          placeholder="Buscar empresa, contacto, ciudad..."
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px 10px 40px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",transition:"border-color 0.15s",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor="rgba(37,99,235,0.5)"}
          onBlur={e=>e.target.style.borderColor=C.border}/>
      </div>
    </div>

    {/* ── FILTER CHIPS ── */}
    <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center",animation:"fadeUp 0.5s ease both",animationDelay:"0.22s"}}>
      {filters.map(f=>{
        const active=activeFilter===f;
        const dot=f==="Activos"?C.green:f==="En riesgo"?"#FFFFFF":null;
        return(
          <button key={f} onClick={()=>{setActiveFilter(f);setPage(1);}} className={active?"":"crm-chip"}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,
              border:`1px solid ${active?"rgba(37,99,235,0.5)":C.border}`,
              background:active?"linear-gradient(135deg,rgba(37,99,235,0.3),rgba(79,124,255,0.2))":"rgba(255,255,255,0.03)",
              color:active?C.white:C.muted,fontWeight:active?700:500,
              fontSize:12,cursor:"pointer",fontFamily:"inherit",
              boxShadow:active?"0 0 0 1px rgba(37,99,235,0.25),0 4px 16px rgba(37,99,235,0.15)":"none",
              transition:"all 0.15s ease"}}>
            {dot&&<div style={{width:7,height:7,borderRadius:"50%",background:dot,boxShadow:`0 0 6px ${dot}`}}/>}
            {f}
          </button>
        );
      })}
      <span style={{marginLeft:"auto",fontSize:12,color:C.muted}}>{filtrado.length} resultado{filtrado.length!==1?"s":""}</span>
    </div>

    {/* ── TABLE ── */}
    {loading?<Spinner/>:
    <div style={{background:"#0E1228",border:`1px solid rgba(255,255,255,0.07)`,borderRadius:16,marginBottom:18,overflow:"hidden",animation:"fadeUp 0.5s ease both",animationDelay:"0.26s",boxShadow:"0 8px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:700,color:C.white}}>Contactos ({filtrado.length})</span>
        <span style={{fontSize:11,color:C.muted}}>Página {page} de {totalPages}</span>
      </div>
      {/* Cards mobile (iOS list style) */}
      {paginated.length===0
        ?<div style={{padding:48,textAlign:"center",color:C.muted}}>
          <div style={{fontSize:32,marginBottom:10,opacity:0.3}}>👥</div>
          <div style={{fontSize:14,marginBottom:12}}>Sin resultados</div>
          <button onClick={openNew} style={{color:C.accent,background:`${C.accent}15`,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>+ Agregar contacto</button>
        </div>
        :paginated.map((r,i)=>{
          const tc=tCol(r.tipo);
          const ec=estadoColorCRM(r.estado);
          return(
            <div key={r.id} className="crm-row-hover"
              style={{padding:"14px 16px",
                borderBottom:i<paginated.length-1?"1px solid rgba(255,255,255,0.05)":"none",
                animation:`fadeUp 0.4s ease both`,animationDelay:`${0.28+i*0.04}s`,
              }}>
              {/* Top: avatar + empresa + tipo */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <AvatarEmpresa name={r.empresa} size={42}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.empresa}</div>
                  <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.ruc?"RUC "+r.ruc:r.email||"—"}</div>
                </div>
                <span style={{flexShrink:0,display:"inline-flex",alignItems:"center",gap:4,background:`${tc}18`,border:`1px solid ${tc}44`,color:tc,borderRadius:8,padding:"3px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                  {r.tipo}
                </span>
              </div>
              {/* Mid: chips ciudad/sector/estado */}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                <span style={{background:"rgba(255,255,255,0.04)",color:C.muted,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,border:"1px solid rgba(255,255,255,0.06)"}}>📍 {r.ciudad||"—"}</span>
                <span style={{background:"rgba(255,255,255,0.04)",color:C.muted,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,border:"1px solid rgba(255,255,255,0.06)"}}>🏢 {r.sector||"—"}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${ec}18`,border:`1px solid ${ec}44`,color:ec,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                  {r.estado}
                </span>
              </div>
              {/* Bottom: contacto + acciones */}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                  <AvatarContacto name={r.contacto||"?"} size={26}/>
                  <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.contacto||"—"}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>wa(r)} title="WhatsApp" style={{background:"#25D36618",border:"1px solid #25D36630",borderRadius:10,padding:"8px 10px",color:"#25D366",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minWidth:36,minHeight:36}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </button>
                  <button onClick={()=>openEdit(r)} title="Editar" style={{background:`${C.accent}18`,border:`1px solid ${C.accent}30`,borderRadius:10,padding:"8px 10px",color:C.accent,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minWidth:36,minHeight:36}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={()=>eliminar(r.id)} title="Eliminar" style={{background:`${C.red}18`,border:`1px solid ${C.red}30`,borderRadius:10,padding:"8px 10px",color:C.red,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minWidth:36,minHeight:36}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      {/* Pagination */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <span style={{fontSize:12,color:C.muted}}>
          Mostrando {Math.min((page-1)*perPage+1,filtrado.length)}–{Math.min(page*perPage,filtrado.length)} de {filtrado.length} resultados
        </span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {Array.from({length:Math.min(totalPages,5)},(_,i)=>{
            const n=totalPages<=5?i+1:i===4&&totalPages>5?"…":i+1;
            return(
              <button key={i} onClick={()=>typeof n==="number"&&setPage(n)}
                style={{width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",
                  background:page===n?"#2563EB":"rgba(255,255,255,0.05)",
                  color:page===n?"#fff":C.muted,fontSize:12,fontWeight:page===n?700:400,fontFamily:"inherit",
                  boxShadow:page===n?"0 2px 12px rgba(37,99,235,0.4)":"none",transition:"all 0.15s"}}>
                {n}
              </button>
            );
          })}
          {totalPages>1&&<button onClick={()=>setPage(p=>Math.min(p+1,totalPages))}
            style={{width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,0.05)",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>}
        </div>
      </div>
    </div>}

    {/* ── MODAL ── */}
    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Contacto":"✏️ Editar Contacto"} onClose={()=>{setModal(null);onModalChange?.(false);}} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar ✓"}>
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {["Cliente","Prospecto"].map(t=>(
            <button key={t} onClick={()=>{setForm(f=>({...f,tipo:t,estado:t==="Cliente"?"Activo":"En contacto"}));}}
              style={{flex:1,padding:10,borderRadius:10,border:`2px solid ${form.tipo===t?tCol(t):C.border}`,background:form.tipo===t?tCol(t)+"22":"transparent",color:form.tipo===t?tCol(t):C.muted,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {t==="Cliente"?"🤝 Cliente":"🎯 Prospecto"}
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {inp("Empresa","empresa",form,setForm,{ph:"Nombre de la empresa"})}
          {inp("Contacto","contacto",form,setForm,{ph:"Nombre completo"})}
          {inp("Celular","celular",form,setForm,{type:"tel",ph:"+51 999 000 000"})}
          {inp("Email","email",form,setForm,{type:"email",ph:"correo@empresa.com"})}
          {form.tipo==="Cliente"&&inp("RUC","ruc",form,setForm,{ph:"20000000001"})}
          {inp("Ciudad","ciudad",form,setForm,{type:"select",options:CIUDADES})}
          {inp("Sector","sector",form,setForm,{type:"select",options:SECTORES})}
          {inp("Estado","estado",form,setForm,{type:"select",options:form.tipo==="Cliente"?ESTADOS_CLI:ESTADOS_PRO})}
        </div>
        {inp("Notas","notas",form,setForm,{type:"textarea",ph:"Observaciones, seguimiento..."})}
      </Modal>
    )}

    {/* ── CTA FOOTER ── */}
    <div style={{display:"flex",alignItems:"center",gap:16,
      background:"linear-gradient(135deg,rgba(79,124,255,0.18),rgba(37,99,235,0.10))",
      border:"1px solid rgba(79,124,255,0.25)",borderRadius:16,padding:"16px 20px",
      animation:"fadeUp 0.5s ease both",animationDelay:"0.65s",marginBottom:8}}>
      <div style={{width:34,height:34,borderRadius:10,flexShrink:0,
        background:"#2563EB",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 0 16px rgba(79,124,255,0.4)"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
      <p style={{flex:1,fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.5,margin:0}}>
        <strong style={{color:C.white}}>Consejo:</strong> Agregar 10 prospectos nuevos esta semana puede aumentar tus ingresos mensuales en un{" "}
        <strong style={{color:"#FFFFFF"}}>30%</strong>.
      </p>
      <button className="crm-btn" onClick={openNew} style={{
        flexShrink:0,display:"flex",alignItems:"center",gap:8,
        background:"#2563EB",
        border:"none",borderRadius:12,padding:"10px 18px",cursor:"pointer",
        color:"#fff",fontWeight:700,fontSize:12,fontFamily:"inherit",
        boxShadow:"0 4px 20px rgba(79,124,255,0.45),inset 0 1px 0 rgba(255,255,255,0.15)",
        transition:"all 0.15s ease",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Agregar prospecto
      </button>
    </div>

  </div>);
}

// ══════════════════════════════════════════════════════════════════
// 📦 PROVEEDORES — Gestión de proveedores y lo que entregan
// ══════════════════════════════════════════════════════════════════
function Proveedores({proveedores,setProveedores,loading,onModalChange}){
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [filtroCat,setFiltroCat]=useState("Todos");
  const [saving,setSaving]=useState(false);
  const closeBackdropRef=useRef(false);
  const modalOpenedAt=useRef(0);
  const sheetTouchedAt=useRef(0);

  const empty={empresa:"",contacto:"",celular:"",email:"",ruc:"",categoria:"Materiales",producto:"",ciudad:"Lima",direccion:"",notas:""};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ modalOpenedAt.current=Date.now(); closeBackdropRef.current=false; setForm(empty); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(p)=>{ modalOpenedAt.current=Date.now(); closeBackdropRef.current=false; setForm({...p}); setModal(p); onModalChange?.(true); };

  const guardar=async()=>{
    if(!form.empresa.trim()) return alert("Escribe el nombre de la empresa");
    setSaving(true);
    const payload={
      empresa:form.empresa.trim(),
      contacto:form.contacto||"",
      celular:form.celular||"",
      email:form.email||"",
      ruc:form.ruc||"",
      categoria:form.categoria||"Otro",
      producto:form.producto||"",
      ciudad:form.ciudad||"",
      direccion:form.direccion||"",
      notas:form.notas||"",
    };
    try{
      if(modal==="nuevo"){
        const [r]=await fb.post("proveedores",payload);
        if(r) setProveedores(p=>[...p,r]);
      } else {
        const [r]=await fb.patch("proveedores",modal.id,payload);
        if(r) setProveedores(p=>p.map(x=>x.id===modal.id?{...x,...r}:x));
      }
      setModal(null); onModalChange?.(false);
    }catch(e){ alert("Error al guardar: "+e.message); }
    setSaving(false);
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este proveedor? Podrás recuperarlo desde Firebase si fue un error.")) return;
    await fb.del("proveedores", id);
    setProveedores(p=>p.filter(x=>x.id!==id));
  };

  const wa=(p)=>{
    if(!p.celular) return alert("Este proveedor no tiene celular registrado");
    const msg=`Hola ${p.contacto||""}, le escribo desde 8 Millas. 🙌`;
    window.open(`https://wa.me/${p.celular.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank");
  };

  const filtrados=useMemo(()=>{
    const q=buscar.trim().toLowerCase();
    return proveedores.filter(p=>{
      const matchQ=!q||[p.empresa,p.contacto,p.producto,p.celular,p.ciudad,p.ruc].some(v=>v?.toLowerCase().includes(q));
      const matchC=filtroCat==="Todos"||p.categoria===filtroCat;
      return matchQ&&matchC;
    });
  },[proveedores,buscar,filtroCat]);

  // Sin morado/amarillo — todas las categorías en azul/blanco (solo verde=ingreso, rojo=gasto)
  const catColor={
    "Impresión":C.accent, "Materiales":C.accent, "Mantenimiento":"#FFFFFF",
    "Servicios":C.green, "Transporte":C.cyan, "Tecnología":C.accent, "Otro":C.muted,
  };

  return(<div>
    {/* ── MODAL NUEVO/EDITAR ── */}
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}
        onPointerDown={e=>{closeBackdropRef.current=e.target===e.currentTarget;}}
        onClick={e=>{
          if(Date.now()-modalOpenedAt.current<500) return;
          if(Date.now()-sheetTouchedAt.current<900) return;
          if(closeBackdropRef.current){closeBackdropRef.current=false;setModal(null);onModalChange?.(false);}
        }}
      >
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onPointerDown={e=>{sheetTouchedAt.current=Date.now();e.stopPropagation();}}
          onPointerUp={e=>{sheetTouchedAt.current=Date.now();}}
          onClick={e=>e.stopPropagation()}
        >
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modal==="nuevo"?"➕ Nuevo Proveedor":"✏️ Editar Proveedor"}</span>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          {(()=>{
            const inpS={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:16,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
            const selS={...inpS,cursor:"pointer"};
            const Fi=FieldGroup;
            return(<>
              <Fi label="Empresa *">
                <input type="text" value={form.empresa} onChange={e=>setForm(f=>({...f,empresa:e.target.value}))}
                  onPointerDown={e=>e.stopPropagation()} placeholder="Ej: Imprenta Sol SAC" style={inpS}/>
              </Fi>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Fi label="Categoría *">
                  <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} style={selS}>
                    {CAT_PROVE.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </Fi>
                <Fi label="Ciudad">
                  <select value={form.ciudad} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} style={selS}>
                    {CIUDADES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </Fi>
              </div>

              <Fi label="Producto / Servicio que provee">
                <input type="text" value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))}
                  onPointerDown={e=>e.stopPropagation()} placeholder="Ej: Lonas, vinilos, instalación..." style={inpS}/>
              </Fi>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Fi label="Contacto">
                  <input type="text" value={form.contacto} onChange={e=>setForm(f=>({...f,contacto:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} placeholder="Nombre" style={inpS}/>
                </Fi>
                <Fi label="Celular">
                  <input type="text" inputMode="tel" value={form.celular} onChange={e=>setForm(f=>({...f,celular:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} placeholder="9XXXXXXXX" style={inpS}/>
                </Fi>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Fi label="RUC">
                  <input type="text" inputMode="numeric" value={form.ruc} onChange={e=>setForm(f=>({...f,ruc:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} placeholder="20XXXXXXXXX" style={inpS}/>
                </Fi>
                <Fi label="Email">
                  <input type="email" inputMode="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                    onPointerDown={e=>e.stopPropagation()} placeholder="contacto@empresa.com" style={inpS}/>
                </Fi>
              </div>

              <Fi label="Dirección">
                <input type="text" value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))}
                  onPointerDown={e=>e.stopPropagation()} placeholder="Calle, número, distrito" style={inpS}/>
              </Fi>

              <Fi label="Notas">
                <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                  onPointerDown={e=>e.stopPropagation()} placeholder="Forma de pago, tiempos de entrega, observaciones..."
                  rows={3} style={{...inpS,resize:"vertical"}}/>
              </Fi>
            </>);
          })()}

          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",opacity:saving?.6:1}}>
              {saving?"Guardando...":modal==="nuevo"?"Crear Proveedor":"Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── HEADER ── */}
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
      <div style={{
        width:54,height:54,borderRadius:14,background:"#EFF6FF",
        border:"1px solid #BFDBFE",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0-2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 16 16z" transform="translate(4 0)"/>
          <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
          <polyline points="7.5 19.79 7.5 14.6 3 12"/>
          <polyline points="21 12 16.5 14.6 16.5 19.79"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:22,fontWeight:800,color:"#0D1117",letterSpacing:"-0.02em"}}>Proveedores</div>
        <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{proveedores.length} proveedor{proveedores.length!==1?"es":""} registrado{proveedores.length!==1?"s":""}</div>
      </div>
      <button onClick={openNew} style={{
        display:"inline-flex",alignItems:"center",gap:8,
        background:"#2563EB",border:"none",borderRadius:14,padding:"12px 18px",
        color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
        boxShadow:"0 6px 18px rgba(37,99,235,0.35)",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo
      </button>
    </div>

    {/* ── BUSCADOR ── */}
    <div style={{position:"relative",marginBottom:12}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar por empresa, producto, ciudad..."
        style={{width:"100%",padding:"12px 14px 12px 42px",background:"#fff",border:"1px solid #E5E7EB",borderRadius:14,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
    </div>

    {/* ── FILTROS POR CATEGORÍA ── */}
    <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
      {["Todos",...CAT_PROVE].map(c=>{
        const active=filtroCat===c;
        const color=c==="Todos"?C.accent:(catColor[c]||C.muted);
        return(
          <button key={c} onClick={()=>setFiltroCat(c)} style={{
            padding:"8px 14px",borderRadius:999,
            background:active?color:"#fff",
            border:`1px solid ${active?color:"#E5E7EB"}`,
            color:active?"#fff":C.muted,
            fontSize:13,fontWeight:active?700:600,
            cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
            transition:"all .15s",
          }}>{c}</button>
        );
      })}
    </div>

    {loading?<Spinner/>:
      filtrados.length===0?(
        <div style={{textAlign:"center",padding:60,color:"#6B7280",background:"#fff",borderRadius:22,border:"1px dashed #E5E7EB"}}>
          {proveedores.length===0
            ?<>Sin proveedores registrados · <button onClick={openNew} style={{color:"#2563EB",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar el primero</button></>
            :"No hay resultados con ese filtro"}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtrados.map(p=>{
            const col=catColor[p.categoria]||"#FFFFFF";
            // Onda decorativa sutil
            const wid="prv-"+p.id;
            return(
              <div key={p.id} style={{
                position:"relative", overflow:"hidden",
                background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                border:"1px solid rgba(79,124,255,0.18)",
                borderRadius:18, padding:"14px 16px",
                boxShadow:"0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                {/* Ondas decorativas */}
                <svg viewBox="0 0 400 120" preserveAspectRatio="none"
                  style={{position:"absolute",left:0,right:0,bottom:0,width:"100%",height:80,pointerEvents:"none",opacity:0.35}}>
                  <defs>
                    <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#2563EB" stopOpacity="0"/>
                      <stop offset="0.5" stopColor="#2563EB" stopOpacity="0.55"/>
                      <stop offset="1" stopColor="#2563EB" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#${wid})`} strokeWidth="1.2" fill="none"/>
                  <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#${wid})`} strokeWidth="0.8" fill="none" opacity="0.7"/>
                  <path d="M0 100 Q140 60 280 90 T400 80" stroke={`url(#${wid})`} strokeWidth="0.6" fill="none" opacity="0.5"/>
                </svg>

                <div style={{position:"relative",zIndex:2}}>
                  {/* Top row: avatar blanco + datos + RUC chip */}
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                    <div style={{
                      flexShrink:0,width:44,height:52,borderRadius:8,
                      background:"#FFFFFF",border:"1px solid #E5E7EB",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:"0 2px 6px rgba(0,0,0,0.25)",
                    }}>
                      <svg width="26" height="32" viewBox="0 0 24 28" fill="none">
                        <rect x="3" y="2" width="18" height="24" rx="1" fill="#FFFFFF" stroke="#0F1729" strokeWidth="1.2"/>
                        <text x="5" y="5.6" fontSize="2.2" fontWeight="900" fill="#2563EB" fontFamily="sans-serif">PROVEEDOR</text>
                        <rect x="5" y="9" width="14" height="6" rx="0.6" fill="#EFF6FF" stroke="#2563EB" strokeWidth="0.5"/>
                        <line x1="5" y1="17" x2="19" y2="17" stroke="#94A3B8" strokeWidth="0.7"/>
                        <line x1="5" y1="19.5" x2="19" y2="19.5" stroke="#94A3B8" strokeWidth="0.7"/>
                        <line x1="5" y1="22" x2="14" y2="22" stroke="#94A3B8" strokeWidth="0.7"/>
                      </svg>
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:15,fontWeight:900,color:"#FFFFFF",letterSpacing:"-0.2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{p.empresa}</span>
                        <span style={{background:col+"26",color:col,border:`1px solid ${col}55`,borderRadius:8,padding:"2px 9px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>{p.categoria||"Otro"}</span>
                      </div>
                      <div style={{fontSize:13,color:"#FFFFFF",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:2}}>
                        {p.contacto||"—"}
                      </div>
                      <div style={{fontSize:11,color:"rgba(160,180,220,0.6)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {p.ciudad||"—"}{p.ruc?` · RUC ${p.ruc}`:""}
                      </div>
                    </div>
                  </div>

                  {p.producto&&(
                    <div style={{
                      background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 12px",marginBottom:10,
                      fontSize:13,color:"#FFFFFF",lineHeight:1.4,
                      border:"1px solid rgba(255,255,255,0.08)",
                    }}>
                      <span style={{fontSize:10,color:"#5B7FCC",fontWeight:700,letterSpacing:1,textTransform:"uppercase",display:"block",marginBottom:2}}>Provee</span>
                      {p.producto}
                    </div>
                  )}

                  {(p.celular||p.email)&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                      {p.celular&&<span style={{fontSize:11,color:"#FFFFFF",background:"rgba(255,255,255,0.05)",padding:"4px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)"}}>{p.celular}</span>}
                      {p.email&&<span style={{fontSize:11,color:"#FFFFFF",background:"rgba(255,255,255,0.05)",padding:"4px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.email}</span>}
                    </div>
                  )}

                  {/* Botones de acción estilo pill */}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                    <button onClick={()=>openEdit(p)} style={{
                      background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.45)",
                      borderRadius:10,padding:"7px 14px",color:"#5A9BFF",fontSize:12,fontWeight:700,
                      cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      Editar
                    </button>
                    {p.celular&&(
                      <button onClick={()=>wa(p)} style={{
                        background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.45)",
                        borderRadius:10,padding:"7px 14px",color:"#10B981",fontSize:12,fontWeight:700,
                        cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 4.7 18.7L3 22l3.4-1.6a11 11 0 1 0 14-16.9zM12 20.2c-1.8 0-3.4-.5-4.8-1.3l-.3-.2-3 .8.8-2.9-.2-.3a9 9 0 1 1 7.5 4z"/></svg>
                        WhatsApp
                      </button>
                    )}
                    <button onClick={()=>eliminar(p.id)} style={{
                      background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.45)",
                      borderRadius:10,padding:"7px 14px",color:"#EF4444",fontSize:12,fontWeight:700,
                      cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      Eliminar
                    </button>
                  </div>

                  {p.notas&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",fontSize:12,color:"rgba(160,180,220,0.7)",lineHeight:1.5}}>
                      {p.notas}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )
    }
  </div>);
}

// ── ESTADO DE RESULTADOS ─────────────────────────────────────────
function Resultados({contratos,loading}){
  const [gastos,setGastos]=useState([]);
  const [loadG,setLoadG]=useState(true);
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const [mes,setMes]=useState(mesHoy());
  const emptyG={categoria:"Mantenimiento",descripcion:"",monto:0,mes};
  const [vistaHistorica,setVistaHistorica]=useState(false);
  const [form,setForm]=useState(emptyG);

  useEffect(()=>{ fb.get("gastos").then(d=>{ setGastos(Array.isArray(d)?d:[]); setLoadG(false); }); },[]);

  const openNew=()=>{ setForm({...emptyG,mes}); setModal("nuevo"); };
  const openEdit=(g)=>{ setForm({...g}); setModal(g); };

  const guardar=async()=>{
    if(!form.descripcion.trim()) return alert("Escribe una descripción");
    setSaving(true);
    const payload={categoria:form.categoria,descripcion:form.descripcion,monto:Number(form.monto)||0,mes:form.mes};
    if(modal==="nuevo"){
      const [r]=await fb.post("gastos",payload);
      if(r) setGastos(p=>[r,...p]);
    } else {
      const [r]=await fb.patch("gastos",modal.id,payload);
      if(r) setGastos(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); setModal(null);
  };

  const eliminar=async(id)=>{ if(!confirm("¿Eliminar este gasto?")) return; await fb.del("gastos",id,{hardDelete:true}); setGastos(p=>p.filter(g=>g.id!==id)); };

  // Historial INFINITO — desde el mes más antiguo (contratos o gastos) hasta hoy
  const historialMeses=useMemo(()=>{
    const fechas=[
      ...contratos.map(c=>c.inicio?.slice(0,7)).filter(Boolean),
      ...gastos.map(g=>g.mes).filter(Boolean),
    ];
    const _now=new Date();
    const mesHoyKey=`${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}`;
    const primerMes=fechas.length>0?fechas.reduce((a,b)=>a<b?a:b):mesHoyKey;
    const lista=[];
    let cur=new Date(primerMes+"-02");
    const tope=new Date(mesHoyKey+"-02");
    while(cur<=tope){
      const key=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      const label=cur.toLocaleDateString("es-PE",{month:"short",year:"2-digit"});
      const ing=contratos.filter(c=>{
        if(!c.pagado) return false;
        const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
        return ini&&fin&&ini<=key&&fin>=key;
      }).reduce((a,c)=>a+Number(c.monto),0);
      const gas=gastos.filter(g=>g.mes===key).reduce((a,g)=>a+Number(g.monto),0);
      lista.push({key,label,ing,gas,util:ing-gas});
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,2);
    }
    return lista;
  },[contratos,gastos]);

  // Cálculos del mes seleccionado — ingresos filtrados por contratos activos ese mes
  const gastosMes=gastos.filter(g=>g.mes===mes);
  const totGastos=gastosMes.reduce((a,g)=>a+Number(g.monto),0);
  const ingCob=contratos.filter(c=>{
    if(!c.pagado) return false;
    const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
    return ini&&fin&&ini<=mes&&fin>=mes;
  }).reduce((a,c)=>a+Number(c.monto),0);
  const ingBrut=contratos.filter(c=>{
    const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
    return ini&&fin&&ini<=mes&&fin>=mes;
  }).reduce((a,c)=>a+Number(c.monto),0);
  const ingPend=ingBrut-ingCob;
  const utilidad=ingCob-totGastos;
  const margen=ingCob>0?Math.round((utilidad/ingCob)*100):0;

  const porCat={};
  gastosMes.forEach(g=>{ porCat[g.categoria]=(porCat[g.categoria]||0)+Number(g.monto); });
  const catMax=Math.max(1,...Object.values(porCat));

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="📈" title="Estado de Resultados" sub="Ingresos, gastos y utilidad"/>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {["Mensual","Histórico"].map(v=>(
            <button key={v} onClick={()=>setVistaHistorica(v==="Histórico")}
              style={{padding:"8px 14px",borderRadius:9,border:`1px solid ${vistaHistorica===(v==="Histórico")?C.accent:C.border}`,background:vistaHistorica===(v==="Histórico")?C.accent+"22":"transparent",color:vistaHistorica===(v==="Histórico")?C.accent:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              {v}
            </button>
          ))}
        </div>
        {!vistaHistorica&&<input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",cursor:"pointer"}}/>}
        <button onClick={()=>{
          const DARK="#0D1B3E",BLUE="#1A3066",ACC="#1E4D9B",LB="#D6E4F7";
          const fechaGen=new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"});
          const horaGen=new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"});
          let bodyHtml="";
          if(vistaHistorica){
            const totIng=historialMeses.reduce((a,m)=>a+m.ing,0);
            const totGas=historialMeses.reduce((a,m)=>a+m.gas,0);
            const totUtil=historialMeses.reduce((a,m)=>a+m.util,0);
            bodyHtml=`
              <div class="kpis">
                <div class="kpi kpi-ing"><div class="kpi-label">💵 Total Ingresos (${historialMeses.length}m)</div><div class="kpi-val verde">${fmt(totIng)}</div></div>
                <div class="kpi kpi-gas"><div class="kpi-label">📉 Total Gastos (${historialMeses.length}m)</div><div class="kpi-val rojo">${fmt(totGas)}</div></div>
                <div class="kpi ${totUtil>=0?"kpi-util-pos":"kpi-util-neg"}"><div class="kpi-label">✅ Utilidad Total</div><div class="kpi-val ${totUtil>=0?"azul":"rojo"}">${fmt(totUtil)}</div></div>
              </div>
              <div class="body">
                <div class="section">
                  <div class="section-title">Resumen histórico mensual</div>
                  <table>
                    <thead><tr><th>Mes</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th><th style="text-align:right">Utilidad</th><th style="text-align:right">Margen</th></tr></thead>
                    <tbody>
                      ${historialMeses.map(m=>{const mg=m.ing>0?Math.round((m.util/m.ing)*100):0;return`<tr>
                        <td><strong>${m.label.toUpperCase()}</strong>${m.key===mesHoy()?` <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700">HOY</span>`:""}</td>
                        <td style="text-align:right;font-family:'Courier New',monospace;color:#065F46;font-weight:700">${fmt(m.ing)}</td>
                        <td style="text-align:right;font-family:'Courier New',monospace;color:#991B1B;font-weight:700">${fmt(m.gas)}</td>
                        <td style="text-align:right;font-family:'Courier New',monospace;font-weight:800;color:${m.util>=0?"#065F46":"#991B1B"}">${fmt(m.util)}</td>
                        <td style="text-align:right;font-weight:700;color:${mg>=0?"#065F46":"#991B1B"}">${mg}%</td>
                      </tr>`;}).join("")}
                      <tr class="total-row"><td>TOTAL GENERAL</td><td style="text-align:right;font-family:'Courier New',monospace">${fmt(totIng)}</td><td style="text-align:right;font-family:'Courier New',monospace">${fmt(totGas)}</td><td style="text-align:right;font-family:'Courier New',monospace">${fmt(totUtil)}</td><td style="text-align:right">${totIng>0?Math.round((totUtil/totIng)*100):0}%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>`;
          } else {
            const label=new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"});
            bodyHtml=`
              <div class="kpis">
                <div class="kpi kpi-ing"><div class="kpi-label">💵 Ingresos Cobrados</div><div class="kpi-val verde">${fmt(ingCob)}</div></div>
                <div class="kpi kpi-gas"><div class="kpi-label">📉 Total Gastos</div><div class="kpi-val rojo">${fmt(totGastos)}</div></div>
                <div class="kpi ${utilidad>=0?"kpi-util-pos":"kpi-util-neg"}"><div class="kpi-label">✅ Utilidad Neta</div><div class="kpi-val ${utilidad>=0?"azul":"rojo"}">${fmt(utilidad)}</div><div class="kpi-margen">Margen: ${margen}%</div></div>
              </div>
              <div class="body">
                <div class="section">
                  <div class="section-title">Detalle de Gastos — ${label}</div>
                  <table>
                    <thead><tr><th>Categoría</th><th>Descripción / Concepto</th><th>Proveedor</th><th style="text-align:right;width:120px">Monto (S/)</th></tr></thead>
                    <tbody>
                      ${gastosMes.length===0?`<tr><td colspan="4" style="color:#999;text-align:center;font-style:italic;padding:18px">Sin gastos registrados este mes</td></tr>`:gastosMes.map(g=>`<tr>
                        <td>${g.categoria||"—"}</td>
                        <td>${g.concepto||g.descripcion||"—"}</td>
                        <td>${g.proveedor||"—"}${g.ruc?`<br/><span style="font-size:9px;color:#64748B">RUC: ${g.ruc}</span>`:""}</td>
                        <td style="text-align:right;font-family:'Courier New',monospace;color:#991B1B;font-weight:700">S/ ${Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</td>
                      </tr>`).join("")}
                      <tr class="total-row"><td colspan="3">TOTAL GASTOS</td><td style="text-align:right;font-family:'Courier New',monospace">${fmt(totGastos)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="section">
                  <div class="section-title">Resumen Financiero — ${label}</div>
                  <div class="resumen">
                    <div class="res-row"><div>Ingresos Brutos</div><div style="color:#374151;font-family:'Courier New',monospace;font-weight:600">${fmt(ingBrut)}</div></div>
                    <div class="res-row"><div>(-) Por Cobrar</div><div style="color:#92400E;font-family:'Courier New',monospace;font-weight:600">- ${fmt(ingPend)}</div></div>
                    <div class="res-row"><div>Ingresos Cobrados</div><div style="color:#065F46;font-family:'Courier New',monospace;font-weight:700">${fmt(ingCob)}</div></div>
                    <div class="res-row"><div>(-) Total Gastos</div><div style="color:#991B1B;font-family:'Courier New',monospace;font-weight:700">- ${fmt(totGastos)}</div></div>
                    <div class="res-row res-total"><div>= Utilidad Neta</div><div>${fmt(utilidad)} (${margen}%)</div></div>
                  </div>
                  ${Object.keys(porCat).length>0?`
                  <div style="margin-top:16px">
                    <div class="section-title">Gastos por Categoría</div>
                    <table>
                      <thead><tr><th>Categoría</th><th style="text-align:right">Monto</th><th style="text-align:right">% del total</th></tr></thead>
                      <tbody>
                        ${Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr>
                          <td>${k}</td>
                          <td style="text-align:right;font-family:'Courier New',monospace;font-weight:700">${fmt(v)}</td>
                          <td style="text-align:right;color:#64748B">${totGastos>0?Math.round((v/totGastos)*100):0}%</td>
                        </tr>`).join("")}
                      </tbody>
                    </table>
                  </div>`:""}
                </div>
              </div>`;
          }
          const titulo=vistaHistorica?`Histórico ${historialMeses.length} Meses`:new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"});
          const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>8 Millas — Estado de Resultados</title>
          <style>
            *{box-sizing:border-box;margin:0;padding:0}
            @page{size:A4;margin:12mm 14mm 12mm 14mm}
            body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px;line-height:1.55}
            .header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .header-left{display:flex;flex-direction:column;gap:8px}
            .logo-img{height:54px;width:auto;object-fit:contain}
            .emisor-sub{font-size:10px;opacity:.72;letter-spacing:1.4px;text-transform:uppercase;margin-top:2px}
            .emisor-data{font-size:10px;opacity:.85;margin-top:4px;line-height:1.75;font-style:italic}
            .emisor-data strong{font-style:normal;font-size:11px;opacity:1}
            .header-right{text-align:right}
            .doc-title{font-size:20px;font-weight:900;letter-spacing:.5px;text-transform:uppercase}
            .doc-periodo{font-size:14px;font-weight:700;margin-top:4px;opacity:.9;text-transform:capitalize}
            .doc-fecha{font-size:10px;opacity:.7;margin-top:8px;font-style:italic;line-height:1.7}
            .divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px 28px}
            .kpi{border-radius:8px;padding:16px 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .kpi-ing{background:#ECFDF5;border-left:4px solid #10B981}.kpi-gas{background:#FEF2F2;border-left:4px solid #EF4444}
            .kpi-util-pos{background:#EFF6FF;border-left:4px solid #1D4ED8}.kpi-util-neg{background:#FEF2F2;border-left:4px solid #EF4444}
            .kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#555;font-weight:700;margin-bottom:6px}
            .kpi-val{font-size:22px;font-weight:900;font-family:'Courier New',monospace}
            .kpi-val.verde{color:#065F46}.kpi-val.rojo{color:#991B1B}.kpi-val.azul{color:#1E40AF}
            .kpi-margen{font-size:12px;font-weight:700;margin-top:4px;color:#64748B}
            .body{padding:0 28px 18px}
            .section{margin-bottom:18px}
            .section-title{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
            table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1}
            thead th{background:${DARK};color:#fff;padding:9px 11px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:left;letter-spacing:.6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            tbody tr:nth-child(even){background:#F8FAFC}
            tbody td{padding:9px 11px;font-size:11.5px;color:#1e293b;border-bottom:1px solid #E2E8F0}
            .total-row td{font-weight:800;background:${DARK};color:#fff;font-size:12.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .resumen{border:1px solid #CBD5E1;border-radius:6px;overflow:hidden;margin-top:10px}
            .res-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #E2E8F0}
            .res-row:last-child{border-bottom:none}
            .res-row div{padding:8px 14px;font-size:12px}
            .res-row div:first-child{background:#F8FAFC;color:#334155;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
            .res-total div:first-child{background:${DARK};color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .res-total div:last-child{background:${ACC};color:#fff;font-weight:900;font-size:14px;font-family:'Courier New',monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .footer{border-top:3px solid ${DARK};padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748B;margin-top:14px;font-style:italic;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .footer-brand{font-weight:900;color:${DARK};font-style:normal;font-size:11px;letter-spacing:.5px}
          </style></head><body>
          <div class="header">
            <div class="header-left">
              <div class="emisor-sub">Gestión de Paneles Publicitarios</div>
              <div class="emisor-data"><strong>RUC: ${EMISOR.ruc}</strong><br/>${EMISOR.razonSocial}<br/>${EMISOR.direccion}</div>
            </div>
            <div class="header-right">
              <div class="doc-title">Estado de Resultados</div>
              <div class="doc-periodo">${titulo}</div>
              <div class="doc-fecha">Generado: ${fechaGen}<br/>Hora: ${horaGen}</div>
            </div>
          </div>
          <div class="divider"></div>
          ${bodyHtml}
          <div class="footer">
            <div><span class="footer-brand">8 MILLAS</span> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
            <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
          </div>
          <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
          </body></html>`;
          const w=window.open("","_blank","width=900,height=700");
          if(w){w.document.write(html);w.document.close();}
        }} style={{background:"linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))",border:"1px solid rgba(239,68,68,0.4)",borderRadius:11,padding:"10px 16px",color:"#FCA5A5",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 14px rgba(239,68,68,0.15)"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
          PDF
        </button>
        {!vistaHistorica&&<button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 18px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Gasto</button>}
      </div>
    </div>

    {/* ── VISTA HISTÓRICA — últimos 6 meses reales ── */}
    {vistaHistorica&&(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:20}}>
          {[
            [`💵 Total Ingresos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.ing,0)),C.green],
            [`📉 Total Gastos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.gas,0)),C.red],
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),historialMeses.reduce((a,m)=>a+m.util,0)>=0?C.green:C.red],
          ].map(([l,v,c])=>(
            <Card key={l} style={{padding:"14px 16px"}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div>
              <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
            </Card>
          ))}
        </div>
        <Card style={{marginBottom:16}}>
          <SecTit ch={`📊 Ingresos vs Gastos — ${historialMeses.length} mes${historialMeses.length!==1?"es":""}`}/>
          <div style={{overflowX:"auto",paddingBottom:4}}><div style={{display:"flex",alignItems:"flex-end",gap:6,height:140,marginTop:8,minWidth:historialMeses.length*52}}>
            {historialMeses.map((m,i)=>{
              const maxV=Math.max(...historialMeses.map(x=>Math.max(x.ing,x.gas)),1);
              return(
                <div key={m.key} style={{flexShrink:0,width:46,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}} onClick={()=>{setMes(m.key);setVistaHistorica(false);}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{fmt(m.ing)}</div>
                  <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:100}}>
                    <div style={{flex:1,height:`${(m.ing/maxV)*100}%`,background:C.green,borderRadius:"4px 4px 0 0",minHeight:4,opacity:0.85}}/>
                    <div style={{flex:1,height:`${(m.gas/maxV)*100}%`,background:C.red,borderRadius:"4px 4px 0 0",minHeight:4,opacity:0.7}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:2}}>{m.label}</div>
                  <div style={{fontSize:10,color:m.util>=0?C.green:C.red,fontWeight:700}}>{m.util>=0?"+":""}{fmt(m.util)}</div>
                </div>
              );
            })}
          </div>
          </div>
          <div style={{display:"flex",gap:16,marginTop:14,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.green}}/><span style={{fontSize:12,color:C.muted}}>Ingresos cobrados</span></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.red}}/><span style={{fontSize:12,color:C.muted}}>Gastos</span></div>
          </div>
          <div style={{marginTop:10,padding:"10px 14px",background:C.surface,borderRadius:10,fontSize:12,color:C.muted}}>
            💡 Clic en cualquier mes para ver su detalle completo
          </div>
        </Card>
        <Card>
          <SecTit ch="📋 Resumen por mes"/>
          <div>
            {historialMeses.map((m,idxM)=>{
                const mg=m.ing>0?Math.round((m.util/m.ing)*100):0;
                const gastosDelMes=gastos.filter(g=>g.mes===m.key);
                const exportarPDF=(mes,label,ing,gas,util,margen,gastosList)=>{
                  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>8 Millas - Estado de Resultados</title>
                  <style>
                    *{box-sizing:border-box;margin:0;padding:0}
                    @page{size:A4;margin:12mm 14mm 12mm 14mm}
                    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px;line-height:1.55}
                    .doc{max-width:100%;margin:0 auto;background:#fff}
                    .header{background:linear-gradient(135deg,#0D1B3E 0%,#1A3066 60%,#1E4D9B 100%);color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .header-left{display:flex;flex-direction:column;gap:10px}
                    .logo-img{height:58px;width:auto;object-fit:contain}
                    .emisor-sub{font-size:10px;opacity:.75;letter-spacing:1.4px;text-transform:uppercase;margin-top:2px}
                    .emisor-data{font-size:10px;opacity:.85;margin-top:6px;line-height:1.75;font-style:italic}
                    .emisor-data strong{font-style:normal;font-size:11px;opacity:1}
                    .header-right{text-align:right}
                    .doc-title{font-size:20px;font-weight:900;letter-spacing:.5px;text-transform:uppercase}
                    .doc-periodo{font-size:14px;font-weight:700;margin-top:4px;opacity:.9;text-transform:capitalize}
                    .doc-fecha{font-size:10px;opacity:.7;margin-top:8px;font-style:italic;line-height:1.7}
                    .divider{height:4px;background:linear-gradient(90deg,#1E4D9B,#0D1B3E,#1E4D9B);-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px 28px}
                    .kpi{border-radius:8px;padding:16px 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .kpi-ing{background:#ECFDF5;border-left:4px solid #10B981}
                    .kpi-gas{background:#FEF2F2;border-left:4px solid #EF4444}
                    .kpi-util-pos{background:#EFF6FF;border-left:4px solid #1D4ED8}
                    .kpi-util-neg{background:#FEF2F2;border-left:4px solid #EF4444}
                    .kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#555;font-weight:700;margin-bottom:6px}
                    .kpi-val{font-size:22px;font-weight:900;font-family:'Courier New',monospace}
                    .kpi-val.verde{color:#065F46} .kpi-val.rojo{color:#991B1B} .kpi-val.azul{color:#1E40AF}
                    .kpi-margen{font-size:12px;font-weight:700;margin-top:4px;color:#64748B}
                    .body{padding:0 28px 18px}
                    .section-title{font-size:9.5px;font-weight:700;color:#1E4D9B;text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #1E4D9B}
                    .section{margin-bottom:18px}
                    table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1}
                    thead th{background:#0D1B3E;color:#fff;padding:9px 11px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:left;letter-spacing:.6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    tbody tr:nth-child(even){background:#F8FAFC}
                    tbody td{padding:9px 11px;font-size:12px;color:#1e293b;border-bottom:1px solid #E2E8F0}
                    .total-row td{font-weight:800;background:#0D1B3E;color:#fff;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .resumen{border:1px solid #CBD5E1;border-radius:6px;overflow:hidden;margin-top:12px}
                    .res-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #E2E8F0}
                    .res-row:last-child{border-bottom:none}
                    .res-row div{padding:8px 14px;font-size:12px}
                    .res-row div:first-child{background:#F8FAFC;color:#334155;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
                    .res-total div:first-child{background:#0D1B3E;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .res-total div:last-child{background:#1E4D9B;color:#fff;font-weight:900;font-size:14px;font-family:'Courier New',monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .footer{border-top:3px solid #0D1B3E;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748B;margin-top:14px;font-style:italic;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .footer-brand{font-weight:900;color:#0D1B3E;font-style:normal;font-size:11px;letter-spacing:.5px}
                    @media print{body{padding:0}}
                  </style></head><body>
                  <div class="doc">
                    <div class="header">
                      <div class="header-left">
                        <div class="emisor-sub">Gestión de Paneles Publicitarios</div>
                        <div class="emisor-data">
                          <strong>RUC: ${EMISOR.ruc}</strong><br/>
                          ${EMISOR.razonSocial}<br/>
                          ${EMISOR.direccion}
                        </div>
                      </div>
                      <div class="header-right">
                        <div class="doc-title">Estado de Resultados</div>
                        <div class="doc-periodo">${label}</div>
                        <div class="doc-fecha">
                          Generado: ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}<br/>
                          Hora: ${new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      </div>
                    </div>
                    <div class="divider"></div>
                    <div class="kpis">
                      <div class="kpi kpi-ing"><div class="kpi-label">💵 Ingresos Cobrados</div><div class="kpi-val verde">${ing}</div></div>
                      <div class="kpi kpi-gas"><div class="kpi-label">📉 Total Gastos</div><div class="kpi-val rojo">${gas}</div></div>
                      <div class="kpi ${margen>=0?"kpi-util-pos":"kpi-util-neg"}"><div class="kpi-label">✅ Utilidad Neta</div><div class="kpi-val ${margen>=0?"azul":"rojo"}">${util}</div><div class="kpi-margen">Margen: ${margen}%</div></div>
                    </div>
                    <div class="body">
                      <div class="section">
                        <div class="section-title">Detalle de Gastos del Período</div>
                        <table>
                          <thead><tr><th>Categoría</th><th>Descripción / Proveedor</th><th style="text-align:right;width:130px">Monto (S/)</th></tr></thead>
                          <tbody>
                            ${gastosList.map(g=>`<tr><td>${g.categoria||"—"}</td><td>${g.proveedor||g.concepto||"—"}</td><td style="text-align:right;font-family:'Courier New',monospace;color:#991B1B;font-weight:700">S/ ${Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</td></tr>`).join("")}
                            ${gastosList.length===0?`<tr><td colspan="3" style="color:#999;text-align:center;font-style:italic;padding:18px">Sin gastos registrados este mes</td></tr>`:""}
                            <tr class="total-row"><td colspan="2">TOTAL GASTOS</td><td style="text-align:right;font-family:'Courier New',monospace">${gas}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      <div class="section">
                        <div class="section-title">Resumen Financiero</div>
                        <div class="resumen">
                          <div class="res-row"><div>Ingresos Cobrados</div><div style="color:#065F46;font-weight:700;font-family:'Courier New',monospace">${ing}</div></div>
                          <div class="res-row"><div>Total Gastos</div><div style="color:#991B1B;font-weight:700;font-family:'Courier New',monospace">${gas}</div></div>
                          <div class="res-row res-total"><div>Utilidad Neta</div><div>${util} (${margen}%)</div></div>
                        </div>
                      </div>
                    </div>
                    <div class="footer">
                      <div><span class="footer-brand">8 MILLAS</span> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
                      <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
                    </div>
                  </div>
                  <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
                  </body></html>`;
                  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement("a");
                  a.href=url;
                  a.download=`8Millas-Resultados-${mes}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                };
                return(
                  <div key={m.key}
                    style={{padding:"14px 4px",borderBottom:idxM<historialMeses.length-1?`1px solid ${C.border}`:"none"}}>
                    {/* Mes + chip "este mes" */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8}}>
                      <div onClick={()=>{setMes(m.key);setVistaHistorica(false);}} style={{fontWeight:700,color:C.white,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                        {m.label} {m.key===mesHoy()&&<Tag color={C.accent} ch="este mes"/>}
                      </div>
                      <Tag color={mg>=0?C.green:C.red} ch={`${mg}%`}/>
                    </div>
                    {/* Mini-grid 3 cifras */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                      <div style={{background:"rgba(16,185,129,0.08)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:"1px solid rgba(16,185,129,0.18)"}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Ingresos</div>
                        <div style={{fontSize:12,fontWeight:800,color:C.green}}>{fmt(m.ing)}</div>
                      </div>
                      <div style={{background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:"1px solid rgba(239,68,68,0.18)"}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Gastos</div>
                        <div style={{fontSize:12,fontWeight:800,color:C.red}}>{fmt(m.gas)}</div>
                      </div>
                      <div style={{background:m.util>=0?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:`1px solid ${m.util>=0?"rgba(16,185,129,0.18)":"rgba(239,68,68,0.18)"}`}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Utilidad</div>
                        <div style={{fontSize:12,fontWeight:800,color:m.util>=0?C.green:C.red}}>{fmt(m.util)}</div>
                      </div>
                    </div>
                    {/* Acciones */}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>exportarPDF(m.key,m.label,fmt(m.ing),fmt(m.gas),fmt(m.util),mg,gastosDelMes)}
                        style={{flex:1,background:"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",border:"none",borderRadius:10,padding:"10px",color:"#FFFFFF",fontWeight:700,fontSize:12,cursor:"pointer",minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 14px rgba(37,99,235,0.35)",transition:"all 0.18s"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                        Exportar PDF
                      </button>
                      <button onClick={async()=>{
                        if(!confirm(`¿Eliminar todos los gastos de ${m.label}? Esta acción no se puede deshacer.`)) return;
                        const ids=gastosDelMes.map(g=>g.id);
                        for(const id of ids) await fb.del("gastos",id,{hardDelete:true});
                        setGastos(prev=>prev.filter(g=>!ids.includes(g.id)));
                      }}
                        style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",minHeight:40,minWidth:44}}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
      </div>
    )}

    {!vistaHistorica&&(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
      <KPIDark label="Ingresos Cobrados" value={fmt(ingCob)} valueColor="#10B981" sub="contratos pagados" accent="#10B981" icon={ICN.check}/>
      <KPIDark label="Por Cobrar"        value={fmt(ingPend)} valueColor="#FFFFFF" sub="contratos pendientes" accent="#2563EB" icon={ICN.hourglass}/>
      <KPIDark label="Total Gastos"      value={fmt(totGastos)} valueColor="#EF4444" sub={`${gastosMes.length} conceptos`} accent="#EF4444" icon={ICN.down}/>
      <KPIDark label="Utilidad Neta"     value={fmt(utilidad)} valueColor={utilidad>=0?"#10B981":"#EF4444"} sub={`Margen ${margen}%`} accent={utilidad>=0?"#10B981":"#EF4444"} icon={utilidad>=0?ICN.up:ICN.down}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14,marginBottom:16}}>
      <Card>
        <SecTit ch="📊 Pérdidas & Ganancias"/>
        {[["Ingresos brutos",ingBrut,C.green],["(-) No cobrados",-ingPend,C.white],["Ingresos netos",ingCob,C.white],["(-) Gastos totales",-totGastos,C.red],["= Utilidad neta",utilidad,utilidad>=0?C.green:C.red]].map(([l,v,c],i)=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",borderTop:i===4?`2px solid ${C.border}`:"none"}}>
            <span style={{fontSize:13,color:i===4?C.white:C.muted,fontWeight:i===4?700:400}}>{l}</span>
            <span style={{fontSize:14,fontWeight:700,color:c}}>{v<0?`-${fmt(Math.abs(v))}`:fmt(v)}</span>
          </div>
        ))}
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:6}}><span>Margen neto</span><span style={{fontWeight:700,color:margen>=0?C.green:C.red}}>{margen}%</span></div>
          <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(Math.abs(margen),100)}%`,background:margen>=0?C.green:C.red,borderRadius:4,transition:"width .5s"}}/></div>
        </div>
      </Card>

      <Card>
        <SecTit ch="🗂 Gastos por Categoría"/>
        {Object.keys(porCat).length===0&&<div style={{color:C.muted,fontSize:13,padding:"16px 0"}}>Sin gastos para este mes</div>}
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
          <div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:C.text,fontWeight:600}}>{cat}</span><span style={{color:catCol[cat]||C.muted,fontWeight:700}}>{fmt(val)}</span></div>
            <div style={{height:6,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(val/catMax)*100}%`,background:catCol[cat]||C.muted,borderRadius:4,transition:"width .5s"}}/></div>
          </div>
        ))}
      </Card>
    </div>

    <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:700,color:C.white}}>📝 Detalle de Gastos — {new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"})}</span>
        <span style={{fontSize:13,color:C.muted}}>{gastosMes.length} conceptos · <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
      {loadG?<Spinner/>:
      <div>
        {gastosMes.length===0&&<div style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></div>}
        {gastosMes.map((g,i)=>(
          <div key={g.id} style={{padding:"12px 16px",borderBottom:i<gastosMes.length-1?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <Tag color={catCol[g.categoria]||C.muted} ch={g.categoria}/>
              </div>
              <div style={{color:C.text,fontSize:13,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descripcion}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.red}}>{fmt(g.monto)}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>openEdit(g)} style={{background:C.accent+"22",border:"none",borderRadius:9,padding:"8px 10px",color:C.accent,cursor:"pointer",minWidth:36,minHeight:36}}>✏️</button>
              <button onClick={()=>eliminar(g.id)} style={{background:C.red+"22",border:"none",borderRadius:9,padding:"8px 10px",color:C.red,cursor:"pointer",minWidth:36,minHeight:36}}>🗑</button>
            </div>
          </div>
        ))}
      </div>}
      <div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
        <span>🔥 Sincronizado con Firebase</span><span>Total gastos: <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
    </Card>
    </div>)}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"} onClose={()=>{setModal(null);onModalChange?.(false);}} onSave={guardar} saveLabel={saving?"Guardando...":"Agregar ✓"}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {inp("Categoría","categoria",form,setForm,{type:"select",options:CAT_GASTOS})}
          {inp("Descripción","descripcion",form,setForm,{ph:"Ej: Mantenimiento Panel Norte"})}
          {inp("Monto ($)","monto",form,setForm,{type:"number"})}
          {inp("Mes","mes",form,setForm,{type:"month"})}
        </div>
      </Modal>
    )}
  </div>);
}

// ── ALERTAS DE VENCIMIENTO ───────────────────────────────────────
function Firebase({contratos,paneles,clientes,gastos,fbConnected,fbLoading,fbError}){
  const [notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const [dbStats,setDbStats]=useState({paneles:0,contratos:0,clientes:0,gastos:0,total:0,loading:true});
  const [storageStats,setStorageStats]=useState({bytes:0,count:0,loading:true,error:false});

  // Calcular uso aproximado de DB (Firestore — serialización JSON como proxy)
  useEffect(()=>{
    const calcSize=(arr)=>arr&&arr.length>0?JSON.stringify(arr).length:0;
    const p=calcSize(paneles); const c=calcSize(contratos);
    const cl=calcSize(clientes); const g=calcSize(gastos);
    const total=p+c+cl+g;
    setDbStats({paneles:p,contratos:c,clientes:cl,gastos:g,total,loading:false});
  },[paneles,contratos,clientes,gastos]);

  // Estimar uso de Cloudinary — ~25KB promedio por foto WebP
  useEffect(()=>{
    const fotos=gastos.filter(g=>g.fotoUrl).length;
    const estimado=fotos*25*1024; // ~25 KB por foto WebP
    setStorageStats({bytes:estimado,count:fotos,loading:false,error:false});
  },[gastos]);

  const fmtBytes=(b)=>{
    if(b===0) return "0 B";
    if(b<1024) return b+" B";
    if(b<1048576) return (b/1024).toFixed(1)+" KB";
    if(b<1073741824) return (b/1048576).toFixed(2)+" MB";
    return (b/1073741824).toFixed(2)+" GB";
  };

  // Firebase Firestore plan Spark: ~1 GB datos, 50K lecturas/día
  const DB_LIMIT=1073741824; // 1 GB (Firestore)
  const dbPct=Math.min(100,Math.round(dbStats.total/DB_LIMIT*10000)/100);

  // Cloudinary plan gratuito: 25 GB
  const STORAGE_LIMIT=26843545600; // 25 GB
  const storagePct=Math.min(100,Math.round(storageStats.bytes/STORAGE_LIMIT*10000)/100);

  // Alertas de vencimiento
  const hoyD=new Date();
  const datos=contratos.map(c=>{
    const panel=paneles.find(p=>p.id===c.panel_id);
    const cliente=clientes.find(cl=>cl.id===c.cliente_id);
    const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);
    return {...c,panel,cliente,d};
  }).filter(c=>c.panel&&c.cliente);
  const criticos=datos.filter(c=>c.d>0&&c.d<=15).sort((a,b)=>a.d-b.d);
  const proximos=datos.filter(c=>c.d>15&&c.d<=30).sort((a,b)=>a.d-b.d);
  const vencidos=datos.filter(c=>c.d<=0);
  const totalAlertas=criticos.length+proximos.length+vencidos.length;

  const activarNotif=async()=>{
    if(typeof Notification==="undefined") return alert("Tu navegador no soporta notificaciones.\nEn iPhone necesitas iOS 16.4+ y agregar la app a Inicio primero.");
    const p=await Notification.requestPermission();
    setNotifPerm(p);
    if(p==="granted"){
      new Notification("✅ 8 Millas — Alertas activadas",{body:"Te avisaremos 30 días y 15 días antes de cada vencimiento",tag:"bienvenida"});
      try{ localStorage.removeItem("v360_notif"); }catch{}
    } else if(p==="denied"){
      alert("Bloqueaste las notificaciones.\nPara activarlas: Ajustes del navegador → Notificaciones → Permitir para este sitio.");
    }
  };

  const AlertRow=({c,color,label})=>{
    const msg=encodeURIComponent(`Hola ${c.cliente?.contacto}, le recordamos que su contrato para *${c.panel?.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`);
    return(
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{width:40,height:40,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c.panel?.foto||"🖥️"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel?.nombre}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>{c.cliente?.empresa} · Vence {fmtF(c.fin)}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
          <span style={{fontSize:10,fontWeight:700,color,background:color+"22",borderRadius:6,padding:"2px 7px"}}>{label}</span>
          <a href={`https://wa.me/${c.cliente?.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
            style={{background:"#25D366",borderRadius:6,padding:"3px 9px",color:"#fff",fontWeight:700,fontSize:10,textDecoration:"none"}}>WhatsApp</a>
        </div>
      </div>
    );
  };

  return(<div>
    <PgTit icon="🔥" title="Firebase & Alertas" sub="Base de datos, storage y notificaciones"/>

    {/* ── ESTADO DE CONEXIÓN — aquí dentro, no en la nav ── */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"12px 16px",background:fbError?"#EF444412":fbLoading?"#F59E0B12":"#10B98112",border:`1px solid ${fbError?C.red+"33":fbLoading?C.amber+"33":C.green+"33"}`,borderRadius:12}}>
      <div style={{width:9,height:9,borderRadius:"50%",background:fbError?C.red:fbLoading?C.amber:C.green,flexShrink:0,animation:fbLoading?"pulse 1s infinite":"none"}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:fbError?C.red:fbLoading?C.amber:C.green}}>
          {fbError?"⚠️ Sin conexión a Firebase":fbLoading?"🔄 Conectando con Firebase...":"✅ Firebase conectado"}
        </div>
        {!fbError&&!fbLoading&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>
          Proyecto: base-de-datos-vista360 · Firestore + Storage activos
        </div>}
        {fbError&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>
          Verifica tu conexión a internet o las reglas de Firestore
        </div>}
      </div>
    </div>

    {/* ── TARJETA USO FIRESTORE ── */}
    <Card style={{marginBottom:16}}>
      <SecTit ch="🔥 Uso de Base de Datos — Firebase Firestore"/>
      {dbStats.loading
        ?<div style={{color:C.muted,fontSize:13}}>Calculando...</div>
        :<div>
          {/* Barra total */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:C.white}}>Total usado</span>
              <span style={{fontSize:13,fontWeight:800,color:dbPct>80?C.red:dbPct>50?C.amber:C.green}}>{fmtBytes(dbStats.total)} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>de 1 GB</span></span>
            </div>
            <div style={{background:C.border,borderRadius:8,height:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${dbPct}%`,background:dbPct>80?"linear-gradient(90deg,#EF4444,#DC2626)":dbPct>50?"linear-gradient(90deg,#F59E0B,#D97706)":"linear-gradient(90deg,#10B981,#059669)",borderRadius:8,transition:"width .8s",minWidth:dbPct>0?"6px":"0"}}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{dbPct.toFixed(3)}% del límite gratuito</div>
          </div>

          {/* Desglose por tabla */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"🖥️ Paneles",size:dbStats.paneles,count:paneles.length,color:C.accent},
              {label:"📋 Contratos",size:dbStats.contratos,count:contratos.length,color:C.green},
              {label:"👥 Clientes",size:dbStats.clientes,count:clientes.length,color:C.purple},
              {label:"🧾 Gastos",size:dbStats.gastos,count:gastos.length,color:C.amber},
            ].map(({label,size,count,color})=>(
              <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 13px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>{label}</div>
                <div style={{fontSize:15,fontWeight:800,color}}>{fmtBytes(size)}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{count} registros</div>
                <div style={{marginTop:6,background:C.border,borderRadius:4,height:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,size/dbStats.total*100)}%`,background:color,borderRadius:4}}/>
                </div>
              </div>
            ))}
          </div>

          {/* Límite gratuito info */}
          <div style={{marginTop:14,padding:"10px 14px",background:"#0EA5E918",border:"1px solid #0EA5E944",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16}}>ℹ️</span>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              <strong style={{color:C.white}}>Firebase Firestore (Plan Spark gratuito):</strong> 1 GiB almacenamiento · 50,000 lecturas/día · 20,000 escrituras/día · Sin límite de filas.
            </div>
          </div>
        </div>
      }
    </Card>

    {/* ── TARJETA FIREBASE STORAGE (FOTOS) — datos reales ── */}
    <Card style={{marginBottom:16}}>
      <SecTit ch="📸 Cloudinary — Fotos de Boletas"/>
      {storageStats.loading
        ?<div style={{color:C.muted,fontSize:13,display:"flex",gap:8,alignItems:"center"}}><div style={{width:14,height:14,border:`2px solid ${C.border}`,borderTopColor:C.cyan,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>Calculando espacio real...</div>
        :<div>
          {/* Barra storage fotos */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:C.white}}>Storage de imágenes</span>
              <span style={{fontSize:13,fontWeight:800,color:storagePct>80?C.red:storagePct>50?C.amber:C.cyan}}>
                {fmtBytes(storageStats.bytes)} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>de 25 GB</span>
              </span>
            </div>
            <div style={{background:C.border,borderRadius:8,height:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.max(storagePct,storageStats.bytes>0?0.3:0)}%`,background:"linear-gradient(90deg,#06B6D4,#0891B2)",borderRadius:8,transition:"width .8s"}}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>
              {storagePct.toFixed(4)}% usado · {storageStats.count} {storageStats.count===1?"foto":"fotos"} de boletas
            </div>
          </div>
          {/* Grid: desglose real */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {label:"📁 Capacidad total",val:"25 GB",sub:"Cloudinary gratuito",color:C.cyan},
              {label:"🖼️ Fotos subidas",val:String(storageStats.count),sub:"boletas escaneadas",color:C.green},
              {label:"📦 Espacio usado",val:fmtBytes(storageStats.bytes),sub:"estimado · ~25 KB/foto",color:C.amber},
              {label:"♻️ Espacio libre",val:fmtBytes(Math.max(0,STORAGE_LIMIT-storageStats.bytes)),sub:"disponible",color:C.purple},
            ].map(({label,val,sub,color})=>(
              <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 13px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>{label}</div>
                <div style={{fontSize:15,fontWeight:800,color}}>{val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{padding:"10px 14px",background:"#06B6D418",border:"1px solid #06B6D444",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16}}>ℹ️</span>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              <strong style={{color:C.white}}>Cloudinary (Plan gratuito):</strong> 25 GB de almacenamiento · Las fotos se comprimen a WebP ~25 KB antes de subir.
            </div>
          </div>
        </div>
      }
    </Card>

    {/* ── ALERTAS DE VENCIMIENTO ── */}
    <Card style={{marginBottom:16,borderColor:totalAlertas>0?C.amber+"44":C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <SecTit ch={`🔔 Alertas de Vencimiento${totalAlertas>0?` · ${totalAlertas} contratos`:""}`}/>
        {totalAlertas>0&&<span style={{background:C.red,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{totalAlertas}</span>}
      </div>

      {totalAlertas===0
        ?<div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:32,marginBottom:8}}>✅</div>
            <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:4}}>Todo al día</div>
            <div style={{fontSize:12,color:C.muted}}>No hay contratos por vencer en los próximos 30 días</div>
          </div>
        :<div>
          {vencidos.length>0&&<div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🚨 Vencidos — {vencidos.length}</div>
            {vencidos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`Venció hace ${Math.abs(c.d)}d`}/>)}
          </div>}
          {criticos.length>0&&<div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🔴 Críticos ≤15 días — {criticos.length}</div>
            {criticos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`⚠️ ${c.d}d`}/>)}
          </div>}
          {proximos.length>0&&<div>
            <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🟡 Próximos 16-30 días — {proximos.length}</div>
            {proximos.map(c=><AlertRow key={c.id} c={c} color={C.amber} label={`📅 ${c.d}d`}/>)}
          </div>}
        </div>
      }
    </Card>

    {/* ── ACTIVAR NOTIFICACIONES ── */}
    <Card>
      <SecTit ch="📲 Notificaciones Push"/>
      <div style={{marginBottom:14,fontSize:13,color:C.muted,lineHeight:1.6}}>
        Recibe alertas automáticas en tu celular <strong style={{color:C.white}}>30 días y 15 días antes</strong> de que venza cada contrato.
      </div>
      {notifPerm==="granted"
        ?<div style={{display:"flex",alignItems:"center",gap:10,background:C.green+"15",border:`1px solid ${C.green}44`,borderRadius:12,padding:"13px 16px"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite",flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.green}}>Notificaciones activas</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>Recibirás alertas 30d y 15d antes de cada vencimiento</div>
            </div>
          </div>
        :notifPerm==="denied"
        ?<div style={{background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:12,padding:"13px 16px"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:4}}>🚫 Notificaciones bloqueadas</div>
            <div style={{fontSize:11,color:C.muted}}>Ve a Ajustes del navegador → Notificaciones → Permitir para este sitio.</div>
          </div>
        :<div>
          <button onClick={activarNotif}
            style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#2563EB,#1E40AF)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 16px rgba(245,158,11,0.35)"}}>
            <span style={{fontSize:20}}>🔔</span> Activar Alertas en Celular
          </button>
          <div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center",lineHeight:1.5}}>
            iPhone: primero agrega la app a Inicio<br/>(Safari → Compartir → Agregar a inicio) para habilitar notificaciones
          </div>
        </div>
      }
    </Card>
  </div>);
}



// ══════════════════════════════════════════════════════════════════
// GASTOS v47 — OCR Tesseract + Diseño profesional estilo Khipu
// ══════════════════════════════════════════════════════════════════
// ── FIELD HELPER para Gastos — FUERA del componente para evitar
//    que React destruya el input en cada keystroke (bug teclado iOS)
function GastosKInp({label,keyN,type="text",opts=[],form,setForm}){
  return(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,display:"block",marginBottom:4}}>{label}</label>
      {type==="select"
        ?<select value={form[keyN]||""} onChange={e=>setForm(f=>({...f,[keyN]:e.target.value}))}
            style={{width:"100%",background:"#0A1020",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none"}}>
            {opts.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
          </select>
        :<input
            type={type==="number"?"text":type}
            inputMode={type==="number"?"decimal":undefined}
            value={form[keyN]||""}
            onChange={e=>setForm(f=>({...f,[keyN]:type==="number"?e.target.value.replace(/[^0-9.]/g,""):e.target.value}))}
            style={{width:"100%",background:"#0A1020",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
      }
    </div>
  );
}

function Gastos({gastos,setGastos,autoScan,setAutoScan,onModalChange}){
  const [mes,setMes]=useState(()=>{const h=new Date();return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`;});
  const [modal,setModal]=useState(null);       // null | "nuevo" | objeto gasto
  const [vistaDetalle,setVistaDetalle]=useState(null); // gasto para vista Khipu
  const [form,setForm]=useState({fecha:"",proveedor:"",ruc:"",concepto:"",monto:"",igv:"",subtotal:"",categoria:"Otro",notas:"",foto_texto:"",moneda:"PEN"});
  const [saving,setSaving]=useState(false);
  const [ocr,setOcr]=useState({loading:false,progress:0,fase:"",text:"",imgUrl:"",previewUrl:""});
  const fileRef=useRef(null);

  // Auto-disparar cámara cuando se entra desde el botón + del bottom nav
  useEffect(()=>{
    if(autoScan && fileRef.current){
      // 1. Resetear formulario completamente (evita arrastrar datos de un gasto editado antes)
      setForm({fecha:"",proveedor:"",ruc:"",concepto:"",monto:"",igv:"",subtotal:"",categoria:"Otro",notas:"",foto_texto:"",moneda:"PEN"});
      // 2. Abrir el modal en modo "nuevo" para que al guardar cree un gasto nuevo
      setModal("nuevo"); onModalChange?.(true);
      // 3. Limpiar cualquier OCR previo
      setOcr({loading:false,progress:0,fase:"",text:"",imgUrl:"",previewUrl:""});
      // 4. Disparar la cámara con un delay para que el modal se monte primero
      const t=setTimeout(()=>{
        fileRef.current?.click();
        setAutoScan?.(false);
      },200);
      return()=>clearTimeout(t);
    }
  },[autoScan,setAutoScan]);

  const cambiarMes=(delta)=>{
    const [y,m]=mes.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    setMes(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };

  const delMes=gastos.filter(g=>g.fecha&&g.fecha.startsWith(mes));
  const totalMes=delMes.reduce((a,g)=>a+Number(g.monto||0),0);
  const porCat={};
  delMes.forEach(g=>{const c=g.categoria||"Otro";porCat[c]=(porCat[c]||0)+Number(g.monto||0);});
  const catColor={"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};
  const catIcon={"Mantenimiento":"🔧","Personal":"👤","Transporte":"🚗","Administrativo":"📁","Servicios":"⚡","Marketing":"📢","Otro":"📦"};

  // ══════════════════════════════════════════════════════════════
  // 1. PRE-PROCESAMIENTO AVANZADO DE IMAGEN (Canvas)
  //    Binarización adaptativa + aumento de contraste + escala de grises
  //    Optimizado para boletas peruanas con fondo grisáceo y sellos
  // ══════════════════════════════════════════════════════════════
  const preprocesarImagen=async(file)=>{
    return new Promise((resolve,reject)=>{
      const img=new Image();
      const originalUrl=URL.createObjectURL(file);
      img.onload=()=>{
        // ── A. Escalar: Tesseract funciona mejor con imágenes ≥ 1800px de ancho
        const targetW=Math.max(img.width,1800);
        const escala=targetW/img.width;
        const canvas=document.createElement("canvas");
        canvas.width=Math.round(img.width*escala);
        canvas.height=Math.round(img.height*escala);
        const ctx=canvas.getContext("2d");
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality="high";
        ctx.drawImage(img,0,0,canvas.width,canvas.height);

        // ── B. Leer píxeles y aplicar pipeline de preprocesamiento
        const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
        const data=imageData.data;
        const W=canvas.width, H=canvas.height;
        const gray=new Uint8Array(W*H);

        // B.1 Convertir a escala de grises — luminancia perceptual ITU-R BT.601
        for(let i=0;i<data.length;i+=4){
          gray[i/4]=Math.round(0.299*data[i]+0.587*data[i+1]+0.114*data[i+2]);
        }

        // B.2 Binarización adaptativa (ventana local 41×41, offset 10)
        //     Elimina gradientes de iluminación desigual — clave en fotos de boletas
        const R=20; // radio de la ventana
        const offset=10;
        const binarized=new Uint8Array(W*H);
        for(let y=0;y<H;y++){
          for(let x=0;x<W;x++){
            const idx=y*W+x;
            // Calcular media local con integral de imagen simplificada
            let suma=0, count=0;
            const y0=Math.max(0,y-R), y1=Math.min(H-1,y+R);
            const x0=Math.max(0,x-R), x1=Math.min(W-1,x+R);
            for(let yy=y0;yy<=y1;yy+=4){ // submuestreo para velocidad
              for(let xx=x0;xx<=x1;xx+=4){
                suma+=gray[yy*W+xx]; count++;
              }
            }
            const media=count>0?suma/count:128;
            // Píxel oscuro (texto) → negro, fondo claro → blanco
            binarized[idx]=gray[idx]<(media-offset)?0:255;
          }
        }

        // B.3 Aumento de contraste global (stretch) sobre la imagen binarizada
        //     Suavizado final para reducir ruido puntual de sellos y marcas
        for(let i=0,j=0;i<data.length;i+=4,j++){
          const v=binarized[j];
          data[i]=v; data[i+1]=v; data[i+2]=v;
          // Alpha sin cambio
        }
        ctx.putImageData(imageData,0,0);

        canvas.toBlob(blob=>{
          URL.revokeObjectURL(originalUrl);
          resolve({blob, previewUrl:canvas.toDataURL("image/jpeg",0.7)});
        },"image/jpeg",0.95);
      };
      img.onerror=()=>{URL.revokeObjectURL(originalUrl);reject(new Error("No se pudo leer la imagen"));};
      img.src=originalUrl;
    });
  };

  // ══════════════════════════════════════════════════════════════
  // 2. GOOGLE CLOUD VISION — OCR de alta precisión
  // ══════════════════════════════════════════════════════════════
  // Google Vision API Key — se lee de Vercel en producción
  const VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_KEY || "";

  const ocr_con_vision = async (file) => {
    // Convertir imagen a base64
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(",")[1]);
      reader.readAsDataURL(file);
    });

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["es", "es-PE"] },
          }],
        }),
      }
    );

    if (!response.ok) throw new Error(`Google Vision error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const texto = data.responses?.[0]?.fullTextAnnotation?.text || "";
    if (!texto.trim()) throw new Error("No se detectó texto en la imagen.");
    return texto;
  };

  // ══════════════════════════════════════════════════════════════
  // 3. PIPELINE PRINCIPAL DE ESCANEO
  // ══════════════════════════════════════════════════════════════
  const escanear=async(file)=>{
    if(!file) return;
    const imgUrl=URL.createObjectURL(file);
    setOcr({loading:true,progress:20,fase:"Analizando con Google Cloud Vision...",text:"",imgUrl,previewUrl:imgUrl,_file:file});

    try{
      // Enviar directamente a Google Vision sin preprocesamiento local
      const textoRaw = await ocr_con_vision(file);
      setOcr(o=>({...o,progress:80,fase:"Texto extraído ✓ — Procesando datos..."}));

      if(!textoRaw||textoRaw.trim().length<8)
        throw new Error("No se detectó texto. Verifica iluminación y enfoque.");

      // Extracción inteligente
      setOcr(o=>({...o,progress:95,fase:"Extrayendo datos estructurados..."}));
      const datosExtraidos=extraerDatosInteligente(textoRaw);

      setOcr(o=>({...o,loading:false,progress:100,fase:"✓ Completado con Google Vision",text:textoRaw,imgUrl,previewUrl:imgUrl,_file:file}));

      // ── Fase 4: Rellenar formulario ───────────────────────────
      setForm(f=>({
        ...f,
        proveedor: datosExtraidos.proveedor||f.proveedor,
        ruc:       datosExtraidos.ruc||f.ruc,
        fecha:     datosExtraidos.fecha||f.fecha,
        concepto:  datosExtraidos.concepto||f.concepto,
        monto:     datosExtraidos.monto?String(datosExtraidos.monto):f.monto,
        igv:       datosExtraidos.igv?String(datosExtraidos.igv):f.igv,
        subtotal:  datosExtraidos.subtotal?String(datosExtraidos.subtotal):f.subtotal,
        categoria: datosExtraidos.categoria!=="Otro"?datosExtraidos.categoria:f.categoria,
        moneda:    datosExtraidos.moneda||f.moneda||"PEN",
        foto_texto:textoRaw,
      }));

    }catch(e){
      setOcr(o=>({...o,loading:false,progress:0,fase:""}));
      alert("Error OCR: "+e.message);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 4. EXTRACCIÓN INTELIGENTE CON REGEX — El núcleo del sistema
  //    Reglas ancladas a palabras clave para evitar falsos positivos
  // ══════════════════════════════════════════════════════════════
  const extraerDatosInteligente=(text)=>{
    // Normalizar: eliminar caracteres basura OCR comunes, unificar espacios
    const t=text
      .replace(/[|¦\[\]{}]/g,"")           // barras y brackets → vacío
      .replace(/[,;](\d{3})/g,".$1")       // coma miles → punto (1,500 → 1.500)
      .replace(/\r/g,"")
      .replace(/[ \t]{2,}/g," ");
    const lineas=t.split("\n").map(l=>l.trim()).filter(l=>l.length>0);

    // ── RUC: estrictamente 11 dígitos iniciando con 10, 15 o 20 ──
    // Busca primero junto a la etiqueta RUC, luego suelta
    const rucConEtiq=t.match(/R\.?U\.?C\.?\s*[:\-]?\s*\b((?:10|15|20)\d{9})\b/i);
    const rucSuelto=t.match(/\b((?:10|15|20)\d{9})\b/);
    const ruc=(rucConEtiq?.[1]||rucSuelto?.[1]||"").trim();

    // ── MONTO TOTAL: anclado a TOTAL / IMPORTE / GRAN TOTAL ──
    // Ignora cifras precedidas por "AHORRO", "DESCUENTO", "PUNTO", "ACUMU"
    // Busca el número más grande que sigue a la palabra clave
    let monto="";
    const patronesTotal=[
      /(?:IMPORTE\s*TOTAL|TOTAL\s*(?:A\s*PAGAR|GENERAL|VENTA|COBRAR)?)\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i,
      /(?:GRAN\s*TOTAL)\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i,
      /^TOTAL\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/im,
    ];
    for(const p of patronesTotal){
      const m=t.match(p);
      if(m){
        const n=parseFloat(m[1].replace(",","."));
        if(!isNaN(n)&&n>0){monto=n;break;}
      }
    }
    // Fallback: mayor monto tras "S/." excluyendo contextos de descuento/ahorro
    if(!monto){
      const textoFiltrado=t.replace(/(?:AHORRO|DESCUENTO|PUNTO|ACUMU|REDONDE)[^\n]*/gi,"");
      const todas=[...textoFiltrado.matchAll(/S\/\.?\s*([\d]+[.,]\d{1,2})/gi)]
        .map(m=>parseFloat(m[1].replace(",",".")))
        .filter(n=>!isNaN(n)&&n>0.5);
      if(todas.length) monto=Math.max(...todas);
    }

    // ── IGV: anclado a etiqueta IGV / I.G.V / TAX ──
    const igvM=t.match(/I\.?G\.?V\.?\s*(?:18%?)?\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i);
    let igv=igvM?parseFloat(igvM[1].replace(",",".")):
              monto?Math.round(Number(monto)/1.18*0.18*100)/100:"";

    // ── SUBTOTAL / BASE IMPONIBLE ──
    const subM=t.match(/(?:SUBTOTAL|BASE\s*IMPONIBLE|V\.?\s*VENTA|VALOR\s*VENTA)\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i);
    let subtotal=subM?parseFloat(subM[1].replace(",",".")):
                 monto&&igv?Math.round((Number(monto)-Number(igv))*100)/100:"";

    // ── FECHA: validación estricta DD/MM/AAAA o variantes ──
    // Descarta años fuera del rango 2010-2035
    let fecha="";
    const fechaPatrones=[
      /\b(\d{2})\/(\d{2})\/(20(?:1\d|2\d|3[0-5]))\b/, // DD/MM/AAAA
      /\b(\d{2})-(\d{2})-(20(?:1\d|2\d|3[0-5]))\b/,   // DD-MM-AAAA
      /\b(\d{2})\.(\d{2})\.(20(?:1\d|2\d|3[0-5]))\b/,  // DD.MM.AAAA
    ];
    for(const p of fechaPatrones){
      const m=t.match(p);
      if(m){
        const [,d,mo,y]=m;
        const dN=parseInt(d), moN=parseInt(mo);
        if(dN>=1&&dN<=31&&moN>=1&&moN<=12){
          fecha=`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
          break;
        }
      }
    }

    // ── PROVEEDOR: prioriza razón social sobre nombre de persona ──
    const skipProv=/^(factura|boleta|ticket|nota|comprobante|ruc|r\.u\.c|fecha|total|subtotal|igv|tax|item|cantidad|precio|descripcion|detalle|cod|nro|n°|serie|copia|gracias|direccion|telefono|email|www|http|nombre\s*de\s*cliente|nombre\s*cl|dni|cliente|ahorraste|tienes|monedero|central|tienda|caja\/turno|cajero)/i;
    const skipCorta=/^[\d\s\.\-\/\*#]{0,5}$/;
    // 1. Razón social explícita (tiene S.A.C, S.A., S.R.L, E.I.R.L)
    const razonSocial=lineas.find(l=>
      /\b(S\.?A\.?C\.?|S\.?A\.?\b|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?)\b/i.test(l)&&l.length>=4
    );
    // 2. Línea en mayúsculas que no sea nombre de persona
    const lineaMayus=!razonSocial&&lineas.find(l=>
      /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s&.]{5,}$/.test(l)&&
      !skipProv.test(l)&&!skipCorta.test(l)&&
      !/NOMBRE|CLIENTE|CAJERO|CAJA|BOLETA|TICKET|BLANCO|MARTINEZ|GARCIA|LOPEZ|GONZALEZ/.test(l)
    );
    // 3. Fallback primera línea válida
    const provFallback=lineas.find(l=>
      l.length>=4&&/[a-zA-ZÀ-ÿ]{3,}/.test(l)&&
      !skipProv.test(l)&&!skipCorta.test(l)&&!/^\d/.test(l)
    )||"";
    const proveedor=(razonSocial||lineaMayus||provFallback).trim();

    // ── CONCEPTO: líneas de descripción de producto/servicio ──
    const skipConc=new RegExp(skipProv.source+"|^"+proveedor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
    const concLineas=lineas.filter(l=>
      l.length>=6&&
      /[a-zA-ZÀ-ÿ]{4,}/.test(l)&&
      !skipConc.test(l)&&
      !skipCorta.test(l)
    );
    const concepto=concLineas.slice(0,2).join(" — ").substring(0,140);

    // ── MONEDA ──
    const esDolares=/\$|USD|DOLLAR/i.test(t)&&!/S\/|SOLES|PEN/i.test(t);
    const moneda=esDolares?"USD":"PEN";

    // ── CATEGORÍA AUTOMÁTICA ──
    const tl=t.toLowerCase();
    let categoria="Otro";
    if(/restaurante|comida|almuerzo|cena|desayuno|pizza|pollo|burger|caf[eé]|marisco|aliment|chifa|menu/i.test(tl)) categoria="Servicios";
    else if(/hotel|hospedaje|alojamiento|hostal|apart|airbnb/i.test(tl)) categoria="Administrativo";
    else if(/taxi|uber|bus|combustible|gasolina|petr[oó]leo|peaje|estaci[oó]n|grifo|pluspetrol|repsol|petroper/i.test(tl)) categoria="Transporte";
    else if(/ferreteri|mantenimiento|reparaci[oó]n|t[eé]cnico|herramienta|electricidad|plomero|pintura|soldadura/i.test(tl)) categoria="Mantenimiento";
    else if(/sueldo|salario|planilla|personal|empleado|honorario/i.test(tl)) categoria="Personal";
    else if(/publicidad|marketing|imprenta|dise[nñ]o|redes|facebook|google ads/i.test(tl)) categoria="Marketing";

    return {proveedor,ruc,fecha,concepto,monto,igv,subtotal,moneda,categoria};
  };

  // ══════════════════════════════════════════════════════════════
  // 5. GUARDAR / ACTUALIZAR EN SUPABASE
  // ══════════════════════════════════════════════════════════════
  const guardar=async()=>{
    if(!form.monto) return alert("El monto es obligatorio");
    setSaving(true);
    const descripcion=([form.concepto,form.proveedor].filter(Boolean).join(" — ")||"Sin descripción").substring(0,255);

    // ── Subir foto WebP a Firebase Storage si hay imagen nueva ──
    let fotoUrl = form.fotoUrl || "";
    const archivoNuevo = ocr._file;
    if(archivoNuevo && !form.fotoUrl){
      try{
        const path = `gastos/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        fotoUrl = await Promise.race([
          fb.uploadImagen(path, archivoNuevo),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),15000))
        ]);
      }catch(e){ console.warn("Foto no subida:", e.message); fotoUrl=""; }
    }

    const payload={
      descripcion,
      categoria:  form.categoria||"Otro",
      monto:      Number(String(form.monto).replace(/[^0-9.]/g,""))||0,
      mes:        form.fecha?form.fecha.substring(0,7):mes,
      fecha:      form.fecha||new Date().toISOString().split("T")[0],
      proveedor:  form.proveedor||"",
      ruc:        form.ruc||"",
      concepto:   form.concepto||"",
      igv:        Number(String(form.igv||"0").replace(/[^0-9.]/g,""))||0,
      subtotal:   Number(String(form.subtotal||"0").replace(/[^0-9.]/g,""))||0,
      notas:      form.notas||"",
      foto_texto: form.foto_texto||"",
      fotoUrl,
      moneda:     form.moneda||"PEN",
    };
    try{
      if(modal==="nuevo"){
        const r=await fb.post("gastos",payload);
        setGastos(g=>[r[0]??{...payload,id:Date.now()},...g]);
      }else{
        const r=await fb.patch("gastos",modal.id,payload);
        setGastos(g=>g.map(x=>x.id===modal.id?(r[0]??{...modal,...payload}):x));
      }
      setSaving(false); setModal(null); onModalChange?.(false);
    }catch(e){
      setSaving(false);
      alert("Error al guardar: "+e.message);
    }
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este gasto?")) return;
    await fb.del("gastos",id,{hardDelete:true});
    setGastos(g=>g.filter(x=>x.id!==id));
    setVistaDetalle(null);
  };

  const abrirNuevo=()=>{
    const h=new Date();
    setForm({fecha:`${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}-${String(h.getDate()).padStart(2,"0")}`,proveedor:"",ruc:"",concepto:"",monto:"",igv:"",subtotal:"",categoria:"Otro",notas:"",foto_texto:"",moneda:"PEN"});
    setOcr({loading:false,progress:0,fase:"",text:"",imgUrl:"",previewUrl:""});
    setModal("nuevo"); onModalChange?.(true);
  };

  const abrirEditar=(g)=>{
    setForm({...g,monto:String(g.monto||""),igv:String(g.igv||""),subtotal:String(g.subtotal||"")});
    setOcr({loading:false,progress:0,fase:"",text:g.foto_texto||"",imgUrl:"",previewUrl:""});
    setModal(g); onModalChange?.(true);
    setVistaDetalle(null);
  };



  // ── CAMPO DE DATO (para vista detalle estilo Khipu) ──────────
  const Campo=({label,value,mono=false})=>value?(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:3}}>{label}</div>
      <div style={{fontSize:13,color:C.white,fontWeight:mono?600:400,fontFamily:mono?"monospace":"inherit"}}>{value}</div>
    </div>
  ):null;

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return(<div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){escanear(e.target.files[0]);e.target.value="";}}}/>

    {/* ── HEADER ── */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <PgTit icon="🧾" title="Gastos" sub="Google Vision OCR · Extracción automática de boletas"/>
      <button onClick={abrirNuevo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 4px 14px rgba(37,99,235,0.4)",whiteSpace:"nowrap"}}>+ Nuevo</button>
    </div>

    {/* ── SELECTOR DE MES ── */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:16,padding:"14px 18px",marginBottom:18}}>
      <button onClick={()=>cambiarMes(-1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(mes)}</div>
        <div style={{fontSize:13,color:C.green,fontWeight:700,marginTop:2}}>{fmt(totalMes)} total · {delMes.length} gastos</div>
      </div>
      <button onClick={()=>cambiarMes(1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
    </div>

    {/* ── CHIPS POR CATEGORÍA ── */}
    {Object.keys(porCat).length>0&&(
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,tot])=>(
          <div key={cat} style={{background:(catColor[cat]||C.muted)+"18",border:`1px solid ${catColor[cat]||C.muted}33`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,color:catColor[cat]||C.muted,display:"flex",alignItems:"center",gap:5}}>
            {catIcon[cat]||"📦"} {cat} · {fmt(tot)}
          </div>
        ))}
      </div>
    )}

    {/* ── LISTA DE GASTOS ── */}
    {delMes.length===0
      ?<div style={{textAlign:"center",padding:"54px 20px",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:20}}>
        <div style={{fontSize:48,marginBottom:12}}>🧾</div>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin gastos este mes</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Sube una foto de tu boleta — el OCR extrae todos los datos</div>
        <button onClick={abrirNuevo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"11px 28px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Agregar gasto</button>
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {delMes.map(g=>(
          <div key={g.id}
            onClick={()=>setVistaDetalle(g)}
            style={{background:"linear-gradient(145deg,#111929,#0E1829)",border:"1px solid #1E3050",borderRadius:16,overflow:"hidden",cursor:"pointer",transition:"border-color .2s",boxShadow:"0 2px 12px rgba(0,0,0,0.25)"}}>
            {/* Barra de color categoría */}
            <div style={{height:3,background:catColor[g.categoria]||C.muted}}/>
            <div style={{padding:"14px 16px"}}>
              {/* Fila superior: nombre + monto */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.white,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {(g.proveedor||"Sin proveedor").toUpperCase()}
                  </div>
                  {g.ruc&&<div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>RUC {g.ruc}</div>}
                </div>
                <div style={{fontSize:20,fontWeight:900,color:C.green,letterSpacing:"-0.5px",marginLeft:12,flexShrink:0}}>
                  {g.moneda==="USD"?"$":"S/"}{Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
              </div>
              {/* Concepto */}
              {g.concepto&&(
                <div style={{fontSize:12,color:"#94A3B8",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</div>
              )}
              {/* Fila inferior: badges + acciones */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{background:(catColor[g.categoria]||C.muted)+"20",color:catColor[g.categoria]||C.muted,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>
                    {catIcon[g.categoria]||"📦"} {g.categoria||"Otro"}
                  </span>
                  <span style={{background:"#1E3050",color:C.muted,borderRadius:20,padding:"2px 10px",fontSize:10}}>
                    📅 {g.fecha?new Date(g.fecha+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}):"—"}
                  </span>
                </div>
                <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>abrirEditar(g)} style={{background:"#2563EB18",border:"1px solid #2563EB33",borderRadius:8,padding:"5px 10px",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700}}>✏️ Editar</button>
                  <button onClick={()=>eliminar(g.id)} style={{background:C.red+"18",border:`1px solid ${C.red}33`,borderRadius:8,padding:"5px 8px",color:C.red,cursor:"pointer",fontSize:12}}>🗑</button>
                </div>
              </div>
              {/* Desglose IGV */}
              {Number(g.igv)>0&&(
                <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #1E3050",display:"flex",gap:16,fontSize:11,color:C.muted}}>
                  <span>BASE: <strong style={{color:"#94A3B8"}}>{g.moneda==="USD"?"$":"S/"}{Number(g.subtotal||0).toFixed(2)}</strong></span>
                  <span>IGV 18%: <strong style={{color:"#94A3B8"}}>{g.moneda==="USD"?"$":"S/"}{Number(g.igv||0).toFixed(2)}</strong></span>
                  <span>TOTAL: <strong style={{color:C.white}}>{g.moneda==="USD"?"$":"S/"}{Number(g.monto||0).toFixed(2)}</strong></span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    }

    {/* ══════════════════════════════════════════════════════════
        VISTA DETALLE — Estilo Khipu: imagen izquierda + datos derecha
        ══════════════════════════════════════════════════════════ */}
    {vistaDetalle&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}
        onClick={e=>e.target===e.currentTarget&&setVistaDetalle(null)}>
        <div style={{background:"#FFFFFF",borderRadius:"22px 22px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",display:"flex",flexDirection:"column",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)",paddingBottom:"env(safe-area-inset-bottom)"}}>

          {/* Header blanco estilo Khipu */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:"1px solid #E5E7EB"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1.2}}>Gasto</div>
              <div style={{fontSize:17,fontWeight:800,color:"#111827"}}>{vistaDetalle.proveedor||"Sin proveedor"}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{background:"#D1FAE5",color:"#065F46",borderRadius:20,padding:"4px 14px",fontSize:11,fontWeight:700}}>Registrado</span>
              <button onClick={()=>setVistaDetalle(null)} style={{width:30,height:30,borderRadius:"50%",background:"#F3F4F6",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>

          {/* Cuerpo: dos columnas */}
          <div style={{display:"flex",gap:0,flex:1,minHeight:0}}>

            {/* ── Columna izquierda: imagen de boleta ── */}
            <div style={{width:"38%",minWidth:180,background:"#F9FAFB",borderRight:"1px solid #E5E7EB",padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,borderRadius:"0 0 0 20px"}}>
              {(ocr.previewUrl||vistaDetalle.fotoUrl||vistaDetalle.foto_url)?
                <img src={ocr.previewUrl||vistaDetalle.fotoUrl||vistaDetalle.foto_url} alt="boleta" style={{width:"100%",borderRadius:12,border:"1px solid #E5E7EB",objectFit:"contain",maxHeight:340,background:"#fff"}}/>
                :<div style={{width:"100%",aspectRatio:"3/4",background:"#E5E7EB",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}} onClick={()=>fileRef.current.click()}>
                  <div style={{fontSize:36}}>📷</div>
                  <div style={{fontSize:11,color:"#6B7280",fontWeight:600,textAlign:"center"}}>Sin imagen<br/>Toca para subir</div>
                </div>
              }
              <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"9px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,color:"#1D4ED8",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                🔄 Reescanear boleta
              </button>
              {ocr.loading&&(
                <div style={{width:"100%",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:11,color:"#0369A1",fontWeight:600,marginBottom:6}}>{ocr.fase}</div>
                  <div style={{height:4,background:"#BAE6FD",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${ocr.progress}%`,background:"linear-gradient(90deg,#0EA5E9,#38BDF8)",borderRadius:2,transition:"width .3s"}}/>
                  </div>
                </div>
              )}
            </div>

            {/* ── Columna derecha: datos estructurados ── */}
            <div style={{flex:1,padding:"20px 24px",overflowY:"auto"}}>

              {/* DATOS DEL GASTO */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:"#111827",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #E5E7EB"}}>Datos del Gasto</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Fecha de Emisión</div>
                    <div style={{fontSize:13,color:"#111827"}}>{vistaDetalle.fecha?new Date(vistaDetalle.fecha+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"}):"—"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Categoría</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{background:(catColor[vistaDetalle.categoria]||C.muted)+"22",color:catColor[vistaDetalle.categoria]||C.muted,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{catIcon[vistaDetalle.categoria]||"📦"} {vistaDetalle.categoria||"Otro"}</span>
                    </div>
                  </div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Concepto</div>
                    <div style={{fontSize:13,color:"#111827"}}>{vistaDetalle.concepto||"—"}</div>
                  </div>
                  {vistaDetalle.notas&&(
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Notas</div>
                      <div style={{fontSize:13,color:"#374151"}}>{vistaDetalle.notas}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* IMPORTES */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:"#111827",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #E5E7EB"}}>Importes</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px 12px",marginBottom:12}}>
                  {[
                    ["BASE",vistaDetalle.subtotal],
                    ["I.G.V","18%"],
                    ["IMPORTE",vistaDetalle.monto],
                    ["SUBTOTAL",vistaDetalle.subtotal],
                  ].map(([k,v])=>(
                    <div key={k}>
                      <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{k}</div>
                      <div style={{fontSize:12,color:"#374151",fontFamily:"monospace"}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,color:"#6B7280",fontWeight:600}}>{vistaDetalle.moneda==="USD"?"USD":"S/"}.</span>
                  <span style={{fontSize:28,fontWeight:900,color:"#111827",letterSpacing:"-1px"}}>
                    {Number(vistaDetalle.monto||0).toLocaleString("es-PE",{minimumFractionDigits:3,maximumFractionDigits:3})}
                  </span>
                </div>
              </div>

              {/* PROVEEDOR */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:"#111827",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #E5E7EB"}}>Proveedor</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Razón Social</div>
                    <div style={{fontSize:13,color:"#111827",fontWeight:600}}>{vistaDetalle.proveedor||"—"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>RUC</div>
                    <div style={{fontSize:13,color:"#111827",fontFamily:"monospace"}}>{vistaDetalle.ruc||"—"}</div>
                  </div>
                </div>
              </div>

              {/* BOTONES — estilo Khipu */}
              <div style={{display:"flex",gap:10,paddingTop:8,flexDirection:"column"}}>
                <button onClick={async()=>{
                  const g=vistaDetalle;
                  const DARK="#0D1B3E",BLUE="#1A3066",ACC="#1E4D9B";
                  const fotoSrc=g.fotoUrl||ocr.previewUrl||"";
                  // Si hay foto en Cloudinary (URL externa) la incluimos directo; si es blob local también
                  const fotoHtml=fotoSrc?`
                    <div style="margin-bottom:22px">
                      <div style="font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact">📷 Comprobante / Boleta Escaneada</div>
                      <div style="text-align:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px">
                        <img src="${fotoSrc}" style="max-width:100%;max-height:480px;border-radius:8px;object-fit:contain;display:block;margin:0 auto" alt="Boleta" crossorigin="anonymous"/>
                      </div>
                    </div>`:"";
                  const monedaSim=g.moneda==="USD"?"$":"S/";
                  const fechaFmt=g.fecha?new Date(g.fecha+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"}):"—";
                  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Gasto — ${g.proveedor||"Sin proveedor"}</title>
                  <style>
                    *{box-sizing:border-box;margin:0;padding:0}
                    @page{size:A4;margin:13mm}
                    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px;line-height:1.55}
                    .header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .h-left .empresa{font-size:18px;font-weight:900;letter-spacing:.3px}
                    .h-left .ruc-txt{font-size:10px;opacity:.75;margin-top:3px}
                    .h-left .logo-img{height:48px;width:auto;object-fit:contain}
                    .h-right{text-align:right}
                    .h-right .doc-tipo{font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}
                    .h-right .monto-grande{font-size:30px;font-weight:900;font-family:'Courier New',monospace;color:#86EFAC;margin-top:6px;letter-spacing:-1px}
                    .h-right .fecha-doc{font-size:10px;opacity:.72;margin-top:5px;font-style:italic}
                    .divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .body{padding:16px 26px 14px}
                    .sec-title{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${ACC};margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:10px}
                    .field label{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:2px}
                    .field .val{font-size:12px;font-weight:600;color:#0f172a}
                    .field .val.mono{font-family:'Courier New',monospace}
                    .importes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
                    .imp-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:11px 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .imp-card.total{background:linear-gradient(135deg,${DARK},${ACC});color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .imp-card .lb{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;color:#64748B}
                    .imp-card.total .lb{color:rgba(255,255,255,0.75)}
                    .imp-card .vl{font-size:15px;font-weight:900;font-family:'Courier New',monospace;color:#0f172a}
                    .imp-card.total .vl{color:#fff;font-size:18px}
                    .cat-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;background:#DBEAFE;color:#1E40AF;border:1px solid #BFDBFE;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .footer{border-top:3px solid ${DARK};padding:9px 26px;display:flex;justify-content:space-between;font-size:9px;color:#64748B;margin-top:12px;font-style:italic;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    .footer-brand{font-weight:900;color:${DARK};font-style:normal;font-size:10px}
                  </style></head><body>
                  <div class="header">
                    <div class="h-left">
                      <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
                      <div class="ruc-txt">RUC: ${EMISOR.ruc} · ${EMISOR.ciudad}</div>
                      <div class="ruc-txt" style="margin-top:2px">${EMISOR.actividad}</div>
                    </div>
                    <div class="h-right">
                      <div class="doc-tipo">Comprobante de Gasto</div>
                      <div class="monto-grande">${monedaSim} ${Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</div>
                      <div class="fecha-doc">${fechaFmt}<br/>Generado: ${new Date().toLocaleDateString("es-PE")}</div>
                    </div>
                  </div>
                  <div class="divider"></div>
                  <div class="body">
                    <div class="importes">
                      <div class="imp-card"><div class="lb">Subtotal / Base</div><div class="vl">${monedaSim} ${Number(g.subtotal||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</div></div>
                      <div class="imp-card"><div class="lb">IGV (18%)</div><div class="vl">${monedaSim} ${Number(g.igv||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</div></div>
                      <div class="imp-card total"><div class="lb">Total Pagado</div><div class="vl">${monedaSim} ${Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</div></div>
                    </div>
                    <div class="sec-title">Datos del Gasto</div>
                    <div class="grid2">
                      <div class="field"><label>Fecha de Emisión</label><div class="val">${fechaFmt}</div></div>
                      <div class="field"><label>Categoría</label><div class="val"><span class="cat-badge">${g.categoria||"Otro"}</span></div></div>
                      <div class="field" style="grid-column:1/-1"><label>Concepto / Descripción</label><div class="val">${g.concepto||g.descripcion||"—"}</div></div>
                      ${g.notas?`<div class="field" style="grid-column:1/-1"><label>Notas internas</label><div class="val" style="color:#64748B;font-style:italic">${g.notas}</div></div>`:""}
                    </div>
                    <div class="sec-title">Proveedor</div>
                    <div class="grid2" style="margin-bottom:16px">
                      <div class="field"><label>Razón Social / Empresa</label><div class="val">${g.proveedor||"—"}</div></div>
                      <div class="field"><label>RUC del Proveedor</label><div class="val mono">${g.ruc||"—"}</div></div>
                    </div>
                    ${fotoHtml}
                  </div>
                  <div class="footer">
                    <div><span class="footer-brand">8 MILLAS</span> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
                    <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
                  </div>
                  <script>
                    // Esperar a que la imagen cargue antes de imprimir
                    window.onload=function(){
                      var imgs=document.querySelectorAll("img");
                      var pending=imgs.length;
                      if(pending===0){setTimeout(function(){window.print();},350);return;}
                      imgs.forEach(function(img){
                        if(img.complete){pending--;if(pending===0)setTimeout(function(){window.print();},350);}
                        else{img.onload=img.onerror=function(){pending--;if(pending===0)setTimeout(function(){window.print();},350);};}
                      });
                    };
                  </script>
                  </body></html>`;
                  const w=window.open("","_blank","width=900,height=750");
                  if(w){w.document.write(html);w.document.close();}
                }} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.08))",border:"1px solid rgba(239,68,68,0.35)",borderRadius:12,color:"#DC2626",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 14px rgba(239,68,68,0.12)"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                  Exportar PDF con foto
                </button>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>eliminar(vistaDetalle.id)} style={{flex:1,padding:"12px",background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:12,color:"#DC2626",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    🗑 Eliminar
                  </button>
                  <button onClick={()=>abrirEditar(vistaDetalle)} style={{flex:1,padding:"12px",background:"#D1FAE5",border:"1px solid #A7F3D0",borderRadius:12,color:"#065F46",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    ✏️ Editar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════
        MODAL NUEVO / EDITAR — Flujo de captura + formulario
        ══════════════════════════════════════════════════════════ */}
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:450,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}
        onClick={e=>{if(e.target===e.currentTarget){setModal(null);onModalChange?.(false);}}}>
        <div style={{background:"#0B1324",border:"1px solid #1E3050",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:540,maxHeight:"93vh",overflowY:"auto",paddingBottom:36}}
          onClick={e=>e.stopPropagation()}>

          {/* Handle */}
          <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:6}}>
            <div style={{width:36,height:4,borderRadius:2,background:"#2D4060"}}/>
          </div>

          {/* Header del modal */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 22px 16px"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.white}}>
              {modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"}
            </div>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{width:30,height:30,borderRadius:"50%",background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <div style={{padding:"0 22px"}}>
            {/* Zona de captura OCR */}
            <div style={{marginBottom:18}}>
              {ocr.imgUrl?(
                <div style={{position:"relative",borderRadius:14,overflow:"hidden",border:"1px solid #1E3050",marginBottom:10}}>
                  <img src={ocr.previewUrl||ocr.imgUrl} alt="boleta" style={{width:"100%",maxHeight:200,objectFit:"contain",background:"#060E1A",display:"block"}}/>
                  {ocr.loading&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(6,14,26,0.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
                      <div style={{width:38,height:38,border:"3px solid #1E3050",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                      <div style={{fontSize:12,color:C.white,fontWeight:600,textAlign:"center",padding:"0 20px"}}>{ocr.fase}</div>
                      <div style={{width:160,height:3,background:"#1E3050",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${ocr.progress}%`,background:"linear-gradient(90deg,#2563EB,#38BDF8)",borderRadius:2,transition:"width .4s"}}/>
                      </div>
                    </div>
                  )}
                  {!ocr.loading&&ocr.text&&(
                    <div style={{position:"absolute",top:8,right:8,background:"#10B981",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,color:"#fff"}}>✓ Extraído</div>
                  )}
                </div>
              ):(
                <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #2D4060",borderRadius:16,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"#060E1A",marginBottom:10}}>
                  <div style={{fontSize:36,marginBottom:8}}>📷</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:4}}>Subir foto de la boleta</div>
                  <div style={{fontSize:11,color:C.muted}}>OCR con binarización adaptativa — extrae RUC, monto, fecha automáticamente</div>
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:"10px",background:"#1E3050",border:"1px solid #2D4060",borderRadius:10,color:C.white,fontWeight:600,fontSize:12,cursor:"pointer"}}>
                  {ocr.imgUrl?"🔄 Reescanear":"📷 Subir boleta"}
                </button>
              </div>
            </div>

            {/* Banner OCR OK */}
            {ocr.text&&!ocr.loading&&(
              <div style={{background:"#10B98112",border:"1px solid #10B98140",borderRadius:10,padding:"9px 13px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
                <span>✅</span>
                <span style={{fontSize:11,color:"#6EE7B7",fontWeight:600}}>Datos extraídos — revisa y corrige si es necesario</span>
              </div>
            )}

            {/* ── SECCIÓN: IMPORTES ── */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>Importes</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <GastosKInp label="Monto Total *" keyN="monto" type="number" form={form} setForm={setForm}/>
                <GastosKInp label="Moneda" keyN="moneda" type="select" opts={["PEN","USD","EUR"]} form={form} setForm={setForm}/>
                <GastosKInp label="IGV (18%)" keyN="igv" type="number" form={form} setForm={setForm}/>
                <GastosKInp label="Subtotal / Base" keyN="subtotal" type="number" form={form} setForm={setForm}/>
              </div>
            </div>

            {/* ── SECCIÓN: DATOS DEL GASTO ── */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>Datos del Gasto</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              {/* Campo fecha con estilo consistente en iOS */}
              <div style={{marginBottom:14}}>
                <label style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,display:"block",marginBottom:4}}>Fecha de Emisión *</label>
                <input type="date" value={form.fecha||""} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
                  style={{width:"100%",background:"#0A1020",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none",boxSizing:"border-box",WebkitAppearance:"none",colorScheme:"dark"}}/>
              </div>
              <GastosKInp label="Categoría *" keyN="categoria" type="select" opts={["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"]} form={form} setForm={setForm}/>
              <GastosKInp label="Concepto / Descripción" keyN="concepto" form={form} setForm={setForm}/>
              <GastosKInp label="Notas internas" keyN="notas" form={form} setForm={setForm}/>
            </div>

            {/* ── SECCIÓN: PROVEEDOR ── */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>Proveedor</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
              <GastosKInp label="Razón Social / Empresa" keyN="proveedor" form={form} setForm={setForm}/>
              <GastosKInp label="RUC (11 dígitos)" keyN="ruc" form={form} setForm={setForm}/>
            </div>

            {/* Botones guardar */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{padding:"13px 20px",background:"transparent",border:"1px solid #1E3050",borderRadius:12,color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{flex:1,padding:"13px",background:saving?"#1E3050":"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":"0 4px 14px rgba(37,99,235,0.4)"}}>
                {saving?"Guardando...":modal==="nuevo"?"Guardar Gasto ✓":"Actualizar Gasto ✓"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>);
}




// ── SVG Icons para sidebar (sin emojis) ──
// ══════════════════════════════════════════════════════════════════
// 📚 HISTÓRICO — Registro de paneles alquilados y contratos
// ══════════════════════════════════════════════════════════════════
function Historico({contratos,setContratos,paneles,clientes,onModalChange}){
  const [filtro,setFiltro]=useState("todos");
  const [modal,setModal]=useState(null); // null | contrato obj
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const hoyD=new Date();

  const generarMeses=(inicio,fin)=>{
    if(!inicio||!fin) return [];
    const meses=[];
    const ini=new Date(inicio+"T12:00:00");
    const fnl=new Date(fin+"T12:00:00");
    let cur=new Date(ini.getFullYear(),ini.getMonth(),1);
    while(cur<=fnl){
      const key=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      const label=cur.toLocaleDateString("es-PE",{month:"short",year:"numeric"});
      meses.push({key,label});
      cur.setMonth(cur.getMonth()+1);
    }
    return meses;
  };

  // Enriquecer contratos con datos de panel y cliente
  const todos=contratos
    .map(c=>({
      ...c,
      d:Math.ceil((new Date(c.fin)-hoyD)/86400000),
      panel:paneles.find(p=>p.id===c.panel_id),
      cliente:clientes.find(cl=>cl.id===c.cliente_id),
    }))
    .filter(c=>c.panel&&c.cliente)
    .sort((a,b)=>new Date(b.inicio||0)-new Date(a.inicio||0));

  const activos=todos.filter(c=>c.d>0);
  const historicos=todos.filter(c=>c.d<=0);
  const lista=filtro==="activos"?activos:filtro==="historicos"?historicos:todos;

  const openEdit=(c)=>{
    setForm({panel_id:c.panel_id,cliente_id:c.cliente_id,inicio:c.inicio||"",fin:c.fin||"",monto:c.monto||"",pagosMeses:c.pagosMeses||{}});
    setModal(c);
    setConfirmDelete(false);
    onModalChange?.(true);
  };
  const closeModal=()=>{ setModal(null); setConfirmDelete(false); onModalChange?.(false); };

  const mesesForm=generarMeses(form.inicio,form.fin);
  const pagosMarcados=Object.values(form.pagosMeses||{}).filter(Boolean).length;
  const toggleMesPago=(key)=>setForm(f=>({...f,pagosMeses:{...f.pagosMeses,[key]:!f.pagosMeses[key]}}));

  const guardar=async()=>{
    if(!form.panel_id) return alert("Selecciona un panel");
    if(!form.cliente_id) return alert("Selecciona un cliente");
    if(!form.inicio||!form.fin) return alert("Ingresa fechas");
    if(!form.monto||Number(form.monto)<=0) return alert("Ingresa un monto válido");
    setSaving(true);
    try{
      const meses=generarMeses(form.inicio,form.fin);
      const pm=form.pagosMeses||{};
      const pagado=pm[meses[0]?.key]||false;
      const payload={panel_id:form.panel_id,cliente_id:form.cliente_id,inicio:form.inicio,fin:form.fin,monto:Number(form.monto),pagado,pagosMeses:pm};
      const [r]=await fb.patch("contratos",modal.id,payload);
      if(r) setContratos(p=>p.map(x=>x.id===modal.id?{...x,...payload}:x));
      closeModal();
    }catch(e){ alert("Error al guardar: "+e.message); }
    setSaving(false);
  };

  const eliminar=async()=>{
    setSaving(true);
    try{
      await fb.del("contratos",modal.id);
      setContratos(p=>p.filter(x=>x.id!==modal.id));
      closeModal();
    }catch(e){ alert("Error al eliminar: "+e.message); }
    setSaving(false);
  };

  const inpStyle={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const selStyle={...inpStyle,cursor:"pointer"};
  const F=FieldGroup;

  return(<div>
    {/* ── MODAL EDITAR ── */}
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}
        onClick={e=>{if(e.target===e.currentTarget) closeModal();}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onMouseDown={e=>e.stopPropagation()}
          onTouchStart={e=>e.stopPropagation()}
          onTouchEnd={e=>e.stopPropagation()}
          onPointerDown={e=>e.stopPropagation()}
          onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>✏️ Editar Contrato</span>
            <button onClick={closeModal} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <F label="Panel *">
            <select value={form.panel_id} onChange={e=>setForm(f=>({...f,panel_id:e.target.value}))}
              onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
              style={selStyle}>
              <option value="">— Selecciona un panel —</option>
              {paneles.map(p=><option key={p.id} value={p.id}>{p.foto} {p.nombre} · {p.ciudad} · {p.estado}</option>)}
            </select>
          </F>

          <F label="Cliente *">
            <select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))}
              onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
              style={selStyle}>
              <option value="">— Selecciona un cliente —</option>
              {clientes.filter(c=>c.tipo==="Cliente").map(c=><option key={c.id} value={c.id}>{c.empresa} · {c.contacto}</option>)}
            </select>
          </F>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="Fecha inicio *">
              <input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value,pagosMeses:{}}))}
                onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                style={{...inpStyle,colorScheme:"light",cursor:"pointer",fontSize:16}}/>
            </F>
            <F label="Fecha fin *">
              <input type="date" value={form.fin} onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))}
                onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                style={{...inpStyle,colorScheme:"light",cursor:"pointer",fontSize:16}}/>
            </F>
          </div>

          <F label="Monto mensual (S/) *">
            <input type="text" inputMode="decimal" value={form.monto}
              onChange={e=>setForm(f=>({...f,monto:e.target.value.replace(/[^0-9.]/g,"")}))}
              onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
              placeholder="Ej: 1500" style={{...inpStyle,fontSize:16}}/>
          </F>

          {mesesForm.length>0&&(
            <F label={`Pagos por mes (${pagosMarcados}/${mesesForm.length} pagados)`}>
              <div style={{background:C.bg,borderRadius:12,padding:14,border:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {mesesForm.map((m,i)=>{
                    const pagado=form.pagosMeses[m.key]||false;
                    return(
                      <button key={m.key} onClick={()=>toggleMesPago(m.key)}
                        style={{padding:"10px 6px",borderRadius:10,border:`2px solid ${pagado?C.green:C.border}`,background:pagado?C.green+"22":C.surface,cursor:"pointer",transition:"all .15s",textAlign:"center"}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3,fontWeight:600}}>Mes {i+1}</div>
                        <div style={{fontSize:12,fontWeight:700,color:pagado?C.green:C.muted,marginBottom:4}}>{m.label}</div>
                        <div style={{fontSize:11,fontWeight:800,color:pagado?C.green:C.red,background:pagado?C.green+"18":C.red+"18",borderRadius:6,padding:"3px 6px"}}>
                          {pagado?"✓ Pagado":"○ Pendiente"}
                        </div>
                        {form.monto&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{fmt(form.monto)}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </F>
          )}

          {/* Botones principales */}
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={closeModal} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",opacity:saving?.6:1}}>
              {saving?"Guardando...":"Guardar Cambios"}
            </button>
          </div>

          {/* ── ZONA ELIMINAR — al final del modal ── */}
          <div style={{marginTop:24,paddingTop:18,borderTop:`1px dashed ${C.border}`}}>
            {!confirmDelete?(
              <button onClick={()=>setConfirmDelete(true)}
                style={{width:"100%",padding:"12px",borderRadius:12,border:`1px solid #FECACA`,background:"#FEF2F2",color:C.red,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                Eliminar contrato
              </button>
            ):(
              <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:16}}>
                <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:6,textAlign:"center"}}>⚠️ ¿Confirmar eliminación?</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:14,textAlign:"center"}}>Esta acción marcará el contrato como eliminado. Se puede recuperar desde Firebase.</div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                    Cancelar
                  </button>
                  <button onClick={eliminar} disabled={saving}
                    style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:C.red,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",opacity:saving?.6:1}}>
                    {saving?"Eliminando...":"Sí, eliminar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    <PgTit icon="📚" title="Histórico" sub={`${todos.length} registros · ${activos.length} activos · ${historicos.length} finalizados`}/>

    {/* ── KPIs estilo Facturación ── */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
      <KPIDark label="Total contratos" value={todos.length}      sub={`${todos.length} registro${todos.length!==1?"s":""}`} accent="#2563EB" icon={ICN.archive}/>
      <KPIDark label="Activos"         value={activos.length}    valueColor="#10B981" sub="En curso" accent="#10B981" icon={ICN.check}/>
      <KPIDark label="Finalizados"     value={historicos.length} valueColor="#FFFFFF" sub="Cerrados" accent="#2563EB" icon={ICN.archive}/>
    </div>

    {/* Filtros */}
    <div style={{display:"flex",gap:8,marginBottom:20,background:C.surface,borderRadius:12,padding:5,width:"fit-content"}}>
      {[
        {id:"todos",label:`Todos (${todos.length})`},
        {id:"activos",label:`Activos (${activos.length})`},
        {id:"historicos",label:`Finalizados (${historicos.length})`},
      ].map(f=>(
        <button key={f.id} onClick={()=>setFiltro(f.id)}
          style={{padding:"8px 14px",borderRadius:9,border:"none",
            background:filtro===f.id?"linear-gradient(135deg,rgba(79,124,255,0.3),rgba(155,111,255,0.2))":"transparent",
            color:filtro===f.id?C.white:C.muted,
            fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s",
          }}>
          {f.label}
        </button>
      ))}
    </div>

    {lista.length===0?(
      <Card style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:10}}>📋</div>
        <div style={{color:C.muted,fontSize:14}}>No hay registros en esta categoría</div>
      </Card>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {lista.map(c=>{
          const activo=c.d>0;
          const statusColor=activo?(c.d<=30?C.amber:C.green):C.muted;
          const statusLabel=activo?(c.d<=30?`Vence en ${c.d}d`:"Activo"):"Finalizado";
          return(
            <Card key={c.id} style={{padding:0,overflow:"hidden"}}>
              <div style={{height:3,background:activo?(c.d<=30?C.amber:C.green):C.muted}}/>
              <div style={{padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:18}}>{c.panel.foto||"📡"}</span>
                      <span style={{fontSize:14,fontWeight:800,color:C.white}}>{c.panel.nombre}</span>
                      <Badge color={statusColor} ch={statusLabel}/>
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{c.cliente.empresa} · {c.panel.ciudad}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:16,fontWeight:900,color:C.green}}>{fmt(c.monto)}/mes</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>{c.pagado?"✅ Pagado":"⏳ Pendiente"}</div>
                    </div>
                    {/* Botón Editar */}
                    <button onClick={()=>openEdit(c)}
                      style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,color:C.white,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      Editar
                    </button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <div style={{background:C.surface,borderRadius:8,padding:"7px 10px"}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>Inicio</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{fmtF(c.inicio)}</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:8,padding:"7px 10px"}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>Fin</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{fmtF(c.fin)}</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    )}
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// 🧾 FACTURACIÓN — Vista360
// Gestión completa de facturas, boletas y cobros
// ══════════════════════════════════════════════════════════════════

// Utilidades de facturación
// ── IGV Amazonía — Ley N° 27037, Art. 13.1 ──────────────────────
// Distritos de Huánuco reconocidos como zona amazónica (exonerados de IGV
// para servicios prestados localmente). Fuente: Ley 27037 + mod. Ley 2024
const DISTRITOS_AMAZONIA_HCO = [
  "huanuco","amarilis","pillco marca","pillcomarca",
  "churubamba","santa maria del valle",
  "chinchao","conchamarca","tomayquichua","ambo",
];
const normStr = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
const isExoneradoIGV = (ciudad = "") => {
  const c = normStr(ciudad);
  return DISTRITOS_AMAZONIA_HCO.some(d => c.includes(d));
};
const IGV_RATE = 0.18;
// rate = 0.18 (normal) | 0 (exonerado Ley Amazonía)
const calcIGV = (total, rate = IGV_RATE) => {
  if (rate === 0) return { subtotal: Number(total), igv: 0, total: Number(total), exonerado: true };
  const sub = Math.round((total / (1 + rate)) * 100) / 100;
  const igv = Math.round((total - sub) * 100) / 100;
  return { subtotal: sub, igv, total, exonerado: false };
};
const numSerie = (n) => String(n).padStart(8, "0");
const fmtMes = (s) => s ? new Date(s + "-02").toLocaleDateString("es-PE", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase()) : "—";
const EST_FAC = ["Emitida", "Aceptada", "Cobrada", "Pagada", "Pendiente", "Vencida", "Rechazada", "Anulada", "Borrador"];
const EST_FAC_COL = {
  Emitida:   "#4F7CFF",  // azul — emitida y enviada al sistema externo
  Aceptada:  "#4F7CFF",  // azul — aceptada por SUNAT
  Cobrada:   "#0FBA7D",  // verde — pagada / cobrada
  Pagada:    "#0FBA7D",  // alias de Cobrada
  Pendiente: "#F59E0B",  // ámbar — pendiente de cobro
  Vencida:   "#F04747",  // rojo — pasó fecha de vencimiento sin cobrar
  Rechazada: "#F04747",  // rojo — rechazada por SUNAT
  Anulada:   "#9B6FFF",  // morado — anulada
  Borrador:  "#4E6080",  // gris — borrador (legacy)
};

// ══════════════════════════════════════════════════════════════════
// 🔌 INTEGRACIÓN CON SISTEMA DE FACTURACIÓN EXTERNO  (SOLO LECTURA)
// ──────────────────────────────────────────────────────────────────
// La app Vista360 NO emite ni envía facturas. Solo MUESTRA los
// comprobantes que tu sistema de facturación externo ya emitió
// (Nubefact, Facturador SUNAT, propio, etc.) y permite ver/descargar
// el PDF generado por ese sistema.
//
// Cuando tu sistema esté listo, completa este bloque:
//
//   FACTURACION_API.enabled  = true
//   FACTURACION_API.endpoint = "https://api.tusistema.com/comprobantes"
//   FACTURACION_API.token    = "TU_API_KEY"
//
// Mientras tanto, los comprobantes se leen de Firebase ("facturas")
// para que puedas probar la UI con datos de ejemplo.
// ──────────────────────────────────────────────────────────────────
//
// 📋 ESTRUCTURA ESPERADA POR LA APP (cada comprobante)
// El sistema externo debe devolver un array de objetos con esta forma:
//
//   {
//     // Identificación
//     id:                "FAC-2026-001",       // ID único en el sistema externo
//     tipo:              "FACTURA"|"BOLETA"|"NOTA_CREDITO"|"NOTA_DEBITO",
//     serie:             "F001",
//     numero:            "00012345",            // ya formateado
//
//     // Cliente
//     cliente_doc_tipo:  "RUC"|"DNI",
//     cliente_doc:       "20XXXXXXXXX",
//     cliente_nombre:    "Empresa S.A.C.",
//     cliente_email:     "...",                 // opcional
//     cliente_id:        "abc123",              // opcional, link a tu CRM
//
//     // Vínculo opcional con tu sistema (panel/contrato)
//     panel_id:          "panel_xyz",
//     contrato_id:       "ctr_abc",
//
//     // Concepto y período
//     concepto:          "Arrendamiento Panel Publicitario",
//     periodo_inicio:    "2026-01-01",
//     periodo_fin:       "2026-01-31",
//
//     // Montos
//     subtotal:          550.85,
//     igv:               99.15,
//     total:             650.00,
//     moneda:            "PEN",                 // o "USD"
//
//     // Fechas
//     fecha_emision:     "2026-01-15",
//     fecha_vencimiento: "2026-02-15",
//     fecha_pago:        null,                  // ISO si está pagada
//
//     // Estado
//     estado:            "Aceptada"|"Cobrada"|"Pendiente"|"Vencida"|"Rechazada"|"Anulada",
//
//     // Archivos generados por el sistema externo
//     pdf_url:           "https://.../factura.pdf",  // ⭐ MÁS IMPORTANTE
//     xml_url:           "https://.../factura.xml",  // opcional
//     cdr_url:           "https://.../cdr.zip",      // opcional (CDR SUNAT)
//
//     // SUNAT (opcionales)
//     hash:              "abc123def...",
//     sunat_estado:      "ACEPTADO",
//
//     // Pago (cuando se cobre, lo gestiona tu sistema externo)
//     metodo_pago:       "Transferencia"|"Efectivo"|"Yape"|...,
//     nro_operacion:     "OP-12345",
//   }
// ══════════════════════════════════════════════════════════════════
const FACTURACION_API = {
  enabled:   false,                                  // ← cambia a true cuando tu sistema esté listo
  endpoint:  "",                                      // ← URL GET que devuelve array de comprobantes
  token:     "",                                      // ← Bearer token / API key
  rucEmisor: EMISOR.ruc,                              // RUC del emisor (8 Millas)
};

async function fetchFacturas() {
  // Modo conectado: lee del sistema externo
  if (FACTURACION_API.enabled && FACTURACION_API.endpoint) {
    try {
      const resp = await fetch(FACTURACION_API.endpoint, {
        headers: {
          "Authorization": `Bearer ${FACTURACION_API.token}`,
          "Accept":        "application/json",
        },
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      // Acepta array directo o { data: [...] } / { comprobantes: [...] }
      return Array.isArray(data) ? data : (data.data || data.comprobantes || []);
    } catch (e) {
      console.error("[Facturación] Error API:", e);
      return [];
    }
  }
  // Modo demo: lee de Firebase ("facturas") en solo lectura
  return fb.get("facturas");
}

// ── Modal: Ver detalle de comprobante (SOLO LECTURA) ─────────────
// Muestra los datos del comprobante emitido por el sistema externo
// y permite abrir el PDF/XML que ese sistema generó.
// NO edita, NO crea, NO envía emails, NO registra pagos.
// ──────────────────────────────────────────────────────────────────
function ModalDetalleFactura({ factura, paneles, clientes, onClose }) {
  // Cliente: prefiere campos directos del API, cae a lookup en CRM por ID
  const cli = factura.cliente_nombre
    ? { empresa: factura.cliente_nombre, ruc: factura.cliente_doc, email: factura.cliente_email }
    : clientes.find(c => c.id === factura.cliente_id);
  const pan = paneles.find(p => p.id === factura.panel_id);

  // Montos: prefiere campos del API, cae a "monto" legacy
  const subtotal = factura.subtotal != null ? Number(factura.subtotal) : null;
  const igv      = factura.igv      != null ? Number(factura.igv)      : null;
  const total    = factura.total    != null ? Number(factura.total)    : Number(factura.monto || 0);
  const monedaSimbolo = factura.moneda === "USD" ? "US$" : "S/";

  const estadoColor = EST_FAC_COL[factura.estado] || C.muted;
  const numeroFmt   = factura.numero?.toString().padStart(8, "0") || factura.numero;

  const isCobrada = factura.estado === "Cobrada" || factura.estado === "Pagada";

  // Estado para el visor PDF inline
  const [mostrarPDF, setMostrarPDF] = useState(false);
  const [pdfCargando, setPdfCargando] = useState(false);

  const tipoLabel = {
    FACTURA:      "🧾 Factura electrónica",
    BOLETA:       "📄 Boleta de venta",
    NOTA_CREDITO: "↩️ Nota de crédito",
    NOTA_DEBITO:  "➕ Nota de débito",
  }[factura.tipo] || factura.tipo || "Comprobante";

  const nombreArchivo = `${factura.serie || "FAC"}-${numeroFmt || factura.numero || "00000001"}.pdf`;

  const verXML = () => {
    if (!factura.xml_url) return;
    window.open(factura.xml_url, "_blank", "noopener,noreferrer");
  };

  // Descarga directa del PDF
  const descargarPDF = async () => {
    if (!factura.pdf_url) {
      alert("Este comprobante aún no tiene PDF disponible.");
      return;
    }
    try {
      const resp = await fetch(factura.pdf_url);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Si el fetch falla por CORS, abrir en nueva pestaña como fallback
      window.open(factura.pdf_url, "_blank", "noopener,noreferrer");
    }
  };

  const toggleVisorPDF = () => {
    if (!factura.pdf_url) {
      alert("Este comprobante aún no tiene PDF disponible.");
      return;
    }
    if (!mostrarPDF) setPdfCargando(true);
    setMostrarPDF(v => !v);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)", zIndex: 300,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "22px 22px 0 0", padding: "10px 20px 24px", width: "100%",
        maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.7)",
      }}>
        {/* Drag handle iOS */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>
        {/* Header con tipo + serie/número + estado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
              {tipoLabel}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.white, fontFamily: "monospace", letterSpacing: "-0.5px" }}>
              {factura.serie}-{numeroFmt}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ background: estadoColor + "22", color: estadoColor, border: `1px solid ${estadoColor}55`, borderRadius: 8, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>
                {factura.estado}
              </span>
              {factura.sunat_estado && (
                <span style={{ background: C.cyan + "18", color: C.cyan, border: `1px solid ${C.cyan}44`, borderRadius: 8, padding: "3px 11px", fontSize: 11, fontWeight: 700 }}>
                  SUNAT: {factura.sunat_estado}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.border, border: "none", borderRadius: 8, padding: "5px 11px", color: C.muted, cursor: "pointer", fontSize: 15, flexShrink: 0 }}>✕</button>
        </div>

        {/* CLIENTE */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Cliente
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 3 }}>
            {cli?.empresa || factura.cliente_nombre || "—"}
          </div>
          {(cli?.ruc || factura.cliente_doc) && (
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
              {factura.cliente_doc_tipo || ((cli?.ruc || factura.cliente_doc)?.length === 11 ? "RUC" : "DNI")}: {cli?.ruc || factura.cliente_doc}
            </div>
          )}
          {(cli?.email || factura.cliente_email) && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              ✉️ {cli?.email || factura.cliente_email}
            </div>
          )}
        </div>

        {/* PANEL / CONCEPTO */}
        {(pan || factura.concepto) && (
          <div style={{ background: C.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Concepto
            </div>
            <div style={{ fontSize: 13, color: C.white, marginBottom: 3 }}>
              {factura.concepto || "Arrendamiento de Panel Publicitario"}
            </div>
            {pan && (
              <div style={{ fontSize: 12, color: C.muted }}>
                Panel: <strong style={{color:C.text}}>{pan.nombre}</strong>{pan.ciudad ? ` · ${pan.ciudad}` : ""}
              </div>
            )}
            {(factura.periodo_inicio || factura.periodo_fin) && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                Período: {fmtF(factura.periodo_inicio)} → {fmtF(factura.periodo_fin)}
              </div>
            )}
          </div>
        )}

        {/* MONTOS */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: `1px solid ${C.border}` }}>
          {subtotal != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 5 }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: "monospace", color: C.text }}>{monedaSimbolo} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {igv != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8 }}>
              <span>IGV {igv === 0 ? "(Exonerado)" : "18%"}</span>
              <span style={{ fontFamily: "monospace", color: igv === 0 ? C.green : C.text }}>{monedaSimbolo} {igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 17, fontWeight: 800, color: C.green,
            borderTop: subtotal != null ? `1px solid ${C.border}` : "none",
            paddingTop: subtotal != null ? 8 : 0,
          }}>
            <span>TOTAL</span>
            <span style={{ fontFamily: "monospace" }}>{monedaSimbolo} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* FECHAS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ background: C.surface, borderRadius: 12, padding: "10px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Emisión</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmtF(factura.fecha_emision)}</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 12, padding: "10px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Vencimiento</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmtF(factura.fecha_vencimiento)}</div>
          </div>
        </div>

        {/* PAGO (si está cobrada y vino info de pago del API) */}
        {isCobrada && (factura.metodo_pago || factura.fecha_pago || factura.nro_operacion) && (
          <div style={{ background: C.green + "10", borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.green}33` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              ✅ Pago registrado
            </div>
            {factura.metodo_pago && (
              <div style={{ fontSize: 12, color: C.text, marginBottom: 2 }}>
                Método: <strong>{factura.metodo_pago}</strong>
              </div>
            )}
            {factura.nro_operacion && (
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
                Op. N° {factura.nro_operacion}
              </div>
            )}
            {factura.fecha_pago && (
              <div style={{ fontSize: 12, color: C.muted }}>
                Fecha: {fmtF(factura.fecha_pago)}
              </div>
            )}
          </div>
        )}

        {/* HASH SUNAT (si vino del API) */}
        {factura.hash && (
          <div style={{ background: C.surface, borderRadius: 12, padding: "10px 14px", marginBottom: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Hash SUNAT
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4 }}>
              {factura.hash}
            </div>
          </div>
        )}

        {/* ── VISOR PDF INLINE ── */}
        {factura.pdf_url && mostrarPDF && (
          <div style={{
            marginBottom: 12,
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${C.accent}44`,
            background: "#0D1421",
            position: "relative",
          }}>
            {/* Barra superior del visor */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              background: "rgba(37,99,235,0.12)",
              borderBottom: `1px solid ${C.accent}33`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>📄</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: "monospace" }}>
                  {nombreArchivo}
                </span>
              </div>
              <button
                onClick={() => setMostrarPDF(false)}
                style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Spinner mientras carga el iframe */}
            {pdfCargando && (
              <div style={{
                position: "absolute", inset: "48px 0 0 0",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#0D1421", zIndex: 2,
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.muted }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin .7s linear infinite" }}/>
                  <span style={{ fontSize: 12 }}>Cargando PDF...</span>
                </div>
              </div>
            )}

            {/* iFrame del PDF */}
            <iframe
              src={factura.pdf_url}
              title={nombreArchivo}
              onLoad={() => setPdfCargando(false)}
              style={{
                width: "100%",
                height: 480,
                border: "none",
                display: "block",
                background: "#fff",
              }}
            />
          </div>
        )}

        {/* BOTONES PDF */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>

          {/* Botón Ver PDF (abre visor inline) */}
          <button
            onClick={toggleVisorPDF}
            disabled={!factura.pdf_url}
            style={{
              width: "100%", padding: 13,
              background: factura.pdf_url
                ? mostrarPDF
                  ? `linear-gradient(135deg,#7B5FFF,${C.accent})`
                  : `linear-gradient(135deg,${C.accent},#7B5FFF)`
                : C.border,
              border: "none", borderRadius: 11,
              color: C.white, fontWeight: 700, fontSize: 14,
              cursor: factura.pdf_url ? "pointer" : "not-allowed",
              opacity: factura.pdf_url ? 1 : 0.5,
              boxShadow: factura.pdf_url ? `0 4px 16px ${C.accent}44` : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
          >
            {factura.pdf_url
              ? (mostrarPDF ? "🔼 Ocultar PDF" : "👁️ Ver PDF")
              : "PDF no disponible"}
          </button>

          {/* Botón Descargar PDF */}
          {factura.pdf_url && (
            <button
              onClick={descargarPDF}
              style={{
                width: "100%", padding: 11,
                background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
                border: "none", borderRadius: 11,
                color: "#FFFFFF", fontWeight: 700, fontSize: 13,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                transition: "all 0.15s",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              Descargar PDF
            </button>
          )}

          {factura.xml_url && (
            <button
              onClick={verXML}
              style={{
                width: "100%", padding: 11,
                background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 11,
                color: C.muted, fontWeight: 600, fontSize: 13,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              📑 Descargar XML firmado
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: "100%", padding: 11,
              background: "transparent",
              border: `1px solid ${C.border}`, borderRadius: 11,
              color: C.muted, fontWeight: 600, fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Nota informativa */}
        <div style={{ marginTop: 14, padding: "8px 12px", background: C.accent + "08", borderRadius: 8, border: `1px solid ${C.accent}22` }}>
          <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
            🔒 Comprobante emitido por tu sistema de facturación externo. La app solo muestra los datos en modo lectura.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 🧾 FACTURACIÓN — VISOR DE SOLO LECTURA
// ──────────────────────────────────────────────────────────────────
// Esta vista NO crea ni edita comprobantes. Solo MUESTRA los que tu
// sistema de facturación externo ya emitió. Lee desde:
//   • API externa (cuando FACTURACION_API.enabled = true)
//   • Firebase "facturas" como fallback de prueba
// ──────────────────────────────────────────────────────────────────
function Facturacion({ paneles, clientes, contratos }) {
  // contratos se recibe pero no se usa (compat con la firma anterior)
  const [facturas, setFacturas]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroEstado, setFiltroEstado]   = useState("Todos");
  const [filtroMes, setFiltroMes]         = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [busqueda, setBusqueda]         = useState("");
  const [vista, setVista]               = useState("lista");

  const conectado = FACTURACION_API.enabled && FACTURACION_API.endpoint;

  // ── Cargar comprobantes desde fuente activa ──
  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchFacturas();
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error al cargar comprobantes");
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Helpers para acceder a campos con fallback (formato API o legacy)
  const totalDe = (f) => Number(f.total ?? f.monto ?? 0);
  const clienteNombreDe = (f) => {
    if (f.cliente_nombre) return f.cliente_nombre;
    const c = clientes.find(cl => cl.id === f.cliente_id);
    return c?.empresa || "—";
  };

  // Meses disponibles
  const meses = useMemo(() => {
    const s = new Set(facturas.map(f => f.fecha_emision?.slice(0, 7)).filter(Boolean));
    return ["Todos", ...Array.from(s).sort().reverse()];
  }, [facturas]);

  // Filtrado
  const facsFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (filtroEstado !== "Todos" && f.estado !== filtroEstado) return false;
      if (filtroMes !== "Todos" && f.fecha_emision?.slice(0, 7) !== filtroMes) return false;
      if (filtroCliente !== "Todos" && f.cliente_id !== filtroCliente) return false;
      if (busqueda) {
        const cli = clienteNombreDe(f);
        const pan = paneles.find(p => p.id === f.panel_id);
        const q   = busqueda.toLowerCase();
        const txt = `${f.serie}-${f.numero} ${cli} ${pan?.nombre || ""} ${f.concepto || ""} ${f.cliente_doc || ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas, filtroEstado, filtroMes, filtroCliente, busqueda, clientes, paneles]);

  // KPIs
  const kpis = useMemo(() => {
    const all = facturas.filter(f => f.estado !== "Anulada" && f.estado !== "Rechazada");
    const total = all.reduce((a, f) => a + totalDe(f), 0);
    const cobradas = all.filter(f => f.estado === "Cobrada" || f.estado === "Pagada").reduce((a, f) => a + totalDe(f), 0);
    const pendientes = all.filter(f => ["Emitida","Aceptada","Pendiente"].includes(f.estado)).reduce((a, f) => a + totalDe(f), 0);
    const vencidas = all.filter(f => f.estado === "Vencida").reduce((a, f) => a + totalDe(f), 0);
    return { total, cobradas, pendientes, vencidas, count: all.length };
  }, [facturas]);

  const numeroFmt = (n) => String(n).padStart(8, "0");

  // ── DECORACIONES (líneas onduladas en cards oscuras) ──
  const WaveDeco = ({ color = "#2563EB" }) => (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 80, pointerEvents: "none", opacity: 0.35 }}>
      <defs>
        <linearGradient id={`wv-${color.replace("#","")}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0"/>
          <stop offset="0.5" stopColor={color} stopOpacity="0.55"/>
          <stop offset="1" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#wv-${color.replace("#","")})`} strokeWidth="1.2" fill="none"/>
      <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#wv-${color.replace("#","")})`} strokeWidth="0.8" fill="none" opacity="0.7"/>
      <path d="M0 100 Q140 60 280 90 T400 80" stroke={`url(#wv-${color.replace("#","")})`} strokeWidth="0.6" fill="none" opacity="0.5"/>
    </svg>
  );

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 10px rgba(15,23,41,0.04)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="3" width="14" height="18" rx="1.5" fill="#FFFFFF" stroke="#0F1729" strokeWidth="1.4"/>
            <line x1="8" y1="6.5" x2="16" y2="6.5" stroke="#0F1729" strokeWidth="0.8"/>
            <line x1="8" y1="9" x2="16" y2="9" stroke="#0F1729" strokeWidth="0.8"/>
            <line x1="8" y1="11.5" x2="16" y2="11.5" stroke="#0F1729" strokeWidth="0.8"/>
            <line x1="8" y1="14" x2="13" y2="14" stroke="#0F1729" strokeWidth="0.8"/>
            <text x="6.5" y="5.2" fontSize="2" fontWeight="900" fill="#0F1729" fontFamily="sans-serif">FACTURA</text>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#0F1729", letterSpacing: "-0.7px", lineHeight: 1.1, marginBottom: 4 }}>Facturación</div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
            {loading ? "Cargando..." : `${facturas.length} comprobante${facturas.length !== 1 ? "s" : ""} registrado${facturas.length !== 1 ? "s" : ""} · 0 contratos pendientes de facturar`}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: C.red + "12", border: `1px solid ${C.red}44`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.red }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── KPIs (4 cards oscuras estilo dashboard) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL FACTURADO", val: fmt(kpis.total),      valueColor: "#FFFFFF", labelColor: "#5B7FCC", sub: `${kpis.count} comprobante${kpis.count !== 1 ? "s" : ""}`, accent: "#2563EB",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#FFFFFF" strokeWidth="1.6"/><line x1="3" y1="10" x2="21" y2="10" stroke="#FFFFFF" strokeWidth="1.6"/><line x1="6.5" y1="14.5" x2="9.5" y2="14.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>
          },
          { label: "COBRADO", val: fmt(kpis.cobradas), valueColor: "#10B981", labelColor: "#5B7FCC", sub: `${facturas.filter(f => f.estado === "Cobrada" || f.estado === "Pagada").length} cobrada${facturas.filter(f => f.estado === "Cobrada" || f.estado === "Pagada").length !== 1 ? "s" : ""}`, accent: "#10B981",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#10B981" strokeWidth="1.6"/><polyline points="8 12 11 15 16 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          },
          { label: "PENDIENTE COBRO", val: fmt(kpis.pendientes), valueColor: "#FFFFFF", labelColor: "#5B7FCC", sub: `${facturas.filter(f => ["Emitida","Aceptada","Pendiente"].includes(f.estado)).length} emitida${facturas.filter(f => ["Emitida","Aceptada","Pendiente"].includes(f.estado)).length !== 1 ? "s" : ""}`, accent: "#F59E0B",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 2H18M6 22H18M6 2V8C6 10 9 12 12 12C15 12 18 10 18 8V2M6 22V16C6 14 9 12 12 12C15 12 18 14 18 16V22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          },
          { label: "VENCIDAS", val: fmt(kpis.vencidas), valueColor: "#FFFFFF", labelColor: "#5B7FCC", sub: `${facturas.filter(f => f.estado === "Vencida").length} sin cobrar`, accent: "#EF4444",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 4C9 4 7 6 7 9V13L5 16H19L17 13V9C17 6 15 4 12 4Z" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="9" r="0.8" fill="#FFFFFF"/><line x1="12" y1="11" x2="12" y2="13" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 19C10 20 11 21 12 21C13 21 14 20 14 19" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>
          },
        ].map((k, i) => (
          <div key={i} style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
            border: "1px solid rgba(79,124,255,0.18)",
            borderRadius: 18, padding: "16px 16px 18px",
            boxShadow: "0 8px 24px rgba(8,12,28,0.45),inset 0 1px 0 rgba(255,255,255,0.04)",
            minHeight: 138,
          }}>
            <WaveDeco color={k.accent}/>
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: k.labelColor, letterSpacing: 1.4, flex: 1, lineHeight: 1.3 }}>{k.label}</div>
                <div style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${k.accent === "#10B981" ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.18)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {k.icon}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.valueColor, letterSpacing: "-0.8px", lineHeight: 1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>{k.val}</div>
              <div style={{ fontSize: 10.5, color: "rgba(160,180,220,0.65)", fontWeight: 500 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Botón Nueva Factura + Buscador ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button onClick={() => alert("Nueva factura: conecta tu sistema externo o usa el botón emitir desde un contrato.")}
          style={{
            background: "#2563EB", border: "none", borderRadius: 12,
            padding: "12px 18px", color: "#FFFFFF", fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 14px rgba(37,99,235,0.32)",
          }}>
          + Nueva Factura
        </button>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2"/>
            <line x1="21" y1="21" x2="16" y2="16" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, panel, serie..."
            style={{ width: "100%", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px 12px 38px", color: "#0F1729", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* ── Filtros (3 dropdowns + 2 botones de vista) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            { value: filtroEstado, onChange: setFiltroEstado, label: "Todos los estados", options: ["Todos", ...EST_FAC] },
            { value: filtroMes, onChange: setFiltroMes, label: "Todos los meses", options: meses, fmt: m => m === "Todos" ? "Todos los meses" : fmtMes(m) },
            { value: filtroCliente, onChange: setFiltroCliente, label: "Todos los clientes", options: ["Todos", ...clientes.map(c => c.id)], fmt: id => id === "Todos" ? "Todos los clientes" : (clientes.find(c => c.id === id)?.empresa || "—") },
          ].map((f, i) => (
            <div key={i} style={{ position: "relative", flexShrink: 0 }}>
              <select value={f.value} onChange={e => f.onChange(e.target.value)}
                style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 32px 10px 14px", color: "#0F1729", fontSize: 12, fontWeight: 600, outline: "none", fontFamily: "inherit", appearance: "none", cursor: "pointer", boxShadow: "0 1px 3px rgba(15,23,41,0.04)" }}>
                {f.options.map(opt => <option key={opt} value={opt}>{f.fmt ? f.fmt(opt) : (opt === "Todos" ? f.label : opt)}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <polyline points="6 9 12 15 18 9" stroke="#0F1729" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setVista("lista")} style={{ width: 42, height: 40, borderRadius: 10, border: vista === "lista" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB", background: vista === "lista" ? "rgba(37,99,235,0.08)" : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="8" y1="6" x2="20" y2="6" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="12" x2="20" y2="12" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="18" x2="20" y2="18" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <circle cx="4" cy="6" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
              <circle cx="4" cy="12" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
              <circle cx="4" cy="18" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
            </svg>
          </button>
          <button onClick={() => setVista("resumen")} style={{ width: 42, height: 40, borderRadius: 10, border: vista === "resumen" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB", background: vista === "resumen" ? "rgba(37,99,235,0.08)" : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="13" width="3" height="8" fill={vista === "resumen" ? "#2563EB" : "#0F1729"}/>
              <rect x="10.5" y="9" width="3" height="12" fill={vista === "resumen" ? "#2563EB" : "#0F1729"}/>
              <rect x="17" y="5" width="3" height="16" fill={vista === "resumen" ? "#2563EB" : "#0F1729"}/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── VISTA RESUMEN ── */}
      {vista === "resumen" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <Card>
            <SecTit ch="Pipeline de Cobros" />
            {(() => {
              const estadosVis = EST_FAC.filter(e => !["Anulada","Rechazada","Borrador"].includes(e));
              const totales = estadosVis.map(e => facturas.filter(f => f.estado === e).reduce((a, f) => a + totalDe(f), 0));
              const maxT = Math.max(...totales, 1);
              return estadosVis.map((est, i) => {
                const facs = facturas.filter(f => f.estado === est);
                if (facs.length === 0) return null;
                const total = totales[i];
                const col = EST_FAC_COL[est] || C.muted;
                return (
                  <div key={est} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{est}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{facs.length} comprobantes</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: "monospace" }}>{fmt(total)}</span>
                    </div>
                    <div style={{ background: C.border, borderRadius: 6, height: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(total / maxT) * 100}%`, background: col, borderRadius: 6, transition: "width .6s" }} />
                    </div>
                  </div>
                );
              });
            })()}
          </Card>

          <Card>
            <SecTit ch="Top Clientes" />
            {(() => {
              const map = new Map();
              facturas
                .filter(f => f.estado !== "Anulada" && f.estado !== "Rechazada")
                .forEach(f => {
                  const key = f.cliente_id || f.cliente_nombre || "—";
                  const nombre = clienteNombreDe(f);
                  if (!map.has(key)) map.set(key, { nombre, total: 0, cobrado: 0, count: 0 });
                  const e = map.get(key);
                  e.total += totalDe(f);
                  if (f.estado === "Cobrada" || f.estado === "Pagada") e.cobrado += totalDe(f);
                  e.count++;
                });
              const top = Array.from(map.values()).sort((a, b) => b.total - a.total);
              if (top.length === 0) return <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "12px 0" }}>Sin datos para mostrar</div>;
              return top.map((c, i) => {
                const pct = c.total > 0 ? Math.round((c.cobrado / c.total) * 100) : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < top.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ background: C.border, borderRadius: 4, height: 4, flex: 1, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: C.green, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{pct}% cobrado</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{fmt(c.total)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{c.count} comp.</div>
                    </div>
                  </div>
                );
              });
            })()}
          </Card>
        </div>
      )}

      {/* ── LISTA ── */}
      {vista === "lista" && (
        <>
          {loading ? <Spinner /> : facsFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>
                {facturas.length === 0 ? "No hay comprobantes aún" : "Sin resultados"}
              </div>
              <div style={{ fontSize: 13 }}>
                {facturas.length === 0
                  ? (conectado ? "Tu sistema externo aún no ha emitido comprobantes" : "Aún no hay datos de prueba en Firebase")
                  : "Prueba ajustando los filtros"
                }
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {facsFiltradas.map(f => {
                const cli = clienteNombreDe(f);
                const pan = paneles.find(p => p.id === f.panel_id);
                const estadoCol = EST_FAC_COL[f.estado] || C.muted;
                const isVencida = f.estado === "Vencida";
                const isCobrada = f.estado === "Cobrada" || f.estado === "Pagada";
                const isBorrador = f.estado === "Borrador";
                const isEmitible = isBorrador;
                const isCobrable = ["Emitida","Aceptada","Pendiente"].includes(f.estado);
                const total = totalDe(f);
                const fechaCorta = f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString("es-PE", { day: "numeric", month: "numeric", year: "numeric" }) : "";
                return (
                  <div key={f.id}
                    style={{
                      position: "relative", overflow: "hidden",
                      background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                      border: `1px solid ${isVencida ? "rgba(239,68,68,0.35)" : "rgba(79,124,255,0.14)"}`,
                      borderRadius: 18, padding: "14px 16px",
                      boxShadow: "0 6px 20px rgba(8,12,28,0.4),inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}>
                    <WaveDeco color={isVencida ? "#EF4444" : isCobrada ? "#10B981" : "#2563EB"}/>
                    <div style={{ position: "relative", zIndex: 2 }}>
                      {/* Top row: icon + serie/chip + total */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        <div onClick={() => setModalDetalle(f)} style={{ flexShrink: 0, width: 44, height: 52, borderRadius: 8, background: "#FFFFFF", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                          <svg width="26" height="32" viewBox="0 0 24 28" fill="none">
                            <rect x="3" y="2" width="18" height="24" rx="1" fill="#FFFFFF" stroke="#0F1729" strokeWidth="1.2"/>
                            <text x="5" y="5.5" fontSize="2.2" fontWeight="900" fill="#0F1729" fontFamily="sans-serif">FACTURA</text>
                            <line x1="5" y1="10" x2="19" y2="10" stroke="#94A3B8" strokeWidth="0.7"/>
                            <line x1="5" y1="13" x2="19" y2="13" stroke="#94A3B8" strokeWidth="0.7"/>
                            <line x1="5" y1="16" x2="19" y2="16" stroke="#94A3B8" strokeWidth="0.7"/>
                            <line x1="5" y1="19" x2="14" y2="19" stroke="#94A3B8" strokeWidth="0.7"/>
                            <line x1="5" y1="22" x2="19" y2="22" stroke="#0F1729" strokeWidth="0.9"/>
                          </svg>
                        </div>
                        <div onClick={() => setModalDetalle(f)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.2px" }}>
                              {f.serie}-{numeroFmt(f.numero)}
                            </span>
                            <span style={{ background: estadoCol + "26", color: estadoCol, border: `1px solid ${estadoCol}55`, borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>{f.estado}</span>
                            <span style={{ fontSize: 10.5, color: "#5B7FCC", fontWeight: 700, letterSpacing: 0.6 }}>{f.tipo || "FACTURA"}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{cli}</div>
                          <div style={{ fontSize: 11, color: "rgba(160,180,220,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {pan?.nombre || f.concepto || "—"}{fechaCorta ? ` · ${fechaCorta}` : ""}
                          </div>
                        </div>
                        <div onClick={() => setModalDetalle(f)} style={{ flexShrink: 0, textAlign: "right", cursor: "pointer" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: isCobrada ? "#10B981" : isVencida ? "#EF4444" : "#FFFFFF", fontFamily: "monospace", letterSpacing: "-0.3px" }}>
                            {fmt(total)}
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      {(isEmitible || isCobrable || f.pdf_url) && (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {isEmitible && (
                            <button onClick={(e) => { e.stopPropagation(); alert("Emitir: integra tu API de facturación electrónica."); }}
                              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.45)", borderRadius: 10, padding: "7px 14px", color: "#5A9BFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5A9BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                              Emitir
                            </button>
                          )}
                          {isCobrable && (
                            <button onClick={(e) => { e.stopPropagation(); alert("Cobrar: marca esta factura como cobrada en tu sistema."); }}
                              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.45)", borderRadius: 10, padding: "7px 14px", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Cobrar
                            </button>
                          )}
                          {f.pdf_url && (
                            <button onClick={(e) => { e.stopPropagation(); window.open(f.pdf_url, "_blank"); }}
                              style={{
                                background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
                                border: "none",
                                borderRadius: 10, padding: "7px 14px",
                                color: "#FFFFFF", fontSize: 12, fontWeight: 700,
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                                fontFamily: "inherit",
                                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                                transition: "all 0.15s ease",
                              }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                              </svg>
                              Ver PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && facsFiltradas.length > 0 && (
            <div style={{
              marginTop: 14,
              background: "#EEF2FF",
              border: "1px solid rgba(37,99,235,0.18)",
              borderRadius: 18, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: "0 2px 8px rgba(37,99,235,0.08)",
            }}>
              <span style={{ fontSize: 12, color: "#1E3A8A", fontWeight: 600 }}>
                {facsFiltradas.length} comprobante{facsFiltradas.length > 1 ? "s" : ""} mostrado{facsFiltradas.length > 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1E3A8A", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#3B6FCC", fontWeight: 600 }}>Total:</span>
                <span style={{ fontFamily: "monospace", letterSpacing: "-0.3px" }}>{fmt(facsFiltradas.reduce((a, f) => a + totalDe(f), 0))}</span>
              </span>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle (solo lectura) */}
      {modalDetalle && (
        <ModalDetalleFactura
          factura={modalDetalle}
          paneles={paneles} clientes={clientes}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  );
}

const ICONS={
  mapa:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  paneles:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  contratos: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  crm:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  resultados:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  reportes:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  gastos:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  perfil:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  hoy:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ranking:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  historico:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><polyline points="3 16 3 11 8 11"/></svg>,
  facturacion: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="18" y2="15"/></svg>,
};

// ── Sidebar icon button ──

// ══════════════════════════════════════════════════════════════════
// 🌅 HOY — Acciones recomendadas del día
// ══════════════════════════════════════════════════════════════════
function Hoy({clientes,contratos,paneles,gastos,setTab}){
  const hoyD=new Date();
  const mesKey=`${hoyD.getFullYear()}-${String(hoyD.getMonth()+1).padStart(2,"0")}`;
  const saludo=hoyD.getHours()<12?"Buenos días":hoyD.getHours()<18?"Buenas tardes":"Buenas noches";

  // ── KPIs
  const ingMes=contratos.filter(c=>c.pagado&&c.inicio?.slice(0,7)<=mesKey&&c.fin?.slice(0,7)>=mesKey).reduce((a,c)=>a+Number(c.monto),0);
  const panelLibres=paneles.filter(p=>p.estado==="Libre").length;
  const cobPendiente=contratos.filter(c=>!c.pagado&&c.inicio?.slice(0,7)<=mesKey&&c.fin?.slice(0,7)>=mesKey).reduce((a,c)=>a+Number(c.monto),0);
  const vence7=contratos.filter(c=>{const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);return d>=0&&d<=30;}).length;
  const totalPaneles=paneles.length;
  const ocupados=paneles.filter(p=>p.estado==="Ocupado").length;
  const ocupPct=totalPaneles>0?Math.round((ocupados/totalPaneles)*100):0;
  const ingPotencial=paneles.filter(p=>p.estado==="Libre").reduce((a,p)=>a+Number(p.precio||0),0);

  // ── ACCIONES
  const acciones = useMemo(()=>{
    const lista=[];
    const hoyD=new Date();

    // Contratos por vencer en 30 días
    contratos.forEach(c=>{
      if(!c.fin) return;
      const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);
      if(d>=0&&d<=30){
        const panel=paneles.find(p=>p.id===c.panel_id);
        const cliente=clientes.find(cl=>cl.id===c.cliente_id);
        lista.push({
          tipo:"vencimiento",
          prioridad: d<=7?"alta":d<=15?"media":"baja",
          icono: d<=7?"🚨":d<=15?"⚠️":"🔔",
          titulo:`Contrato vence en ${d} días`,
          desc:`${cliente?.empresa||"Cliente"} · ${panel?.nombre||"Panel"} · ${fmt(c.monto)}/mes`,
          accion:"Ver Contratos",
          tab:"contratos",
          color: d<=7?C.red:d<=15?C.amber:C.accent,
        });
      }
    });

    // Paneles libres sin contrato
    paneles.filter(p=>p.estado==="Libre").forEach(p=>{
      const diasLibre = (() => {
        const ctrs = contratos.filter(c=>c.panel_id===p.id).sort((a,b)=>new Date(b.fin)-new Date(a.fin));
        if(ctrs.length===0) return 999;
        return Math.max(0,Math.ceil((hoyD - new Date(ctrs[0].fin))/86400000));
      })();
      if(diasLibre>14){
        lista.push({
          tipo:"panel_libre",
          prioridad: diasLibre>60?"alta":diasLibre>30?"media":"baja",
          icono:"📡",
          titulo:`${p.nombre} lleva ${diasLibre>900?"tiempo sin contrato":`${diasLibre} días libre`}`,
          desc:`${p.ciudad} · ${p.tipo} · Precio: ${fmt(p.precio)}/mes`,
          accion:"Ir a Paneles",
          tab:"paneles",
          color: diasLibre>60?C.red:diasLibre>30?C.amber:C.muted,
        });
      }
    });

    // Clientes "Por vencer" o "Inactivo"
    clientes.filter(c=>c.tipo==="Cliente"&&(c.estado==="Por vencer"||c.estado==="Inactivo")).forEach(cl=>{
      lista.push({
        tipo:"cliente_riesgo",
        prioridad: cl.estado==="Inactivo"?"alta":"media",
        icono: cl.estado==="Inactivo"?"🔴":"🟡",
        titulo:`${cl.empresa} — ${cl.estado}`,
        desc:`${cl.sector||""} · ${cl.celular||cl.email||"Sin contacto"} · Renovar contrato`,
        accion:"Ir a Clientes",
        tab:"crm",
        color: cl.estado==="Inactivo"?C.red:C.amber,
      });
    });

    // Contratos no pagados del mes
    const mesActualKey=`${hoyD.getFullYear()}-${String(hoyD.getMonth()+1).padStart(2,"0")}`;
    contratos.filter(c=>{
      if(c.pagado) return false;
      const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
      return ini&&fin&&ini<=mesActualKey&&fin>=mesActualKey;
    }).forEach(c=>{
      const panel=paneles.find(p=>p.id===c.panel_id);
      const cliente=clientes.find(cl=>cl.id===c.cliente_id);
      lista.push({
        tipo:"cobro_pendiente",
        prioridad:"alta",
        icono:"💸",
        titulo:`Cobro pendiente: ${fmt(c.monto)}`,
        desc:`${cliente?.empresa||"Cliente"} · ${panel?.nombre||"Panel"} · Este mes`,
        accion:"Ver Contratos",
        tab:"contratos",
        color: C.red,
      });
    });

    // Paneles con precio bajo (ocupados con precio menor al promedio)
    const precios=paneles.filter(p=>p.estado==="Ocupado"&&Number(p.precio)>0).map(p=>Number(p.precio));
    const promPrecio=precios.length?Math.round(precios.reduce((a,b)=>a+b,0)/precios.length):0;
    if(promPrecio>0){
      paneles.filter(p=>p.estado==="Libre"&&Number(p.precio)>0&&Number(p.precio)<promPrecio*0.7).forEach(p=>{
        lista.push({
          tipo:"precio_bajo",
          prioridad:"baja",
          icono:"📉",
          titulo:`${p.nombre} podría tener precio bajo`,
          desc:`Precio actual: ${fmt(p.precio)}/mes · Promedio portafolio: ${fmt(promPrecio)}/mes`,
          accion:"Editar Panel",
          tab:"paneles",
          color: C.purple,
        });
      });
    }

    // Ordenar por prioridad
    const ord={alta:0,media:1,baja:2};
    return lista.sort((a,b)=>ord[a.prioridad]-ord[b.prioridad]).slice(0,8);
  },[clientes,contratos,paneles,gastos]);

  // ── FECHA FORMATEADA
  const fechaLarga=hoyD.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const fechaCap=fechaLarga.charAt(0).toUpperCase()+fechaLarga.slice(1);

  // ── INSIGHT para badge hero
  const insightBadge=panelLibres>0
    ?{txt:`Tienes ${panelLibres} panel${panelLibres>1?"es":""} libre${panelLibres>1?"s":""}`,sub:"Acción recomendada"}
    :vence7>0
    ?{txt:`${vence7} contrato${vence7>1?"s":""} vence${vence7>1?"n":""} esta semana`,sub:"Revisar ahora"}
    :cobPendiente>0
    ?{txt:`${fmt(cobPendiente)} pendiente de cobro`,sub:"Gestionar cobros"}
    :{txt:"¡Todo al día hoy!",sub:"Excelente gestión"};

  return(
  <div style={{paddingBottom:24}}>
    {/* ══════════ 1. HERO — Navy slab + bar chart card ══════════ */}
    {(()=>{
      // bar chart data: últimos 6 meses de ingresos
      const meses6 = (()=>{
        const arr=[]; const d=new Date(hoyD);
        for(let i=5;i>=0;i--){
          const dd=new Date(d.getFullYear(),d.getMonth()-i,1);
          const k=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}`;
          const lbl=dd.toLocaleDateString("es-PE",{month:"short"}).replace(".","");
          const tot=contratos.filter(c=>c.inicio?.slice(0,7)<=k&&c.fin?.slice(0,7)>=k).reduce((a,c)=>a+Number(c.monto||0),0);
          arr.push({k,lbl:lbl.charAt(0).toUpperCase()+lbl.slice(1),v:tot});
        }
        return arr;
      })();
      const maxV = Math.max(1, ...meses6.map(m=>m.v));
      // delta vs mes anterior
      const ingActual = meses6[meses6.length-1].v;
      const ingPrev   = meses6[meses6.length-2].v;
      const delta     = ingActual - ingPrev;
      const deltaPct  = ingPrev>0 ? (delta/ingPrev)*100 : 0;
      const positive  = delta>=0;
      return (
    <div style={{
      position:"relative",
      margin:"-16px -16px 18px",
      padding:"22px 20px 26px",
      borderBottomLeftRadius:28, borderBottomRightRadius:28,
      overflow:"hidden",
      background:"linear-gradient(180deg, #0B1430 0%, #0E1A3B 55%, #0B1430 100%)",
      color:"#fff",
      boxShadow:"0 18px 40px -28px rgba(8,14,40,0.55)",
    }}>
      {/* radial highlights */}
      <div aria-hidden style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",borderBottomLeftRadius:28,borderBottomRightRadius:28}}>
        <div style={{position:"absolute",top:-60,right:-40,width:260,height:260,borderRadius:"50%",background:"radial-gradient(closest-side, rgba(29,107,255,0.35), rgba(29,107,255,0))",filter:"blur(2px)"}}/>
        <div style={{position:"absolute",top:80,left:-80,width:240,height:240,borderRadius:"50%",background:"radial-gradient(closest-side, rgba(80,140,255,0.18), rgba(0,0,0,0))"}}/>
      </div>

      {/* header row */}
      <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginTop:4}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,color:"rgba(200,212,240,0.62)",fontWeight:500}}>{saludo}, Alan Martínez</div>
          <div style={{fontSize:30,fontWeight:800,color:"#fff",letterSpacing:"-0.03em",lineHeight:1.02,marginTop:4}}>Resumen</div>
          <div style={{fontSize:11.5,color:"rgba(200,212,240,0.55)",marginTop:6}}>{fechaCap}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setTab("resultados")} aria-label="Notificaciones" style={{
            width:42,height:42,borderRadius:"50%",
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",
            color:"#fff",position:"relative",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
            {acciones.length>0 && <span style={{position:"absolute",top:8,right:10,width:9,height:9,borderRadius:"50%",background:"#FF5A5F",border:"2px solid #0E1A3B"}}/>}
          </button>
          <div style={{
            width:42,height:42,borderRadius:"50%",
            background:"linear-gradient(135deg, #2A6BFF 0%, #1042B8 100%)",
            border:"2px solid rgba(255,255,255,0.18)",color:"#fff",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:700,fontSize:13,letterSpacing:0.4,
            boxShadow:"0 6px 16px rgba(20,55,160,0.45)",
          }}>AM</div>
        </div>
      </div>

      {/* hero card */}
      <div style={{
        position:"relative",marginTop:20,
        background:"linear-gradient(180deg, rgba(20,32,68,0.92) 0%, rgba(14,24,56,0.92) 100%)",
        border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:20,padding:"16px 16px 18px",
        display:"flex",alignItems:"stretch",gap:14,
        boxShadow:"0 12px 28px -18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {/* left numbers */}
        <div style={{flex:"1 1 56%",minWidth:0,display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:12,color:"rgba(200,212,240,0.66)",fontWeight:500}}>Ingreso del mes</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:6,flexWrap:"wrap"}}>
            <div style={{fontSize:26,fontWeight:800,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>{fmt(ingActual)}</div>
            <div style={{fontSize:12,fontWeight:700,color:positive?"#5BD39A":"#FF7A8A"}}>{positive?"+":""}{deltaPct.toFixed(1)}%</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <span style={{
              fontSize:11,fontWeight:700,
              color:positive?"#5BD39A":"#FF7A8A",
              background:positive?"rgba(91,211,154,0.12)":"rgba(255,122,138,0.12)",
              border:`1px solid ${positive?"rgba(91,211,154,0.25)":"rgba(255,122,138,0.25)"}`,
              padding:"3px 8px",borderRadius:999,
            }}>{positive?"+":"-"}{fmt(Math.abs(delta))}</span>
            <span style={{fontSize:11,color:"rgba(200,212,240,0.55)"}}>vs mes anterior</span>
          </div>
          <div style={{flex:1}}/>
          <button onClick={()=>setTab("contratos")} style={{
            marginTop:14,alignSelf:"flex-start",
            display:"inline-flex",alignItems:"center",gap:6,
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
            color:"#fff",borderRadius:999,padding:"7px 12px",
            fontSize:12,fontWeight:600,cursor:"pointer",
          }}>
            Ver contratos
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>

        {/* right bar chart */}
        <div style={{flex:"1 1 44%",minWidth:0,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <div style={{
              display:"inline-flex",alignItems:"center",gap:6,
              background:"rgba(29,107,255,0.18)",border:"1px solid rgba(127,174,255,0.35)",
              color:"#BDD2FF",borderRadius:999,padding:"4px 10px",
              fontSize:11,fontWeight:600,
            }}>
              6 meses
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div style={{flex:1,marginTop:10,display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:5,height:90}}>
            {meses6.map((m,i)=>{
              const isHi = i>=meses6.length-3;
              const h = (m.v/maxV)*100;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:0}}>
                  <div style={{
                    width:"68%",height:`${Math.max(h,6)}%`,minHeight:5,borderRadius:4,
                    background:isHi?"linear-gradient(180deg,#4A8CFF 0%,#1D6BFF 100%)":"rgba(255,255,255,0.08)",
                    boxShadow:isHi?"0 0 14px rgba(29,107,255,0.45)":"none",
                  }}/>
                  <div style={{fontSize:9,fontWeight:600,color:isHi?"rgba(189,210,255,0.95)":"rgba(200,212,240,0.45)",letterSpacing:0.4,textTransform:"uppercase"}}>{m.lbl}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
      );})()}

    {/* ══════════ 2. KPI CARDS ══════════ */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      {/* Ingreso del mes */}
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(16,185,129,0.2)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        boxShadow:"0 4px 20px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:700}}>Ingreso del mes</div>
        <div style={{fontSize:20,fontWeight:900,color:"#10B981",letterSpacing:"-0.5px",textShadow:"0 0 20px rgba(16,185,129,0.4)"}}>{fmt(ingMes)}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4}}>{contratos.filter(c=>c.pagado).length} de {contratos.length} contratos</div>
      </div>

      {/* Paneles libres — destacado morado */}
      <div style={{
        background:"linear-gradient(145deg,rgba(109,40,217,0.28),rgba(79,60,200,0.18))",
        border:"1px solid rgba(139,92,246,0.45)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        boxShadow:"0 4px 28px rgba(109,40,217,0.3),inset 0 1px 0 rgba(255,255,255,0.08)",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"80%",height:"80%",background:"radial-gradient(ellipse,rgba(139,92,246,0.2) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(139,92,246,0.25)",border:"1px solid rgba(139,92,246,0.5)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(196,167,255,0.7)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Paneles libres</div>
        <div style={{fontSize:28,fontWeight:900,color:"#FFFFFF",letterSpacing:"-1px",textShadow:"0 0 24px rgba(139,92,246,0.7)",position:"relative",zIndex:1}}>{panelLibres}</div>
        <div style={{fontSize:10,color:"rgba(196,167,255,0.55)",marginTop:4,position:"relative",zIndex:1}}>Listos para asignar</div>
      </div>

      {/* Por cobrar */}
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(245,166,35,0.28)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        boxShadow:"0 4px 20px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"70%",height:"70%",background:"radial-gradient(ellipse,rgba(245,166,35,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(245,166,35,0.18)",border:"1px solid rgba(245,166,35,0.45)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1,boxShadow:"0 0 14px rgba(245,166,35,0.25)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Por cobrar</div>
        <div style={{fontSize:20,fontWeight:900,color:"#F5A623",letterSpacing:"-0.5px",textShadow:"0 0 20px rgba(245,166,35,0.55)",position:"relative",zIndex:1}}>{fmt(cobPendiente)}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4,position:"relative",zIndex:1}}>{contratos.filter(c=>!c.pagado&&c.inicio?.slice(0,7)<=mesKey&&c.fin?.slice(0,7)>=mesKey).length} de {contratos.length} contratos</div>
      </div>

      {/* Vencen pronto */}
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(240,71,71,0.28)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        boxShadow:"0 4px 20px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"70%",height:"70%",background:"radial-gradient(ellipse,rgba(240,71,71,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(240,71,71,0.18)",border:"1px solid rgba(240,71,71,0.45)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1,boxShadow:"0 0 14px rgba(240,71,71,0.25)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F04747" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Vencen pronto</div>
        <div style={{fontSize:28,fontWeight:900,color:"#F04747",letterSpacing:"-1px",textShadow:"0 0 22px rgba(240,71,71,0.6)",position:"relative",zIndex:1}}>{vence7}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4,position:"relative",zIndex:1}}>Próximos 30 días</div>
      </div>
    </div>

    {/* ══════════ 3. ACCIONES RECOMENDADAS ══════════ */}
    <div style={{
      background:"linear-gradient(145deg,rgba(10,18,34,0.97),rgba(6,10,20,0.99))",
      border:"1px solid rgba(79,124,255,0.14)",
      borderRadius:18,padding:"18px 18px",marginBottom:16,
      boxShadow:"0 8px 36px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,rgba(37,99,235,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 12px rgba(37,99,235,0.3)"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{fontSize:15,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.3px"}}>Acciones recomendadas para hoy</span>
        </div>
        <button onClick={()=>setTab("resultados")} style={{background:"none",border:"none",color:"rgba(167,139,250,0.7)",fontSize:12,cursor:"pointer",fontWeight:600,padding:0}}>
          Ver todas →
        </button>
      </div>

      {acciones.length===0?(
        <div style={{
          display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
          background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",
          borderRadius:14,
        }}>
          <div style={{fontSize:28}}>🎉</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#10B981",marginBottom:2}}>¡Todo al día!</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>No hay acciones urgentes por el momento.</div>
          </div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {acciones.slice(0,4).map((a,i)=>{
            // Icon per type
            const iconSvg = a.tipo==="panel_libre"
              ?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              :a.tipo==="vencimiento"
              ?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              :a.tipo==="cobro_pendiente"
              ?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>;
            const btnLabel=a.tipo==="panel_libre"?"Asignar cliente":a.tipo==="cobro_pendiente"?"Cobrar":a.tipo==="vencimiento"?"Renovar":"Contactar";
            return(
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:12,padding:"13px 15px",
                background:`linear-gradient(135deg,rgba(14,24,42,0.9),rgba(10,18,32,0.95))`,
                border:`1px solid rgba(79,124,255,0.12)`,
                borderRadius:14,cursor:"pointer",transition:"all 0.18s",
              }}
                onClick={()=>setTab(a.tab)}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${a.color}44`;e.currentTarget.style.background=`linear-gradient(135deg,${a.color}0A,rgba(10,18,32,0.95))`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(79,124,255,0.12)";e.currentTarget.style.background="linear-gradient(135deg,rgba(14,24,42,0.9),rgba(10,18,32,0.95))";}}
              >
                {/* Icon box */}
                <div style={{
                  width:40,height:40,borderRadius:12,flexShrink:0,
                  background:`linear-gradient(135deg,${a.color}28,${a.color}18)`,
                  border:`1px solid ${a.color}40`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:a.color,
                  boxShadow:`0 2px 12px ${a.color}22`,
                }}>
                  {iconSvg}
                </div>
                {/* Text */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#FFFFFF",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.titulo}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.42)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.desc}</div>
                </div>
                {/* Priority badge */}
                <span style={{
                  flexShrink:0,fontSize:10,fontWeight:800,letterSpacing:0.5,
                  background:a.prioridad==="alta"?"rgba(240,71,71,0.2)":a.prioridad==="media"?"rgba(245,166,35,0.15)":"rgba(79,124,255,0.15)",
                  color:a.prioridad==="alta"?"#F04747":a.prioridad==="media"?"#F5A623":"#7B9FFF",
                  border:`1px solid ${a.prioridad==="alta"?"rgba(240,71,71,0.4)":a.prioridad==="media"?"rgba(245,166,35,0.3)":"rgba(79,124,255,0.3)"}`,
                  borderRadius:20,padding:"3px 9px",textTransform:"uppercase",
                  marginRight:6,
                }}>{a.prioridad}</span>
                {/* Action button */}
                <button
                  onClick={e=>{e.stopPropagation();setTab(a.tab);}}
                  style={{
                    flexShrink:0,
                    background:"linear-gradient(135deg,rgba(79,124,255,0.25),rgba(37,99,235,0.2))",
                    border:"1px solid rgba(255,255,255,0.25)",
                    borderRadius:10,padding:"7px 13px",
                    color:"#FFFFFF",fontWeight:700,fontSize:12,
                    cursor:"pointer",whiteSpace:"nowrap",
                    transition:"all 0.15s",
                    boxShadow:"0 2px 10px rgba(37,99,235,0.2)",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(37,99,235,0.4),rgba(79,124,255,0.3))";e.currentTarget.style.color="#fff";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(79,124,255,0.25),rgba(37,99,235,0.2))";e.currentTarget.style.color="#FFFFFF";}}
                >
                  {btnLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* ══════════ 4. RESUMEN INTELIGENTE ══════════ */}
    {(()=>{
      // ingreso REAL del mes = todos los contratos vigentes este mes (pagados o no)
      // un panel alquilado con contrato activo YA genera ingreso aunque no haya cobrado aún
      const contratosActivosMes = contratos.filter(c=>{
        if(!c.inicio||!c.fin) return false;
        const ini=c.inicio.slice(0,7); const fin=c.fin.slice(0,7);
        return ini<=mesKey&&fin>=mesKey;
      });
      const ingActualMes = contratosActivosMes.reduce((a,c)=>a+Number(c.monto||0),0);

      const panelLibresMes = paneles.filter(p=>p.estado==="Libre");
      const ingPotencialTotal = panelLibresMes.reduce((a,p)=>a+Number(p.precio||0),0);
      const ingConPaneles = ingActualMes + ingPotencialTotal;
      const contratosPendientes = contratos.filter(c=>!c.pagado&&c.inicio?.slice(0,7)<=mesKey&&c.fin?.slice(0,7)>=mesKey).length;
      const contratosVencen30 = contratos.filter(c=>{const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);return d>0&&d<=30;}).length;

      // El valor siempre verde — representa ingreso generado o potencial
      let titulo="", mensaje="", subtitulo="";
      if(totalPaneles===0){
        titulo="Sin paneles registrados";
        mensaje="Agrega tu primer panel para empezar a generar ingresos y ver proyecciones reales.";
        subtitulo="$0/mes";
      } else if(ocupados===0){
        titulo="Ningún panel alquilado aún";
        mensaje=`Tienes ${totalPaneles} panel${totalPaneles>1?"es":""} disponible${totalPaneles>1?"s":""}. Asignando contratos podrías generar hasta`;
        subtitulo=`${fmt(ingPotencialTotal)}/mes`;
      } else if(panelLibresMes.length>0){
        titulo=`${ocupPct}% ocupado — margen para crecer`;
        mensaje=`Estás generando ${fmt(ingActualMes)}/mes. Con ${panelLibresMes.length} panel${panelLibresMes.length>1?"es":""} libre${panelLibresMes.length>1?"s":""} adicional${panelLibresMes.length>1?"es":""} podrías llegar a`;
        subtitulo=`${fmt(ingConPaneles)}/mes`;
      } else if(contratosVencen30>0){
        titulo="100% ocupado — renovar pronto";
        mensaje=`Excelente ocupación. ${contratosVencen30} contrato${contratosVencen30>1?"s":""} vence${contratosVencen30>1?"n":""} en 30 días. Contacta los clientes para renovar y mantener`;
        subtitulo=`${fmt(ingActualMes)}/mes`;
      } else if(contratosPendientes>0){
        titulo=`${ocupPct}% ocupado — cobros pendientes`;
        mensaje=`Hay ${contratosPendientes} pago${contratosPendientes>1?"s":""} pendiente${contratosPendientes>1?"s":""} este mes. Tu ingreso mensual asegurado es`;
        subtitulo=`${fmt(ingActualMes)}/mes`;
      } else {
        titulo=`${ocupPct}% ocupado — todo al día`;
        mensaje="Todos tus paneles están activos y cobros al día. Tu ingreso mensual confirmado es";
        subtitulo=`${fmt(ingActualMes)}/mes`;
      }

      return(
        <div style={{
          background:"linear-gradient(145deg,rgba(10,18,34,0.97),rgba(6,10,20,0.99))",
          border:"1px solid rgba(79,124,255,0.14)",
          borderRadius:18,padding:"20px 20px",marginBottom:16,
          boxShadow:"0 8px 36px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.04)",
          display:"flex",alignItems:"center",gap:20,
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,rgba(37,99,235,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 10px rgba(37,99,235,0.3)"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <span style={{fontSize:15,fontWeight:800,color:"#FFFFFF"}}>Resumen inteligente</span>
              {ocupPct===100&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:"auto"}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(196,167,255,0.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>{titulo}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.62)",lineHeight:1.7,marginBottom:10}}>{mensaje}</div>
            <div style={{fontSize:26,fontWeight:900,color:C.green,letterSpacing:"-1px",textShadow:`0 0 24px ${C.green}55`,marginBottom:14}}>
              {subtitulo}
            </div>
            <button
              onClick={()=>setTab("resultados")}
              style={{
                background:"none",border:"1px solid rgba(255,255,255,0.25)",
                borderRadius:10,padding:"8px 16px",
                color:"rgba(255,255,255,0.8)",fontWeight:600,fontSize:12,
                cursor:"pointer",transition:"all 0.15s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(37,99,235,0.18)";e.currentTarget.style.color="#FFFFFF";}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}
            >
              Ver proyección completa →
            </button>
          </div>

          {/* Semicircular gauge */}
          <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            {(()=>{
              const R=52, W=118, H=70;
              const circumference=Math.PI*R;
              const progress=(ocupPct/100)*circumference;
              const angle=(ocupPct/100)*180-180;
              const dotX=W/2+R*Math.cos((angle*Math.PI)/180);
              const dotY=H+R*Math.sin((angle*Math.PI)/180);
              const gaugeColor=ocupPct===100?"#10B981":ocupPct>=60?"#4F7CFF":ocupPct>0?"#F5A623":"#4E6080";
              return(
                <svg width={W} height={H+14} viewBox={`0 0 ${W} ${H+14}`}>
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={gaugeColor}/>
                      <stop offset="100%" stopColor={ocupPct===100?"#9B6FFF":gaugeColor}/>
                    </linearGradient>
                    <filter id="gaugeGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <path d={`M ${W/2-R},${H} A ${R},${R} 0 0,1 ${W/2+R},${H}`}
                    fill="none" stroke="rgba(22,32,53,0.9)" strokeWidth="10" strokeLinecap="round"/>
                  {ocupPct>0&&<path d={`M ${W/2-R},${H} A ${R},${R} 0 0,1 ${W/2+R},${H}`}
                    fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference}`}
                    filter="url(#gaugeGlow)"/>}
                  <circle cx={dotX} cy={dotY} r="6" fill={gaugeColor} filter="url(#gaugeGlow)"/>
                  <circle cx={dotX} cy={dotY} r="3" fill="#fff"/>
                  <text x={W/2} y={H-4} textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="800" fontFamily="DM Sans,sans-serif">{ocupPct}%</text>
                  <text x={W/2} y={H+10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="DM Sans,sans-serif">ocupación</text>
                </svg>
              );
            })()}
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>{ocupados} de {totalPaneles} paneles ocupados</div>
          </div>
        </div>
      );
    })()}

    {/* ══════════ 5. ACCESOS RÁPIDOS ══════════ */}
    <div>
      <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:12,letterSpacing:"-0.2px"}}>Accesos rápidos</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,label:"Ver paneles",sub:"Gestionar activos",tab:"paneles",color:"#4F7CFF"},
          {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,label:"Nuevo contrato",sub:"Crear contrato",tab:"contratos",color:"#9B6FFF"},
          {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,label:"Clientes",sub:"Ver clientes",tab:"crm",color:"#0FBA7D"},
          {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,label:"Mapa",sub:"Ver ubicaciones",tab:"mapa",color:"#22D3EE"},
        ].map(q=>(
          <button key={q.tab} onClick={()=>setTab(q.tab)} style={{
            background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
            border:`1px solid rgba(79,124,255,0.12)`,
            borderRadius:14,padding:"14px 10px",
            cursor:"pointer",transition:"all 0.18s",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
            boxShadow:"0 4px 16px rgba(0,0,0,0.4)",
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=`${q.color}44`;e.currentTarget.style.background=`linear-gradient(145deg,${q.color}0D,rgba(8,14,26,0.98))`;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 24px rgba(0,0,0,0.5),0 0 16px ${q.color}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(79,124,255,0.12)";e.currentTarget.style.background="linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.4)";}}
          >
            <div style={{width:36,height:36,borderRadius:10,background:`${q.color}18`,border:`1px solid ${q.color}30`,display:"flex",alignItems:"center",justifyContent:"center",color:q.color}}>
              {q.icon}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)",textAlign:"center",lineHeight:1.2}}>{q.label}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>{q.sub}</div>
          </button>
        ))}
      </div>
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// 🧾 GENERADOR DE COMPROBANTE PDF — Vista360 Perú
// ══════════════════════════════════════════════════════════════════
function ModalPreFactura({ contrato, panel, cliente, onClose }) {
  const [tipo, setTipo]   = useState("FACTURA");
  const [serie, setSerie] = useState("F001");
  const [numero, setNumero] = useState("1");

  const monto      = Number(contrato.monto || 0);
  const exonerado  = isExoneradoIGV(panel?.ciudad || EMISOR.ciudad);
  const igvRate    = exonerado ? 0 : IGV_RATE;
  const subtotal   = exonerado ? monto : Math.round((monto / 1.18) * 100) / 100;
  const igv        = exonerado ? 0 : Math.round((monto - subtotal) * 100) / 100;
  const hoy        = new Date().toLocaleDateString("es-PE", {day:"2-digit",month:"long",year:"numeric"});

  const generarHTML = () => {
    const s = tipo==="FACTURA" ? serie : serie.replace(/^F/,"B");
    const numPad = numero.padStart(8,"0");
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${tipo} ${s}-${numPad} — 8 Millas</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:14mm 14mm 14mm 14mm}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;font-size:13px}
  .doc{background:#fff;max-width:100%;margin:0 auto}
  .header{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .logo{font-size:24px;font-weight:900;letter-spacing:-1px}.logo span{color:#93C5FD}
  .logo-img{height:54px;width:auto;object-fit:contain;display:block;margin-bottom:4px}
  .logo-sub{font-size:11px;opacity:.75;margin-top:3px}
  .emisor-data{font-size:11px;opacity:.9;margin-top:10px;line-height:1.7}
  .emisor-data strong{font-size:12px}
  .tipo-doc{text-align:right}
  .tipo-doc .tipo{font-size:18px;font-weight:900}
  .tipo-doc .serie{font-size:14px;font-family:monospace;margin-top:4px;opacity:.9}
  .tipo-doc .fecha{font-size:11px;opacity:.75;margin-top:6px;line-height:1.6}
  .body{padding:18px 26px}
  .section{margin-bottom:16px}
  .section-title{font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #E5E7EB}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field label{font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:2px}
  .field .value{font-size:13px;font-weight:600;color:#111827}
  .field .value.mono{font-family:monospace}
  table{width:100%;border-collapse:collapse}
  thead th{background:#1E3A8A;color:#fff;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  tbody td{padding:10px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6}
  .totales{display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-top:12px}
  .tot-row{display:flex;gap:32px;font-size:12px;color:#6B7280}
  .tot-row .lbl{min-width:120px;text-align:right}
  .tot-row .val{font-weight:700;color:#374151;min-width:110px;text-align:right;font-family:monospace}
  .total-final{display:flex;gap:14px;background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;border-radius:8px;padding:12px 16px;margin-top:8px;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .total-final .lbl{font-size:13px;font-weight:700;flex:1}
  .total-final .val{font-size:22px;font-weight:900;font-family:monospace}
  .footer{border-top:2px solid #1E3A8A;padding:10px 26px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#6B7280;margin-top:10px}
  .footer strong{color:#1E3A8A}
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div>
      <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
      <div class="logo-sub">8 MILLAS · Publicidad Exterior</div>
      <div class="emisor-data">
        <strong>RUC: ${EMISOR.ruc}</strong><br/>
        ${EMISOR.razonSocial}<br/>
        ${EMISOR.direccion}<br/>
        Actividad: ${EMISOR.actividad}
        ${exonerado ? `<br/><span style="display:inline-block;margin-top:6px;background:#D1FAE5;color:#065F46;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact">🌿 EXONERADO IGV — LEY AMAZONÍA N° 27037</span>` : ""}
      </div>
    </div>
    <div class="tipo-doc">
      <div class="tipo">${tipo} ELECTRÓNICA</div>
      <div class="serie">${s}-${numPad}</div>
      <div class="fecha">Fecha: ${hoy}</div>
    </div>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">📤 Datos del ${tipo==="FACTURA"?"Adquirente":"Receptor"}</div>
      <div class="grid2">
        <div class="field">
          <label>${tipo==="FACTURA"?"Razón Social":"Apellidos y Nombres"}</label>
          <div class="value">${cliente.empresa||"—"}</div>
        </div>
        <div class="field">
          <label>${tipo==="FACTURA"?"RUC":"DNI / CE"}</label>
          <div class="value mono">${cliente.ruc||cliente.dni||"Sin documento"}</div>
        </div>
        <div class="field"><label>Contacto</label><div class="value">${cliente.contacto||"—"}</div></div>
        <div class="field"><label>Teléfono</label><div class="value mono">${cliente.celular||cliente.telefono||"—"}</div></div>
        <div class="field" style="grid-column:1/-1"><label>Dirección</label><div class="value">${cliente.direccion||"—"}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📋 Detalle del Servicio</div>
      <table>
        <thead><tr><th style="width:40px">Cant.</th><th>Descripción</th><th style="width:110px">Período</th><th style="text-align:right;width:110px">V. Unit. S/IGV</th><th style="text-align:right;width:110px">Total S/IGV</th></tr></thead>
        <tbody>
          <tr>
            <td style="text-align:center;font-weight:700">1</td>
            <td>
              <strong>Arrendamiento de Panel Publicitario</strong><br/>
              <span style="font-size:11px;color:#6B7280">${panel.nombre}${panel.tipo?" · "+panel.tipo:""}${panel.ciudad?" · "+panel.ciudad:""}</span>
              ${panel.direccion?`<br/><span style="font-size:10px;color:#9CA3AF">📍 ${panel.direccion}</span>`:""}
            </td>
            <td style="font-size:11px;color:#6B7280;white-space:nowrap">${fmtF(contrato.inicio)}<br/>al ${fmtF(contrato.fin)}</td>
            <td style="text-align:right;font-family:monospace;font-weight:600">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</td>
            <td style="text-align:right;font-family:monospace;font-weight:700">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>
      <div class="totales">
        <div class="tot-row"><span class="lbl">${exonerado ? "Op. Inafecta" : "Valor Venta (sin IGV)"}</span><span class="val">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
        <div class="tot-row"><span class="lbl">${exonerado ? "IGV 0% (Exonerado — Ley Amazonía N° 27037)" : "IGV 18%"}</span><span class="val">S/ ${igv.toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
        ${exonerado ? `<div class="tot-row" style="font-size:10px"><span class="lbl" style="color:#059669">Base legal</span><span style="font-size:10px;color:#059669;min-width:220px;text-align:right">Art. 13° Ley N° 27037 — Zona Amazónica Huánuco</span></div>` : ""}
        <div class="total-final"><span class="lbl">IMPORTE TOTAL A PAGAR</span><span class="val">S/ ${monto.toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div><strong>8 Millas</strong> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
    <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body>
</html>`;
  };

  const descargar = () => {
    const s = tipo==="FACTURA" ? serie : serie.replace(/^F/,"B");
    const titulo = `${tipo}-${s}-${numero.padStart(8,"0")}-${(cliente.empresa||"cliente").replace(/\s+/g,"-")}`;
    const html = generarHTML();
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href=url; a.download=`${titulo}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(()=>URL.revokeObjectURL(url), 30000);
  };

  const inpStyle = {
    background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
    padding:"9px 12px", color:C.text, fontSize:13, outline:"none",
    width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:500,
      display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0B1324",border:"1px solid #1E3050",
        borderRadius:"22px 22px 0 0",width:"100%",maxWidth:560,
        maxHeight:"92vh",overflowY:"auto",paddingBottom:32}}>

        <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:6}}>
          <div style={{width:36,height:4,borderRadius:2,background:"#2D4060"}}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 22px 18px"}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:C.white}}>🧾 Generar Comprobante PDF</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>RUC {EMISOR.ruc} · 8 Millas · Huánuco</div>
          </div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",
            background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",
            fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{padding:"0 22px",display:"flex",flexDirection:"column",gap:16}}>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Tipo de Comprobante</div>
            <div style={{display:"flex",gap:8}}>
              {["FACTURA","BOLETA"].map(t=>(
                <button key={t} onClick={()=>{setTipo(t);setSerie(t==="FACTURA"?"F001":"B001");}}
                  style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",
                    border:`1px solid ${tipo===t?C.accent+"66":C.border}`,
                    background:tipo===t?C.accent+"18":"transparent",
                    color:tipo===t?C.white:C.muted,fontWeight:700,fontSize:13,transition:"all 0.15s"}}>
                  {t==="FACTURA"?"🧾 Factura":"📄 Boleta"}
                  <div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:0.7}}>
                    {t==="FACTURA"?"Con RUC del cliente":"Con DNI / Consumidor final"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>Serie</div>
              <input value={serie} onChange={e=>setSerie(e.target.value.toUpperCase())} style={inpStyle} placeholder="F001"/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>Número</div>
              <input value={numero} onChange={e=>setNumero(e.target.value.replace(/\D/g,""))} style={inpStyle} placeholder="1"/>
            </div>
          </div>

          <div style={{background:C.surface,border:`1px solid ${exonerado ? C.green : C.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>Resumen del Comprobante</div>
            {exonerado && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"6px 10px",background:C.green+"18",borderRadius:8,border:`1px solid ${C.green}44`}}>
                <span style={{fontSize:13}}>🌿</span>
                <span style={{fontSize:11,fontWeight:700,color:C.green}}>Exonerado de IGV — Ley Amazonía N° 27037 (Huánuco)</span>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {l:"Emisor",       v:`${EMISOR.razonSocial} — ${EMISOR.ruc}`, c:C.accent},
                {l:"Cliente",      v:cliente.empresa||"—",                    c:C.white},
                {l:tipo==="FACTURA"?"RUC":"DNI", v:cliente.ruc||cliente.dni||"Sin documento", c:cliente.ruc||cliente.dni?C.text:C.amber},
                {l:"Panel",        v:`${panel.nombre} · ${panel.ciudad||""}`, c:C.text},
                {l:"Período",      v:`${fmtF(contrato.inicio)} → ${fmtF(contrato.fin)}`, c:C.muted},
                {l:exonerado?"Op. Inafecta":"Valor s/IGV", v:`S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}`, c:C.text},
                {l:exonerado?"IGV (0% — Exonerado)":"IGV 18%", v:`S/ ${igv.toLocaleString("es-PE",{minimumFractionDigits:2})}`, c:exonerado?C.green:C.text},
                {l:"TOTAL",        v:fmt(contrato.monto), c:C.green, bold:true},
              ].map(({l,v,c,bold})=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:4,borderBottom:`1px solid ${C.border}22`}}>
                  <span style={{fontSize:11,color:C.muted}}>{l}</span>
                  <span style={{fontSize:bold?14:12,fontWeight:bold?800:600,color:c,fontFamily:bold?"monospace":"inherit"}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={onClose} style={{padding:"13px 18px",background:"transparent",
              border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,
              fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
            <button onClick={descargar} style={{flex:1,padding:"13px",
              background:"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",border:"none",
              borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
              boxShadow:"0 4px 14px rgba(37,99,235,0.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              Descargar PDF
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// 📊 MÓDULO PRINCIPAL — REPORTES

function Reportes({ contratos, paneles, clientes, gastos }) {
  const [seccion, setSeccion] = useState("resumen");
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [modalFactura, setModalFactura] = useState(null);

  // ── Datos por año ─────────────────────────────────────────────
  const mesesAnio = useMemo(() => {
    return Array.from({length:12},(_,i)=>{
      const m = `${anio}-${String(i+1).padStart(2,"0")}`;
      const ctrsMes = contratos.filter(c =>
        c.inicio && c.fin &&
        c.inicio.slice(0,7) <= m && c.fin.slice(0,7) >= m
      );
      const ingPagado  = ctrsMes.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto||0),0);
      const ingTotal   = ctrsMes.reduce((a,c)=>a+Number(c.monto||0),0);
      const gastosMes  = gastos.filter(g=>g.fecha?.startsWith(m)).reduce((a,g)=>a+Number(g.monto||0),0);
      const utilidad   = ingPagado - gastosMes;
      const contrActivos = ctrsMes.length;
      return { mes:m, label:new Date(m+"-02").toLocaleDateString("es-PE",{month:"short"}).toUpperCase(),
               ingPagado, ingTotal, gastosMes, utilidad, contrActivos };
    });
  }, [contratos, gastos, anio]);

  const maxIngreso = Math.max(...mesesAnio.map(m=>m.ingTotal), 1);

  const kpis = useMemo(() => {
    const totalIngPagado  = mesesAnio.reduce((a,m)=>a+m.ingPagado, 0);
    const totalIngTotal   = mesesAnio.reduce((a,m)=>a+m.ingTotal, 0);
    const totalGastos     = mesesAnio.reduce((a,m)=>a+m.gastosMes, 0);
    const totalUtilidad   = totalIngPagado - totalGastos;
    const pendiente       = totalIngTotal - totalIngPagado;
    const mesTop          = [...mesesAnio].sort((a,b)=>b.ingPagado-a.ingPagado)[0];
    return { totalIngPagado, totalIngTotal, totalGastos, totalUtilidad, pendiente, mesTop };
  }, [mesesAnio]);

  const rentPaneles = useMemo(() => {
    return paneles.map(p => {
      const ctrs = contratos.filter(c=>c.panel_id===p.id);
      const ingreso  = ctrs.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto||0),0);
      const pendiente= ctrs.filter(c=>!c.pagado).reduce((a,c)=>a+Number(c.monto||0),0);
      const gastP    = gastos.filter(g=>g.panel_id===p.id).reduce((a,g)=>a+Number(g.monto||0),0);
      const utilidad = ingreso - gastP;
      const ocupPct  = (() => {
        const hoyD = new Date();
        let activo=0, total=0;
        ctrs.forEach(c=>{
          if(!c.inicio||!c.fin) return;
          const ini=new Date(c.inicio), fin=new Date(c.fin);
          if(fin<ini) return;
          total += Math.ceil((Math.min(fin,hoyD)-ini)/86400000);
          if(ini<=hoyD) activo += Math.ceil((Math.min(fin,hoyD)-ini)/86400000);
        });
        return total>0 ? Math.round((activo/total)*100) : 0;
      })();
      return {...p, ingreso, pendiente, gastP, utilidad, numCtrs:ctrs.length, ocupPct};
    }).sort((a,b)=>b.ingreso-a.ingreso);
  }, [paneles, contratos, gastos]);

  const contratosFact = useMemo(() => {
    return contratos
      .map(c => ({...c, panel: paneles.find(p=>p.id===c.panel_id), cliente:clientes.find(cl=>cl.id===c.cliente_id)}))
      .filter(c=>c.panel&&c.cliente)
      .sort((a,b)=>new Date(b.inicio||0)-new Date(a.inicio||0));
  }, [contratos, paneles, clientes]);

  const secciones = [
    {id:"resumen",   label:"📊 Resumen",      emoji:"📊"},
    {id:"mensual",   label:"📅 Por Mes",       emoji:"📅"},
    {id:"paneles",   label:"🖥️ Paneles",       emoji:"🖥️"},
    {id:"prefactura",label:"🧾 Comprobantes",  emoji:"🧾"},
  ];

  // ── Colores dark (inline con C) ──────────────────────────────
  const D = {
    bg:      "linear-gradient(145deg,rgba(14,24,42,0.97) 0%,rgba(8,14,26,0.99) 100%)",
    border:  "rgba(79,124,255,0.15)",
    text:    "#FFFFFF",
    muted:   "#8892A4",
    green:   "#10B981",
    amber:   "#F59E0B",
    red:     "#EF4444",
    accent:  "#4F7CFF",
    surface: "rgba(255,255,255,0.05)",
  };

  const cardStyle = {
    background: D.bg,
    border: `1px solid ${D.border}`,
    borderRadius: 20,
    padding: "20px 18px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
    position: "relative",
    overflow: "hidden",
  };

  // ── EXPORT PDF RESUMEN ────────────────────────────────────────
  const exportResumenPDF = () => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC  = "#1E4D9B";
    const LB   = "#D6E4F7";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte Anual ${anio}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .ruc{font-size:11px;opacity:.75;margin-top:4px;letter-spacing:.5px}
.h-left .empresa{font-size:20px;font-weight:900;letter-spacing:.5px}
.h-left .logo-img{height:56px;width:auto;object-fit:contain;margin-bottom:6px;display:block}
.h-right{text-align:right}
.h-right .titulo{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}
.h-right .anio{font-size:28px;font-weight:900;color:#93C5FD;font-family:'Courier New',monospace}
.h-right .fecha{font-size:10px;opacity:.7;margin-top:4px}
.divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:18px 28px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{background:${LB};border-radius:8px;padding:14px 12px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .ic{font-size:22px;margin-bottom:4px}
.kpi .lb{font-size:9px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.kpi .vl{font-size:14px;font-weight:900;color:#0f172a}
.kpi .sl{font-size:9px;color:#64748B;margin-top:2px}
.section-title{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:10px;padding-bottom:5px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:20px}
thead th{background:${DARK};color:#fff;padding:9px 11px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:left;letter-spacing:.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:9px 11px;font-size:11px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pos{color:#065F46;font-weight:700} .neg{color:#991B1B;font-weight:700}
.best-mes{background:linear-gradient(135deg,${DARK},${ACC});color:#fff;border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.best-mes .ic{font-size:32px}
.best-mes .lb{font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:.8px}
.best-mes .nm{font-size:16px;font-weight:800}
.best-mes .vl{font-size:22px;font-weight:900;color:#FCD34D;font-family:'Courier New',monospace}
.footer{border-top:2px solid ${DARK};padding:10px 28px;display:flex;justify-content:space-between;font-size:9px;color:#64748B;margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.ciudad}</div>
    <div class="ruc">${EMISOR.actividad}</div>
  </div>
  <div class="h-right">
    <div class="titulo">Reporte Anual</div>
    <div class="anio">${anio}</div>
    <div class="fecha">Generado: ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">
  <div class="kpis">
    <div class="kpi"><div class="ic">💰</div><div class="lb">Ingresos Cobrados</div><div class="vl" style="color:#065F46">${fmt(kpis.totalIngPagado)}</div><div class="sl">Contratos pagados</div></div>
    <div class="kpi"><div class="ic">⏳</div><div class="lb">Por Cobrar</div><div class="vl" style="color:#92400E">${fmt(kpis.pendiente)}</div><div class="sl">Pendientes</div></div>
    <div class="kpi"><div class="ic">💸</div><div class="lb">Gastos Totales</div><div class="vl" style="color:#991B1B">${fmt(kpis.totalGastos)}</div><div class="sl">Todos los gastos</div></div>
    <div class="kpi"><div class="ic">📈</div><div class="lb">Utilidad Neta</div><div class="vl" style="color:${kpis.totalUtilidad>=0?"#065F46":"#991B1B"}">${fmt(kpis.totalUtilidad)}</div><div class="sl">Cobrado − Gastos</div></div>
  </div>

  <div class="section-title">Detalle Mensual ${anio}</div>
  <table>
    <thead><tr><th>Mes</th><th>Contratos</th><th class="num">Cobrado</th><th class="num">Gastos</th><th class="num">Utilidad</th><th class="num">% Cobrado</th></tr></thead>
    <tbody>
      ${mesesAnio.map(m=>`<tr>
        <td><strong>${mesLabel(m.mes)}</strong></td>
        <td style="text-align:center">${m.contrActivos}</td>
        <td class="num pos">${fmt(m.ingPagado)}</td>
        <td class="num neg">${fmt(m.gastosMes)}</td>
        <td class="num ${m.utilidad>=0?"pos":"neg"}">${fmt(m.utilidad)}</td>
        <td class="num">${m.ingTotal>0?Math.round((m.ingPagado/m.ingTotal)*100):0}%</td>
      </tr>`).join("")}
    </tbody>
  </table>

  ${kpis.mesTop&&kpis.mesTop.ingPagado>0?`
  <div class="section-title">🏆 Mejor Mes del Año</div>
  <div class="best-mes">
    <div class="ic">🏆</div>
    <div>
      <div class="lb">Mejor rendimiento en ${anio}</div>
      <div class="nm">${mesLabel(kpis.mesTop.mes)}</div>
      <div class="vl">${fmt(kpis.mesTop.ingPagado)}</div>
      <div style="font-size:10px;opacity:.75;margin-top:3px">${kpis.mesTop.contrActivos} contrato(s) activos</div>
    </div>
  </div>`:""}
</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc} · ${EMISOR.ciudad}</span>
  <span>Reporte Anual ${anio} — Sistema Vista360</span>
  <span>Generado ${new Date().toLocaleDateString("es-PE")}</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
    const w = window.open("","_blank","width=900,height=700");
    if(w){ w.document.write(html); w.document.close(); }
  };

  // ── EXPORT PDF ANUAL MENSUAL (todos los meses del año) ────────
  const exportAnualMensualPDF = () => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC  = "#1E4D9B";
    const LB   = "#D6E4F7";

    // Construir detalle de contratos por mes
    const mesesConDetalle = mesesAnio.map(m => {
      const ctrsDelMes = contratos
        .map(c=>({...c,panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)}))
        .filter(c=>c.panel&&c.cliente&&c.inicio&&c.fin&&c.inicio.slice(0,7)<=m.mes&&c.fin.slice(0,7)>=m.mes);
      const gastosDelMes = gastos.filter(g=>g.fecha?.startsWith(m.mes));
      return { ...m, ctrsDelMes, gastosDelMes };
    });

    const totalIng   = kpis.totalIngPagado;
    const totalGast  = kpis.totalGastos;
    const totalUtil  = kpis.totalUtilidad;
    const mesTopLabel= kpis.mesTop?.ingPagado>0 ? mesLabel(kpis.mesTop.mes) : "—";
    const mesTopVal  = kpis.mesTop?.ingPagado>0 ? fmt(kpis.mesTop.ingPagado) : "—";

    const filasMeses = mesesAnio.map(m => {
      const pct = m.ingTotal>0 ? Math.round((m.ingPagado/m.ingTotal)*100) : 0;
      return `<tr>
        <td><strong>${mesLabel(m.mes)}</strong></td>
        <td style="text-align:center">${m.contrActivos}</td>
        <td class="num pos">${fmt(m.ingPagado)}</td>
        <td class="num" style="color:#92400E">${fmt(m.ingTotal-m.ingPagado)}</td>
        <td class="num neg">${fmt(m.gastosMes)}</td>
        <td class="num ${m.utilidad>=0?"pos":"neg"}">${fmt(m.utilidad)}</td>
        <td class="num">${pct}%</td>
      </tr>`;
    }).join("");

    // Detalle expandido por mes (solo los que tienen datos)
    const detalleMeses = mesesConDetalle
      .filter(m=>m.ingPagado>0||m.gastosMes>0)
      .map(m=>{
        const filasCtrs = m.ctrsDelMes.length>0
          ? m.ctrsDelMes.map(c=>`<tr>
              <td>${c.cliente?.empresa||c.cliente?.nombre||"—"}</td>
              <td>${c.panel?.nombre||"—"}</td>
              <td>${fmtF(c.inicio)} → ${fmtF(c.fin)}</td>
              <td class="num">${fmt(c.monto)}</td>
              <td class="num ${c.pagado?"pag":"pend"}">${c.pagado?"✓ Pagado":"Pendiente"}</td>
            </tr>`).join("")
          : `<tr><td colspan="5" style="text-align:center;color:#94A3B8;font-style:italic">Sin contratos activos este mes</td></tr>`;

        const filasGastos = m.gastosDelMes.length>0
          ? m.gastosDelMes.map(g=>`<tr>
              <td>${g.descripcion||"—"}</td>
              <td>${g.categoria||"—"}</td>
              <td>${fmtF(g.fecha)}</td>
              <td class="num neg">${fmt(g.monto)}</td>
            </tr>`).join("")
          : `<tr><td colspan="4" style="text-align:center;color:#94A3B8;font-style:italic">Sin gastos registrados</td></tr>`;

        return `
          <div class="mes-block">
            <div class="mes-header">
              <div class="mes-cal">
                <div class="mes-anio">${anio}</div>
                <div class="mes-nombre">${new Date(m.mes+"-02").toLocaleDateString("es-PE",{month:"short"}).toUpperCase().replace(".","")}</div>
              </div>
              <div class="mes-info">
                <div class="mes-titulo">${mesLabel(m.mes)}</div>
                <div class="mes-kpis">
                  <span class="mk pos">💰 ${fmt(m.ingPagado)}</span>
                  <span class="mk neg">💸 ${fmt(m.gastosMes)}</span>
                  <span class="mk ${m.utilidad>=0?"pos":"neg"}">📈 ${fmt(m.utilidad)}</span>
                </div>
              </div>
            </div>
            <div class="sec">Contratos activos · ${m.contrActivos}</div>
            <table>
              <thead><tr><th>Cliente</th><th>Panel</th><th>Período</th><th class="num">Monto</th><th class="num">Estado</th></tr></thead>
              <tbody>${filasCtrs}</tbody>
            </table>
            <div class="sec">Gastos del mes · ${m.gastosDelMes.length} registro(s)</div>
            <table>
              <thead><tr><th>Descripción</th><th>Categoría</th><th>Fecha</th><th class="num">Monto</th></tr></thead>
              <tbody>${filasGastos}</tbody>
            </table>
          </div>`;
      }).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte Anual Detallado ${anio} — 8 Millas</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:13mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:11.5px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .logo-img{height:52px;width:auto;object-fit:contain;margin-bottom:5px;display:block}
.h-left .ruc{font-size:10px;opacity:.75;margin-top:3px;letter-spacing:.3px}
.h-right{text-align:right}
.h-right .titulo{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
.h-right .subtitulo{font-size:11px;opacity:.8;margin-top:3px}
.h-right .anio{font-size:32px;font-weight:900;color:#93C5FD;font-family:'Courier New',monospace;line-height:1}
.divider{height:5px;background:linear-gradient(90deg,${ACC},#3B82F6,${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:16px 28px}
/* KPI resumen */
.kpis-wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.kpi{background:${LB};border-radius:8px;padding:13px 11px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .ic{font-size:20px;margin-bottom:3px}
.kpi .lb{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.kpi .vl{font-size:14px;font-weight:900}
.kpi .sl{font-size:8.5px;color:#64748B;margin-top:2px}
/* Tabla resumen */
.section-title{font-size:9px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-top:14px}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:12px;font-size:10.5px}
thead th{background:${DARK};color:#fff;padding:8px 10px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:7px 10px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pos{color:#065F46;font-weight:700} .neg{color:#991B1B;font-weight:700} .pag{color:#065F46;font-weight:700} .pend{color:#92400E}
/* Bloque best mes */
.best{background:linear-gradient(135deg,${DARK},${ACC});color:#fff;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:14px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.best .ic{font-size:28px}
.best .lb{font-size:9px;opacity:.75;text-transform:uppercase;letter-spacing:.7px}
.best .nm{font-size:14px;font-weight:800}
.best .vl{font-size:20px;font-weight:900;color:#FCD34D;font-family:'Courier New',monospace}
/* Bloques por mes */
.mes-block{border:1px solid #CBD5E1;border-radius:8px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
.mes-header{background:${DARK};color:#fff;padding:11px 14px;display:flex;align-items:center;gap:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mes-cal{width:44px;height:52px;background:#fff;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.mes-anio{font-size:8px;font-weight:800;color:${ACC};letter-spacing:.4px}
.mes-nombre{font-size:15px;font-weight:900;color:#0F1729;margin-top:2px}
.mes-info{flex:1}
.mes-titulo{font-size:14px;font-weight:800;letter-spacing:-.2px}
.mes-kpis{display:flex;gap:12px;margin-top:5px;flex-wrap:wrap}
.mk{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.12)}
.sec{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.4px;padding:8px 14px 5px;border-bottom:1px solid #E5E7EB;background:#F8FAFC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mes-block table{border:none;margin-bottom:0}
.mes-block thead th{font-size:8px;padding:6px 10px}
.mes-block tbody td{font-size:10px;padding:6px 10px}
/* Footer */
.footer{border-top:2px solid ${DARK};padding:9px 28px;display:flex;justify-content:space-between;font-size:8.5px;color:#64748B;margin-top:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.direccion}</div>
    <div class="ruc">${EMISOR.actividad}</div>
  </div>
  <div class="h-right">
    <div class="titulo">Reporte Anual Detallado</div>
    <div class="subtitulo">Ingresos · Gastos · Utilidad por mes</div>
    <div class="anio">${anio}</div>
    <div class="ruc" style="color:rgba(255,255,255,0.65);margin-top:4px">Generado: ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">

  <div class="section-title">Resumen del año ${anio}</div>
  <div class="kpis-wrap">
    <div class="kpi"><div class="ic">💰</div><div class="lb">Total Cobrado</div><div class="vl" style="color:#065F46">${fmt(totalIng)}</div><div class="sl">Contratos pagados</div></div>
    <div class="kpi"><div class="ic">⏳</div><div class="lb">Por Cobrar</div><div class="vl" style="color:#92400E">${fmt(kpis.pendiente)}</div><div class="sl">Pendientes</div></div>
    <div class="kpi"><div class="ic">💸</div><div class="lb">Total Gastos</div><div class="vl" style="color:#991B1B">${fmt(totalGast)}</div><div class="sl">Todos los gastos</div></div>
    <div class="kpi"><div class="ic">📈</div><div class="lb">Utilidad Neta</div><div class="vl" style="color:${totalUtil>=0?"#065F46":"#991B1B"}">${fmt(totalUtil)}</div><div class="sl">Cobrado − Gastos</div></div>
  </div>

  ${kpis.mesTop?.ingPagado>0?`
  <div class="best">
    <div class="ic">🏆</div>
    <div>
      <div class="lb">Mejor mes del año</div>
      <div class="nm">${mesTopLabel}</div>
      <div class="vl">${mesTopVal}</div>
    </div>
  </div>`:""}

  <div class="section-title">Cuadro consolidado por mes</div>
  <table>
    <thead>
      <tr><th>Mes</th><th style="text-align:center">Contratos</th><th class="num">Cobrado</th><th class="num">Pendiente</th><th class="num">Gastos</th><th class="num">Utilidad</th><th class="num">% Cobro</th></tr>
    </thead>
    <tbody>
      ${filasMeses}
      <tr style="background:#F1F5F9">
        <td><strong>TOTAL ${anio}</strong></td>
        <td style="text-align:center"></td>
        <td class="num pos"><strong>${fmt(totalIng)}</strong></td>
        <td class="num" style="color:#92400E"><strong>${fmt(kpis.pendiente)}</strong></td>
        <td class="num neg"><strong>${fmt(totalGast)}</strong></td>
        <td class="num ${totalUtil>=0?"pos":"neg"}"><strong>${fmt(totalUtil)}</strong></td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Detalle expandido por mes</div>
  ${detalleMeses || `<p style="color:#94A3B8;font-style:italic;text-align:center;padding:20px">No hay datos registrados para ${anio}</p>`}

</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc} · ${EMISOR.ciudad}</span>
  <span>Reporte Anual Detallado ${anio} — Vista360</span>
  <span>Generado ${new Date().toLocaleDateString("es-PE")}</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`;

    const w = window.open("","_blank","width=960,height=750");
    if(w){ w.document.write(html); w.document.close(); }
  };

  // ── EXPORT PDF MES ────────────────────────────────────────────
  const exportMesPDF = (m) => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC  = "#1E4D9B";
    const LB   = "#D6E4F7";
    const ctrsDelMes = contratos
      .map(c=>({...c,panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)}))
      .filter(c=>c.panel&&c.cliente&&c.inicio&&c.fin&&c.inicio.slice(0,7)<=m.mes&&c.fin.slice(0,7)>=m.mes);
    const gastosDelMes = gastos.filter(g=>g.fecha?.startsWith(m.mes));

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte ${mesLabel(m.mes)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .empresa{font-size:18px;font-weight:900} .h-left .ruc{font-size:10px;opacity:.75;margin-top:3px} .h-left .logo-img{height:48px;width:auto;object-fit:contain;margin-bottom:5px;display:block}
.h-right{text-align:right} .h-right .mes-titulo{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.5px} .h-right .anio{font-size:12px;opacity:.75;margin-top:3px}
.divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:16px 28px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
.kpi{background:${LB};border-radius:8px;padding:13px 11px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .lb{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.kpi .vl{font-size:16px;font-weight:900}
.sec{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${ACC};margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:14px}
thead th{background:${DARK};color:#fff;padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:8px 10px;font-size:11px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pag{color:#065F46;font-weight:700} .pend{color:#92400E} .neg{color:#991B1B}
.bar-wrap{background:#E5E7EB;border-radius:4px;height:8px;overflow:hidden;margin-top:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar-fill{height:100%;border-radius:4px;background:${DARK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.footer{border-top:2px solid ${DARK};padding:10px 28px;display:flex;justify-content:space-between;font-size:9px;color:#64748B;margin-top:14px}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.ciudad}</div>
  </div>
  <div class="h-right">
    <div class="mes-titulo">${mesLabel(m.mes)}</div>
    <div class="anio">Reporte Mensual · ${new Date().toLocaleDateString("es-PE")}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">
  <div class="kpis">
    <div class="kpi"><div class="lb">Cobrado</div><div class="vl" style="color:#065F46">${fmt(m.ingPagado)}</div></div>
    <div class="kpi"><div class="lb">Gastos</div><div class="vl" style="color:#991B1B">${fmt(m.gastosMes)}</div></div>
    <div class="kpi"><div class="lb">Utilidad Neta</div><div class="vl" style="color:${m.utilidad>=0?"#065F46":"#991B1B"}">${fmt(m.utilidad)}</div></div>
  </div>
  ${m.ingTotal>0?`<div style="margin-bottom:16px;font-size:11px;color:#475569">Cobrado vs Total Facturado: <strong>${Math.round((m.ingPagado/m.ingTotal)*100)}%</strong> (${fmt(m.ingPagado)} de ${fmt(m.ingTotal)})<div class="bar-wrap"><div class="bar-fill" style="width:${Math.round((m.ingPagado/m.ingTotal)*100)}%"></div></div></div>`:""}

  ${ctrsDelMes.length>0?`
  <div class="sec">Contratos del mes (${ctrsDelMes.length})</div>
  <table>
    <thead><tr><th>Cliente</th><th>Panel</th><th>Estado</th><th class="num">Monto/mes</th><th>Período</th></tr></thead>
    <tbody>
      ${ctrsDelMes.map(c=>`<tr>
        <td><strong>${c.cliente?.empresa||"—"}</strong>${c.cliente?.ruc?`<br/><span style="font-size:9px;color:#64748B">RUC: ${c.cliente.ruc}</span>`:""}</td>
        <td>${c.panel?.nombre||"—"}</td>
        <td class="${c.pagado?"pag":"pend"}">${c.pagado?"✅ Pagado":"⏳ Pendiente"}</td>
        <td class="num">${fmt(c.monto)}</td>
        <td style="font-size:10px;color:#64748B">${fmtF(c.inicio)}<br/>${fmtF(c.fin)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`:"<div style='color:#64748B;font-style:italic;margin-bottom:14px'>Sin contratos en este mes.</div>"}

  ${gastosDelMes.length>0?`
  <div class="sec">Gastos del mes (${gastosDelMes.length})</div>
  <table>
    <thead><tr><th>Descripción</th><th>Categoría</th><th class="num">Monto</th><th>Fecha</th></tr></thead>
    <tbody>
      ${gastosDelMes.map(g=>`<tr>
        <td>${g.descripcion||"—"}</td>
        <td>${g.categoria||"—"}</td>
        <td class="num neg">${fmt(g.monto)}</td>
        <td style="font-size:10px;color:#64748B">${fmtF(g.fecha)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`:""}
</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc}</span>
  <span>Reporte: ${mesLabel(m.mes)}</span>
  <span>Sistema Vista360</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
    const w = window.open("","_blank","width=900,height=700");
    if(w){ w.document.write(html); w.document.close(); }
  };

  // ── Sparkline wave decorativa en cards ───────────────────────
  const CardWave = ({color="#4F7CFF"}) => (
    <svg width="120" height="30" viewBox="0 0 120 30" style={{position:"absolute",bottom:0,right:0,opacity:0.18}} preserveAspectRatio="none">
      <polyline points="0,25 15,18 30,22 45,10 60,15 75,8 90,14 105,6 120,12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{color:C.text}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:"#0F1729",letterSpacing:"-0.5px"}}>
          Reportes & Facturación
        </div>
        <div style={{fontSize:13,color:"#1E3A8A",marginTop:3,fontWeight:600}}>
          Análisis financiero · RUC {EMISOR.ruc} · 8 Millas Huánuco
        </div>
      </div>

      {/* Tabs mejorados */}
      <div style={{
        display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:20,
      }}>
        {secciones.map(s=>{
          const active = seccion === s.id;
          const iconMap = {
            resumen: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
            mensual: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            paneles: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
            prefactura: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
          };
          const labelMap = {resumen:"Resumen",mensual:"Por Mes",paneles:"Paneles",prefactura:"Comprobantes"};
          return (
            <button key={s.id} onClick={()=>setSeccion(s.id)} style={{
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:5,padding:"12px 8px",borderRadius:14,border:"none",cursor:"pointer",
              background:active
                ?"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)"
                :"#FFFFFF",
              color:active?"#FFFFFF":"#1E3A8A",
              fontWeight:active?800:600,fontSize:10.5,transition:"all 0.18s",
              boxShadow:active
                ?"0 4px 20px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.18)"
                :"0 1px 4px rgba(15,23,41,0.08)",
              outline:active?"none":"1px solid #E2E8F0",
              letterSpacing:active?"0.02em":"0",
            }}>
              <div style={{
                width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                background:active?"rgba(255,255,255,0.18)":"rgba(37,99,235,0.08)",
                color:active?"#FFFFFF":"#1E40AF",
                transition:"all 0.18s",
              }}>
                {iconMap[s.id]}
              </div>
              <span style={{whiteSpace:"nowrap"}}>{labelMap[s.id]}</span>
              {active && <div style={{width:18,height:2,borderRadius:2,background:"rgba(255,255,255,0.7)",marginTop:1}}/>}
            </button>
          );
        })}
      </div>

      {/* ════════ RESUMEN ANUAL ════════ */}
      {seccion==="resumen" && (
        <div>
          {/* Selector año + botón exportar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#FFFFFF",borderRadius:14,padding:"6px 10px",boxShadow:"0 1px 4px rgba(15,23,41,0.10)",border:"1px solid #E2E8F0"}}>
              <button onClick={()=>setAnio(a=>a-1)} style={{
                width:32,height:32,borderRadius:8,border:"1px solid #DBEAFE",
                background:"#EFF6FF",color:"#1E40AF",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{fontSize:20,fontWeight:900,color:"#1E3A8A",minWidth:50,textAlign:"center",letterSpacing:"-0.5px"}}>{anio}</div>
              <button onClick={()=>setAnio(a=>a+1)} style={{
                width:32,height:32,borderRadius:8,border:"1px solid #DBEAFE",
                background:"#EFF6FF",color:"#1E40AF",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <button onClick={exportResumenPDF} style={{
              display:"inline-flex",alignItems:"center",gap:8,
              padding:"10px 20px",borderRadius:12,border:"none",
              background:"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
              color:"#FFFFFF",fontWeight:700,fontSize:12.5,cursor:"pointer",
              boxShadow:"0 4px 16px rgba(37,99,235,0.35), 0 1px 3px rgba(37,99,235,0.2)",
              transition:"all 0.18s",letterSpacing:"0.02em",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
              </svg>
              Exportar PDF {anio}
            </button>
          </div>

          {/* KPI Cards (estilo Facturación) */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
            <KPIDark label="Ingresos cobrados" value={fmt(kpis.totalIngPagado)} valueColor="#10B981" sub="Contratos pagados" accent="#10B981" icon={ICN.check}/>
            <KPIDark label="Por cobrar"        value={fmt(kpis.pendiente)}      valueColor="#FFFFFF" sub="Contratos pendientes" accent="#2563EB" icon={ICN.hourglass}/>
            <KPIDark label="Gastos totales"    value={fmt(kpis.totalGastos)}    valueColor="#EF4444" sub="Todos los gastos" accent="#EF4444" icon={ICN.down}/>
            <KPIDark label="Utilidad neta"     value={fmt(kpis.totalUtilidad)}  valueColor={kpis.totalUtilidad>=0?"#10B981":"#EF4444"} sub="Cobrado − Gastos" accent={kpis.totalUtilidad>=0?"#10B981":"#EF4444"} icon={kpis.totalUtilidad>=0?ICN.up:ICN.down}/>
          </div>

          {/* Gráfico barras */}
          <div style={{...cardStyle,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>
                📊 Ingresos Mensuales — Barras
              </div>
              <span style={{background:"rgba(79,124,255,0.15)",color:D.accent,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(79,124,255,0.25)"}}>
                Mensual
              </span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:110,padding:"6px 0 0"}}>
              {mesesAnio.map(m => {
                const hPag = maxIngreso>0 ? Math.max(4,(m.ingPagado/maxIngreso)*100) : 4;
                const hTot = maxIngreso>0 ? Math.max(4,(m.ingTotal/maxIngreso)*100) : 4;
                const isCurrentMonth = m.mes === `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
                return (
                  <div key={m.mes} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:"100%",height:90,position:"relative",display:"flex",alignItems:"flex-end"}}>
                      {/* Barra total (fondo) */}
                      <div style={{position:"absolute",bottom:0,left:0,right:0,
                        height:`${hTot}%`,background:"rgba(79,124,255,0.18)",borderRadius:"4px 4px 0 0"}}/>
                      {/* Barra pagado */}
                      <div style={{position:"absolute",bottom:0,left:"18%",right:"18%",
                        height:`${hPag}%`,
                        background: m.ingPagado>0
                          ? `linear-gradient(180deg,${C.green},${C.green}88)`
                          : "rgba(255,255,255,0.07)",
                        borderRadius:"4px 4px 0 0",
                        boxShadow: m.ingPagado>0 ? `0 0 10px ${C.green}44` : "none"}}/>
                      {isCurrentMonth && (
                        <div style={{position:"absolute",bottom:-3,left:"50%",transform:"translateX(-50%)",
                          width:4,height:4,borderRadius:"50%",background:D.accent}}/>
                      )}
                    </div>
                    <div style={{fontSize:8,color:isCurrentMonth?D.accent:C.muted,fontWeight:700,textTransform:"uppercase"}}>{m.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:10}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:C.green}}/>
                <span style={{fontSize:10,color:C.muted}}>Cobrado</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:"rgba(79,124,255,0.25)",border:"1px solid rgba(79,124,255,0.4)"}}/>
                <span style={{fontSize:10,color:C.muted}}>Facturado (total)</span>
              </div>
            </div>
          </div>

          {/* Mejor mes */}
          {kpis.mesTop&&kpis.mesTop.ingPagado>0&&(
            <div style={{...cardStyle,background:"linear-gradient(135deg,rgba(16,185,129,0.12) 0%,rgba(14,24,42,0.97) 60%)"}}>
              <CardWave color={C.green}/>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:12}}>
                Mejor mes del año
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(16,185,129,0.18)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,
                  border:"1px solid rgba(16,185,129,0.3)"}}>🏆</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(kpis.mesTop.mes)}</div>
                  <div style={{fontSize:24,fontWeight:900,color:C.green,letterSpacing:"-0.5px"}}>{fmt(kpis.mesTop.ingPagado)}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{kpis.mesTop.contrActivos} contrato(s) activos</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ POR MES ════════ */}
      {seccion==="mensual" && (
        <div>
          {/* ── Barra de año con logo 8 Millas ── */}
          <div style={{
            position:"relative",overflow:"hidden",
            background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
            border:"1px solid rgba(79,124,255,0.18)",
            borderRadius:18,padding:"14px 18px",marginBottom:12,
            boxShadow:"0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
          }}>
            <CardWave color="#2563EB"/>
            <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:12}}>
              <div>
                <div style={{fontSize:10,fontWeight:800,color:"#5B7FCC",letterSpacing:1.4}}>DETALLE MENSUAL</div>
                <div style={{fontSize:13,color:"rgba(160,180,220,0.7)",marginTop:2}}>
                  {mesesAnio.filter(m=>m.ingPagado>0||m.gastosMes>0).length} mes(es) con datos
                </div>
              </div>
            </div>
            <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setAnio(a=>a-1)} style={{
                width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",
                background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{fontSize:22,fontWeight:900,color:"#fff",fontFamily:"monospace",letterSpacing:"-0.5px",minWidth:60,textAlign:"center"}}>{anio}</div>
              <button onClick={()=>setAnio(a=>a+1)} style={{
                width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",
                background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
          </div>

          {/* ── Selector rápido de meses ── */}
          <div style={{
            display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5,marginBottom:14,
          }}>
            {mesesAnio.map((m,idx)=>{
              const tieneData = m.ingPagado>0||m.gastosMes>0;
              const mShort = new Date(m.mes+"-02").toLocaleDateString("es-PE",{month:"short"}).toUpperCase().replace(".","");
              const hoyM = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
              const esHoy = m.mes === hoyM;
              return (
                <a key={m.mes} href={`#mes-${m.mes}`} style={{
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  padding:"7px 4px",borderRadius:10,textDecoration:"none",cursor:"pointer",
                  background:esHoy
                    ?"linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.18))"
                    :tieneData
                      ?"rgba(79,124,255,0.1)"
                      :"rgba(255,255,255,0.03)",
                  border:esHoy?"1px solid rgba(16,185,129,0.45)":tieneData?"1px solid rgba(79,124,255,0.2)":"1px solid rgba(255,255,255,0.05)",
                  transition:"all 0.15s",
                }}>
                  <div style={{fontSize:9.5,fontWeight:800,color:"#1E3A8A",letterSpacing:0.4}}>{mShort}</div>
                  {tieneData && <div style={{width:4,height:4,borderRadius:"50%",background:m.utilidad>=0?"#10B981":"#EF4444",marginTop:3}}/>}
                </a>
              );
            })}
          </div>

          {/* ── Botón exportar PDF anual ── */}
          <button onClick={exportAnualMensualPDF} style={{
            width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            padding:"13px 20px",borderRadius:14,marginBottom:14,cursor:"pointer",
            background:"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
            border:"none",
            color:"#FFFFFF",fontWeight:800,fontSize:13,fontFamily:"inherit",
            boxShadow:"0 4px 20px rgba(37,99,235,0.35)",
            transition:"all 0.18s",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
            Generar PDF Anual {anio} — Detalle completo por mes
          </button>

          {/* ── Cards mensuales estilo factura ── */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {mesesAnio.map(m => {
              const monthShort=new Date(m.mes+"-02").toLocaleDateString("es-PE",{month:"short"}).toUpperCase().replace(".","");
              return(
              <div key={m.mes} id={`mes-${m.mes}`} style={{
                position:"relative",overflow:"hidden",
                background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                border:"1px solid rgba(79,124,255,0.14)",
                borderRadius:18,padding:"14px 16px",
                boxShadow:"0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                <CardWave color="#2563EB"/>
                <div style={{position:"relative",zIndex:2}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    {/* Thumbnail mes (blanco) */}
                    <div style={{
                      flexShrink:0,width:50,height:60,borderRadius:8,
                      background:"#FFFFFF",border:"1px solid #E5E7EB",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      boxShadow:"0 2px 6px rgba(0,0,0,0.25)",lineHeight:1,
                    }}>
                      <div style={{fontSize:9,fontWeight:800,color:"#2563EB",letterSpacing:0.6}}>{anio}</div>
                      <div style={{fontSize:17,fontWeight:900,color:"#0F1729",marginTop:3,letterSpacing:"-0.5px"}}>{monthShort}</div>
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      {/* Cabecera */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:15,fontWeight:900,color:"#FFFFFF",letterSpacing:"-0.2px"}}>
                          {mesLabel(m.mes)}
                        </span>
                        <span style={{
                          background:"rgba(37,99,235,0.18)",color:"#7FAEFF",
                          border:"1px solid rgba(37,99,235,0.4)",borderRadius:8,
                          padding:"2px 9px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap",
                        }}>{m.contrActivos} CONTRATO{m.contrActivos!==1?"S":""}</span>
                        <button onClick={()=>exportMesPDF(m)} style={{
                          marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:5,
                          padding:"5px 11px",borderRadius:8,
                          border:"none",
                          background:"linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
                          color:"#FFFFFF",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                          boxShadow:"0 3px 10px rgba(37,99,235,0.35)",
                        }} title={`Exportar PDF de ${mesLabel(m.mes)}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                          </svg>
                          PDF
                        </button>
                      </div>

                      {/* 3 columnas: COBRADO / GASTOS / UTILIDAD */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div>
                          <div style={{fontSize:9,fontWeight:700,color:"#5B7FCC",letterSpacing:0.8}}>COBRADO</div>
                          <div style={{fontSize:13.5,fontWeight:900,color:C.green,fontFamily:"monospace",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{fmt(m.ingPagado)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,fontWeight:700,color:"#5B7FCC",letterSpacing:0.8}}>GASTOS</div>
                          <div style={{fontSize:13.5,fontWeight:900,color:C.red,fontFamily:"monospace",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{fmt(m.gastosMes)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,fontWeight:700,color:"#5B7FCC",letterSpacing:0.8}}>UTILIDAD</div>
                          <div style={{fontSize:13.5,fontWeight:900,color:m.utilidad>=0?C.green:C.red,fontFamily:"monospace",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{fmt(m.utilidad)}</div>
                        </div>
                      </div>

                      {/* Barra de progreso cobrado / facturado */}
                      {m.ingTotal>0&&(
                        <div style={{marginTop:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:9.5,color:"rgba(160,180,220,0.6)",letterSpacing:0.4}}>COBRADO / FACTURADO</span>
                            <span style={{fontSize:9.5,color:"#FFFFFF",fontWeight:700}}>
                              {Math.round((m.ingPagado/m.ingTotal)*100)}%
                            </span>
                          </div>
                          <div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:3,width:`${Math.round((m.ingPagado/m.ingTotal)*100)}%`,
                              background:C.green}}/>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ PANELES ════════ */}
      {seccion==="paneles" && (
        <div>
          <div style={{marginBottom:14,fontSize:13,color:C.muted}}>
            Rentabilidad acumulada por panel — todos los tiempos
          </div>
          {rentPaneles.length===0 ? (
            <div style={{...cardStyle,textAlign:"center",padding:40}}>
              <div style={{fontSize:32,marginBottom:10}}>🖥️</div>
              <div style={{color:C.muted}}>No hay paneles registrados</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {rentPaneles.map((p)=>(
                <div key={p.id} style={{...cardStyle,padding:"16px 18px"}}>
                  <CardWave color={p.utilidad>=0?C.green:C.red}/>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{width:44,height:44,borderRadius:12,
                      background:(p.estado==="Ocupado"?C.red:C.green)+"18",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,
                      border:`1px solid ${(p.estado==="Ocupado"?C.red:C.green)}28`}}>
                      {p.foto||"📡"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:C.white}}>{p.nombre}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:1}}>{p.ciudad} · {p.tipo} · {p.numCtrs} contrato{p.numCtrs!==1?"s":""}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Ocupación</div>
                      <div style={{fontSize:18,fontWeight:800,color:p.ocupPct>60?C.green:p.ocupPct>30?"#FFFFFF":C.red}}>
                        {p.ocupPct}%
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                    {[
                      {l:"Ingresos cobrados",v:fmt(p.ingreso),c:C.green},
                      {l:"Por cobrar",v:fmt(p.pendiente),c:"#FFFFFF"},
                      {l:"Utilidad neta",v:fmt(p.utilidad),c:p.utilidad>=0?C.green:C.red},
                    ].map(({l,v,c})=>(
                      <div key={l} style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"9px 8px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:800,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:10,color:C.muted}}>% ocupación histórica</span>
                      <span style={{fontSize:10,fontWeight:700,color:p.ocupPct>60?C.green:p.ocupPct>30?"#FFFFFF":C.red}}>{p.ocupPct}%</span>
                    </div>
                    <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:`${p.ocupPct}%`,
                        background:p.ocupPct>60?C.green:p.ocupPct>30?"#FFFFFF":C.red}}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════ COMPROBANTES ════════ */}
      {seccion==="prefactura" && (
        <div>
          <div style={{...cardStyle,marginBottom:16,background:"linear-gradient(135deg,rgba(16,185,129,0.12),rgba(14,24,42,0.98))"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{fontSize:28,flexShrink:0}}>🧾</div>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:C.white,marginBottom:4}}>
                  Generar Comprobante PDF
                </div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>
                  Selecciona un contrato → descarga el PDF con tus datos reales del emisor (RUC {EMISOR.ruc}) →
                  listo para enviar al cliente o usar con el Facturador SUNAT.
                </div>
                <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  {["RUC 20615629431","IGV 0% — Ley Amazonía N° 27037","Formato A4 imprimible"].map(t=>(
                    <span key={t} style={{background:"rgba(16,185,129,0.15)",color:C.green,border:"1px solid rgba(16,185,129,0.3)",
                      borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✓ {t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{marginBottom:14,fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>
            Selecciona un contrato para generar el comprobante
          </div>

          {contratosFact.length===0 ? (
            <div style={{...cardStyle,textAlign:"center",padding:40}}>
              <div style={{fontSize:32,marginBottom:10}}>📋</div>
              <div style={{color:C.muted}}>No hay contratos registrados</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {contratosFact.map(c=>(
                <div key={c.id} style={{...cardStyle,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:22,flexShrink:0}}>{c.panel.foto||"📡"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:C.white,marginBottom:2}}>{c.cliente.empresa}</div>
                      <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{c.panel.nombre} · {c.panel.ciudad}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        <span style={{background:"rgba(79,124,255,0.15)",color:D.accent,border:"1px solid rgba(79,124,255,0.3)",
                          borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                          {fmt(c.monto)}/mes
                        </span>
                        <span style={{background:(c.pagado?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.08)"),
                          color:c.pagado?C.green:"#FFFFFF",
                          border:`1px solid ${c.pagado?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.18)"}`,
                          borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                          {c.pagado?"✅ Pagado":"⏳ Pendiente"}
                        </span>
                        {!c.cliente.ruc && (
                          <span style={{background:"rgba(239,68,68,0.15)",color:C.red,border:"1px solid rgba(239,68,68,0.3)",
                            borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>⚠️ Sin RUC</span>
                        )}
                      </div>
                      <div style={{fontSize:11,color:C.muted}}>
                        {fmtF(c.inicio)} → {fmtF(c.fin)}
                      </div>
                    </div>
                    <button
                      onClick={()=>setModalFactura({contrato:c,panel:c.panel,cliente:c.cliente})}
                      style={{flexShrink:0,padding:"9px 14px",
                        background:"linear-gradient(135deg,rgba(79,124,255,0.22),rgba(123,95,255,0.18))",
                        border:"1px solid rgba(79,124,255,0.35)",borderRadius:10,
                        color:C.white,fontWeight:700,fontSize:12,cursor:"pointer",
                        boxShadow:"0 2px 12px rgba(79,124,255,0.2)",
                        transition:"all 0.15s"}}>
                      🧾 Generar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal comprobante */}
      {modalFactura && (
        <ModalPreFactura
          contrato={modalFactura.contrato}
          panel={modalFactura.panel}
          cliente={modalFactura.cliente}
          onClose={()=>setModalFactura(null)}
        />
      )}
    </div>
  );
}

// ── Sidebar icon button ──

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// NUEVA PALETA — Light theme (reemplaza la oscura de arriba)
// Se declara como NL (New Light) para no colisionar con C original
// ══════════════════════════════════════════════════════════════════
const NL = {
  bg:       "#F2F4F8",
  white:    "#FFFFFF",
  text:     "#0D1117",
  muted:    "#6B7280",
  accent:   "#2563EB",
  accentLt: "#EFF4FF",
  green:    "#10B981",
  amber:    "#F59E0B",
  red:      "#EF4444",
  border:   "#E5E7EB",
};

// ══════════════════════════════════════════════════════════════════
// WAVE — mini sparkline decorativa
// ══════════════════════════════════════════════════════════════════
function Wave({ color = "#2563EB", data = [3,4,3,5,4,6,5,7,6,8,7,9] }) {
  const w = 120, h = 30, pad = 2;
  const max = Math.max(...data), min = Math.min(...data);
  const span = Math.max(0.0001, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad*2) / (data.length - 1));
    const y = h - pad - ((v - min) / span) * (h - pad*2);
    return [x, y];
  });
  const d = pts.map((p, i) => `${i?"L":"M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const dArea = d + ` L ${pts[pts.length-1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  const gid = "sp-" + color.replace("#", "");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={dArea} fill={`url(#${gid})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// HERO CARD — dark con ola azul
// ══════════════════════════════════════════════════════════════════
function HeroCard({ panalesLibres, contratos = [], setTab = () => {} }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const fechaHoy = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const fechaCap = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);
  const fmt = (n) => `S/ ${Number(n||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  // bar chart: últimos 6 meses
  const d = new Date();
  const meses6 = [];
  for (let i = 5; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const k = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}`;
    const lbl = dd.toLocaleDateString("es-PE",{month:"short"}).replace(".","");
    const tot = contratos.filter(c => c.inicio?.slice(0,7) <= k && c.fin?.slice(0,7) >= k).reduce((a,c) => a + Number(c.monto||0), 0);
    meses6.push({ k, lbl: lbl.charAt(0).toUpperCase()+lbl.slice(1), v: tot });
  }
  const maxV = Math.max(1, ...meses6.map(m => m.v));
  const ingActual = meses6[meses6.length-1].v;
  const ingPrev   = meses6[meses6.length-2].v;
  const delta     = ingActual - ingPrev;
  const deltaPct  = ingPrev > 0 ? (delta/ingPrev)*100 : 0;
  const positive  = delta >= 0;

  return (
    <div style={{
      position: "relative",
      margin: "-20px -16px 22px",
      padding: "4px 22px 26px",
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      overflow: "hidden",
      background: "linear-gradient(180deg, #0E1A3B 0%, #0E1A3B 40%, #15265A 100%)",
      color: "#fff",
    }}>
      <div aria-hidden style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ position:"absolute", bottom:-120, right:-100, width:380, height:380, borderRadius:"50%", background:"radial-gradient(closest-side, rgba(60,130,255,0.28), rgba(60,130,255,0))", filter:"blur(6px)" }}/>
        <div style={{ position:"absolute", bottom:-80, left:-120, width:280, height:280, borderRadius:"50%", background:"radial-gradient(closest-side, rgba(80,140,255,0.16), rgba(0,0,0,0))" }}/>
      </div>

      {/* header */}
      <div style={{ position:"relative", marginTop:4 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, color:"rgba(200,212,240,0.62)", fontWeight:500 }}>{saludo}, Alan Martínez</div>
          <div style={{ fontSize:30, fontWeight:800, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.02, marginTop:4 }}>Resumen</div>
          <div style={{ fontSize:11.5, color:"rgba(200,212,240,0.55)", marginTop:6 }}>{fechaCap}</div>
        </div>
      </div>

      {/* hero card */}
      <div style={{
        position:"relative", marginTop:20,
        background:"linear-gradient(180deg, rgba(20,32,68,0.92) 0%, rgba(14,24,56,0.92) 100%)",
        border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:20, padding:"16px 16px 18px",
        display:"flex", alignItems:"stretch", gap:14,
        boxShadow:"0 12px 28px -18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{ flex:"1 1 56%", minWidth:0, display:"flex", flexDirection:"column" }}>
          <div style={{ fontSize:12, color:"rgba(200,212,240,0.66)", fontWeight:500 }}>Ingreso del mes</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:6, flexWrap:"wrap" }}>
            <div style={{ fontSize:26, fontWeight:800, color:"#fff", letterSpacing:"-0.03em", lineHeight:1 }}>{fmt(ingActual)}</div>
            <div style={{ fontSize:12, fontWeight:700, color: positive ? "#5BD39A" : "#FF7A8A" }}>{positive?"+":""}{deltaPct.toFixed(1)}%</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
            <span style={{
              fontSize:11, fontWeight:700,
              color: positive ? "#5BD39A" : "#FF7A8A",
              background: positive ? "rgba(91,211,154,0.12)" : "rgba(255,122,138,0.12)",
              border: `1px solid ${positive ? "rgba(91,211,154,0.25)" : "rgba(255,122,138,0.25)"}`,
              padding:"3px 8px", borderRadius:999,
            }}>{positive?"+":"-"}{fmt(Math.abs(delta))}</span>
            <span style={{ fontSize:11, color:"rgba(200,212,240,0.55)" }}>vs mes anterior</span>
          </div>
          <div style={{ flex:1 }}/>
          <button onClick={() => setTab("contratos")} style={{
            marginTop:14, alignSelf:"flex-start",
            display:"inline-flex", alignItems:"center", gap:6,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
            color:"#fff", borderRadius:999, padding:"7px 12px",
            fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            Ver contratos
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>

        <div style={{ flex:"1 1 44%", minWidth:0, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background:"rgba(29,107,255,0.18)", border:"1px solid rgba(127,174,255,0.35)",
              color:"#BDD2FF", borderRadius:999, padding:"4px 10px",
              fontSize:11, fontWeight:600,
            }}>
              6 meses
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div style={{ flex:1, marginTop:10, display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:5, height:90 }}>
            {meses6.map((m,i) => {
              const isHi = i >= meses6.length-3;
              const h = (m.v/maxV)*100;
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, minWidth:0 }}>
                  <div style={{
                    width:"68%", height:`${Math.max(h,6)}%`, minHeight:5, borderRadius:4,
                    background: isHi ? "linear-gradient(180deg,#4A8CFF 0%,#1D6BFF 100%)" : "rgba(255,255,255,0.08)",
                    boxShadow: isHi ? "0 0 14px rgba(29,107,255,0.45)" : "none",
                  }}/>
                  <div style={{ fontSize:9, fontWeight:600, color: isHi ? "rgba(189,210,255,0.95)" : "rgba(200,212,240,0.45)", letterSpacing:0.4, textTransform:"uppercase" }}>{m.lbl}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// METRIC CARD
// ══════════════════════════════════════════════════════════════════
function MetricCardNL({ icon, label, value, sub, waveColor, valueColor }) {
  return (
    <div style={{ background: NL.white, borderRadius: 18, padding: "14px 12px 12px", minWidth: 0, border: `1px solid ${NL.border}`, boxShadow: "0 1px 0 rgba(16,22,40,0.02), 0 6px 24px -16px rgba(16,22,40,0.18)", display: "flex", flexDirection: "column" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 12, color: NL.text, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: valueColor || NL.text, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 11, color: NL.muted, marginTop: 6, lineHeight: 1.35, minHeight: 28 }}>{sub}</div>
      <div style={{ marginTop: 4, marginLeft: -2, marginRight: -2 }}><Wave color={waveColor || NL.accent} /></div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ACCIONES RECOMENDADAS
// ══════════════════════════════════════════════════════════════════
function AccionesCard({ panalesLibres, setTab }) {
  if (panalesLibres === 0) return null;
  return (
    <div style={{ background: "#0D1020", borderRadius: 20, padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA", letterSpacing: 1.5, textTransform: "uppercase" }}>Acciones recomendadas</span>
        <button style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver todas ›</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Asignar panel a cliente</span>
            <span style={{ background: "rgba(29,107,255,0.18)", color: "#7FAEFF", border: "1px solid rgba(127,174,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 0.6, padding: "2px 7px", borderRadius: 6 }}>ALTA</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Tienes {panalesLibres} paneles listos para asignar.</div>
        </div>
        <button onClick={() => setTab("paneles")} style={{ background: "#2563EB", border: "none", borderRadius: 50, padding: "9px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          Asignar ahora ›
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ACTIVIDAD RECIENTE (basada en datos reales)
// ══════════════════════════════════════════════════════════════════
function ActividadReciente({ contratos, clientes, paneles }) {
  // Construir actividad desde datos reales
  const items = [];
  [...contratos]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3)
    .forEach(c => {
      const cl = clientes.find(x => x.id === c.cliente_id);
      const ts = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time = diff === null ? "" : diff < 24 ? `Hace ${diff}h` : `Hace ${Math.floor(diff/24)}d`;
      items.push({ icon: "📄", bg: "#EFF4FF", title: "Contrato creado", sub: cl?.empresa || "—", time });
    });
  [...clientes]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 2)
    .forEach(cl => {
      const ts = cl.createdAt?.seconds ? new Date(cl.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time = diff === null ? "" : diff < 24 ? `Hace ${diff}h` : `Hace ${Math.floor(diff/24)}d`;
      items.push({ icon: "👤", bg: "#EFF4FF", title: "Nuevo cliente agregado", sub: cl.empresa || cl.nombre || "—", time });
    });
  const sorted = items.slice(0, 4);

  return (
    <div style={{ background: NL.white, borderRadius: 20, padding: "18px 16px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: NL.accent, letterSpacing: 1.5, textTransform: "uppercase" }}>Actividad reciente</span>
        <button style={{ background: "none", border: "none", color: NL.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver todas ›</button>
      </div>
      {sorted.length === 0 && <div style={{ color: NL.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Sin actividad reciente</div>}
      {sorted.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < sorted.length - 1 ? `1px solid ${NL.border}` : "none" }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{a.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NL.text }}>{a.title}</div>
            <div style={{ fontSize: 12, color: NL.muted }}>{a.sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: NL.muted }}>{a.time}</span>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke={NL.muted} strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// RESUMEN HOY — nuevo diseño con datos reales
// ══════════════════════════════════════════════════════════════════
function ResumenNuevo({ clientes, contratos, paneles, gastos, setTab }) {
  const panalesLibres = paneles.filter(p => !p.clienteId && p.estado !== "Inactivo").length;
  const ingreso = contratos
    .filter(c => c.estado === "Activo")
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const porcobrar = contratos.filter(c => c.estado === "Por vencer").reduce((s, c) => s + Number(c.monto || 0), 0);
  const vencenProx = contratos.filter(c => {
    if (!c.fin) return false;
    const d = Math.ceil((new Date(c.fin) - new Date()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;
  const fmtS = n => `$${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`;

  const iDollar = <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2V22M17 5H9.5C8.12 5 7 6.12 7 7.5S8.12 10 9.5 10h5C15.88 10 17 11.12 17 12.5S15.88 15 14.5 15H7" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;
  const iPanels = <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2"/></svg>;
  const iClock  = <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/><path d="M12 7V12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;
  const iCal    = <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M3 9H21M8 2V6M16 2V6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;

  return (
    <div style={{ paddingBottom: 32 }}>
      <HeroCard panalesLibres={panalesLibres} contratos={contratos} setTab={setTab} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <MetricCardNL icon={iDollar} label="Ingreso del mes" value={fmtS(ingreso)} sub={`${contratos.filter(c=>c.estado==="Activo").length} de ${contratos.length} contratos`} waveColor="#2563EB"/>
        <MetricCardNL icon={iPanels} label="Paneles libres"  value={panalesLibres} valueColor={NL.accent} sub="Listos para asignar" waveColor="#2563EB"/>
        <MetricCardNL icon={iClock}  label="Por cobrar"      value={fmtS(porcobrar)} valueColor={NL.accent} sub={`${contratos.filter(c=>c.estado==="Por vencer").length} de ${contratos.length} contratos`} waveColor="#2563EB"/>
        <MetricCardNL icon={iCal}    label="Vencen pronto"   value={vencenProx} sub="Próximos 30 días" waveColor="#2563EB"/>
      </div>
      <AccionesCard panalesLibres={panalesLibres} setTab={setTab} />
      <ActividadReciente contratos={contratos} clientes={clientes} paneles={paneles} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DRAWER — menú lateral
// ══════════════════════════════════════════════════════════════════
const MENU_DRAWER = [
  { id: "mapa",         label: "Mapa"         },
  { id: "historico",    label: "Histórico"    },
  { id: "resultados",   label: "Resultados"   },
  { id: "reportes",     label: "Reportes"     },
  { id: "gastos",       label: "Gastos"       },
  { id: "proveedores",  label: "Proveedores"  },
  { id: "facturacion",  label: "Facturación"  },
];

// ── Íconos SVG del drawer (estilo trazo fino, azul Vista360) ─────
const DRAWER_ICONS = {
  mapa: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z"/>
      <line x1="9"  y1="4" x2="9"  y2="18"/>
      <line x1="15" y1="6" x2="15" y2="20"/>
    </svg>
  ),
  historico: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8"  y1="3" x2="8"  y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
      <text x="12" y="17.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="DM Sans, sans-serif">17</text>
    </svg>
  ),
  resultados: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 6"/>
      <polyline points="15 6 21 6 21 12"/>
    </svg>
  ),
  reportes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3 H7 a2 2 0 0 0 -2 2 V19 a2 2 0 0 0 2 2 H17 a2 2 0 0 0 2 -2 V8 Z"/>
      <polyline points="14 3 14 8 19 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  gastos: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7 a2 2 0 0 1 2 -2 H17 a2 2 0 0 1 2 2"/>
      <rect x="3" y="7" width="18" height="13" rx="2.5"/>
      <path d="M16 14 H21"/>
      <circle cx="17.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  proveedores: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  facturacion: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3 V21 L8.5 19.5 L11 21 L13 19.5 L15 21 L17.5 19.5 L20 21 V3 L17.5 4.5 L15 3 L13 4.5 L11 3 L8.5 4.5 Z"/>
      <line x1="9"  y1="9"  x2="17" y2="9"/>
      <line x1="9"  y1="13" x2="17" y2="13"/>
      <line x1="9"  y1="17" x2="14" y2="17"/>
    </svg>
  ),
};


// ══════════════════════════════════════════════════════════════════
// 🔍 BÚSQUEDA GLOBAL
// ══════════════════════════════════════════════════════════════════
function BusquedaGlobal({ open, onClose, paneles, clientes, contratos, onNavigate }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 80); setQ(""); }
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const resultados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    if (texto.length < 2) return [];
    const res = [];

    paneles.forEach(p => {
      const haystack = [p.nombre, p.ubicacion, p.ciudad, p.tipo].join(" ").toLowerCase();
      if (haystack.includes(texto)) {
        const contratosPanel = contratos.filter(c => c.panel_id === p.id);
        const activo = contratosPanel.some(c => c.estado === "Activo");
        res.push({ tipo: "panel", id: p.id, titulo: p.nombre, sub: `${p.ciudad || ""}${p.ubicacion ? " · " + p.ubicacion : ""}`, tag: activo ? "Activo" : "Libre", tagColor: activo ? "#10B981" : "#64748B", tab: "paneles" });
      }
    });

    clientes.forEach(c => {
      const haystack = [c.empresa, c.contacto, c.celular, c.email, c.ciudad, c.ruc].join(" ").toLowerCase();
      if (haystack.includes(texto)) {
        res.push({ tipo: "cliente", id: c.id, titulo: c.empresa, sub: `${c.contacto || ""}${c.ciudad ? " · " + c.ciudad : ""}`, tag: c.tipo, tagColor: c.tipo === "Cliente" ? "#10B981" : "#2563EB", tab: "crm" });
      }
    });

    contratos.forEach(ct => {
      const panel   = paneles.find(p => p.id === ct.panel_id);
      const cliente = clientes.find(c => c.id === ct.cliente_id);
      const haystack = [ct.concepto, panel?.nombre, cliente?.empresa, ct.estado, ct.monto?.toString()].join(" ").toLowerCase();
      if (haystack.includes(texto)) {
        const dRestantes = Math.ceil((new Date(ct.fin) - new Date()) / 86400000);
        const tagColor = ct.estado === "Activo" ? "#10B981" : ct.estado === "Por vencer" ? "#FFFFFF" : "#EF4444";
        res.push({ tipo: "contrato", id: ct.id, titulo: `${panel?.nombre || "Panel"} — ${cliente?.empresa || "Cliente"}`, sub: `S/ ${Number(ct.monto || 0).toLocaleString("es-PE")} · vence ${ct.fin ? new Date(ct.fin).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}`, tag: ct.estado || "—", tagColor, tab: "contratos" });
      }
    });

    return res.slice(0, 20);
  }, [q, paneles, clientes, contratos]);

  const grupos = useMemo(() => {
    const g = {};
    resultados.forEach(r => {
      if (!g[r.tipo]) g[r.tipo] = [];
      g[r.tipo].push(r);
    });
    return g;
  }, [resultados]);

  const iconoPor = { panel: "📡", cliente: "🏢", contrato: "📄" };
  const labelPor = { panel: "Paneles", cliente: "Clientes", contrato: "Contratos" };

  if (!open) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "max(60px, env(safe-area-inset-top))", padding: "max(60px, env(safe-area-inset-top)) 16px 0" }}
    >
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 0, maxHeight: "80vh" }}>

        {/* Barra de búsqueda */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 18, padding: "12px 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0, color: "#64748B" }}>
            <path d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar paneles, clientes, contratos…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, color: "#0F1729", background: "transparent", fontFamily: "'DM Sans',sans-serif" }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6L18 18" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          )}
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "4px 10px", color: "#64748B", fontSize: 12, cursor: "pointer", flexShrink: 0, fontFamily: "'DM Sans',sans-serif" }}>Esc</button>
        </div>

        {/* Resultados */}
        {q.length >= 2 && (
          <div style={{ background: "#fff", borderRadius: 16, marginTop: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflowY: "auto" }}>
            {resultados.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#64748B", fontSize: 14 }}>
                Sin resultados para <strong style={{ color: "#0F1729" }}>"{q}"</strong>
              </div>
            ) : (
              Object.entries(grupos).map(([tipo, items]) => (
                <div key={tipo}>
                  <div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1.2, borderTop: "1px solid #F1F5F9" }}>
                    {iconoPor[tipo]} {labelPor[tipo]} ({items.length})
                  </div>
                  {items.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { onNavigate(r.tab); onClose(); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderTop: "1px solid #F8FAFC" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {iconoPor[tipo]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0F1729", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.titulo}</div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sub}</div>
                      </div>
                      <span style={{ background: r.tagColor + "18", color: r.tagColor, border: `1px solid ${r.tagColor}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{r.tag}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sugerencias cuando está vacío */}
        {q.length < 2 && (
          <div style={{ background: "#fff", borderRadius: 16, marginTop: 8, padding: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Accesos rápidos</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Ver paneles", emoji: "📡", tab: "paneles" },
                { label: "Ver contratos", emoji: "📄", tab: "contratos" },
                { label: "Ver clientes", emoji: "🏢", tab: "crm" },
                { label: "Facturación", emoji: "🧾", tab: "facturacion" },
              ].map(a => (
                <button key={a.tab} onClick={() => { onNavigate(a.tab); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0F1729", fontFamily: "'DM Sans',sans-serif" }}>
                  <span style={{ fontSize: 18 }}>{a.emoji}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerMenu({ open, onClose, activeTab, onTabClick }) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: 0,
            background: "rgba(15,23,41,0.45)",
            zIndex: 200,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}
      <div style={{
        position: "absolute",
        top: 0, left: 0, bottom: 0,
        width: 300,
        background: "#FFFFFF",
        zIndex: 201,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
        boxShadow: open ? "4px 0 32px rgba(0,0,0,0.12)" : "none",
        display: "flex", flexDirection: "column",
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "env(safe-area-inset-bottom)",
        overflow: "hidden",
      }}>

        {/* ── Perfil de usuario ── */}
        <button
          onClick={() => { onTabClick("perfil"); onClose(); }}
          style={{
            padding: "16px 22px 20px",
            background: "none", border: "none",
            cursor: "pointer", textAlign: "left",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFFFFF", fontWeight: 800, fontSize: 17,
              flexShrink: 0,
              letterSpacing: "0.5px",
              boxShadow: "0 10px 24px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}>
              AM
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0F1729", letterSpacing: "-0.3px" }}>
                Alan Martínez
              </div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2, fontWeight: 500 }}>
                Dueño · 8 Millas
              </div>
            </div>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ opacity: 0.32, flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" stroke="#0F1729" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        {/* ── Items del menú ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 8px" }}>
          {MENU_DRAWER.map((item, idx) => {
            const active = activeTab === item.id;
            const nextActive = idx < MENU_DRAWER.length - 1 && activeTab === MENU_DRAWER[idx + 1]?.id;
            const showDivider = idx < MENU_DRAWER.length - 1 && !active && !nextActive;
            return (
              <div key={item.id}>
                <button
                  onClick={() => { onTabClick(item.id); onClose(); }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "10px 12px",
                    margin: "2px 0",
                    borderRadius: 16,
                    background: active
                      ? "linear-gradient(90deg, #DBE7FF 0%, #ECF2FF 100%)"
                      : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.18s ease",
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: active ? "#FFFFFF" : "#F5F7FB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: active ? "#2563EB" : "#1E3A8A",
                    flexShrink: 0,
                    boxShadow: active
                      ? "0 4px 12px rgba(37,99,235,0.18), inset 0 0 0 1px rgba(37,99,235,0.10)"
                      : "inset 0 0 0 1px rgba(15,23,41,0.04)",
                    transition: "all 0.18s ease",
                  }}>
                    {DRAWER_ICONS[item.id]}
                  </div>
                  <span style={{
                    fontSize: 16,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#2563EB" : "#0F1729",
                    flex: 1, textAlign: "left",
                    letterSpacing: "-0.2px",
                  }}>
                    {item.label}
                  </span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ opacity: active ? 0.6 : 0.32, flexShrink: 0 }}>
                    <path
                      d="M9 18l6-6-6-6"
                      stroke={active ? "#2563EB" : "#0F1729"}
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {showDivider && (
                  <div style={{ height: 1, background: "#F1F3F8", margin: "0 18px" }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          position: "relative",
          padding: "8px 0 18px",
          marginTop: "auto",
          flexShrink: 0,
        }}>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// BOTTOM TAB BAR ICONS
// ══════════════════════════════════════════════════════════════════
const BTM_ICONS = {
  hoy:       <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  paneles:   <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>,
  contratos: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  crm:       <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
};

const BOTTOM_TABS_LIST = [
  { id: "hoy",       label: "Inicio" },
  { id: "paneles",   label: "Paneles" },
  { id: "__add__",   label: "" },
  { id: "contratos", label: "Contratos" },
  { id: "crm",       label: "Clientes" },
];

// ══════════════════════════════════════════════════════════════════
// 🔐 LOGIN — Pantalla de inicio de sesión con Google
// ══════════════════════════════════════════════════════════════════
// Lista de emails autorizados. Si está vacía, cualquier usuario Google entra.
// Para restringir acceso, agrega aquí tus emails: ["alan@gmail.com", "otro@gmail.com"]
const ALLOWED_EMAILS = [
  "armn.11155@gmail.com", // Alan — Dueño
];

function LoginScreen({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Whitelist check (solo si ALLOWED_EMAILS tiene elementos)
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
        await signOut(auth);
        setError(`Acceso denegado. El email ${user.email} no está autorizado.`);
        setLoading(false);
        return;
      }

      onLoginSuccess(user);
    } catch (err) {
      console.error("Error login Google:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana de Google antes de terminar.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Tu navegador bloqueó la ventana. Permite popups e intenta de nuevo.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google Sign-In no está habilitado en Firebase. Activa el método en Firebase Console → Authentication.");
      } else {
        setError("Error: " + (err.message || "no se pudo iniciar sesión"));
      }
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
      background: "linear-gradient(160deg, #0A0F1E 0%, #131D30 50%, #0A0F1E 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      zIndex: 998, padding: 24,
    }}>
      {/* Halos decorativos */}
      <div style={{
        position: "absolute", top: "-20%", right: "-15%",
        width: "60%", height: "60%",
        background: "radial-gradient(ellipse, rgba(37,99,235,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute", bottom: "-15%", left: "-10%",
        width: "55%", height: "50%",
        background: "radial-gradient(ellipse, rgba(37,99,235,0.14) 0%, transparent 70%)",
        pointerEvents: "none",
      }}/>

      {/* Logo */}
      <div style={{ marginBottom: 32, position: "relative", filter: "drop-shadow(0 0 40px rgba(37,99,235,0.35))" }}>
        <Logo360 width={260}/>
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 14, fontWeight: 600,
        color: "rgba(255,255,255,0.65)",
        letterSpacing: 4, textTransform: "uppercase",
        marginBottom: 56, textAlign: "center",
      }}>
        Gestión de Paneles Publicitarios
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: 22,
        padding: "32px 28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        position: "relative",
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", textAlign: "center", marginBottom: 8, letterSpacing: "-0.5px" }}>
          Bienvenido
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Inicia sesión con tu cuenta de Google para acceder a Vista360
        </div>

        {/* Botón Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: loading ? "rgba(255,255,255,0.5)" : "#FFFFFF",
            color: "#0F1729",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            transition: "all 0.2s",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {/* Logo de Google */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          {loading ? "Iniciando sesión..." : "Continuar con Google"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            color: "#FCA5A5",
            fontSize: 12,
            lineHeight: 1.4,
            textAlign: "center",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          color: "rgba(255,255,255,0.35)",
          textAlign: "center",
          lineHeight: 1.6,
        }}>
          Acceso seguro vía Google OAuth<br/>
          8 Millas · Publicidad Exterior
        </div>
      </div>

      {/* Versión */}
      <div style={{
        position: "absolute", bottom: 24,
        fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center",
      }}>
        Vista360 v1.0 · © 2026
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CENTRO DE NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════
function NotifPanel({ open, onClose, contratos, clientes, paneles, gastos }) {
  const [leidas, setLeidas] = useState({});
  const [filtro, setFiltro] = useState("todas");

  const notifs = useMemo(() => {
    const hoyD = new Date();
    const lista = [];

    // Contratos por vencer (próximos 30 días)
    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin) - hoyD) / 86400000);
      if (d > 0 && d <= 30) {
        const cliente = clientes.find(cl => cl.id === c.cliente_id);
        const panel   = paneles.find(p => p.id === c.panel_id);
        lista.push({
          id: `cv_${c.id}`, tipo: "contrato",
          titulo: `Contrato por vencer — ${cliente?.empresa || "Cliente"}`,
          desc: `Vence en ${d} día${d===1?"":"s"}. Panel: ${panel?.nombre || "—"} · ${fmt(c.monto)}/mes`,
          tiempo: `En ${d} días`,
        });
      }
    });

    // Facturas sin pagar
    contratos.filter(c => !c.pagado && c.monto > 0).forEach(c => {
      const cliente = clientes.find(cl => cl.id === c.cliente_id);
      lista.push({
        id: `fp_${c.id}`, tipo: "factura",
        titulo: `Factura pendiente — ${cliente?.empresa || "Cliente"}`,
        desc: `${fmt(c.monto)} sin registrar como pagado.`,
        tiempo: "Pendiente",
      });
    });

    // Paneles sin contrato activo
    paneles.forEach(p => {
      const tieneActivo = contratos.some(c =>
        c.panel_id === p.id && new Date(c.fin) > hoyD
      );
      if (!tieneActivo) {
        lista.push({
          id: `pl_${p.id}`, tipo: "panel",
          titulo: `Panel libre — ${p.nombre}`,
          desc: "Sin contrato activo. Oportunidad de venta.",
          tiempo: "Disponible",
        });
      }
    });

    // Clientes inactivos (sin contratos en los últimos 90 días)
    clientes.forEach(cl => {
      const tieneReciente = contratos.some(c =>
        c.cliente_id === cl.id &&
        Math.ceil((hoyD - new Date(c.fin)) / 86400000) < 90
      );
      if (!tieneReciente) {
        lista.push({
          id: `ci_${cl.id}`, tipo: "cliente",
          titulo: `Cliente inactivo — ${cl.empresa}`,
          desc: "Sin contratos en los últimos 3 meses.",
          tiempo: "+90 días",
        });
      }
    });

    // Meta mensual alcanzada (meta: S/ 10,000)
    const mesHoyKey = `${hoyD.getFullYear()}-${String(hoyD.getMonth()+1).padStart(2,"0")}`;
    const ingresoMes = contratos
      .filter(c => c.pagado && (c.inicio||"").startsWith(mesHoyKey))
      .reduce((a, c) => a + Number(c.monto||0), 0);
    if (ingresoMes >= 10000) {
      lista.push({
        id: "meta_mes", tipo: "meta",
        titulo: "Meta mensual alcanzada",
        desc: `Superaste ${fmt(ingresoMes)} este mes.`,
        tiempo: "Este mes",
      });
    }

    return lista.slice(0, 20);
  }, [contratos, clientes, paneles]);

  const CFG = {
    contrato: { icon: "ti-calendar-x",   bg: "#FAEEDA", ic: "#854F0B", dot: "#EF9F27" },
    factura:  { icon: "ti-file-invoice",  bg: "#FCEBEB", ic: "#A32D2D", dot: "#E24B4A" },
    panel:    { icon: "ti-ad-2",          bg: "#E6F1FB", ic: "#185FA5", dot: "#378ADD" },
    cliente:  { icon: "ti-user-off",      bg: "#FAEEDA", ic: "#854F0B", dot: "#EF9F27" },
    meta:     { icon: "ti-trophy",        bg: "#EAF3DE", ic: "#3B6D11", dot: "#639922" },
  };

  const visibles   = filtro === "todas" ? notifs : notifs.filter(n => n.tipo === filtro);
  const noLeidas   = notifs.filter(n => !leidas[n.id]).length;
  const marcarTodas = () => { const t = {}; notifs.forEach(n => { t[n.id] = true; }); setLeidas(t); };

  if (!open) return null;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 500, background: "rgba(0,0,0,0.3)" }}>
      <div style={{
        position: "absolute",
        top: "max(64px, env(safe-area-inset-top))",
        right: 12,
        width: "min(360px, calc(100vw - 24px))",
        background: NL.white,
        borderRadius: 20,
        border: `1px solid ${NL.border}`,
        maxHeight: "72vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: `1px solid ${NL.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NL.text }}>Notificaciones</span>
            {noLeidas > 0 && (
              <span style={{ background: NL.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 7px" }}>
                {noLeidas}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {noLeidas > 0 && (
              <button onClick={marcarTodas} style={{ fontSize: 11, color: NL.muted, background: "none", border: "none", cursor: "pointer", padding: "3px 6px" }}>
                Marcar leídas
              </button>
            )}
            <button onClick={onClose} style={{ background: NL.border, border: "none", borderRadius: 8, padding: "4px 10px", color: NL.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", borderBottom: `1px solid ${NL.border}`, flexShrink: 0 }}>
          {["todas","contrato","factura","panel","cliente","meta"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: "4px 11px", borderRadius: 99,
              border: `1px solid ${filtro===f ? NL.accent : NL.border}`,
              background: filtro===f ? NL.accent : "transparent",
              color: filtro===f ? "#fff" : NL.muted,
              fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {{ todas:"Todas", contrato:"Contratos", factura:"Facturas", panel:"Paneles", cliente:"Clientes", meta:"Metas" }[f]}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 10px" }}>
          {visibles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: NL.muted, fontSize: 13 }}>
              Sin notificaciones
            </div>
          ) : visibles.map(n => {
            const cfg = CFG[n.tipo] || CFG.contrato;
            const isLeida = !!leidas[n.id];
            return (
              <div key={n.id}
                onClick={() => setLeidas(l => ({ ...l, [n.id]: true }))}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 8px", borderRadius: 12, marginBottom: 4,
                  background: isLeida ? "transparent" : NL.bg,
                  cursor: "pointer", opacity: isLeida ? 0.45 : 1,
                  transition: "opacity .15s",
                }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>
                  <i className={`ti ${cfg.icon}`} style={{ color: cfg.ic }} aria-hidden="true"/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NL.text, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.titulo}</div>
                  <div style={{ fontSize: 11, color: NL.muted, lineHeight: 1.4 }}>{n.desc}</div>
                  <div style={{ fontSize: 10, color: NL.muted, marginTop: 3 }}>{n.tiempo}</div>
                </div>
                {!isLeida && <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 5 }}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT — nuevo diseño + lógica Firebase original
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [splash, setSplash]         = useState(true);
  const [user, setUser]             = useState(null);   // Firebase Auth user
  const [authReady, setAuthReady]   = useState(false);  // true cuando ya sabemos si hay sesión o no
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab]               = useState("hoy");

  // Actualizar <meta theme-color> dinámicamente para que la barra de estado iOS/Android
  // matchee el color del header (navy en Inicio, claro en el resto)
  useEffect(() => {
    const navy = (tab === "hoy" && !showProfile);
    const color = navy ? "#0E1A3B" : "#F2F4F8";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
    document.documentElement.style.background = color;
    document.body.style.background = color;
  }, [tab, showProfile]);
  const [clientes, setClientes]     = useState([]);
  const [paneles, setPaneles]       = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [gastos, setGastos]         = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoScan, setAutoScan]     = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

  const swRef = useRef(null);

  // ── Auth: detectar usuario ya logueado al cargar ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Whitelist check si el usuario ya estaba logueado y se restringe
      if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email)) {
        signOut(auth);
        setUser(null);
      } else {
        setUser(u);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ── Service Worker para push notifications ──
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const SW = `
      self.addEventListener("install", e => self.skipWaiting());
      self.addEventListener("activate", e => e.waitUntil(clients.claim()));
      self.addEventListener("notificationclick", e => {
        e.notification.close();
        e.waitUntil(clients.matchAll({type:"window"}).then(list => {
          if (list.length) return list[0].focus();
          return clients.openWindow("/");
        }));
      });
    `;
    const blob = new Blob([SW], { type: "application/javascript" });
    const url  = URL.createObjectURL(blob);
    navigator.serviceWorker.register(url)
      .then(reg => { swRef.current = reg; URL.revokeObjectURL(url); })
      .catch(() => {});
  }, []);

  // ── Notificaciones de vencimiento ──
  useEffect(() => {
    if (!contratos.length || !paneles.length || !clientes.length) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const hoyD = new Date();
    let enviadas = {};
    try { enviadas = JSON.parse(localStorage.getItem("v360_notif") || "{}"); } catch {}
    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin) - hoyD) / 86400000);
      [30, 15].forEach(umbral => {
        if (d > 0 && d <= umbral) {
          const key = `${c.id}_${umbral}`;
          if (enviadas[key]) return;
          const panel   = paneles.find(p => p.id === c.panel_id);
          const cliente = clientes.find(cl => cl.id === c.cliente_id);
          if (!panel || !cliente) return;
          const titulo = d <= 5
            ? `🚨 Vence en ${d} día${d===1?"":"s"} — ${panel.nombre}`
            : `⚠️ Vence en ${d} días — ${panel.nombre}`;
          const cuerpo = `Cliente: ${cliente.empresa} · ${fmt(c.monto)}/mes`;
          try {
            if (swRef.current?.showNotification) {
              swRef.current.showNotification(titulo, { body: cuerpo, tag: key, icon: "/favicon.ico", badge: "/favicon.ico", vibrate: [200, 100, 200], requireInteraction: d <= 5 });
            } else {
              new Notification(titulo, { body: cuerpo, tag: key });
            }
            enviadas[key] = true;
          } catch {}
        }
      });
    });
    try { localStorage.setItem("v360_notif", JSON.stringify(enviadas)); } catch {}
  }, [contratos, paneles, clientes]);

  // ── Carga de datos Firebase (solo cuando hay usuario logueado) ──
  useEffect(() => {
    if (!user) return;  // No cargar nada hasta que el usuario inicie sesión
    setLoading(true);
    Promise.all([
      fb.get("clientes"),
      fb.get("paneles"),
      fb.get("contratos"),
      fb.get("gastos"),
      fb.get("proveedores"),
    ]).then(([c, p, ct, g, pr]) => {
      // Filtrar registros marcados como eliminados (borrado lógico)
      setClientes(Array.isArray(c)  ? c.filter(x => !x.deleted)  : []);
      setPaneles(Array.isArray(p)   ? p                           : []); // paneles: borrado físico
      setContratos(Array.isArray(ct)? ct.filter(x => !x.deleted) : []);
      setGastos(Array.isArray(g) ? g : []);
      setProveedores(Array.isArray(pr) ? pr.filter(x => !x.deleted) : []);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [user]);

  const activeTab = showProfile ? "perfil" : tab;

  function handleTabClick(id) {
    if (id === "perfil") { setShowProfile(true); setTab("hoy"); }
    else { setTab(id); setShowProfile(false); }
  }

  const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  function renderContent() {
    if (showProfile) {
      const userName  = user?.displayName || "Alan Martínez";
      const userEmail = user?.email || "";
      const userPhoto = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=64&bold=true`;
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "20px", background: "linear-gradient(135deg,#0E1835,#0A1228)", borderRadius: 20, border: "1px solid rgba(59,110,248,0.2)", boxShadow: "0 4px 32px rgba(0,0,0,0.5)" }}>
            <img src={userPhoto} style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #3B82F6" }} alt="perfil"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{userName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Dueño · 8 Millas</div>
              {userEmail && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>}
            </div>
          </div>

          {/* Botón cerrar sesión */}
          <button
            onClick={() => setConfirmLogout(true)}
            style={{
              width: "100%", padding: "14px 18px", marginBottom: 24,
              background: "#FFFFFF", color: NL.red,
              border: `1px solid ${NL.red}33`, borderRadius: 14,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NL.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>

          {confirmLogout && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(4px)"}}>
              <div style={{background:NL.white,borderRadius:20,padding:28,width:"100%",maxWidth:320,textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>👋</div>
                <div style={{fontSize:17,fontWeight:800,color:NL.text,marginBottom:8}}>¿Cerrar sesión?</div>
                <div style={{fontSize:13,color:NL.muted,marginBottom:24}}>Tendrás que volver a iniciar sesión con Google.</div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setConfirmLogout(false)} style={{flex:1,padding:"12px",background:"transparent",border:`1px solid ${NL.border}`,borderRadius:12,fontWeight:600,fontSize:14,cursor:"pointer",color:NL.muted}}>Cancelar</button>
                  <button onClick={async()=>{ await signOut(auth); setUser(null); setShowProfile(false); setConfirmLogout(false); }} style={{flex:1,padding:"12px",background:NL.red,border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",color:"#fff"}}>Salir</button>
                </div>
              </div>
            </div>
          )}

          <Firebase contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos} fbConnected={!error && !loading} fbLoading={loading} fbError={!!error}/>
        </div>
      );
    }
    return (
      <>
        {error && (
          <div style={{ background: "#FFF8EC", border: `1px solid ${NL.amber}55`, borderRadius: 14, padding: 16, marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: NL.amber, fontSize: 14 }}>Sin conexión a Firebase</div>
              <div style={{ fontSize: 12, color: NL.muted }}>Despliega en Vercel para conectar.</div>
            </div>
          </div>
        )}
        {tab === "hoy"         && <ResumenNuevo clientes={clientes} contratos={contratos} paneles={paneles} gastos={gastos} setTab={setTab}/>}
        {tab === "mapa"        && <Mapa        paneles={paneles} clientes={clientes} contratos={contratos}/>}
        {tab === "paneles"     && <Paneles     paneles={paneles} setPaneles={setPaneles} loading={loading} setTab={setTab} onModalChange={setAnyModalOpen}/>}
        {tab === "contratos"   && <Contratos   contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} loading={loading} setTab={setTab} onModalChange={setAnyModalOpen}/>}
        {tab === "historico"   && <Historico   contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} onModalChange={setAnyModalOpen}/>}
        {tab === "crm"         && <CRM         clientes={clientes} setClientes={setClientes} contratos={contratos} loading={loading} onModalChange={setAnyModalOpen}/>}
        {tab === "resultados"  && <Resultados  contratos={contratos} loading={loading}/>}
        {tab === "reportes"    && <Reportes    contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos}/>}
        {tab === "gastos"      && <Gastos      gastos={gastos} setGastos={setGastos} autoScan={autoScan} setAutoScan={setAutoScan} onModalChange={setAnyModalOpen}/>}
        {tab === "proveedores" && <Proveedores proveedores={proveedores} setProveedores={setProveedores} loading={loading} onModalChange={setAnyModalOpen}/>}
        {tab === "facturacion" && <Facturacion contratos={contratos} paneles={paneles} clientes={clientes}/>}
      </>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover,user-scalable=no"/>
      <meta name="theme-color" content="#F2F4F8"/>
      <meta name="apple-mobile-web-app-capable" content="yes"/>
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
      <meta name="apple-mobile-web-app-title" content="Vista360"/>
      <meta name="mobile-web-app-capable" content="yes"/>
      <meta name="format-detection" content="telephone=no"/>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
        html{margin:0;padding:0;background:#F2F4F8;width:100%;height:100%;height:100vh;height:100dvh;overflow:hidden;-webkit-text-size-adjust:100%}
        body{margin:0;padding:0;background:#F2F4F8;width:100%;height:100%;height:100vh;height:100dvh;overflow:hidden;overscroll-behavior:none;position:relative;-webkit-text-size-adjust:100%;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{width:100%;height:100%;overflow:hidden;position:relative}
        ::-webkit-scrollbar{display:none}
        /* Permitir selección sólo en campos de texto */
        input,textarea{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
        /* Evitar zoom en focus iOS — fuentes >= 16px en inputs */
        input,select,textarea{font-size:16px !important;scroll-margin-bottom:180px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{from{opacity:.2}to{opacity:.6}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        button{font-family:inherit}
        button:active{opacity:0.72;transform:scale(0.96);transition:transform 0.07s ease,opacity 0.07s ease}
        /* Inputs estilo iOS */
        input,select,textarea{-webkit-appearance:none;appearance:none}
        /* Soporte safe-areas */
        .safe-top{padding-top:env(safe-area-inset-top)}
        .safe-bottom{padding-bottom:env(safe-area-inset-bottom)}
      `}</style>

      {splash && <Splash done={() => setSplash(false)}/>}

      {/* Pantalla de login: se muestra solo si no hay usuario y ya verificamos auth */}
      {!splash && authReady && !user && (
        <LoginScreen onLoginSuccess={(u) => setUser(u)}/>
      )}

      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, background: NL.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif", color: NL.text, overflow: "hidden" }}>

        {/* ── TOP NAV ── */}
        <div style={{
          flexShrink: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: 16, paddingRight: 16, paddingBottom: 12,
          background: (tab === "hoy" && !showProfile)
            ? "#0E1A3B"
            : "rgba(242,244,248,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: (tab === "hoy" && !showProfile)
            ? "none"
            : `1px solid rgba(229,231,235,0.7)`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {/* Botón menú */}
          <button onClick={() => setDrawerOpen(true)} aria-label="Menú" style={{
            width: 40, height: 40, borderRadius: 12,
            background: (tab === "hoy" && !showProfile) ? "rgba(255,255,255,0.10)" : NL.text,
            border: (tab === "hoy" && !showProfile) ? "1px solid rgba(255,255,255,0.14)" : "none",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: (tab === "hoy" && !showProfile) ? "none" : "0 4px 12px rgba(15,23,41,0.18)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="white"/>
              <rect x="13" y="3" width="8" height="8" rx="2" fill="white"/>
              <rect x="3" y="13" width="8" height="8" rx="2" fill="white"/>
              <rect x="13" y="13" width="8" height="8" rx="2" fill="white"/>
            </svg>
          </button>

          {/* Título de sección + fecha */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: (tab === "hoy" && !showProfile) ? "#fff" : NL.text, lineHeight: 1.1 }}>
              {showProfile ? "Perfil" : {
                hoy:"Inicio", mapa:"Mapa",
                paneles:"Paneles", contratos:"Contratos", historico:"Histórico",
                crm:"Clientes", resultados:"Resultados", reportes:"Reportes",
                gastos:"Gastos", proveedores:"Proveedores", facturacion:"Facturación",
              }[tab] || "Vista360"}
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setGlobalSearch(true)} aria-label="Buscar" style={{ width: 40, height: 40, borderRadius: "50%", background: (tab === "hoy" && !showProfile) ? "rgba(255,255,255,0.10)" : NL.white, border: (tab === "hoy" && !showProfile) ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z" stroke={(tab === "hoy" && !showProfile) ? "#fff" : NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onClick={() => setNotifOpen(v => !v)} aria-label="Notificaciones" style={{ width: 40, height: 40, borderRadius: "50%", background: (tab === "hoy" && !showProfile) ? "rgba(255,255,255,0.10)" : NL.white, border: (tab === "hoy" && !showProfile) ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M15 17H9M15 17C15 18.657 13.657 20 12 20C10.343 20 9 18.657 9 17M15 17H20L18.784 15.784C18.284 15.284 18 14.612 18 13.914V10C18 7.239 15.761 5 13 5H11C8.239 5 6 7.239 6 10V13.914C6 14.612 5.716 15.284 5.216 15.784L4 17H9" stroke={(tab === "hoy" && !showProfile) ? "#fff" : NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {contratos.length > 0 && (() => {
                const hoyD = new Date();
                const count =
                  contratos.filter(c => { const d = Math.ceil((new Date(c.fin)-hoyD)/86400000); return d>0&&d<=30; }).length +
                  contratos.filter(c => !c.pagado && c.monto > 0).length;
                return count > 0
                  ? <div style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: "50%", background: NL.red, border: `2px solid ${NL.white}` }}/>
                  : null;
              })()}
            </button>
            <NotifPanel
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              contratos={contratos}
              clientes={clientes}
              paneles={paneles}
              gastos={gastos}
            />
            <button onClick={() => handleTabClick("perfil")} aria-label="Perfil" style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, border: showProfile ? `2px solid ${NL.accent}` : "2px solid transparent", cursor: "pointer", boxShadow: "0 4px 12px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)", letterSpacing: "0.5px" }}>
              AM
            </button>
          </div>
        </div>

        {/* ── CONTENIDO ── */}
        <div
          style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}
        >
          <div style={{ padding: "20px 16px", paddingBottom: "calc(108px + env(safe-area-inset-bottom))" }}>
            {loading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: NL.muted }}>
                  <div style={{ width: 20, height: 20, border: `2px solid ${NL.border}`, borderTopColor: NL.accent, borderRadius: "50%", animation: "spin .7s linear infinite" }}/>
                  Cargando...
                </div>
              : renderContent()
            }
          </div>
        </div>

        {/* ── BOTTOM TAB BAR FLOTANTE ── */}
        {!anyModalOpen && <div style={{
          position: "fixed",
          bottom: "calc(0px + env(safe-area-inset-bottom))",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 24px)",
          maxWidth: 420,
          zIndex: 100,
          pointerEvents: "none",
        }}>
          <div style={{
            position: "relative",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "26px 26px 0 0",
            border: "1px solid rgba(255,255,255,0.9)",
            borderBottom: "none",
            boxShadow: "0 -4px 24px rgba(15,23,41,0.10), 0 -1px 4px rgba(15,23,41,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
            padding: "12px 6px 14px",
            display: "flex",
            alignItems: "center",
            pointerEvents: "auto",
          }}>
            {BOTTOM_TABS_LIST.map(t => {
              if (t.id === "__add__") return (
                <div key="add" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <button
                    aria-label="Agregar gasto"
                    onClick={() => { setAutoScan(true); handleTabClick("gastos"); }}
                    style={{
                      width: 54, height: 54, borderRadius: "50%",
                      background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
                      border: "3px solid rgba(255,255,255,0.95)",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(37,99,235,0.42), 0 2px 8px rgba(37,99,235,0.2)",
                      marginTop: -28,
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              );
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => handleTabClick(t.id)} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3,
                  background: active ? "rgba(37,99,235,0.08)" : "none",
                  border: "none", cursor: "pointer",
                  color: active ? NL.accent : "#9CA3AF",
                  padding: "6px 4px",
                  minHeight: 48,
                  borderRadius: 18,
                  margin: "0 2px",
                  transition: "background 0.18s ease, color 0.18s ease",
                }}>
                  <div style={{ transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)", transform: active ? "scale(1.12)" : "scale(1)" }}>
                    {BTM_ICONS[t.id]}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: active ? "0.01em" : 0 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>}

        {/* ── DRAWER ── */}
        <BusquedaGlobal open={globalSearch} onClose={() => setGlobalSearch(false)} paneles={paneles} clientes={clientes} contratos={contratos} onNavigate={handleTabClick}/>
        <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} onTabClick={handleTabClick}/>
      </div>
    </>
  );
}
