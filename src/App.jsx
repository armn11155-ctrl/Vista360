
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


// ══════════════════════════════════════════════════════════════════
// 📊 DASHBOARD — Placeholder (módulo en construcción)
// ══════════════════════════════════════════════════════════════════
function Dashboard({clientes,contratos,paneles,setTab}){
  // Calcular ingresos por mes desde contratos
  const mesesData = useMemo(() => {
    const map = {};
    contratos.forEach(c => {
      const fecha = c.inicio || c.fecha || c.created_at;
      if (!fecha) return;
      const key = fecha.slice(0,7); // "YYYY-MM"
      map[key] = (map[key] || 0) + (Number(c.monto) || 0);
    });
    const keys = Object.keys(map).sort().slice(-6); // últimos 6 meses
    return keys.map(k => {
      const [y,m] = k.split("-");
      const label = new Date(Number(y), Number(m)-1).toLocaleDateString("es-PE",{month:"short"}).replace(".","");
      return { key:k, label: label.charAt(0).toUpperCase()+label.slice(1), monto: map[k] };
    });
  }, [contratos]);

  const maxVal = Math.max(...mesesData.map(d => d.monto), 1);
  const totalMes = mesesData[mesesData.length-1]?.monto || 0;
  const totalAnterior = mesesData[mesesData.length-2]?.monto || 0;
  const crecimiento = totalAnterior > 0 ? ((totalMes - totalAnterior) / totalAnterior * 100).toFixed(1) : null;

  const panOcupados = paneles.filter(p => p.estado === "Ocupado").length;
  const ocup_rate = paneles.length > 0 ? Math.round(panOcupados / paneles.length * 100) : 0;
  const ingresoTotal = contratos.reduce((a,c) => a + (Number(c.monto)||0), 0);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PgTit icon="📊" title="Dashboard" sub="Visión general del negocio" />

      {/* KPIs rápidos */}
      {/* Tarjeta principal — Ingresos del mes, ancho completo */}
      <div style={{ background:"linear-gradient(135deg,#0F1729 0%,#1E2A4A 100%)", borderRadius:18, padding:"18px 20px", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.8, marginBottom:6 }}>Ingresos este mes</div>
          <div style={{ fontSize:28, fontWeight:800, color:"#fff", letterSpacing:"-0.5px", lineHeight:1 }}>{fmt(totalMes)}</div>
          {crecimiento !== null && (
            <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:4, background:"rgba(16,185,129,0.18)", borderRadius:8, padding:"3px 10px" }}>
              <span style={{ fontSize:12 }}>{Number(crecimiento)>=0?"▲":"▼"}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.green }}>{Math.abs(crecimiento)}% vs mes ant.</span>
            </div>
          )}
        </div>
        <div style={{ width:48, height:48, borderRadius:14, background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>💰</div>
      </div>
      {/* Fila secundaria — Ocupación y Clientes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        {[
          { label:"Ocupación", val:`${ocup_rate}%`, color:C.green, icon:"📡" },
          { label:"Clientes activos", val:clientes.length, color:C.purple, icon:"👥" },
        ].map((k,i) => (
          <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"16px 14px" }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`${k.color}16`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, marginBottom:10 }}>{k.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:k.color, letterSpacing:"-0.3px", lineHeight:1, marginBottom:4 }}>{k.val}</div>
            <div style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Gráfica de crecimiento */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"20px 18px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:2 }}>Crecimiento del negocio</div>
            <div style={{ fontSize:11, color:C.muted }}>Ingresos mensuales por contratos</div>
          </div>
          <div style={{ fontSize:11, background:`${C.accent}12`, color:C.accent, borderRadius:8, padding:"4px 10px", fontWeight:700 }}>Mensual</div>
        </div>

        {mesesData.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:C.muted, fontSize:13 }}>
            Sin datos de contratos aún
          </div>
        ) : (
          <>
            {/* Barras */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:130, marginBottom:10 }}>
              {mesesData.map((d,i) => {
                const h = Math.max((d.monto / maxVal) * 110, 4);
                const isLast = i === mesesData.length-1;
                return (
                  <div key={d.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ fontSize:9, fontWeight:700, color: isLast ? C.accent : C.muted, whiteSpace:"nowrap" }}>
                      {d.monto > 0 ? `S/${Math.round(d.monto/1000)}k` : ""}
                    </div>
                    <div style={{
                      width:"100%", height:h,
                      background: isLast
                        ? `linear-gradient(180deg, ${C.accent}, ${C.accent}99)`
                        : `linear-gradient(180deg, ${C.accent}50, ${C.accent}22)`,
                      borderRadius:"6px 6px 3px 3px",
                      border: isLast ? `1px solid ${C.accent}` : "none",
                      transition:"height .3s",
                    }}/>
                  </div>
                );
              })}
            </div>
            {/* Etiquetas mes */}
            <div style={{ display:"flex", gap:8 }}>
              {mesesData.map((d,i) => (
                <div key={d.key} style={{ flex:1, textAlign:"center", fontSize:10, color: i===mesesData.length-1 ? C.accent : C.muted, fontWeight:700 }}>
                  {d.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detalle paneles */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"18px" }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:14 }}>Estado de paneles</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { label:"Ocupados", val:panOcupados, total:paneles.length, color:C.red },
            { label:"Libres", val:paneles.length-panOcupados, total:paneles.length, color:C.green },
          ].map((r,i) => (
            <div key={i}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
                <span>{r.label}</span>
                <span style={{ color:r.color }}>{r.val} / {r.total}</span>
              </div>
              <div style={{ height:8, background:C.border, borderRadius:999, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${r.total>0?(r.val/r.total*100):0}%`, background:r.color, borderRadius:999, transition:"width .4s" }}/>
              </div>
            </div>
          ))}
        </div>
        <button onClick={()=>setTab("paneles")} style={{ marginTop:14, width:"100%", padding:"10px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:12, color:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Ver todos los paneles →
        </button>
      </div>
    </div>
  );
}

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
              <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
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
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),C.cyan],
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
                        <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
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
                        style={{flex:1,background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:10,padding:"10px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer",minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                        📄 Exportar PDF
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
        {[["Ingresos brutos",ingBrut,C.green],["(-) No cobrados",-ingPend,C.amber],["Ingresos netos",ingCob,C.cyan],["(-) Gastos totales",-totGastos,C.red],["= Utilidad neta",utilidad,utilidad>=0?C.green:C.red]].map(([l,v,c],i)=>(
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
      <KPIDark label="Por vencer 30d"  value={activos.filter(c=>c.d<=30).length} valueColor="#FFFFFF" sub="Atención" accent="#2563EB" icon={ICN.clock}/>
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
                background: C.green + "18",
                border: `1px solid ${C.green}55`, borderRadius: 11,
                color: C.green, fontWeight: 700, fontSize: 13,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              ⬇️ Descargar PDF
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
                              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "7px 14px", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                              📄 PDF
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
              position: "relative", overflow: "hidden",
              marginTop: 14,
              background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
              border: "1px solid rgba(79,124,255,0.18)",
              borderRadius: 18, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: "0 6px 20px rgba(8,12,28,0.4)",
            }}>
              <WaveDeco color="#2563EB"/>
              <span style={{ position: "relative", zIndex: 2, fontSize: 12, color: "rgba(160,180,220,0.7)", fontWeight: 500 }}>
                {facsFiltradas.length} comprobante{facsFiltradas.length > 1 ? "s" : ""} mostrado{facsFiltradas.length > 1 ? "s" : ""}
              </span>
              <span style={{ position: "relative", zIndex: 2, fontSize: 16, fontWeight: 800, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "rgba(160,180,220,0.8)", fontWeight: 600 }}>Total:</span>
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
  dashboard: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
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
  .logo-img{height:54px;width:auto;object-fit:contain;filter:invert(1) brightness(2);display:block;margin-bottom:4px}
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
              background:"linear-gradient(135deg,#059669,#10B981)",border:"none",
              borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
              boxShadow:"0 4px 14px rgba(16,185,129,0.4)"}}>
              📄 Descargar PDF
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
.h-left .logo-img{height:56px;width:auto;object-fit:contain;filter:invert(1) brightness(2);margin-bottom:6px;display:block}
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
.h-left .logo-img{height:52px;width:auto;object-fit:contain;filter:invert(1) brightness(2);margin-bottom:5px;display:block}
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
.h-left .empresa{font-size:18px;font-weight:900} .h-left .ruc{font-size:10px;opacity:.75;margin-top:3px} .h-left .logo-img{height:48px;width:auto;object-fit:contain;filter:invert(1) brightness(2);margin-bottom:5px;display:block}
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
    <div style={{color:C.white}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:C.white,letterSpacing:"-0.5px"}}>
          📊 Reportes & Facturación
        </div>
        <div style={{fontSize:13,color:C.muted,marginTop:3}}>
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
                ?"linear-gradient(135deg,rgba(79,124,255,0.38),rgba(99,102,241,0.28))"
                :"rgba(255,255,255,0.04)",
              color:active?"#FFFFFF":"rgba(255,255,255,0.4)",
              fontWeight:active?800:600,fontSize:10.5,transition:"all 0.18s",
              boxShadow:active
                ?"0 4px 20px rgba(79,124,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
                :"none",
              outline:active?"1.5px solid rgba(79,124,255,0.4)":"1px solid rgba(255,255,255,0.06)",
              letterSpacing:active?"0.02em":"0",
            }}>
              <div style={{
                width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                background:active?"rgba(79,124,255,0.25)":"rgba(255,255,255,0.06)",
                color:active?"#7FAEFF":"rgba(255,255,255,0.35)",
                transition:"all 0.18s",
              }}>
                {iconMap[s.id]}
              </div>
              <span style={{whiteSpace:"nowrap"}}>{labelMap[s.id]}</span>
              {active && <div style={{width:18,height:2,borderRadius:2,background:"#4F7CFF",marginTop:1}}/>}
            </button>
          );
        })}
      </div>

      {/* ════════ RESUMEN ANUAL ════════ */}
      {seccion==="resumen" && (
        <div>
          {/* Selector año + botón exportar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <button onClick={()=>setAnio(a=>a-1)} style={{
                width:36,height:36,borderRadius:10,border:"1px solid rgba(79,124,255,0.3)",
                background:"rgba(79,124,255,0.12)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{fontSize:20,fontWeight:800,color:C.white,minWidth:50,textAlign:"center"}}>{anio}</div>
              <button onClick={()=>setAnio(a=>a+1)} style={{
                width:36,height:36,borderRadius:10,border:"1px solid rgba(79,124,255,0.3)",
                background:"rgba(79,124,255,0.12)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <button onClick={exportResumenPDF} style={{
              display:"inline-flex",alignItems:"center",gap:8,
              padding:"10px 18px",borderRadius:12,border:"1px solid rgba(239,68,68,0.35)",
              background:"linear-gradient(135deg,rgba(239,68,68,0.18),rgba(220,38,38,0.12))",
              color:"#FCA5A5",fontWeight:700,fontSize:12,cursor:"pointer",
              boxShadow:"0 4px 16px rgba(239,68,68,0.15)",transition:"all 0.15s",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
              <img src={DRAWER_LOGO_B64} alt="8 Millas" style={{
                height:38,width:"auto",objectFit:"contain",
                filter:"invert(1) brightness(2)",flexShrink:0,
              }}/>
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
                  <div style={{fontSize:9.5,fontWeight:800,color:esHoy?"#6EE7B7":tieneData?"#7FAEFF":"rgba(255,255,255,0.2)",letterSpacing:0.4}}>{mShort}</div>
                  {tieneData && <div style={{width:4,height:4,borderRadius:"50%",background:m.utilidad>=0?"#10B981":"#EF4444",marginTop:3}}/>}
                </a>
              );
            })}
          </div>

          {/* ── Botón exportar PDF anual ── */}
          <button onClick={exportAnualMensualPDF} style={{
            width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            padding:"13px 20px",borderRadius:14,marginBottom:14,cursor:"pointer",
            background:"linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.14))",
            border:"1px solid rgba(239,68,68,0.4)",
            color:"#FCA5A5",fontWeight:800,fontSize:13,fontFamily:"inherit",
            boxShadow:"0 4px 20px rgba(239,68,68,0.18)",
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
            {[...mesesAnio].reverse().map(m => {
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
                          marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:4,
                          padding:"4px 10px",borderRadius:8,
                          border:"1px solid rgba(239,68,68,0.4)",
                          background:"rgba(239,68,68,0.12)",
                          color:"#FCA5A5",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                        }} title={`Exportar PDF de ${mesLabel(m.mes)}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
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
  { id: "dashboard",    label: "Dashboard"    },
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
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6"  y1="20" x2="6"  y2="13"/>
      <line x1="12" y1="20" x2="12" y2="7"/>
      <line x1="18" y1="20" x2="18" y2="10"/>
    </svg>
  ),
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

        {/* ── Footer: Logo VISTA360 + arco decorativo ── */}
        <div style={{
          position: "relative",
          padding: "8px 0 18px",
          marginTop: "auto",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 5,
            position: "relative", zIndex: 2,
          }}>
            <img src={DRAWER_LOGO_B64} alt="Vista360" style={{width:120,height:"auto",display:"block",objectFit:"contain"}}/>
            <div style={{
              fontSize: 8.5, fontWeight: 600,
              color: "#94A3B8",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}>
              Gestión de Paneles
            </div>
          </div>

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
        {tab === "dashboard"   && <Dashboard   clientes={clientes} contratos={contratos} paneles={paneles} setTab={setTab}/>}
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
                hoy:"Inicio", dashboard:"Dashboard", mapa:"Mapa",
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
          <div style={{ padding: "20px 16px", paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
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
          bottom: "calc(6px + env(safe-area-inset-bottom))",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 420,
          zIndex: 100,
          pointerEvents: "none",
        }}>
          <div style={{
            position: "relative",
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 8px 32px rgba(15,23,41,0.14), 0 2px 8px rgba(15,23,41,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
            padding: "10px 6px 12px",
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
