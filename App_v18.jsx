
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
const EMOJIS      = ["📡","🏙️","🌆","🛣️","🏬","🔄","🏪","🏢","🌉","🏟️"];
const INGRESOS_HIST = []; // ya no se usa — se calcula desde contratos reales

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

// ── MODAL DE CONFIGURACIÓN (Firebase info) ──────────────────────
function ModalConfig({onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#111929",border:"1px solid #18253D",borderRadius:20,padding:26,width:"100%",maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>🔥 Firebase — Vista360</div>
          <button onClick={onClose} style={{background:"#18253D",border:"none",borderRadius:8,padding:"5px 11px",color:"#64748B",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{fontSize:13,color:"#64748B",lineHeight:1.8,marginBottom:16}}>
          La app usa <strong style={{color:"#F59E0B"}}>Firebase Firestore</strong> como base de datos y <strong style={{color:"#F59E0B"}}>Cloudinary</strong> para fotos de boletas.<br/>
          El proyecto conectado es: <strong style={{color:"#fff"}}>base-de-datos-vista360</strong>
        </div>
        <div style={{background:"#0D1421",borderRadius:12,padding:"14px 16px",fontSize:12,color:"#10B981",fontFamily:"monospace",marginBottom:18,lineHeight:1.8}}>
          projectId: base-de-datos-vista360<br/>
          storageBucket: base-de-datos-vista360.firebasestorage.app<br/>
          OCR: Google Cloud Vision API ✓
        </div>
        <button onClick={onClose} style={{width:"100%",padding:12,background:"#2563EB",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

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

// ── LOGO — PNG real con fondo transparente ──────────────────────
// Logo Vista360 — usado en splash y app (separado del de 8 Millas que va en facturas)
const LOGO_VISTA360_B64 = "data:image/png;base64,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";

const LOGO_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAH0AfQDASIAAhEBAxEB/8QAGgABAAMBAQEAAAAAAAAAAAAAAAQFBgMCAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAs+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9yCI7+iMl9ytffgAAAAAAAAAAAAAAAAAAAAAAAAAAAnRtSVNOACTGGszU29McAAAAAAAAAAAAAAAAAAAAAAAAAAC/8Afb0ZUAADe4LdmNjTYQAAAAAAAAAAAAAAAAAAAAAAAAABo7rGbQx0Ld5sqAAddvR8in8AAAAAAAAAAAAAAAAAAAAAAAAAAAt6gb31jNKeM1tvhgZdtQllVAAAAAAAAAAAAAAAAAAAAAAAAAAAALgqvEqKXWhwnY3MeBbmTrN/RmcAAAAAAAAAAAAAAAAAAAAAAAAAAOhb/NBhzyABYV420nCbEo6bZ4wAAAAAAAAAAAAAAAAAAAAAAAAAWVbZGhxm1xQAAAtaqQbTB7XFAAAAAAAAAAAAAAAAAAAAAAAAADpzG7xk+zMqAABZVugPND68gAAAAAAAAAAAAAAAAAAAAAAAAACyrRoKbhKIqVzOPvp8Jtf4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD78uildLIqQffk2ED6PkyGAffk+AACxK5Kig6DnaQDkAAAAAAAAAAAAAAAAAABY13ssuEH2eATYXvwPvwTIc2OcgT4HfoRALar+FnV9eQ+/BJ6+Yp5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9oADAMBAAIAAwAAACEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwgwAAAAAAAAAAAAAAAAAAAAAAAAAAAByAADQAAAAAAAAAAAAAAAAAAAAAAAAAABgAADCgAAAAAAAAAAAAAAAAAAAAAAAAABgAACyAAAAAAAAAAAAAAAAAAAAAAAAAAACRBCAAAAAAAAAAAAAAAAAAAAAAAAAAAABDDAQAAAAAAAAAAAAAAAAAAAAAAAAAABwABCwgAAAAAAAAAAAAAAAAAAAAAAAAACgAABSgAAAAAAAAAAAAAAAAAAAAAAAAACwgAACAAAAAAAAAAAAAAAAAAAAAAAAAAACQxBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARgAgAgAABQADAAAAAAAAAAAAAAAAAAAATQCgSgAgDiBDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAgADAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCCAAAAAAAAAAAAAAAAAAAAAAAAAAAACOAAECAAAAAAAAAAAAAAAAAAAAAAAAAAHAAANKAAAAAAAAAAAAAAAAAAAAAAAAAAOKAAMIAAAAAAAAAAAAAAAAAAAAAAAAAAAFGHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMADLCAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAOAAAAAAAAAAAAAAAAAAAAAAAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAADAAADIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFAAACACAEAACAAAAAAAAAAAAAAAAAAAEIAIAJALAOAFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";
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
      setTimeout(()=>setF(4), 2000),  // tagline + separator
      setTimeout(()=>setF(5), 2400),  // progress bar starts
      setTimeout(()=>setF(6), 3700),  // begin fade out
      setTimeout(done,        4300),
    ];
    return()=>ts.forEach(clearTimeout);
  },[]);

  return(
    <div style={{
      position:"absolute",
      top:0, right:0, bottom:0, left:0,
      zIndex:999,
      background:"radial-gradient(ellipse at center, #0B1530 0%, #060A18 45%, #02030A 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      opacity:f>=6?0:1,
      transition:f>=6?"opacity .6s cubic-bezier(.4,0,.2,1)":"none",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes spArcSweep{0%{transform:translate(-50%,-50%) rotate(-90deg);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-50%) rotate(270deg);opacity:.85}}
        @keyframes spArcLoop{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes spGlowPulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
        @keyframes spLogoIn{0%{opacity:0;transform:scale(.82);filter:blur(8px)}60%{filter:blur(0)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
        @keyframes spLine{0%{width:0;opacity:0}100%{width:170px;opacity:1}}
        @keyframes spLineDot{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes spBarFill{0%{width:0%}100%{width:55%}}
        @keyframes spBarShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spDots{0%,20%{content:""}40%{content:"."}60%{content:".."}80%,100%{content:"..."}}
        @keyframes spRingIn{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        @keyframes spStarTwinkle{0%,100%{opacity:.15}50%{opacity:.55}}
      `}</style>

      {/* ─── Tiny twinkling dots (subtle stars) ─── */}
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

      {/* ─── Outermost ring (very faint, huge) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"54%",
        width:"160vmin",height:"160vmin",maxWidth:1200,maxHeight:1200,
        borderRadius:"50%",
        border:"1px solid rgba(120,160,255,.08)",
        boxShadow:"inset 0 0 80px rgba(80,120,255,.04)",
        opacity:f>=1?1:0,
        transform:`translate(-50%,-50%) scale(${f>=1?1:0.9})`,
        transition:"opacity 1.4s ease, transform 1.6s cubic-bezier(.4,0,.2,1)",
      }}/>

      {/* ─── Middle large ring ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"54%",
        width:"95vmin",height:"95vmin",maxWidth:720,maxHeight:720,
        borderRadius:"50%",
        border:"1px solid rgba(140,180,255,.12)",
        boxShadow:"inset 0 0 120px rgba(60,100,220,.06)",
        opacity:f>=1?1:0,
        transform:`translate(-50%,-50%) scale(${f>=1?1:0.85})`,
        transition:"opacity 1.2s ease .15s, transform 1.4s cubic-bezier(.4,0,.2,1) .15s",
      }}/>

      {/* ─── Inner ring (logo container) ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"54%",
        width:"58vmin",height:"58vmin",maxWidth:440,maxHeight:440,
        borderRadius:"50%",
        border:"1px solid rgba(150,190,255,.18)",
        background:"radial-gradient(circle at 50% 40%, rgba(40,80,180,.18) 0%, rgba(20,40,90,.05) 50%, transparent 100%)",
        boxShadow:"inset 0 0 60px rgba(80,140,255,.10), 0 0 80px rgba(40,80,200,.18)",
        opacity:f>=2?1:0,
        transform:`translate(-50%,-50%) scale(${f>=2?1:0.78})`,
        transition:"opacity 1s ease, transform 1.1s cubic-bezier(.34,1.28,.64,1)",
      }}/>

      {/* ─── Bright arc rotating (top-left highlight) ─── */}
      <svg style={{
        position:"absolute",left:"50%",top:"54%",
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

      {/* ─── Soft inner glow behind logo ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"54%",
        width:"36vmin",height:"36vmin",maxWidth:280,maxHeight:280,
        borderRadius:"50%",
        background:"radial-gradient(circle, rgba(80,130,255,.18) 0%, rgba(50,80,200,.06) 50%, transparent 75%)",
        opacity:f>=2?1:0,
        animation:f>=2?"spGlowPulse 3.5s ease-in-out infinite":"none",
        transform:"translate(-50%,-50%)",
        transition:"opacity 1s ease",
        pointerEvents:"none",
      }}/>

      {/* ─── Center stack: logo + separator + tagline ─── */}
      <div style={{
        position:"absolute",left:"50%",top:"54%",
        transform:"translate(-50%,-50%)",
        zIndex:5,
        display:"flex",flexDirection:"column",alignItems:"center",
        width:"50vmin",maxWidth:380,
      }}>
        {/* Logo */}
        <div style={{
          opacity:f>=3?1:0,
          animation:f>=3?"spLogoIn 1.1s cubic-bezier(.34,1.28,.64,1) both":"none",
          filter:"drop-shadow(0 0 24px rgba(120,170,255,.55)) drop-shadow(0 0 6px rgba(180,200,255,.35))",
        }}>
          <Logo360 width={260}/>
        </div>

        {/* Separator with glowing center dot */}
        <div style={{
          position:"relative",
          marginTop:28,marginBottom:22,
          height:1,
          width:f>=4?170:0,
          background:"linear-gradient(90deg,transparent 0%,rgba(120,170,255,.15) 20%,rgba(180,210,255,.85) 50%,rgba(120,170,255,.15) 80%,transparent 100%)",
          transition:"width .9s cubic-bezier(.4,0,.2,1)",
        }}>
          <div style={{
            position:"absolute",left:"50%",top:"50%",
            width:6,height:6,borderRadius:"50%",
            background:"#9BBBFF",
            boxShadow:"0 0 12px rgba(155,187,255,.95), 0 0 24px rgba(80,130,255,.6)",
            transform:"translate(-50%,-50%)",
            opacity:f>=4?1:0,
            animation:f>=4?"spLineDot 2.2s ease-in-out infinite":"none",
            transition:"opacity .5s ease .4s",
          }}/>
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily:"'DM Sans',system-ui,sans-serif",
          fontSize:11.5,
          fontWeight:500,
          color:"rgba(180,200,235,.55)",
          letterSpacing:6,
          textTransform:"uppercase",
          textAlign:"center",
          opacity:f>=4?1:0,
          transform:f>=4?"translateY(0)":"translateY(8px)",
          transition:"opacity .7s ease .15s, transform .7s ease .15s",
          textShadow:"0 0 20px rgba(120,170,255,.3)",
        }}>
          Gestión de Paneles
        </div>
      </div>

      {/* ─── Bottom progress bar ─── */}
      <div style={{
        position:"absolute",
        bottom:"7%",left:"50%",
        transform:"translateX(-50%)",
        display:"flex",flexDirection:"column",alignItems:"center",gap:18,
        opacity:f>=5?1:0,
        transition:"opacity .5s ease",
      }}>
        {/* Track */}
        <div style={{
          width:200,height:2,
          background:"rgba(255,255,255,.08)",
          borderRadius:2,overflow:"hidden",
          position:"relative",
        }}>
          <div style={{
            height:"100%",
            background:"linear-gradient(90deg,rgba(80,130,255,0) 0%, #4F7CFF 30%, #B5D0FF 50%, #4F7CFF 70%, rgba(80,130,255,0) 100%)",
            backgroundSize:"200% 100%",
            borderRadius:2,
            boxShadow:"0 0 10px rgba(120,170,255,.7)",
            animation:f>=5?"spBarFill 1.4s cubic-bezier(.4,0,.2,1) forwards, spBarShimmer 1.6s linear infinite":"none",
          }}/>
        </div>
        {/* CONECTANDO label */}
        <div style={{
          fontFamily:"'DM Sans',system-ui,sans-serif",
          fontSize:11,
          fontWeight:500,
          color:"rgba(180,200,235,.55)",
          letterSpacing:5,
          textTransform:"uppercase",
        }}>
          Conectando<span style={{
            display:"inline-block",width:18,textAlign:"left",
          }}>...</span>
        </div>
      </div>
    </div>
  );
}

// ── DONUT / BARCHART ─────────────────────────────────────────────
function Donut({pct,color,label,sub}){
  const r=32,c2=2*Math.PI*r,d=(pct/100)*c2;
  return(<div style={{display:"flex",alignItems:"center",gap:14}}>
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} fill="none" stroke={C.border} strokeWidth={8}/>
      <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${d} ${c2}`} strokeLinecap="round" transform="rotate(-90 40 40)"/>
      <text x={40} y={44} textAnchor="middle" fill={C.white} fontSize={13} fontWeight={700}>{pct}%</text>
    </svg>
    <div><div style={{fontSize:14,fontWeight:700,color:C.white}}>{label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{sub}</div></div>
  </div>);
}
function BarChart({data}){
  const max=Math.max(...data.map(d=>d.v));
  return(<div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
    {data.map((d,i)=>{const last=i===data.length-1;return(
      <div key={d.mes} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
        <div style={{fontSize:10,color:last?C.white:C.muted}}>{fmt(d.v)}</div>
        <div style={{width:"100%",height:`${(d.v/max)*100}%`,background:last?C.accent:C.accent+"44",borderRadius:"5px 5px 0 0",minHeight:6}}/>
        <div style={{fontSize:11,fontWeight:last?700:400,color:last?C.white:C.muted}}>{d.mes}</div>
      </div>
    );})}
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// PANTALLAS
// ══════════════════════════════════════════════════════════════════

// ── GRÁFICA DE CRECIMIENTO ───────────────────────────────────────
function GraficaCrecimiento({contratos}){
  const [vista,setVista]=useState("meses");
  const [tooltip,setTooltip]=useState(null);

  const datosMeses=useMemo(()=>{
    const mapa={};
    contratos.filter(c=>c.pagado).forEach(c=>{
      const d=new Date(c.inicio||c.created_at||Date.now());
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      mapa[key]=(mapa[key]||0)+Number(c.monto||0);
    });
    const res=[];
    for(let i=11;i>=0;i--){
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      res.push({key,label:d.toLocaleDateString("es-PE",{month:"short",year:"2-digit"}),v:mapa[key]||0});
    }
    return res;
  },[contratos]);

  const datosAnios=useMemo(()=>{
    const mapa={};
    contratos.filter(c=>c.pagado).forEach(c=>{
      const d=new Date(c.inicio||c.created_at||Date.now());
      const key=String(d.getFullYear());
      mapa[key]=(mapa[key]||0)+Number(c.monto||0);
    });
    const anioActual=new Date().getFullYear();
    return Array.from({length:5},(_,i)=>anioActual-4+i).map(a=>({key:String(a),label:String(a),v:mapa[String(a)]||0}));
  },[contratos]);

  const data=vista==="meses"?datosMeses:datosAnios;
  const maxV=Math.max(...data.map(d=>d.v),1);
  const mesActual=datosMeses[datosMeses.length-1]?.v||0;
  const mesAnterior=datosMeses[datosMeses.length-2]?.v||0;
  const crecPct=mesAnterior>0?Math.round(((mesActual-mesAnterior)/mesAnterior)*100):0;
  const totalHist=datosMeses.reduce((a,d)=>a+d.v,0);
  const mejorMes=Math.max(...datosMeses.map(d=>d.v),0);
  const mesesConData=datosMeses.filter(d=>d.v>0);
  const promMes=mesesConData.length?Math.round(mesesConData.reduce((a,d)=>a+d.v,0)/mesesConData.length):0;
  const promUlt3=Math.round(datosMeses.slice(-3).reduce((a,d)=>a+d.v,0)/3);
  const proyeccionAnio=mesActual+promUlt3*Math.max(0,11-new Date().getMonth());

  // SVG
  const W=500,H=130,PAD=12;
  const pts=data.map((d,i)=>({
    x:PAD+(i/(data.length-1||1))*(W-PAD*2),
    y:H-PAD-(d.v/maxV)*(H-PAD*2),
    v:d.v, label:d.label,
  }));
  const pathD=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const areaD=pts.length>1?`${pathD} L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`:"";
  const proyPts=vista==="meses"&&pts.length>=2?[
    pts[pts.length-1],
    {x:pts[pts.length-1].x+(W-PAD*2)/(data.length-1)*0.8,y:H-PAD-(Math.min(promUlt3*1.08,maxV)/maxV)*(H-PAD*2)},
  ]:[];
  const proyD=proyPts.length>1?proyPts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" "):"";

  return(<div>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div>
        <SecTit ch="📈 Crecimiento del Negocio"/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:-8}}>
          <span style={{fontSize:28,fontWeight:800,color:C.white}}>{fmt(mesActual)}</span>
          <div style={{display:"flex",alignItems:"center",gap:5,background:(crecPct>=0?C.green:C.red)+"18",border:`1px solid ${(crecPct>=0?C.green:C.red)}44`,borderRadius:8,padding:"4px 10px"}}>
            <span style={{fontSize:13}}>{crecPct>=0?"▲":"▼"}</span>
            <span style={{fontSize:13,fontWeight:700,color:crecPct>=0?C.green:C.red}}>{Math.abs(crecPct)}% vs mes ant.</span>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,background:C.surface,borderRadius:10,padding:4}}>
        {["meses","años"].map(v=>(
          <button key={v} onClick={()=>setVista(v)}
            style={{padding:"6px 14px",borderRadius:7,border:"none",background:vista===v?C.accent:"transparent",color:vista===v?C.white:C.muted,fontWeight:700,fontSize:12,cursor:"pointer",textTransform:"uppercase",letterSpacing:0.5}}>
            {v==="meses"?"Mensual":"Anual"}
          </button>
        ))}
      </div>
    </div>

    {/* SVG Chart grande */}
    <div style={{position:"relative",marginBottom:6,background:C.surface,borderRadius:14,padding:"16px 8px 8px"}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible",display:"block"}}>
        <defs>
          <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75].map(p=>(
          <line key={p} x1={PAD} y1={H-PAD-(p*(H-PAD*2))} x2={W-PAD} y2={H-PAD-(p*(H-PAD*2))}
            stroke={C.border} strokeWidth="0.8" strokeDasharray="4,4"/>
        ))}
        {pts.length>1&&<path d={areaD} fill="url(#gr1)"/>}
        {pts.length>1&&<path d={pathD} stroke={C.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
        {proyD&&<path d={proyD} stroke={C.cyan} strokeWidth="2" fill="none" strokeDasharray="5,4" strokeLinecap="round"/>}
        {pts.map((p,i)=>(
          <g key={i} style={{cursor:"pointer"}}
            onMouseEnter={()=>setTooltip(p)} onMouseLeave={()=>setTooltip(null)}
            onTouchStart={()=>setTooltip(p)} onTouchEnd={()=>setTimeout(()=>setTooltip(null),1500)}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent"/>
            <circle cx={p.x} cy={p.y} r={p.v>0?4:2.5} fill={p.v>0?C.accent:C.border} stroke={C.bg} strokeWidth="2"/>
          </g>
        ))}
        {tooltip&&(
          <g>
            <rect x={Math.min(Math.max(tooltip.x-38,4),W-80)} y={tooltip.y-38} width={76} height={28} rx={7} fill={C.card} stroke={C.accent} strokeWidth="1"/>
            <text x={Math.min(Math.max(tooltip.x-38,4),W-80)+38} y={tooltip.y-20} textAnchor="middle" fill={C.white} fontSize={11} fontWeight="800">{fmt(tooltip.v)}</text>
            <text x={Math.min(Math.max(tooltip.x-38,4),W-80)+38} y={tooltip.y-9} textAnchor="middle" fill={C.muted} fontSize={9}>{tooltip.label}</text>
          </g>
        )}
      </svg>

      {/* Labels eje X */}
      <div style={{display:"flex",justifyContent:"space-between",paddingLeft:PAD,paddingRight:PAD,marginTop:4}}>
        {data.filter((_,i)=>i===0||i===Math.floor(data.length/2)||i===data.length-1).map(d=>(
          <span key={d.key} style={{fontSize:10,color:C.muted,fontWeight:600}}>{d.label}</span>
        ))}
      </div>
    </div>

    {/* Proyección */}
    {vista==="meses"&&promUlt3>0&&(
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0",padding:"9px 14px",background:C.cyan+"0E",border:`1px solid ${C.cyan}28`,borderRadius:10}}>
        <span style={{color:C.cyan,fontSize:16}}>〰</span>
        <span style={{fontSize:13,color:C.cyan}}>Proyección fin de año: <strong>{fmt(proyeccionAnio)}</strong></span>
      </div>
    )}

    {/* Métricas */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
      {[["Total histórico",fmt(totalHist),C.white,"💵"],["Mejor mes",fmt(mejorMes),C.green,"🏆"],["Promedio/mes",fmt(promMes),C.cyan,"📊"]].map(([l,v,c,ic])=>(
        <div key={l} style={{textAlign:"center",background:C.surface,borderRadius:12,padding:"12px 8px"}}>
          <div style={{fontSize:16,marginBottom:4}}>{ic}</div>
          <div style={{fontSize:15,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:3,textTransform:"uppercase",letterSpacing:0.5}}>{l}</div>
        </div>
      ))}
    </div>
  </div>);
}

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
function Paneles({paneles,setPaneles,loading,setTab}){
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);

  const empty={nombre:"",tipo:"LED",precio:0,estado:"Libre",foto:"📡",ciudad:"Lima",direccion:"",lat:"",lng:"",ancho:"",alto:"",iluminacion:"Sí",visibilidad:"",notas:""};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ setForm(empty); setModal("nuevo"); };
  const openEdit=(p)=>{ setForm({...p}); setModal(p); };

  const guardar=async()=>{
    if(!form.nombre.trim()) return alert("Escribe el nombre del panel");
    setSaving(true);
    const payload={nombre:form.nombre,tipo:form.tipo,precio:Number(form.precio)||0,estado:form.estado,foto:form.foto||"📡",ciudad:form.ciudad,direccion:form.direccion||"",lat:form.lat?String(form.lat):null,lng:form.lng?String(form.lng):null,ancho:form.ancho||"",alto:form.alto||"",iluminacion:form.iluminacion||"Sí",visibilidad:form.visibilidad||"",notas:form.notas||""};
    try{
      if(modal==="nuevo"){
        const r=await fb.post("paneles",payload);
        // Si Firebase devolvió el objeto completo, úsalo; si no, recarga la lista
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>[...p,saved]); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null);
        alert("✓ Panel guardado correctamente");
        // Si el panel está Ocupado, navegar a Histórico
        if(payload.estado==="Ocupado"&&setTab) setTab("historico");
      } else {
        const r=await fb.patch("paneles",modal.id,payload);
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>p.map(x=>x.id===modal.id?saved:x)); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null);
        alert("✓ Panel actualizado correctamente");
        // Si el panel está Ocupado, navegar a Histórico
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
      <Modal title={modal==="nuevo"?"➕ Nuevo Panel":"✏️ Editar Panel"} onClose={()=>{setModal(null);setGeocodeMsg("");}} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar Panel ✓"}>
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
                      color: diasVence>15?"#10B981":diasVence>0?"#F59E0B":"#EF4444",
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
                      color: contrato.pagado?"#10B981":"#F59E0B",
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
function Contratos({contratos,setContratos,paneles,clientes,loading,setTab}){
  const [filtro,setFiltro]=useState("Activos");
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
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

  const openNew=()=>{ setForm(emptyC); setModal("nuevo"); };
  const openEdit=(c)=>{
    const pm=c.pagosMeses||{};
    setForm({panel_id:c.panel_id,cliente_id:c.cliente_id,inicio:c.inicio||"",fin:c.fin||"",monto:c.monto||"",pagosMeses:pm});
    setModal(c);
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
      setModal(null);
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

  const F=({label,children})=>(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</label>
      {children}
    </div>
  );
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const sel={...inp,cursor:"pointer"};

  const pagosMarcados=Object.values(form.pagosMeses||{}).filter(Boolean).length;

  return(<div>
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}>
          {/* Drag handle iOS */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modal==="nuevo"?"➕ Nuevo Contrato":"✏️ Editar Contrato"}</span>
            <button onClick={()=>setModal(null)} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <F label="Panel *">
            <select value={form.panel_id} onChange={e=>setForm(f=>({...f,panel_id:e.target.value}))} style={sel}>
              <option value="">— Selecciona un panel —</option>
              {paneles.map(p=><option key={p.id} value={p.id}>{p.foto} {p.nombre} · {p.ciudad} · {p.estado}</option>)}
            </select>
          </F>

          <F label="Cliente *">
            <select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))} style={sel}>
              <option value="">— Selecciona un cliente —</option>
              {clientes.filter(c=>c.tipo==="Cliente").map(c=><option key={c.id} value={c.id}>{c.empresa} · {c.contacto}</option>)}
            </select>
          </F>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="Fecha inicio *">
              <input type="date" value={form.inicio}
                onChange={e=>setForm(f=>({...f,inicio:e.target.value,pagosMeses:{}}))}
                onMouseDown={e=>e.stopPropagation()}
                onTouchStart={e=>e.stopPropagation()}
                style={{...inp,colorScheme:"dark",cursor:"pointer"}}/>
            </F>
            <F label="Fecha fin *">
              <input type="date" value={form.fin}
                onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))}
                onMouseDown={e=>e.stopPropagation()}
                onTouchStart={e=>e.stopPropagation()}
                style={{...inp,colorScheme:"dark",cursor:"pointer"}}/>
            </F>
          </div>

          <F label="Monto mensual ($) *">
            <input type="number" min="0" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} placeholder="Ej: 1500" style={inp}/>
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
            <button onClick={()=>setModal(null)} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancelar</button>
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

// ── CRM ──────────────────────────────────────────────────────────
function CRM({clientes,setClientes,contratos,loading}){
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [activeFilter,setActiveFilter]=useState("Todos");
  const [saving,setSaving]=useState(false);
  const [page,setPage]=useState(1);
  const perPage=10;
  const emptyC={tipo:"Prospecto",empresa:"",contacto:"",celular:"",email:"",ruc:"",ciudad:"Lima",sector:"Alimentación",estado:"En contacto",notas:""};
  const [form,setForm]=useState(emptyC);

  const openNew=()=>{ setForm(emptyC); setModal("nuevo"); };
  const openEdit=(r)=>{ setForm({...r}); setModal(r); };

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
    setSaving(false); setModal(null);
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

  // Paleta compartida para avatares
  const avatarPalette=[
    {from:"#7C3AED",to:"#A855F7",glow:"rgba(124,58,237,0.55)"},
    {from:"#059669",to:"#10B981",glow:"rgba(16,185,129,0.50)"},
    {from:"#D97706",to:"#FBBF24",glow:"rgba(251,191,36,0.50)"},
    {from:"#2563EB",to:"#60A5FA",glow:"rgba(96,165,250,0.50)"},
    {from:"#DC2626",to:"#F87171",glow:"rgba(248,113,113,0.50)"},
    {from:"#0891B2",to:"#22D3EE",glow:"rgba(34,211,238,0.50)"},
    {from:"#7C3AED",to:"#C084FC",glow:"rgba(192,132,252,0.50)"},
    {from:"#DB2777",to:"#F472B6",glow:"rgba(244,114,182,0.50)"},
    {from:"#EA580C",to:"#FB923C",glow:"rgba(251,146,60,0.50)"},
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

  const estadoColorCRM=(e)=>({
    "Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,
    "En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red,
  }[e]||C.muted);

  return(<div>
    <style>{`
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      @keyframes drawLine{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      .crm-row-hover:hover{background:rgba(124,58,237,0.05)!important;border-color:rgba(124,58,237,0.2)!important;}
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
        background:"linear-gradient(135deg,#7C3AED,#4F7CFF)",
        border:"none",borderRadius:12,padding:"10px 18px",cursor:"pointer",
        color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit",
        boxShadow:"0 4px 20px rgba(124,58,237,0.45),inset 0 1px 0 rgba(255,255,255,0.15)",
        transition:"all 0.15s ease",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo contacto
      </button>
    </div>

    {/* ── METRIC CARDS ── */}
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:20}}>
      {/* Clientes */}
      <div style={{background:"linear-gradient(145deg,rgba(16,185,129,0.12),rgba(16,185,129,0.04))",border:"1px solid rgba(16,185,129,0.25)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animation:"fadeUp 0.5s ease both",animationDelay:"0.05s",boxShadow:"0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.05)"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(16,185,129,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(16,185,129,0.2)",border:"1px solid rgba(16,185,129,0.35)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(16,185,129,0.25)"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:C.green,letterSpacing:1,textTransform:"uppercase"}}>Clientes</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,letterSpacing:"-2px",lineHeight:1}}>{clis.length}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>registrados</div>
          </div>
          <SparklineMini color={C.green} data={SPARK_CLI}/>
        </div>
        <div style={{marginTop:12}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:C.green}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
            activos
          </span>
        </div>
      </div>

      {/* Prospectos */}
      <div style={{background:"linear-gradient(145deg,rgba(124,58,237,0.14),rgba(79,124,255,0.06))",border:"1px solid rgba(124,58,237,0.28)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animation:"fadeUp 0.5s ease both",animationDelay:"0.1s",boxShadow:"0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.05)"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(124,58,237,0.15) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.38)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(124,58,237,0.3)"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:"#A78BFA",letterSpacing:1,textTransform:"uppercase"}}>Prospectos</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,letterSpacing:"-2px",lineHeight:1}}>{pros.length}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>en pipeline</div>
          </div>
          <SparklineMini color="#A78BFA" data={SPARK_PRO}/>
        </div>
        <div style={{marginTop:12}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#A78BFA"}}>
            Por captar
          </span>
        </div>
      </div>

      {/* Propuestas */}
      <div style={{background:"linear-gradient(145deg,rgba(245,158,11,0.12),rgba(239,68,68,0.04))",border:"1px solid rgba(245,158,11,0.25)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animation:"fadeUp 0.5s ease both",animationDelay:"0.15s",boxShadow:"0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.05)"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(245,158,11,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(245,158,11,0.2)",border:"1px solid rgba(245,158,11,0.38)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(245,158,11,0.25)"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:C.amber,letterSpacing:1,textTransform:"uppercase"}}>Propuestas</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,letterSpacing:"-2px",lineHeight:1}}>{propuestas.length}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>abiertas</div>
          </div>
          <SparklineMini color={C.amber} data={SPARK_PROP}/>
        </div>
        <div style={{marginTop:12}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:C.amber}}>
            Por cerrar
          </span>
        </div>
      </div>
    </div>

    {/* ── SEARCH ── */}
    <div style={{display:"flex",gap:12,marginBottom:14,animation:"fadeUp 0.5s ease both",animationDelay:"0.18s"}}>
      <div style={{flex:1,position:"relative"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPage(1);}}
          placeholder="Buscar empresa, contacto, ciudad..."
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px 10px 40px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",transition:"border-color 0.15s",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor="rgba(124,58,237,0.5)"}
          onBlur={e=>e.target.style.borderColor=C.border}/>
      </div>
    </div>

    {/* ── FILTER CHIPS ── */}
    <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center",animation:"fadeUp 0.5s ease both",animationDelay:"0.22s"}}>
      {filters.map(f=>{
        const active=activeFilter===f;
        const dot=f==="Activos"?C.green:f==="En riesgo"?C.amber:null;
        return(
          <button key={f} onClick={()=>{setActiveFilter(f);setPage(1);}} className={active?"":"crm-chip"}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,
              border:`1px solid ${active?"rgba(124,58,237,0.5)":C.border}`,
              background:active?"linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,124,255,0.2))":"rgba(255,255,255,0.03)",
              color:active?C.white:C.muted,fontWeight:active?700:500,
              fontSize:12,cursor:"pointer",fontFamily:"inherit",
              boxShadow:active?"0 0 0 1px rgba(124,58,237,0.25),0 4px 16px rgba(124,58,237,0.15)":"none",
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
                  background:page===n?"linear-gradient(135deg,#7C3AED,#4F7CFF)":"rgba(255,255,255,0.05)",
                  color:page===n?"#fff":C.muted,fontSize:12,fontWeight:page===n?700:400,fontFamily:"inherit",
                  boxShadow:page===n?"0 2px 12px rgba(124,58,237,0.4)":"none",transition:"all 0.15s"}}>
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
      <Modal title={modal==="nuevo"?"➕ Nuevo Contacto":"✏️ Editar Contacto"} onClose={()=>setModal(null)} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar ✓"}>
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
      background:"linear-gradient(135deg,rgba(79,124,255,0.12),rgba(124,58,237,0.08))",
      border:"1px solid rgba(79,124,255,0.25)",borderRadius:16,padding:"16px 20px",
      animation:"fadeUp 0.5s ease both",animationDelay:"0.65s",marginBottom:8}}>
      <div style={{width:34,height:34,borderRadius:10,flexShrink:0,
        background:"linear-gradient(135deg,#4F7CFF,#7C3AED)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 0 16px rgba(79,124,255,0.4)"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
      <p style={{flex:1,fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.5,margin:0}}>
        <strong style={{color:C.white}}>Consejo:</strong> Agregar 10 prospectos nuevos esta semana puede aumentar tus ingresos mensuales en un{" "}
        <strong style={{color:"#A78BFA"}}>30%</strong>.
      </p>
      <button className="crm-btn" onClick={openNew} style={{
        flexShrink:0,display:"flex",alignItems:"center",gap:8,
        background:"linear-gradient(135deg,#4F7CFF,#7C3AED)",
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
            .logo-img{height:54px;width:auto;object-fit:contain;filter:brightness(0) invert(1)}
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
              <img class="logo-img" src="${LOGO_B64}" alt="8 Millas"/>
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
                    .logo-img{height:58px;width:auto;object-fit:contain;filter:brightness(0) invert(1)}
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
                        <img class="logo-img" src="${LOGO_B64}" alt="8 Millas"/>
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
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
      {[["💵 Ingresos Cobrados",fmt(ingCob),C.green,"contratos pagados"],["⏳ Por Cobrar",fmt(ingPend),C.amber,"contratos pendientes"],["📉 Total Gastos",fmt(totGastos),C.red,`${gastosMes.length} conceptos`],["✅ Utilidad Neta",fmt(utilidad),utilidad>=0?C.green:C.red,`Margen ${margen}%`]].map(([l,v,c,s])=>(
        <Card key={l} style={{padding:"14px 14px"}}>
          <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div>
          <div style={{fontSize:18,fontWeight:800,color:c,letterSpacing:"-0.5px",wordBreak:"break-word"}}>{v}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:3}}>{s}</div>
        </Card>
      ))}
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
      <Modal title={modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"} onClose={()=>setModal(null)} onSave={guardar} saveLabel={saving?"Guardando...":"Agregar ✓"}>
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
            style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#F59E0B,#D97706)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 16px rgba(245,158,11,0.35)"}}>
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

function Gastos({gastos,setGastos,autoScan,setAutoScan}){
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
      setModal("nuevo");
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
      setSaving(false); setModal(null);
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
    setModal("nuevo");
  };

  const abrirEditar=(g)=>{
    setForm({...g,monto:String(g.monto||""),igv:String(g.igv||""),subtotal:String(g.subtotal||"")});
    setOcr({loading:false,progress:0,fase:"",text:g.foto_texto||"",imgUrl:"",previewUrl:""});
    setModal(g);
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
                    .h-left .logo-img{height:48px;width:auto;object-fit:contain;filter:brightness(0) invert(1)}
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
                      <img class="logo-img" src="${LOGO_B64}" alt="8 Millas"/>
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
        onClick={e=>e.target===e.currentTarget&&setModal(null)}>
        <div style={{background:"#0B1324",border:"1px solid #1E3050",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:540,maxHeight:"93vh",overflowY:"auto",paddingBottom:36}}>

          {/* Handle */}
          <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:6}}>
            <div style={{width:36,height:4,borderRadius:2,background:"#2D4060"}}/>
          </div>

          {/* Header del modal */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 22px 16px"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.white}}>
              {modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"}
            </div>
            <button onClick={()=>setModal(null)} style={{width:30,height:30,borderRadius:"50%",background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
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
              <button onClick={()=>setModal(null)} style={{padding:"13px 20px",background:"transparent",border:"1px solid #1E3050",borderRadius:12,color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
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
function Historico({contratos,paneles,clientes}){
  const [filtro,setFiltro]=useState("todos");
  const hoyD=new Date();

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

  return(<div>
    <PgTit icon="📚" title="Histórico" sub={`${todos.length} registros · ${activos.length} activos · ${historicos.length} finalizados`}/>

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
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:900,color:C.green}}>{fmt(c.monto)}/mes</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{c.pagado?"✅ Pagado":"⏳ Pendiente"}</div>
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
    {/* ══════════ 1. HERO ══════════ */}
    <div style={{
      position:"relative",borderRadius:22,overflow:"hidden",
      marginBottom:18,minHeight:230,
      background:"#03040E",
      boxShadow:"0 16px 60px rgba(0,0,0,0.9),0 0 0 1px rgba(109,40,217,0.3)",
    }}>
      {/* ── Sky gradient — deep indigo → twilight purple → warm horizon */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#03040E 0%,#080B28 18%,#0F0A38 35%,#1A0845 52%,#2D0A50 68%,#3D1060 80%,#55185A 90%,#6B2048 97%,#7A2840 100%)"}}/>

      {/* ── Milky Way band — faint diagonal streak */}
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:"30%",background:"linear-gradient(125deg,transparent 20%,rgba(180,150,255,0.04) 40%,rgba(200,170,255,0.07) 50%,rgba(180,150,255,0.04) 60%,transparent 80%)",pointerEvents:"none"}}/>

      {/* ── Atmospheric glow right — deep magenta */}
      <div style={{position:"absolute",top:"-10%",right:"-8%",width:"65%",height:"120%",background:"radial-gradient(ellipse at 60% 40%,rgba(168,85,247,0.38) 0%,rgba(120,40,200,0.22) 35%,rgba(80,20,140,0.1) 60%,transparent 80%)",pointerEvents:"none"}}/>
      {/* ── Atmospheric glow left — cool indigo */}
      <div style={{position:"absolute",top:"0%",left:"-10%",width:"55%",height:"80%",background:"radial-gradient(ellipse at 40% 30%,rgba(50,80,220,0.2) 0%,rgba(30,50,180,0.1) 45%,transparent 70%)",pointerEvents:"none"}}/>
      {/* ── Warm horizon glow behind peaks */}
      <div style={{position:"absolute",bottom:"18%",left:"15%",right:"15%",height:"28%",background:"radial-gradient(ellipse at 50% 80%,rgba(220,100,80,0.22) 0%,rgba(180,70,120,0.14) 40%,transparent 75%)",pointerEvents:"none"}}/>

      {/* ── Stars — multiple layers of varying size/brightness */}
      {/* Bright large stars */}
      {[[6,4,1,3],[18,7,0.95,2.5],[34,3,0.9,2.8],[50,6,1,3.2],[65,4,0.85,2.5],[80,8,0.9,2.8],[92,5,0.95,2.5],[45,2,0.8,2],[28,11,0.75,2],[72,3,0.88,2.2],[12,15,0.7,1.8],[58,9,0.82,2]].map(([rx,ry,op,sz],i)=>(
        <div key={`bstar-${i}`} style={{position:"absolute",top:`${ry}%`,left:`${rx}%`,width:sz,height:sz,borderRadius:"50%",background:"white",opacity:op,boxShadow:`0 0 ${sz*4}px ${sz*2}px rgba(220,200,255,0.8)`,pointerEvents:"none"}}/>
      ))}
      {/* Medium stars */}
      {[[3,6,0.7,1.5],[9,12,0.6,1.5],[15,3,0.65,1.8],[23,8,0.55,1.5],[31,5,0.68,1.5],[39,10,0.6,1.5],[47,4,0.72,1.8],[55,7,0.58,1.5],[63,11,0.65,1.5],[71,5,0.7,1.8],[79,13,0.55,1.5],[87,3,0.68,1.5],[95,9,0.6,1.5],[42,14,0.5,1.5],[25,15,0.55,1.5],[68,14,0.52,1.5]].map(([lx,ty,op,sz],i)=>(
        <div key={`mstar-${i}`} style={{position:"absolute",top:`${ty}%`,left:`${lx}%`,width:sz,height:sz,borderRadius:"50%",background:"rgba(240,235,255,1)",opacity:op,boxShadow:`0 0 ${sz*3}px rgba(200,180,255,0.7)`,pointerEvents:"none"}}/>
      ))}
      {/* Small dim stars scattered */}
      {[[5,10,0.45,1],[10,5,0.4,1],[16,18,0.4,1],[20,13,0.42,1],[27,6,0.38,1],[33,16,0.4,1],[41,8,0.44,1],[49,13,0.4,1],[53,3,0.45,1],[61,16,0.38,1],[66,8,0.42,1],[74,12,0.4,1],[82,5,0.44,1],[88,16,0.38,1],[96,7,0.42,1],[14,20,0.35,1],[36,19,0.35,1],[57,18,0.35,1],[78,19,0.35,1]].map(([lx,ty,op,sz],i)=>(
        <div key={`sstar-${i}`} style={{position:"absolute",top:`${ty}%`,left:`${lx}%`,width:sz,height:sz,borderRadius:"50%",background:"rgba(230,225,255,1)",opacity:op,pointerEvents:"none"}}/>
      ))}

      {/* ── Mountain SVG — 3 layers, realistic jagged ridges with snow caps */}
      <svg style={{position:"absolute",bottom:0,left:0,width:"100%",pointerEvents:"none"}} viewBox="0 0 800 180" preserveAspectRatio="none">
        <defs>
          {/* Far mountains — coolest, most desaturated */}
          <linearGradient id="mFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A1040" stopOpacity="0.65"/>
            <stop offset="60%" stopColor="#120C30" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#07051A" stopOpacity="1"/>
          </linearGradient>
          {/* Mid mountains — slightly warmer purple */}
          <linearGradient id="mMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22103A" stopOpacity="0.88"/>
            <stop offset="50%" stopColor="#180C2C" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#080514" stopOpacity="1"/>
          </linearGradient>
          {/* Near mountains — darkest, silhouette foreground */}
          <linearGradient id="mNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#120825" stopOpacity="0.98"/>
            <stop offset="40%" stopColor="#0A0618" stopOpacity="1"/>
            <stop offset="100%" stopColor="#050310" stopOpacity="1"/>
          </linearGradient>
          {/* Snow cap gradient */}
          <linearGradient id="snwCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.9"/>
            <stop offset="50%" stopColor="#C4B5FD" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/>
          </linearGradient>
          {/* Snow cap warm tinted */}
          <linearGradient id="snwWarm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE8D8" stopOpacity="0.75"/>
            <stop offset="60%" stopColor="#C4A8E8" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
          </linearGradient>
          {/* Ridge edge glow */}
          <filter id="ridgeGlow" x="-5%" y="-10%" width="110%" height="130%">
            <feGaussianBlur stdDeviation="1.8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softBlur"><feGaussianBlur stdDeviation="2.5"/></filter>
          <filter id="snowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Layer 1: Farthest range — soft, hazy, barely visible */}
        <polygon
          points="0,180 0,120 35,95 70,115 105,75 145,100 185,58 225,88 265,45 305,78 345,52 385,82 425,62 465,88 505,55 545,80 585,68 620,90 660,72 700,88 740,70 780,82 800,75 800,180"
          fill="url(#mFar)" filter="url(#softBlur)" opacity="0.8"/>

        {/* ── Layer 2: Mid range — main dramatic peaks */}
        <polygon
          points="0,180 0,138 20,128 42,138 65,112 85,125 108,90 130,108 152,72 175,96 198,60 222,86 245,42 268,70 285,52 302,68 318,48 340,72 360,55 378,70 398,88 420,68 442,82 462,58 480,76 500,90 520,68 540,82 558,62 578,80 600,68 622,85 645,65 668,80 690,62 712,80 735,70 758,82 780,72 800,80 800,180"
          fill="url(#mMid)" filter="url(#ridgeGlow)"/>

        {/* Snow caps for mid range peaks */}
        <polygon points="245,42 222,86 255,70 268,70" fill="url(#snwCap)" filter="url(#snowGlow)" opacity="0.85"/>
        <polygon points="152,72 130,108 162,95 175,96" fill="url(#snwCap)" filter="url(#snowGlow)" opacity="0.75"/>
        <polygon points="318,48 302,68 328,62 340,72" fill="url(#snwCap)" filter="url(#snowGlow)" opacity="0.7"/>
        <polygon points="462,58 442,82 472,72 480,76" fill="url(#snwWarm)" filter="url(#snowGlow)" opacity="0.65"/>
        <polygon points="645,65 622,85 654,78 668,80" fill="url(#snwWarm)" filter="url(#snowGlow)" opacity="0.6"/>
        <polygon points="108,90 85,125 118,108 130,108" fill="url(#snwCap)" filter="url(#snowGlow)" opacity="0.6"/>

        {/* Subtle ridge highlight — purple-pink rim light on peaks */}
        <polyline
          points="20,128 42,138 65,112 85,125 108,90 130,108 152,72 175,96 198,60 222,86 245,42 268,70 285,52 302,68 318,48 340,72 360,55 378,70"
          stroke="rgba(167,139,250,0.28)" strokeWidth="1.2" fill="none"/>
        <polyline
          points="378,70 398,88 420,68 442,82 462,58 480,76 500,90 520,68 540,82 558,62 578,80 600,68 622,85 645,65 668,80 690,62 712,80 735,70 758,82 780,72 800,80"
          stroke="rgba(216,180,254,0.18)" strokeWidth="1" fill="none"/>

        {/* ── Layer 3: Foreground — darkest, crisp silhouette */}
        <polygon
          points="0,180 0,155 15,150 32,158 50,142 68,155 85,134 100,148 118,125 135,142 150,130 168,145 185,118 200,136 218,122 235,140 252,128 270,145 288,132 305,148 322,136 340,152 358,138 375,152 392,140 410,155 428,142 445,158 462,144 480,155 498,142 515,156 535,143 555,158 575,145 592,155 610,144 628,158 645,145 662,155 680,143 698,155 715,148 732,155 750,148 768,155 785,148 800,152 800,180"
          fill="url(#mNear)"/>

        {/* Horizon atmospheric haze — warm purple-pink band */}
        <rect x="0" y="155" width="800" height="8" fill="rgba(160,80,180,0.12)" opacity="0.8"/>
        <ellipse cx="280" cy="158" rx="200" ry="10" fill="rgba(200,100,160,0.1)"/>
        <ellipse cx="600" cy="158" rx="160" ry="8" fill="rgba(180,80,200,0.08)"/>
      </svg>

      {/* Gradient overlay bottom — blends mountains into content */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"48%",background:"linear-gradient(to top,rgba(3,4,14,0.92) 0%,rgba(5,6,18,0.6) 50%,transparent 100%)",pointerEvents:"none"}}/>

      {/* ── Content — reorganized: greeting → title → date → badge */}
      <div style={{position:"relative",zIndex:4,padding:"22px 22px 26px"}}>
        {/* Greeting */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.65)",fontWeight:400}}>{saludo},</span>
          <span style={{fontSize:13,color:"#C4B5FD",fontWeight:700}}>Alan Martínez</span>

        </div>

        {/* Title */}
        <div style={{fontSize:32,fontWeight:900,color:"#FFFFFF",letterSpacing:"-1px",lineHeight:1.05,marginBottom:10,textShadow:"0 2px 28px rgba(139,92,246,0.55),0 0 60px rgba(109,40,217,0.3)"}}>
          Resumen de hoy
        </div>

        {/* Fecha — below title */}
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:30,padding:"5px 13px",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",marginBottom:14}}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="2" stroke="#A78BFA" strokeWidth="1.3" fill="none"/><line x1="1" y1="6" x2="13" y2="6" stroke="#A78BFA" strokeWidth="1.3"/><line x1="4" y1="1" x2="4" y2="4" stroke="#A78BFA" strokeWidth="1.3" strokeLinecap="round"/><line x1="10" y1="1" x2="10" y2="4" stroke="#A78BFA" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{fontSize:11.5,color:"rgba(255,255,255,0.85)",fontWeight:500}}>{fechaCap}</span>
        </div>

        {/* Insight badge — below date */}
        <div style={{
          display:"inline-flex",alignItems:"center",gap:10,
          background:"rgba(109,40,217,0.25)",
          border:"1px solid rgba(139,92,246,0.4)",
          borderRadius:14,padding:"9px 15px",
          backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
          boxShadow:"0 4px 24px rgba(109,40,217,0.22),inset 0 1px 0 rgba(255,255,255,0.07)",
        }}>
          <div style={{width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,#7C3AED,#4F7CFF)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 12px rgba(124,58,237,0.55)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div>
            <div style={{fontSize:12.5,fontWeight:700,color:"#E9D5FF",lineHeight:1.2}}>{insightBadge.txt}</div>
            <div style={{fontSize:11,color:"rgba(196,167,255,0.72)",marginTop:1}}>{insightBadge.sub}</div>
          </div>
        </div>
      </div>
    </div>

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(196,167,255,0.7)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Paneles libres</div>
        <div style={{fontSize:28,fontWeight:900,color:"#C4B5FD",letterSpacing:"-1px",textShadow:"0 0 24px rgba(139,92,246,0.7)",position:"relative",zIndex:1}}>{panelLibres}</div>
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
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 12px rgba(124,58,237,0.3)"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
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
                    background:"linear-gradient(135deg,rgba(79,124,255,0.25),rgba(124,58,237,0.2))",
                    border:"1px solid rgba(139,92,246,0.35)",
                    borderRadius:10,padding:"7px 13px",
                    color:"#C4B5FD",fontWeight:700,fontSize:12,
                    cursor:"pointer",whiteSpace:"nowrap",
                    transition:"all 0.15s",
                    boxShadow:"0 2px 10px rgba(124,58,237,0.2)",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,124,255,0.3))";e.currentTarget.style.color="#fff";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(79,124,255,0.25),rgba(124,58,237,0.2))";e.currentTarget.style.color="#C4B5FD";}}
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
              <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 10px rgba(124,58,237,0.3)"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
                background:"none",border:"1px solid rgba(139,92,246,0.35)",
                borderRadius:10,padding:"8px 16px",
                color:"rgba(167,139,250,0.8)",fontWeight:600,fontSize:12,
                cursor:"pointer",transition:"all 0.15s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(124,58,237,0.18)";e.currentTarget.style.color="#C4B5FD";}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="rgba(167,139,250,0.8)";}}
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
      <div class="logo">Vista<span>360</span></div>
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
// ══════════════════════════════════════════════════════════════════
// ── BAR — barra de progreso simple usada en Reportes ─────────────
function Bar({ val, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  return (
    <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }}/>
    </div>
  );
}


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
    <div class="empresa">8 MILLAS</div>
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
.h-left .empresa{font-size:18px;font-weight:900} .h-left .ruc{font-size:10px;opacity:.75;margin-top:3px}
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
    <div class="empresa">8 MILLAS</div>
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

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"rgba(14,24,42,0.7)",
        borderRadius:14,padding:5,overflowX:"auto",scrollbarWidth:"none",border:"1px solid rgba(79,124,255,0.12)"}}>
        {secciones.map(s=>(
          <button key={s.id} onClick={()=>setSeccion(s.id)} style={{
            flexShrink:0,padding:"9px 14px",borderRadius:10,border:"none",cursor:"pointer",
            background:seccion===s.id
              ?"linear-gradient(135deg,rgba(79,124,255,0.32),rgba(123,95,255,0.22))"
              :"transparent",
            color:seccion===s.id?"#FFFFFF":"rgba(255,255,255,0.45)",
            fontWeight:700,fontSize:12,transition:"all 0.15s",
            boxShadow:seccion===s.id?"0 2px 14px rgba(79,124,255,0.25), inset 0 1px 0 rgba(255,255,255,0.06)":"none",
            borderRight:seccion===s.id?`none`:"none",
          }}>
            {s.label}
          </button>
        ))}
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

          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
            {[
              {label:"Ingresos cobrados",val:fmt(kpis.totalIngPagado),color:C.green,icon:"💰",sub:"Contratos pagados",wave:C.green},
              {label:"Por cobrar",val:fmt(kpis.pendiente),color:C.amber,icon:"⏳",sub:"Contratos pendientes",wave:C.amber},
              {label:"Gastos totales",val:fmt(kpis.totalGastos),color:C.red,icon:"💸",sub:"Todos los gastos",wave:C.red},
              {label:"Utilidad neta",val:fmt(kpis.totalUtilidad),color:kpis.totalUtilidad>=0?C.green:C.red,icon:"📈",sub:"Cobrado − Gastos",wave:kpis.totalUtilidad>=0?C.green:C.red},
            ].map(({label,val,color,icon,sub,wave})=>(
              <div key={label} style={{...cardStyle}}>
                <CardWave color={wave}/>
                <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
                <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
                <div style={{fontSize:21,fontWeight:900,color,letterSpacing:"-0.5px",lineHeight:1}}>{val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:5}}>{sub}</div>
              </div>
            ))}
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
            <div style={{...cardStyle,background:"linear-gradient(135deg,rgba(245,158,11,0.12) 0%,rgba(14,24,42,0.97) 60%)"}}>
              <CardWave color={C.amber}/>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:12}}>
                🏆 Mejor mes del año
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(245,158,11,0.18)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,
                  border:"1px solid rgba(245,158,11,0.3)"}}>🏆</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(kpis.mesTop.mes)}</div>
                  <div style={{fontSize:24,fontWeight:900,color:C.amber,letterSpacing:"-0.5px"}}>{fmt(kpis.mesTop.ingPagado)}</div>
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
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <button onClick={()=>setAnio(a=>a-1)} style={{
                width:36,height:36,borderRadius:10,border:"1px solid rgba(79,124,255,0.3)",
                background:"rgba(79,124,255,0.12)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{fontSize:20,fontWeight:800,color:C.white}}>{anio}</div>
              <button onClick={()=>setAnio(a=>a+1)} style={{
                width:36,height:36,borderRadius:10,border:"1px solid rgba(79,124,255,0.3)",
                background:"rgba(79,124,255,0.12)",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...mesesAnio].reverse().map(m => (
              <div key={m.mes} style={{...cardStyle,padding:"16px 18px"}}>
                <CardWave color={m.utilidad>=0?C.green:C.red}/>
                {/* Cabecera mes */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.white}}>{mesLabel(m.mes)}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {m.ingTotal>0&&(
                      <span style={{background:"rgba(16,185,129,0.15)",color:C.green,border:"1px solid rgba(16,185,129,0.25)",
                        borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                        {m.contrActivos} contrato{m.contrActivos!==1?"s":""}
                      </span>
                    )}
                    {/* Botón exportar PDF por mes */}
                    <button onClick={()=>exportMesPDF(m)} style={{
                      display:"inline-flex",alignItems:"center",gap:5,
                      padding:"5px 11px",borderRadius:8,
                      border:"1px solid rgba(239,68,68,0.3)",
                      background:"rgba(239,68,68,0.12)",
                      color:"#FCA5A5",fontWeight:700,fontSize:11,cursor:"pointer",
                      transition:"all 0.15s",
                    }}
                    title={`Exportar PDF de ${mesLabel(m.mes)}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                      </svg>
                      PDF
                    </button>
                  </div>
                </div>

                {/* KPIs del mes */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                  {[
                    {l:"Cobrado",v:fmt(m.ingPagado),c:C.green},
                    {l:"Gastos",v:fmt(m.gastosMes),c:C.red},
                    {l:"Utilidad",v:fmt(m.utilidad),c:m.utilidad>=0?C.green:C.red},
                  ].map(({l,v,c})=>(
                    <div key={l} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 10px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Barra progreso */}
                {m.ingTotal>0&&(
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:10,color:C.muted}}>Cobrado / Total facturado</span>
                      <span style={{fontSize:10,color:C.muted,fontWeight:700}}>
                        {Math.round((m.ingPagado/m.ingTotal)*100)}%
                      </span>
                    </div>
                    <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:`${Math.round((m.ingPagado/m.ingTotal)*100)}%`,
                        background:`linear-gradient(90deg,${C.green},${C.green}88)`,
                        boxShadow:`0 0 8px ${C.green}44`}}/>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
                      <div style={{fontSize:18,fontWeight:800,color:p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}}>
                        {p.ocupPct}%
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                    {[
                      {l:"Ingresos cobrados",v:fmt(p.ingreso),c:C.green},
                      {l:"Por cobrar",v:fmt(p.pendiente),c:C.amber},
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
                      <span style={{fontSize:10,fontWeight:700,color:p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}}>{p.ocupPct}%</span>
                    </div>
                    <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:`${p.ocupPct}%`,
                        background:p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}}/>
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
                        <span style={{background:(c.pagado?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)"),
                          color:c.pagado?C.green:C.amber,
                          border:`1px solid ${c.pagado?"rgba(16,185,129,0.3)":"rgba(245,158,11,0.3)"}`,
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
function HeroWaveArt() {
  // Topographic flowing curves — like silk folds, anchored to right edge
  const layers = [];
  // Layer A — main bright bundle (32 lines, brightest in middle)
  for (let i = 0; i < 34; i++) {
    const t = i / 33;
    const dy = -8 - t * 120;        // each line offset upward
    const dx = -t * 22;              // slight leftward drift
    // path: starts off-canvas right, sweeps down-left into a deep valley, back up, exits
    const d = `M ${420 + dx} ${280 + dy}
               C ${360 + dx} ${230 + dy}, ${300 + dx} ${220 + dy}, ${230 + dx} ${170 + dy}
               S ${110 + dx} ${110 + dy}, ${30 + dx}  ${60 + dy}`;
    // Color band: outer rim is bright cyan-white, body is royal blue, deep is indigo
    const stroke = i < 5 ? "#E8F1FF" : i < 10 ? "#A6C5FF" : i < 22 ? "#3D78FF" : "#1C45C8";
    const w = i < 5 ? 0.9 : i < 10 ? 0.95 : 1.05;
    const op = i < 5 ? 0.95 - i * 0.05 : i < 10 ? 0.85 : 0.42 + (1 - Math.abs(t - 0.55) * 1.6) * 0.5;
    layers.push(<path key={"a"+i} d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" opacity={Math.max(0.05, Math.min(1, op))}/>);
  }
  // Layer B — secondary mirrored bundle below (gives the second “wave hump”)
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const dy = -t * 60;
    const dx = -t * 14;
    const d = `M ${420 + dx} ${260 + dy}
               C ${340 + dx} ${260 + dy}, ${280 + dx} ${290 + dy}, ${210 + dx} ${275 + dy}
               S ${110 + dx} ${235 + dy}, ${30 + dx} ${210 + dy}`;
    const stroke = i < 3 ? "#BCD3FF" : i < 8 ? "#5589FF" : "#1F4DC8";
    layers.push(<path key={"b"+i} d={d} fill="none" stroke={stroke} strokeWidth={i < 3 ? 0.85 : 1} strokeLinecap="round" opacity={i < 3 ? 0.65 - i*0.1 : 0.32}/>);
  }
  return (
    <svg viewBox="0 0 420 280" preserveAspectRatio="xMaxYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="hbglow" cx="82%" cy="45%" r="60%">
          <stop offset="0%"  stopColor="#3268E6" stopOpacity="0.55"/>
          <stop offset="45%" stopColor="#0F2A6E" stopOpacity="0.30"/>
          <stop offset="100%" stopColor="#0A0B11" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="hbsheen" cx="75%" cy="35%" r="22%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="hbleft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#0A0B11" stopOpacity="1"/>
          <stop offset="38%" stopColor="#0A0B11" stopOpacity="0.65"/>
          <stop offset="60%" stopColor="#0A0B11" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect width="420" height="280" fill="url(#hbglow)"/>
      <g>{layers}</g>
      <rect width="420" height="280" fill="url(#hbsheen)"/>
      {/* fade left side so text stays readable */}
      <rect width="420" height="280" fill="url(#hbleft)"/>
    </svg>
  );
}

function HeroCard({ panalesLibres }) {
  const count = panalesLibres > 0 ? panalesLibres : 0;
  const msg = count > 0
    ? `Tienes ${count} panel${count > 1 ? "es" : ""} libre${count > 1 ? "s" : ""}\nlistos para asignar.`
    : "Todos los paneles están asignados\ny generando ingresos.";

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const fechaHoy = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const fechaCap = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  return (
    <div style={{
      borderRadius: 26, overflow: "hidden",
      background: "#0A0B11", position: "relative",
      marginBottom: 22,
      boxShadow: "0 12px 36px -12px rgba(8,12,28,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
      minHeight: 270,
    }}>
      <HeroWaveArt/>
      <div style={{ position: "relative", zIndex: 2, padding: "26px 24px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 270 }}>

        {/* Bloque superior: saludo */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>{saludo},</span>
            <span style={{ fontSize: 13, color: "#5B9BFF", fontWeight: 700 }}>Alan Martínez</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 30, padding: "4px 12px", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: 0.2 }}>{fechaCap}</span>
          </div>
        </div>

        {/* Bloque inferior: título */}
        <div style={{ marginTop: 36 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.04em", marginTop: 18 }}>
            Todo bajo<br/>control.
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
      <div style={{ width: 38, height: 38, borderRadius: 11, background: NL.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{icon}</div>
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
      <HeroCard panalesLibres={panalesLibres} />
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
        res.push({ tipo: "cliente", id: c.id, titulo: c.empresa, sub: `${c.contacto || ""}${c.ciudad ? " · " + c.ciudad : ""}`, tag: c.tipo, tagColor: c.tipo === "Cliente" ? "#10B981" : "#7C3AED", tab: "crm" });
      }
    });

    contratos.forEach(ct => {
      const panel   = paneles.find(p => p.id === ct.panel_id);
      const cliente = clientes.find(c => c.id === ct.cliente_id);
      const haystack = [ct.concepto, panel?.nombre, cliente?.empresa, ct.estado, ct.monto?.toString()].join(" ").toLowerCase();
      if (haystack.includes(texto)) {
        const dRestantes = Math.ceil((new Date(ct.fin) - new Date()) / 86400000);
        const tagColor = ct.estado === "Activo" ? "#10B981" : ct.estado === "Por vencer" ? "#F59E0B" : "#EF4444";
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
        paddingTop: "max(64px, env(safe-area-inset-top))",
        paddingBottom: "env(safe-area-inset-bottom)",
        overflow: "hidden",
      }}>

        {/* ── Perfil de usuario ── */}
        <button
          onClick={() => { onTabClick("perfil"); onClose(); }}
          style={{
            padding: "8px 22px 24px",
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
          padding: "18px 0 28px",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8,
            position: "relative", zIndex: 2,
          }}>
            <img src={DRAWER_LOGO_B64} alt="Vista360" style={{width:170,height:"auto",display:"block",objectFit:"contain"}}/>
            <div style={{
              fontSize: 9.5, fontWeight: 600,
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
        background: "radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 70%)",
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
  const [clientes, setClientes]     = useState([]);
  const [paneles, setPaneles]       = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [gastos, setGastos]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoScan, setAutoScan]     = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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
    ]).then(([c, p, ct, g]) => {
      // Filtrar registros marcados como eliminados (borrado lógico)
      setClientes(Array.isArray(c)  ? c.filter(x => !x.deleted)  : []);
      setPaneles(Array.isArray(p)   ? p                           : []); // paneles: borrado físico
      setContratos(Array.isArray(ct)? ct.filter(x => !x.deleted) : []);
      setGastos(Array.isArray(g) ? g : []);
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
        {tab === "paneles"     && <Paneles     paneles={paneles} setPaneles={setPaneles} loading={loading} setTab={setTab}/>}
        {tab === "contratos"   && <Contratos   contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} loading={loading} setTab={setTab}/>}
        {tab === "historico"   && <Historico   contratos={contratos} paneles={paneles} clientes={clientes}/>}
        {tab === "crm"         && <CRM         clientes={clientes} setClientes={setClientes} contratos={contratos} loading={loading}/>}
        {tab === "resultados"  && <Resultados  contratos={contratos} loading={loading}/>}
        {tab === "reportes"    && <Reportes    contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos}/>}
        {tab === "gastos"      && <Gastos      gastos={gastos} setGastos={setGastos} autoScan={autoScan} setAutoScan={setAutoScan}/>}
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
          background: "rgba(242,244,248,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(229,231,235,0.7)`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {/* Botón menú */}
          <button onClick={() => setDrawerOpen(true)} aria-label="Menú" style={{
            width: 40, height: 40, borderRadius: 12,
            background: NL.text, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 4px 12px rgba(15,23,41,0.18)",
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
            <div style={{ fontSize: 15, fontWeight: 700, color: NL.text, lineHeight: 1.1 }}>
              {showProfile ? "Perfil" : {
                hoy:"Inicio", dashboard:"Dashboard", mapa:"Mapa",
                paneles:"Paneles", contratos:"Contratos", historico:"Histórico",
                crm:"Clientes", resultados:"Resultados", reportes:"Reportes",
                gastos:"Gastos", facturacion:"Facturación",
              }[tab] || "Vista360"}
            </div>

          </div>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setGlobalSearch(true)} aria-label="Buscar" style={{ width: 40, height: 40, borderRadius: "50%", background: NL.white, border: `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z" stroke={NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onClick={() => setNotifOpen(v => !v)} aria-label="Notificaciones" style={{ width: 40, height: 40, borderRadius: "50%", background: NL.white, border: `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M15 17H9M15 17C15 18.657 13.657 20 12 20C10.343 20 9 18.657 9 17M15 17H20L18.784 15.784C18.284 15.284 18 14.612 18 13.914V10C18 7.239 15.761 5 13 5H11C8.239 5 6 7.239 6 10V13.914C6 14.612 5.716 15.284 5.216 15.784L4 17H9" stroke={NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button onClick={() => handleTabClick("perfil")} aria-label="Perfil" style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, border: showProfile ? `2px solid ${NL.accent}` : "2px solid transparent", cursor: "pointer" }}>
              {user?.displayName ? user.displayName.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase() : "AM"}
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
        <div style={{
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
                      background: "linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)",
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
        </div>

        {/* ── DRAWER ── */}
        <BusquedaGlobal open={globalSearch} onClose={() => setGlobalSearch(false)} paneles={paneles} clientes={clientes} contratos={contratos} onNavigate={handleTabClick}/>
        <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} onTabClick={handleTabClick}/>
      </div>
    </>
  );
}
