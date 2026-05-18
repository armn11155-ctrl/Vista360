
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ── VIEWPORT FIX: meter viewport-fit=cover en <head> antes del primer render ──
// El <meta viewport> que está en el JSX lo ignora iOS porque queda dentro de #root.
// Esto corre al cargar el módulo, antes de que React toque el DOM.
;(function(){
  try {
    var vp = document.querySelector('meta[name="viewport"]');
    var c  = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
    if (vp) { vp.setAttribute('content', c); }
    else {
      var m = document.createElement('meta');
      m.name = 'viewport'; m.content = c;
      document.head.appendChild(m);
    }
    // apple-mobile-web-app-capable también al <head>
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      var a = document.createElement('meta');
      a.name = 'apple-mobile-web-app-capable'; a.content = 'yes';
      document.head.appendChild(a);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      var s = document.createElement('meta');
      s.name = 'apple-mobile-web-app-status-bar-style'; s.content = 'default';
      document.head.appendChild(s);
    }
  } catch(e) {}
})();

// ══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE — Vite + npm (firebase package instalado)
// ══════════════════════════════════════════════════════════════════
import { initializeApp }    from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, serverTimestamp, setDoc, getDoc, onSnapshot } from "firebase/firestore";
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

// ── HAPTIC FEEDBACK ─────────────────────────────────────────────
const haptic = (type = "light") => {
  try {
    if (navigator.vibrate) {
      const patterns = { light: [10], medium: [20], success: [10, 50, 20], error: [30, 20, 30] };
      navigator.vibrate(patterns[type] || [10]);
    }
  } catch {}
};

// ── DESIGN TOKENS UNIFICADOS ────────────────────────────────────
const D = {
  dark:    "#0D1629",   // card oscura — UN SOLO azul oscuro en toda la app
  darker:  "#07101F",   // fondo en pantalla capital
  accent:  "#2563EB",   // azul acción
  accentLt:"#EFF4FF",
  green:   "#10B981",
  red:     "#EF4444",
  amber:   "#F59E0B",
  bg:      "#F2F4F8",   // fondo claro
  text:    "#0D1629",
  muted:   "#64748B",
  border:  "#E5E7EB",
  white:   "#FFFFFF",
};

// ── PALETA ───────────────────────────────────────────────────────
const C = {
  bg:"#F2F4F8", surface:"#FFFFFF", card:"#FFFFFF", border:"#E5E7EB",
  accent:"#2563EB", green:"#10B981", red:"#EF4444", amber:"#F59E0B",
  purple:"#7C3AED", cyan:"#0891B2", text:"#0F1729", muted:"#64748B", white:"#FFFFFF",
  sidebarBg:"#FFFFFF", contentBg:"#F2F4F8",
};
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};


// ══════════════════════════════════════════════════════════════════
// 🔔 TOAST SYSTEM — reemplaza alert() y confirm() nativos
// ══════════════════════════════════════════════════════════════════
let _toastDispatch = null;
const toast = {
  success: (msg) => _toastDispatch?.({ type: "success", msg }),
  error:   (msg) => _toastDispatch?.({ type: "error",   msg }),
  info:    (msg) => _toastDispatch?.({ type: "info",    msg }),
  warn:    (msg) => _toastDispatch?.({ type: "warn",    msg }),
};

// confirm() asíncrono — devuelve Promise<boolean>
let _confirmDispatch = null;
const confirmAsync = (msg, opts = {}) =>
  new Promise((resolve) => _confirmDispatch?.({ msg, opts, resolve }));

function ToastProvider() {
  const [toasts, setToasts]     = useState([]);
  const [confirm, setConfirm]   = useState(null); // { msg, opts, resolve }

  useEffect(() => {
    _toastDispatch = ({ type, msg }) => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, type, msg }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
    };
    _confirmDispatch = (payload) => setConfirm(payload);
    return () => { _toastDispatch = null; _confirmDispatch = null; };
  }, []);

  const ICONS = {
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    info:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    warn:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  };
  const COLORS = {
    success: { bg: "#0F172A", border: "#10B981", icon: "#10B981" },
    error:   { bg: "#0F172A", border: "#EF4444", icon: "#EF4444" },
    info:    { bg: "#0F172A", border: "#3B82F6", icon: "#3B82F6" },
    warn:    { bg: "#0F172A", border: "#F59E0B", icon: "#F59E0B" },
  };

  return (
    <>
      {/* Toasts */}
      <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none", width: "min(340px, 92vw)" }}>
        {toasts.map(({ id, type, msg }) => {
          const c = COLORS[type];
          return (
            <div key={id} style={{ background: c.bg, border: `1px solid ${c.border}44`, borderLeft: `3px solid ${c.border}`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "fadeUp .2s ease", pointerEvents: "auto", width: "100%" }}>
              <span style={{ color: c.icon, flexShrink: 0 }}>{ICONS[type]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{msg}</span>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: "28px 24px", width: "100%", maxWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 8, lineHeight: 1.4 }}>{confirm.opts?.title || "Confirmar"}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24, lineHeight: 1.5 }}>{confirm.msg}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { confirm.resolve(false); setConfirm(null); }}
                style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid #E2E8F0", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", touchAction: "manipulation", color: "#64748B", fontFamily: "inherit" }}>
                {confirm.opts?.cancel || "Cancelar"}
              </button>
              <button onClick={() => { confirm.resolve(true); setConfirm(null); }}
                style={{ flex: 1, padding: "12px", background: confirm.opts?.danger ? "#EF4444" : "#0F172A", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", touchAction: "manipulation", color: "#fff", fontFamily: "inherit" }}>
                {confirm.opts?.ok || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ── SKELETON COMPONENTS ──────────────────────────────────────────
const SkPulse = ({ w="100%", h=16, r=8, style={} }) => (
  <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%)", backgroundSize:"200% 100%", animation:"skPulse 1.4s ease infinite", flexShrink:0, ...style }}/>
);

const SkCard = () => (
  <div style={{ background:"#fff", borderRadius:20, padding:20, border:"1px solid #E5E7EB", marginBottom:14 }}>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      <SkPulse w={48} h={48} r={12}/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
        <SkPulse h={14} r={6}/>
        <SkPulse w="60%" h={11} r={6}/>
      </div>
    </div>
    <SkPulse h={11} r={6} style={{ marginBottom:8 }}/>
    <SkPulse w="80%" h={11} r={6}/>
  </div>
);

const SkDarkCard = () => (
  <div style={{ background:D.dark, borderRadius:20, padding:20, marginBottom:12 }}>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.06)", flexShrink:0 }}/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ height:13, borderRadius:6, background:"rgba(255,255,255,0.08)" }}/>
        <div style={{ height:10, width:"55%", borderRadius:6, background:"rgba(255,255,255,0.05)" }}/>
      </div>
    </div>
    <div style={{ height:10, borderRadius:6, background:"rgba(255,255,255,0.06)", marginBottom:8 }}/>
    <div style={{ height:10, width:"70%", borderRadius:6, background:"rgba(255,255,255,0.04)" }}/>
  </div>
);

function SkeletonPaneles() {
  return <div>{[1,2,3].map(i=><SkDarkCard key={i}/>)}</div>;
}
function SkeletonContratos() {
  return <div>{[1,2,3,4].map(i=><SkDarkCard key={i}/>)}</div>;
}
function SkeletonCRM() {
  return <div>{[1,2,3].map(i=><SkCard key={i}/>)}</div>;
}

// ── ATOMS ────────────────────────────────────────────────────────
const Badge  = ({color,ch})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Card   = ({children,style={}})=><div style={{background:"linear-gradient(145deg,rgba(14,24,42,0.95) 0%,rgba(8,14,26,0.98) 100%)",border:`1px solid rgba(79,124,255,0.13)`,borderRadius:16,padding:22,boxShadow:"0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",...style}}>{children}</div>;
const SecTit = ({ch})=><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>{ch}</div>;
const PgTit  = ({icon,title,sub,dark})=><div style={{marginBottom:22,padding:"16px 16px 0"}}><div style={{fontSize:22,fontWeight:800,color:dark?"#fff":D.text,letterSpacing:"-0.5px"}}>{icon} {title}</div>{sub&&<div style={{fontSize:13,color:dark?"rgba(255,255,255,0.5)":"#64748B",marginTop:3}}>{sub}</div>}</div>;
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


// ── SWIPE ROW — desliza a la izquierda para ver acciones ─────────
function SwipeRow({ children, onDelete, onEdit, deleteLabel = "Eliminar" }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const rowRef = useRef(null);
  const ACTION_W = 80;
  const THRESHOLD = 40;

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    if (dx < 0) { setOffset(0); return; }
    setOffset(Math.min(dx, ACTION_W + 10));
  };
  const onTouchEnd = () => {
    setDragging(false);
    startX.current = null;
    if (offset > THRESHOLD) setOffset(ACTION_W);
    else setOffset(0);
  };
  const close = () => setOffset(0);

  return (
    <div ref={rowRef} style={{ position:"relative", overflow:"hidden", marginBottom:10, borderRadius:22 }}>
      {/* Action button revealed on swipe */}
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:ACTION_W, display:"flex", alignItems:"stretch", borderRadius:"0 22px 22px 0", overflow:"hidden" }}>
        <button onClick={() => { close(); onDelete?.(); }}
          style={{ flex:1, background:"#EF4444", border:"none", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", touchAction:"manipulation", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          {deleteLabel}
        </button>
      </div>
      {/* Main content slides left */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform:`translateX(-${offset}px)`, transition: dragging ? "none" : "transform .25s cubic-bezier(.4,0,.2,1)", willChange:"transform" }}
      >
        {children}
      </div>
    </div>
  );
}


// ── PULL TO REFRESH ──────────────────────────────────────────────

// ── MODAL BASE ───────────────────────────────────────────────────
function Modal({title,onClose,onSave,saveLabel="Guardar ✓",children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",overscrollBehavior:"none",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}>
        {/* Drag handle iOS */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:800,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:20,position:"sticky",bottom:0}}>
          <button onClick={onClose} style={{flex:1,padding:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontWeight:600,cursor:"pointer",touchAction:"manipulation",fontSize:14,minHeight:46}}>Cancelar</button>
          <button onClick={onSave} style={{flex:2,padding:14,background:C.accent,border:"none",borderRadius:12,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",minHeight:46}}>{saveLabel}</button>
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

const LOGO_B64 = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAQABgADASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAgJBgcBAgUEA//EAGMQAQABAwMCAwQFAwsMCxACAwABAgMEBQYRByEIEjETIkFRCTJhcYEUkaEVFiMzQnKCkpSx0xc1UmJjc5Oys7TB0RgkJ0NHU1d0g6KjJTQ4RVVkZWZ1doSFlaTCwyjUNuHw/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==";
const DRAWER_LOGO_B64 = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAQABgADASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAgJBgcBAgUEA//EAGMQAQABAwMCAwQFAwsMCxACAwABAgMEBQYRByEIEjETIkFRCTJhcYEUkaEVFiMzQnKCkpSx0xc1UmJjc5Oys7TB0RgkJ0NHU1d0g6KjJTQ4RVVkZWZ1doSFlaTCwyjUNuHw/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==";
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
      position:"fixed",
      top:0, right:0, bottom:0, left:0,
      zIndex:999,
      background:D.dark,
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
function Paneles({paneles,setPaneles,contratos,loading,setTab,onModalChange}){
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);

  const empty={nombre:"",tipo:"LED",precio:0,estado:"Libre",foto:"📡",ciudad:"Lima",direccion:"",lat:"",lng:"",ancho:"",alto:"",iluminacion:"Sí",visibilidad:"",notas:"",costoInstalacion:"",fechaInstalacion:"",vidaUtilAnios:10};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ setForm(empty); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(p)=>{ setForm({...p}); setModal(p); onModalChange?.(true); };

  const guardar=async()=>{
    if(!form.nombre.trim()) return toast.warn("Escribe el nombre del panel");
    setSaving(true);
    const payload={nombre:form.nombre,tipo:form.tipo,precio:Number(form.precio)||0,estado:form.estado,foto:form.foto||"📡",ciudad:form.ciudad,direccion:form.direccion||"",lat:form.lat?String(form.lat):null,lng:form.lng?String(form.lng):null,ancho:form.ancho||"",alto:form.alto||"",iluminacion:form.iluminacion||"Sí",visibilidad:form.visibilidad||"",notas:form.notas||"",costoInstalacion:Number(form.costoInstalacion)||0,fechaInstalacion:form.fechaInstalacion||"",vidaUtilAnios:Number(form.vidaUtilAnios)||10};
    try{
      if(modal==="nuevo"){
        const r=await fb.post("paneles",payload);
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>[...p,saved]); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null); onModalChange?.(false);
        toast.success("✓ Panel guardado correctamente");
        if(payload.estado==="Ocupado"&&setTab) setTab("historico");
      } else {
        const r=await fb.patch("paneles",modal.id,payload);
        const saved=r&&r.length>0&&r[0]&&r[0].id ? r[0] : null;
        if(saved){ setPaneles(p=>p.map(x=>x.id===modal.id?saved:x)); }
        else { const fresh=await fb.get("paneles"); setPaneles(Array.isArray(fresh)?fresh:[]); }
        setSaving(false); setModal(null); onModalChange?.(false);
        toast.success("✓ Panel actualizado correctamente");
        if(payload.estado==="Ocupado"&&setTab) setTab("historico");
      }
    }catch(e){ 
      setSaving(false); 
      toast.error("Error al guardar: "+e.message); 
    }
  };

  const eliminar=async(id)=>{
    if(!(await confirmAsync("Los contratos asociados quedarán sin panel.", {title:"¿Eliminar panel?", danger:true, ok:"Sí, eliminar"}))) return;
    await fb.del("paneles",id);
    setPaneles(p=>p.filter(x=>x.id!==id));
  };

  // Ocupado real = tiene contrato activo HOY (no el campo estado manual)
  const hoyStrP = new Date().toISOString().slice(0,10);
  const panelsConContratoHoy = new Set(
    contratos
      .filter(c => !c.deleted && c.inicio <= hoyStrP && c.fin >= hoyStrP)
      .map(c => c.panel_id)
  );
  const libre = paneles.filter(p => !panelsConContratoHoy.has(p.id)).length;
  const ocup  = paneles.filter(p =>  panelsConContratoHoy.has(p.id)).length;

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
        color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",
        boxShadow:"0 6px 18px rgba(37,99,235,0.35)",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo Panel
      </button>
    </div>

    {loading?<SkeletonPaneles/>:
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      {paneles.map(p=>{
        const ocupado = panelsConContratoHoy.has(p.id);
        const stateColor=ocupado?"#EF4444":"#3B82F6";
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
                background:"#fff",border:"none",cursor:"pointer",touchAction:"manipulation",
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
                cursor:"pointer",touchAction:"manipulation",
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
      {paneles.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#6B7280",background:"#fff",borderRadius:22,border:"1px dashed #E5E7EB"}}>Sin paneles registrados · <button onClick={openNew} style={{color:"#2563EB",background:"none",border:"none",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>+ Agregar el primero</button></div>}
    </div>}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Panel":"Editar Panel"} onClose={()=>{setModal(null);setGeocodeMsg("");onModalChange?.(false);}} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar Panel ✓"}>
        {/* Emoji selector */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>Ícono</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setForm(f=>({...f,foto:e}))}
                style={{width:40,height:40,borderRadius:8,border:`2px solid ${form.foto===e?C.accent:C.border}`,background:form.foto===e?C.accent+"22":"transparent",fontSize:20,cursor:"pointer",touchAction:"manipulation"}}>
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
        {/* Datos para depreciación / Capital */}
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>💰 Capital (depreciación)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {inp("Costo de instalación (S/)","costoInstalacion",form,setForm,{type:"number",ph:"ej: 15000"})}
            {inp("Vida útil (años)","vidaUtilAnios",form,setForm,{type:"number",ph:"10"})}
          </div>
          <div style={{marginTop:12}}>
            {inp("Fecha de instalación","fechaInstalacion",form,setForm,{type:"date"})}
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
                style={{padding:"10px 16px",background:geocoding?C.border:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",whiteSpace:"nowrap",flexShrink:0}}>
                {geocoding?"⏳":"📍 Ubicar"}
              </button>
            </div>
            {/* Dropdown sugerencias */}
            {showSug&&sugerencias.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:56,background:C.card,border:`1px solid ${C.accent}`,borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:999,overflow:"hidden",boxShadow:`0 8px 24px rgba(0,0,0,0.5)`}}>
                {sugerencias.map((s,i)=>(
                  <div key={i} onMouseDown={()=>elegirSugerencia(s)}
                    style={{padding:"10px 14px",cursor:"pointer",touchAction:"manipulation",borderBottom:i<sugerencias.length-1?`1px solid ${C.border}`:"none",fontSize:13,color:C.text,display:"flex",alignItems:"center",gap:8,transition:"background .1s"}}
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
              <button onClick={()=>setForm(f=>({...f,lat:"",lng:"",direccion:""}))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:11}}>✕ Limpiar</button>
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
      const baseColor = panelsConContratoHoy.has(p.id)?"#EF4444":"#3B82F6";
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

  const hoyStrM = new Date().toISOString().slice(0,10);
  const panelsConContratoHoy = new Set(
    contratos
      .filter(c => !c.deleted && c.inicio <= hoyStrM && c.fin >= hoyStrM)
      .map(c => c.panel_id)
  );

  const sinCoords=paneles.filter(p=>!p.lat||!p.lng);

  return(<div style={{margin:"-20px -16px",minHeight:"100%",background:"#070D1C",paddingBottom:"calc(100px + env(safe-area-inset-bottom))"}}>
    <PgTit dark icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>} title="Mapa de Paneles" sub="OpenStreetMap · Clic en un pin para ver detalles"/>

    {sinCoords.length>0&&(
      <div style={{background:C.amber+"12",border:`1px solid ${C.amber}33`,borderRadius:12,padding:"10px 16px",marginBottom:14,fontSize:13,color:C.amber,display:"flex",gap:10,alignItems:"center"}}>
        <span><strong>{sinCoords.length} panel(es)</strong> sin coordenadas exactas — aparecen aproximados por ciudad. Ve a <strong>Paneles → Editar → Ubicar</strong> para precisarlos.</span>
      </div>
    )}

    <Card style={{padding:0,overflow:"hidden",position:"relative",borderRadius:20}}>
      <div style={{position:"absolute",top:16,left:16,zIndex:500,background:D.dark,borderRadius:22,padding:"10px 16px",display:"flex",gap:14,boxShadow:"0 6px 20px rgba(0,0,0,0.25)"}}>
        {[["#3B82F6","Libre"],["#EF4444","Ocupado"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
            <span style={{fontSize:13,color:"#FFFFFF",fontWeight:600}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:16,right:16,zIndex:500,background:D.dark,borderRadius:22,padding:"10px 16px",fontSize:13,color:"#FFFFFF",fontWeight:600,boxShadow:"0 6px 20px rgba(0,0,0,0.25)"}}>
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
        const isOcup = panelsConContratoHoy.has(p.id);
        const accentColor = isOcup ? "#EF4444" : "#3B82F6";
        const contrato=info;
        const diasVence=contrato?Math.ceil((new Date(contrato.fin)-new Date())/86400000):null;
        return(
          <div style={{
            position:"absolute",
            bottom:0,left:0,right:0,
            zIndex:500,
            background:"#0B1224",

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
                  cursor:"pointer",touchAction:"manipulation",
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
                      cursor:"pointer",touchAction:"manipulation",
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
                      cursor:"pointer",touchAction:"manipulation",
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

  const datos=contratos.filter(c=>!c.deleted).map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id)||{nombre:"Panel eliminado",id:c.panel_id},cliente:clientes.find(cl=>cl.id===c.cliente_id)||{nombre:"Cliente eliminado",contacto:"",id:c.cliente_id}}));
  const datosEliminados=contratos.filter(c=>c.deleted).map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id)||{nombre:"Panel eliminado",id:c.panel_id},cliente:clientes.find(cl=>cl.id===c.cliente_id)||{nombre:"Cliente eliminado",contacto:"",id:c.cliente_id}}));

  let fil;
  if(filtro==="Eliminados") fil=datosEliminados.sort((a,b)=>new Date(b.deletedAt||0)-new Date(a.deletedAt||0));
  else if(filtro==="Activos") fil=datos.filter(c=>c.d>0).sort((a,b)=>a.d-b.d);
  else fil=datos.filter(c=>c.d>0&&c.d<=60).sort((a,b)=>a.d-b.d);

  const activos=datos.filter(c=>c.d>0).length;
  const porVencer=datos.filter(c=>c.d>0&&c.d<=60).length;
  const historicos=datos.filter(c=>c.d<=0).length;
  const eliminadosCount=datosEliminados.length;

  const openNew=()=>{ modalOpenedAt.current=Date.now(); closeBackdropRef.current=false; setForm(emptyC); setModal("nuevo"); onModalChange?.(true); };
  const openEdit=(c)=>{
    modalOpenedAt.current=Date.now();
    closeBackdropRef.current=false;
    const pm=c.pagosMeses||{};
    setForm({panel_id:c.panel_id,cliente_id:c.cliente_id,inicio:c.inicio||"",fin:c.fin||"",monto:c.monto||"",pagosMeses:pm});
    setModal(c); onModalChange?.(true);
  };

  const guardar=async()=>{
    if(!form.panel_id) return toast.warn("Selecciona un panel");
    if(!form.cliente_id) return toast.warn("Selecciona un cliente");
    if(!form.inicio||!form.fin) return toast.warn("Ingresa fechas de inicio y fin");
    if(!form.monto||Number(form.monto)<=0) return toast.warn("Ingresa un monto válido");
    if(new Date(form.fin)<new Date(form.inicio)) return toast.warn("La fecha fin debe ser después del inicio");
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
      // Quedarse en contratos para que el usuario vea el contrato creado
    } catch(e){
      toast.error("Error al guardar: "+e.message);
    }
    setSaving(false);
  };

  const eliminar=async(id)=>{
    if(!(await confirmAsync("Podrás restaurarlo desde la papelera.", {title:"¿Mover a papelera?", ok:"Mover", cancel:"Cancelar"}))) return;
    await fb.del("contratos", id); // soft delete: deleted:true
    setContratos(p=>p.map(c=>c.id===id?{...c,deleted:true,deletedAt:new Date().toISOString()}:c));
  };

  const eliminarPermanente=async(id)=>{
    if(!(await confirmAsync("Esta acción NO se puede deshacer.", {title:"¿Eliminar definitivamente?", danger:true, ok:"Sí, eliminar"}))) return;
    await fb.del("contratos", id, {hardDelete:true});
    setContratos(p=>p.filter(c=>c.id!==id));
  };

  const restaurar=async(id)=>{
    await fb.patch("contratos", id, {deleted:false, deletedAt:null});
    setContratos(p=>p.map(c=>c.id===id?{...c,deleted:false,deletedAt:null}:c));
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
  const sel={...inp,cursor:"pointer",touchAction:"manipulation"};

  const pagosMarcados=Object.values(form.pagosMeses||{}).filter(Boolean).length;

  return(<div>
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
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
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",overscrollBehavior:"none",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onPointerDown={e=>{sheetTouchedAt.current=Date.now();e.stopPropagation();}}
          onPointerUp={e=>{sheetTouchedAt.current=Date.now();}}
          onClick={e=>e.stopPropagation()}
        >
          {/* Drag handle iOS */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modal==="nuevo"?"➕ Nuevo Contrato":"Editar Contrato"}</span>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
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
                style={{...inp,colorScheme:"light",cursor:"pointer",touchAction:"manipulation",fontSize:16}}/>
            </F>
            <F label="Fecha fin *">
              <input type="date" value={form.fin}
                onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))}
                onPointerDown={e=>e.stopPropagation()}
                style={{...inp,colorScheme:"light",cursor:"pointer",touchAction:"manipulation",fontSize:16}}/>
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
                          cursor:"pointer",touchAction:"manipulation",transition:"background .08s",textAlign:"center"
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
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",touchAction:"manipulation",opacity:saving?.6:1}}>
              {saving?"Guardando...":modal==="nuevo"?"Crear Contrato":"Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── HEADER CARD: Contratos ── */}
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"20px 16px 0"}}>
      <div style={{
        width:46,height:46,borderRadius:13,background:"rgba(37,99,235,0.18)",
        border:"1px solid rgba(99,140,255,0.2)",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>Contratos</div>
        <div style={{fontSize:12,color:"rgba(148,175,255,0.5)",marginTop:1}}>{contratos.filter(c=>!c.deleted).length} contratos · {activos} activos</div>
      </div>
      <button onClick={openNew} style={{
        display:"inline-flex",alignItems:"center",gap:7,
        background:"#2563EB",border:"none",borderRadius:13,padding:"10px 16px",
        color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",
        boxShadow:"0 6px 18px rgba(37,99,235,0.4)",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo
      </button>
    </div>

    {/* ── FILTER PILLS ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18,padding:"14px 16px 0"}}>
      {[
        {label:"Activos",count:activos,icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>)},
        {label:"Por vencer",count:porVencer,icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>)},
        {label:"Eliminados",count:eliminadosCount,icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>)},
      ].map(f=>{
        const isActive=filtro===f.label;
        const isTrash=f.label==="Eliminados";
        const activeColor=isTrash?"#EF4444":"#3B82F6";
        const activeBg=isTrash?"rgba(239,68,68,0.80)":"rgba(59,130,246,0.80)";
        const activeBorder=isTrash?"rgba(239,68,68,0.45)":"rgba(59,130,246,0.45)";
        return (
          <button key={f.label} onClick={()=>setFiltro(f.label)} style={{
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,
            padding:"12px 6px",borderRadius:16,
            background:isActive?activeBg:"rgba(255,255,255,0.07)",
            border:`1px solid ${isActive?activeBorder:"rgba(255,255,255,0.10)"}`,
            color:isActive?"#fff":"rgba(255,255,255,0.55)",
            fontWeight:isActive?700:500,fontSize:12,cursor:"pointer",touchAction:"manipulation",
            backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",
          }}>
            <span style={{
              width:28,height:28,borderRadius:8,
              background:isActive?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.06)",
              color:isActive?"#fff":"rgba(255,255,255,0.45)",
              display:"inline-flex",alignItems:"center",justifyContent:"center",
            }}>{f.icon}</span>
            <span>{f.label}</span>
            {f.count>0&&<span style={{
              minWidth:20,padding:"1px 7px",borderRadius:999,
              background:isActive?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)",
              color:isActive?"#fff":"rgba(255,255,255,0.5)",
              fontSize:11,fontWeight:700,textAlign:"center",
            }}>{f.count}</span>}
          </button>
        );
      })}
    </div>

    {loading?<SkeletonContratos/>:
    <div style={{display:"flex",flexDirection:"column",gap:18,padding:"0 16px 32px"}}>
      {/* Banner de papelera */}
      {filtro==="Eliminados"&&fil.length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:16}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{fontSize:13,color:"#FCA5A5",fontWeight:600,flex:1}}>La 🗑️ papelera es permanente — usa el botón rojo para eliminar definitivamente o restaura el contrato.</span>
        </div>
      )}
      {fil.map(c=>{
        const msg=filtro!=="Eliminados"?encodeURIComponent(`Hola ${c.cliente?.contacto}, le recordamos que su contrato para *${c.panel?.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`):"";
        const meses=generarMeses(c.inicio,c.fin);
        const pm=c.pagosMeses||{};
        const pagados=meses.filter(m=>pm[m.key]).length;
        const dRest=c.d;
        // Siempre azul — color fijo de la card
        const accentCard="#3B82F6";
        const borderCard="rgba(59,130,246,0.22)";

        const card = (
          <div style={{
            background:"linear-gradient(160deg,#131F3E 0%,#0D1629 55%,#0A1120 100%)",
            borderRadius:22,
            border:`1px solid ${borderCard}`,
            boxShadow:`0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)`,
            overflow:"hidden",
            position:"relative",
          }}>

            {/* ── Acento lateral ── */}
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:`linear-gradient(180deg,${accentCard}CC 0%,${accentCard}22 100%)`,borderRadius:"22px 0 0 22px"}}/>

            {/* ── CABECERA: Panel + Monto ── */}
            <div style={{padding:"18px 18px 14px 20px",position:"relative"}}>

              {/* Ondas decorativas de fondo */}
              <svg viewBox="0 0 380 110" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.22,pointerEvents:"none"}}>
                {[0,1,2,3,4].map(i=>{
                  const t=i/4;
                  return <path key={i} d={`M${360-t*60} ${110} C ${280-t*40} ${70} ${200-t*30} ${40} ${80-t*20} ${20} S ${-20+t*10} ${10} ${-40} ${30}`}
                    fill="none" stroke={accentCard} strokeWidth="0.8" opacity={0.3+t*0.4}/>;
                })}
              </svg>

              <div style={{position:"relative",display:"flex",alignItems:"center",gap:14}}>
                {/* Avatar panel */}
                <div style={{
                  width:58,height:58,borderRadius:16,flexShrink:0,
                  background:`linear-gradient(135deg,${accentCard}33,${accentCard}11)`,
                  border:`1.5px solid ${accentCard}44`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:28,
                  boxShadow:`0 6px 20px rgba(0,0,0,0.4), 0 0 0 4px ${accentCard}10`,
                }}>{c.panel?.foto||"🏙️"}</div>

                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:17,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.02em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{c.panel?.nombre||"Panel eliminado"}</div>
                  <div style={{fontSize:12,color:"rgba(200,215,255,0.70)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.cliente?.empresa||"—"} · {c.cliente?.contacto||"—"}</div>
                  {/* Badge vencimiento */}
                  <div style={{marginTop:7}}>
                    <span style={{
                      display:"inline-flex",alignItems:"center",gap:4,
                      fontSize:11,fontWeight:700,
                      color:"#93C5FD",
                      background:"rgba(59,130,246,0.18)",
                      border:"1px solid rgba(59,130,246,0.35)",
                      borderRadius:99,padding:"3px 9px",
                    }}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:"#3B82F6",display:"inline-block",flexShrink:0}}/>
                      {dRest>0?`Vence en ${dRest} día${dRest===1?"":"s"}`:dRest===0?"Vence hoy":"Finalizado"}
                    </span>
                  </div>
                </div>

                {/* Monto */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#FFFFFF",letterSpacing:"-0.03em",lineHeight:1}}>{fmt(c.monto)}</div>
                  <div style={{fontSize:10,color:"rgba(200,215,255,0.55)",fontWeight:600,marginTop:2}}>/mes</div>
                  <div style={{fontSize:12,fontWeight:800,color:"#34D399",marginTop:5}}>{fmt(pagados*Number(c.monto))} cobrado</div>
                </div>
              </div>
            </div>

            {/* ── SEPARATOR ── */}
            <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"0 18px"}}/>

            {/* ── FECHAS + ACCIONES ── */}
            <div style={{padding:"12px 18px 12px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>

              {/* Date pill */}
              <div style={{
                display:"inline-flex",alignItems:"center",gap:6,
                background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:10,padding:"7px 11px",
                fontSize:12,fontWeight:600,color:"rgba(240,245,255,0.90)",
                flexShrink:0,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>
                {fmtF(c.inicio)} → {fmtF(c.fin)}
              </div>

              {/* Meses pill */}
              <div style={{
                display:"inline-flex",alignItems:"center",gap:5,
                background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.28)",
                borderRadius:10,padding:"7px 11px",
                fontSize:12,fontWeight:700,color:"#BFDBFE",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 11h20"/></svg>
                {pagados}/{meses.length} meses
              </div>

              <div style={{flex:1}}/>

              {/* Botones acción */}
              {filtro==="Eliminados" ? (<>
                <button onClick={()=>restaurar(c.id)} title="Restaurar" style={{width:38,height:38,borderRadius:10,border:"1px solid rgba(16,185,129,0.3)",background:"rgba(16,185,129,0.10)",cursor:"pointer",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#34D399"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74"/><path d="M3 3v4h4"/></svg>
                </button>
                <button onClick={()=>eliminarPermanente(c.id)} title="Eliminar definitivamente" style={{width:38,height:38,borderRadius:10,border:"1px solid rgba(239,68,68,0.35)",background:"rgba(239,68,68,0.10)",cursor:"pointer",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FCA5A5"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
                </button>
              </>) : (<>
                {/* Editar */}
                <button onClick={()=>openEdit(c)} style={{width:38,height:38,borderRadius:10,border:"1px solid rgba(255,255,255,0.14)",background:"rgba(255,255,255,0.08)",cursor:"pointer",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"rgba(240,245,255,0.85)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
                {/* WhatsApp */}
                <a href={`https://wa.me/${c.cliente.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                  style={{width:38,height:38,borderRadius:10,border:"1px solid rgba(37,211,102,0.35)",background:"rgba(37,211,102,0.11)",cursor:"pointer",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}}>
                  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 2C8.268 2 2 8.268 2 16c0 2.442.642 4.735 1.762 6.726L2 30l7.472-1.731A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="#25D366"/>
                    <path d="M23.004 19.47c-.355-.177-2.1-1.035-2.424-1.154-.323-.118-.558-.177-.793.177-.236.354-.912 1.154-1.118 1.39-.207.236-.413.265-.768.089-.354-.177-1.497-.552-2.851-1.76-1.054-.94-1.765-2.1-1.972-2.455-.206-.354-.022-.545.155-.721.16-.16.355-.413.532-.62.177-.206.236-.354.354-.59.119-.235.06-.442-.029-.62-.09-.177-.793-1.912-1.087-2.618-.286-.688-.577-.595-.793-.606l-.676-.012c-.235 0-.62.088-.944.442-.324.354-1.236 1.208-1.236 2.944s1.265 3.416 1.442 3.652c.177.235 2.49 3.803 6.032 5.33.844.364 1.502.582 2.015.745.847.27 1.618.231 2.228.14.679-.1 2.1-.858 2.396-1.687.295-.83.295-1.54.207-1.687-.088-.147-.324-.236-.679-.413z" fill="#fff"/>
                  </svg>
                </a>
              </>)}
            </div>

            {/* ── LISTA DE PAGOS ── */}
            {meses.length>0&&(
              <>
                <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"0 18px"}}/>
                <div style={{padding:"10px 18px 16px 20px",display:"flex",flexDirection:"column",gap:6}}>
                  {meses.map(m=>{
                    const pag=pm[m.key]||false;
                    return(
                      <button key={m.key} onClick={()=>togglePagoRapido(c,m.key)} style={{
                        display:"flex",alignItems:"center",gap:12,
                        padding:"11px 13px",borderRadius:13,
                        background:pag?"rgba(16,185,129,0.10)":"rgba(255,255,255,0.05)",
                        border:`1px solid ${pag?"rgba(16,185,129,0.25)":"rgba(255,255,255,0.09)"}`,
                        cursor:"pointer",touchAction:"manipulation",textAlign:"left",width:"100%",
                        fontFamily:"inherit",transition:"background .15s",
                      }}>
                        {/* Círculo check */}
                        <span style={{
                          width:24,height:24,borderRadius:"50%",flexShrink:0,
                          display:"inline-flex",alignItems:"center",justifyContent:"center",
                          background:pag?"#10B981":"transparent",
                          border:pag?"none":"1.5px solid rgba(255,255,255,0.25)",
                        }}>
                          {pag&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                        <span style={{flex:1,fontSize:14,fontWeight:700,color:pag?"#6EE7B7":"rgba(240,245,255,0.92)"}}>{m.label}</span>
                        <span style={{
                          padding:"4px 11px",borderRadius:999,fontSize:11,fontWeight:700,
                          background:pag?"rgba(16,185,129,0.18)":"rgba(255,255,255,0.08)",
                          color:pag?"#34D399":"rgba(200,215,255,0.65)",
                        }}>{pag?"Pagado":"Pendiente"}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(200,215,255,0.35)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
        return filtro==="Eliminados"
          ? <div key={c.id}>{card}</div>
          : <SwipeRow key={c.id} onDelete={() => eliminar(c.id)} deleteLabel="Archivar">{card}</SwipeRow>;
      })}
      {fil.length===0&&(
        <div style={{textAlign:"center",padding:48,background:"rgba(255,255,255,0.05)",borderRadius:22,border:"1px dashed rgba(255,255,255,0.12)"}}>
          <div style={{
            width:64,height:64,borderRadius:18,
            background:filtro==="Eliminados"?"rgba(239,68,68,0.15)":"rgba(37,99,235,0.12)",
            margin:"0 auto 14px",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:filtro==="Eliminados"?"#F87171":"#60A5FA",
          }}>
            {filtro==="Eliminados"
              ? <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            }
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.85)",marginBottom:6}}>
            {filtro==="Eliminados"?"La papelera está vacía":"Sin contratos "+filtro.toLowerCase()}
          </div>
          {filtro!=="Eliminados"&&<button onClick={openNew} style={{marginTop:10,background:"#2563EB",border:"none",borderRadius:12,padding:"11px 20px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>+ Crear primer contrato</button>}
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
    if(!form.empresa.trim()) return toast.warn("Escribe el nombre de la empresa");
    setSaving(true);
    const payload={tipo:form.tipo,empresa:form.empresa,contacto:form.contacto,celular:form.celular,email:form.email,ruc:form.ruc,ciudad:form.ciudad,sector:form.sector,estado:form.estado,notas:form.notas};
    if(modal==="nuevo"){
      const [r]=await fb.post("clientes",payload);
      if(r) setClientes(p=>[...p,r]);
    } else {
      const [r]=await fb.patch("clientes",modal.id,payload);
      if(r) setClientes(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); haptic('success'); toast.success('Guardado correctamente'); setModal(null); onModalChange?.(false);
  };

  const eliminar=async(id)=>{
    if(!(await confirmAsync("Podrás recuperarlo desde Firebase si fue un error.", {title:"¿Eliminar contacto?", danger:true, ok:"Sí, eliminar"}))) return;
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

  return (
    <div style={{ background: "#F2F4F8", margin: "-20px -16px", minHeight: "100%", paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}>

      {/* ── TOP STRIP AZUL ── */}
      <div style={{ background: "linear-gradient(160deg,#1D4ED8 0%,#2563EB 55%,#3B82F6 100%)", padding: "20px 20px 28px", borderBottomLeftRadius: 28, borderBottomRightRadius: 28, boxShadow: "0 8px 28px rgba(37,99,235,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>CRM · 8 Millas</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>Clientes</div>
          </div>
          <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "#fff", border: "none", borderRadius: 50, color: "#2563EB", fontWeight: 700, fontSize: 13, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo
          </button>
        </div>
        {/* Stats inline */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Clientes",   val: clis.length,          bg: "rgba(255,255,255,0.15)" },
            { label: "Prospectos", val: pros.length,           bg: "rgba(255,255,255,0.1)"  },
            { label: "Propuestas", val: propuestas.length,     bg: "rgba(255,255,255,0.1)"  },
            { label: "Total",      val: clientes.length,       bg: "rgba(255,255,255,0.1)"  },
          ].map(({ label, val, bg }) => (
            <div key={label} style={{ flex: 1, background: bg, borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div style={{ padding: "14px 16px", background: "#2563EB", borderBottom: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 14, padding: "11px 14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={buscar} onChange={e => { setBuscar(e.target.value); setPage(1); }}
            placeholder="Buscar empresa, contacto, ciudad..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#fff", background: "transparent", fontFamily: "inherit" }}/>
          {buscar && <button onClick={() => { setBuscar(""); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", padding: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>}
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: 7, padding: "10px 16px 14px", background: "#2563EB", borderBottom: "none", overflowX: "auto" }}>
        {filters.map(f => {
          const active = activeFilter === f;
          const dot = f === "Activos" ? "#10B981" : f === "En riesgo" ? "#EF4444" : null;
          return (
            <button key={f} onClick={() => { setActiveFilter(f); setPage(1); }} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 99, flexShrink: 0,
              border: `1.5px solid ${active ? "#fff" : "rgba(255,255,255,0.3)"}`,
              background: active ? "#fff" : "rgba(255,255,255,0.12)",
              color: active ? "#2563EB" : "rgba(255,255,255,0.85)",
              fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit",
            }}>
              {dot && <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#2563EB" : dot }}/>}
              {f}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8", flexShrink: 0, alignSelf: "center", fontWeight: 600 }}>{filtrado.length}</span>
      </div>

      {/* ── LISTA DE CONTACTOS ── */}
      {loading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#64748B" }}><div style={{ width: 20, height: 20, border: "2px solid #E5E7EB", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin .7s linear infinite" }}/> Cargando...</div> :
      <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {paginated.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "48px 20px", textAlign: "center", border: "1px solid #E5E7EB" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "#EFF4FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "#2563EB" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 12 }}>Sin resultados</div>
            <button onClick={openNew} style={{ background: "#2563EB", border: "none", borderRadius: 50, padding: "9px 20px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit" }}>+ Agregar contacto</button>
          </div>
        ) : paginated.map(r => {
          const tc = tCol(r.tipo);
          const ec = estadoColorCRM(r.estado);
          return (
            <div key={r.id} style={{ background: "#fff", borderRadius: 18, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -6px rgba(0,0,0,0.08)" }}>
              {/* Borde izquierdo de color tipo */}
              <div style={{ display: "flex" }}>
                <div style={{ width: 4, background: tc, flexShrink: 0, borderRadius: "0 0 0 0" }}/>
                <div style={{ flex: 1, padding: "14px 14px 12px" }}>
                  {/* Fila principal */}
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                    <AvatarEmpresa name={r.empresa} size={42}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.empresa}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ruc ? "RUC " + r.ruc : r.email || "—"}</div>
                    </div>
                    <span style={{ background: `${tc}18`, border: `1px solid ${tc}40`, color: tc, borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{r.tipo}</span>
                  </div>
                  {/* Chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F8FAFC", color: "#64748B", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "1px solid #E5E7EB" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {r.ciudad || "—"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F8FAFC", color: "#64748B", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "1px solid #E5E7EB" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                      {r.sector || "—"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${ec}12`, border: `1px solid ${ec}30`, color: ec, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: ec }}/>
                      {r.estado}
                    </span>
                  </div>
                  {/* Footer: contacto + acciones */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AvatarContacto name={r.contacto || "?"} size={26}/>
                    <span style={{ fontSize: 11, color: "#94A3B8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contacto || "—"}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => wa(r)} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#25D366", cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                      <button onClick={() => openEdit(r)} style={{ width: 34, height: 34, borderRadius: 10, background: "#EFF4FF", border: "1px solid #BFDBFE", color: "#2563EB", cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button onClick={() => eliminar(r.id)} style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{Math.min((page-1)*perPage+1,filtrado.length)}–{Math.min(page*perPage,filtrado.length)} de {filtrado.length}</span>
            <div style={{ display: "flex", gap: 5 }}>
              {page > 1 && <button onClick={() => setPage(p => p-1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", background: "#fff", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>}
              {Array.from({length: Math.min(totalPages,5)}, (_,i) => i+1).map(n => (
                <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${page===n?"#2563EB":"#E5E7EB"}`, cursor: "pointer", background: page===n?"#2563EB":"#fff", color: page===n?"#fff":"#64748B", fontSize: 12, fontWeight: page===n?700:400, fontFamily: "inherit" }}>{n}</button>
              ))}
              {page < totalPages && <button onClick={() => setPage(p => Math.min(p+1,totalPages))} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", background: "#fff", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>}
            </div>
          </div>
        )}
      </div>}

      {/* ── MODAL ── */}
      {modal && (
        <Modal title={modal === "nuevo" ? "Nuevo Contacto" : "Editar Contacto"} onClose={() => { setModal(null); onModalChange?.(false); }} onSave={guardar} saveLabel={saving ? "Guardando..." : "Guardar ✓"}>
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            {["Cliente","Prospecto"].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, estado: t==="Cliente" ? "Activo" : "En contacto" }))}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: `2px solid ${form.tipo===t ? tCol(t) : C.border}`, background: form.tipo===t ? tCol(t)+"22" : "transparent", color: form.tipo===t ? tCol(t) : C.muted, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit", fontSize: 14 }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("Empresa","empresa",form,setForm,{ph:"Nombre de la empresa"})}
            {inp("Contacto","contacto",form,setForm,{ph:"Nombre completo"})}
            {inp("Celular","celular",form,setForm,{type:"tel",ph:"+51 999 000 000"})}
            {inp("Email","email",form,setForm,{type:"email",ph:"correo@empresa.com"})}
            {form.tipo==="Cliente" && inp("RUC","ruc",form,setForm,{ph:"20000000001"})}
            {inp("Ciudad","ciudad",form,setForm,{type:"select",options:CIUDADES})}
            {inp("Sector","sector",form,setForm,{type:"select",options:SECTORES})}
            {inp("Estado","estado",form,setForm,{type:"select",options:form.tipo==="Cliente" ? ESTADOS_CLI : ESTADOS_PRO})}
          </div>
          {inp("Notas","notas",form,setForm,{type:"textarea",ph:"Observaciones, seguimiento..."})}
        </Modal>
      )}

      {/* ── LEADS / PROSPECTOS SECTION ── */}
      <div style={{ margin: "0 16px 8px" }}>
        {/* Header leads */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.text }}>Leads</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{pros.length} prospecto{pros.length !== 1 ? "s" : ""} · {propuestas.length} con propuesta</div>
          </div>
          <button onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: D.dark, border: "none", borderRadius: 50, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar
          </button>
        </div>

        {/* Pipeline funnel cards */}
        {[
          { label: "En contacto",      estado: "En contacto",      color: "#3B82F6", bg: "#EFF6FF" },
          { label: "Propuesta enviada",estado: "Propuesta enviada",color: "#8B5CF6", bg: "#F5F3FF" },
          { label: "Frío",             estado: "Frío",             color: "#94A3B8", bg: "#F8FAFC" },
          { label: "Perdido",          estado: "Perdido",          color: "#EF4444", bg: "#FEF2F2" },
        ].map(({ label, estado, color, bg }) => {
          const grupo = pros.filter(p => p.estado === estado);
          if (grupo.length === 0) return null;
          return (
            <div key={estado} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5, paddingLeft: 4 }}>
                {label} · {grupo.length}
              </div>
              {grupo.map(p => (
                <div key={p.id} onClick={() => openEdit(p)} style={{ background: D.dark, borderRadius: 16, padding: "14px 16px", marginBottom: 7, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", touchAction: "manipulation" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.empresa}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{p.contacto || "Sin contacto"}{p.ciudad ? " · " + p.ciudad : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {p.celular && (
                      <button onClick={e => { e.stopPropagation(); const msg = `Hola ${p.contacto}, somos Vista 360, paneles publicitarios en ${p.ciudad}. ¿Le interesaría conocer nuestras opciones? 📍`; window.open(`https://wa.me/${p.celular.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); }}
                        style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(37,211,102,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 0C5.374 0 0 5.373 0 11.998c0 2.117.554 4.1 1.523 5.82L.057 23.52a.5.5 0 0 0 .598.641l5.882-1.542a11.943 11.943 0 0 0 5.46 1.319c6.625 0 12-5.374 12-12S18.623 0 11.998 0zm0 21.94a9.94 9.94 0 0 1-5.065-1.381l-.363-.215-3.758.985.999-3.649-.236-.374A9.943 9.943 0 0 1 2.06 11.998c0-5.479 4.46-9.94 9.939-9.94 5.478 0 9.939 4.461 9.939 9.94 0 5.478-4.461 9.94-9.94 9.94z"/></svg>
                      </button>
                    )}
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Si no hay prospectos */}
        {pros.length === 0 && (
          <div style={{ background: D.dark, borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Sin prospectos aún. Agrega tu primer lead.</div>
            <button onClick={openNew} style={{ background: "#2563EB", border: "none", borderRadius: 50, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit" }}>+ Agregar prospecto</button>
          </div>
        )}
      </div>

    </div>
  );
}

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
    if(!form.empresa.trim()) return toast.warn("Escribe el nombre de la empresa");
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
    }catch(e){ toast.error("Error al guardar: "+e.message); }
    setSaving(false);
  };

  const eliminar=async(id)=>{
    if(!(await confirmAsync("Podrás recuperarlo desde Firebase si fue un error.", {title:"¿Eliminar proveedor?", danger:true, ok:"Sí, eliminar"}))) return;
    await fb.del("proveedores", id);
    setProveedores(p=>p.filter(x=>x.id!==id));
  };

  const wa=(p)=>{
    if(!p.celular) return toast.warn("Este proveedor no tiene celular registrado");
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
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onPointerDown={e=>{closeBackdropRef.current=e.target===e.currentTarget;}}
        onClick={e=>{
          if(Date.now()-modalOpenedAt.current<500) return;
          if(Date.now()-sheetTouchedAt.current<900) return;
          if(closeBackdropRef.current){closeBackdropRef.current=false;setModal(null);onModalChange?.(false);}
        }}
      >
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",overscrollBehavior:"none",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onPointerDown={e=>{sheetTouchedAt.current=Date.now();e.stopPropagation();}}
          onPointerUp={e=>{sheetTouchedAt.current=Date.now();}}
          onClick={e=>e.stopPropagation()}
        >
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modal==="nuevo"?"➕ Nuevo Proveedor":"Editar Proveedor"}</span>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          {(()=>{
            const inpS={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:16,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
            const selS={...inpS,cursor:"pointer",touchAction:"manipulation"};
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
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",touchAction:"manipulation",opacity:saving?.6:1}}>
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
        color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",
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
    <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4,overscrollBehavior:"none"}}>
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
            cursor:"pointer",touchAction:"manipulation",whiteSpace:"nowrap",flexShrink:0,
            transition:"background .08s",
          }}>{c}</button>
        );
      })}
    </div>

    {loading?<SkeletonCRM/>:
      filtrados.length===0?(
        <div style={{textAlign:"center",padding:60,color:"#6B7280",background:"#fff",borderRadius:22,border:"1px dashed #E5E7EB"}}>
          {proveedores.length===0
            ?<>Sin proveedores registrados · <button onClick={openNew} style={{color:"#2563EB",background:"none",border:"none",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>+ Agregar el primero</button></>
            :"No hay resultados con ese filtro"}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtrados.map(p=>{
            const col=catColor[p.categoria]||"#FFFFFF";
            const wid="prv-"+p.id;
            const card = (
              <div style={{
                position:"relative", overflow:"hidden",
                background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                border:"1px solid rgba(79,124,255,0.22)",
                borderRadius:18, padding:"14px 16px",
                boxShadow:"0 6px 24px rgba(8,12,28,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.07)",
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
                      cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      Editar
                    </button>
                    {p.celular&&(
                      <button onClick={()=>wa(p)} style={{
                        background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.40)",
                        borderRadius:10,padding:"7px 14px",color:"#25D366",fontSize:12,fontWeight:700,
                        cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:7,fontFamily:"inherit",
                      }}>
                        <svg width="15" height="15" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 2C8.268 2 2 8.268 2 16c0 2.442.642 4.735 1.762 6.726L2 30l7.472-1.731A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="#25D366"/>
                          <path d="M23.004 19.47c-.355-.177-2.1-1.035-2.424-1.154-.323-.118-.558-.177-.793.177-.236.354-.912 1.154-1.118 1.39-.207.236-.413.265-.768.089-.354-.177-1.497-.552-2.851-1.76-1.054-.94-1.765-2.1-1.972-2.455-.206-.354-.022-.545.155-.721.16-.16.355-.413.532-.62.177-.206.236-.354.354-.59.119-.235.06-.442-.029-.62-.09-.177-.793-1.912-1.087-2.618-.286-.688-.577-.595-.793-.606l-.676-.012c-.235 0-.62.088-.944.442-.324.354-1.236 1.208-1.236 2.944s1.265 3.416 1.442 3.652c.177.235 2.49 3.803 6.032 5.33.844.364 1.502.582 2.015.745.847.27 1.618.231 2.228.14.679-.1 2.1-.858 2.396-1.687.295-.83.295-1.54.207-1.687-.088-.147-.324-.236-.679-.413z" fill="#fff"/>
                        </svg>
                        WhatsApp
                      </button>
                    )}
                  </div>

                  {p.notas&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",fontSize:12,color:"rgba(160,180,220,0.7)",lineHeight:1.5}}>
                      {p.notas}
                    </div>
                  )}
                </div>
              </div>
            );
            return <SwipeRow key={p.id} onDelete={() => eliminar(p.id)} deleteLabel="Eliminar">{card}</SwipeRow>;
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
    if(!form.descripcion.trim()) return toast.warn("Escribe una descripción");
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

  const eliminar=async(id)=>{ if(!(await confirmAsync("Esta acción no se puede deshacer.", {title:"¿Eliminar gasto?", danger:true, ok:"Sí, eliminar"}))) return; await fb.del("gastos",id,{hardDelete:true}); setGastos(p=>p.filter(g=>g.id!==id)); };

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
      // CORRECTO: cobrado en ese mes = pagosMeses[key] === true
      const ing = contratos.filter(c => {
        if (c.deleted) return false;
        const ini = c.inicio?.slice(0,7); const fin = c.fin?.slice(0,7);
        return ini && fin && ini <= key && fin >= key && c.pagosMeses?.[key] === true;
      }).reduce((a,c) => a + Number(c.monto), 0);
      const gas=gastos.filter(g=>g.mes===key).reduce((a,g)=>a+Number(g.monto),0);
      lista.push({key,label,ing,gas,util:ing-gas});
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,2);
    }
    return lista;
  },[contratos,gastos]);

  // ── Cálculos del mes seleccionado ──────────────────────────────
  // CORRECTO: usar pagosMeses[mes] para saber si ese mes específico fue cobrado,
  // NO c.pagado (que solo refleja el primer mes al crear el contrato).
  const gastosMes  = gastos.filter(g => g.mes === mes);
  const totGastos  = gastosMes.reduce((a,g) => a + Number(g.monto), 0);

  // Contratos activos en el mes seleccionado
  const contratosActiMes = contratos.filter(c => {
    if (c.deleted) return false;
    const ini = c.inicio?.slice(0,7); const fin = c.fin?.slice(0,7);
    return ini && fin && ini <= mes && fin >= mes;
  });

  // Cobrado: ese mes marcado como pagado en pagosMeses
  const ingCob  = contratosActiMes
    .filter(c => c.pagosMeses?.[mes] === true)
    .reduce((a,c) => a + Number(c.monto), 0);

  // Bruto: todos los contratos activos ese mes (cobrados + pendientes)
  const ingBrut = contratosActiMes.reduce((a,c) => a + Number(c.monto), 0);

  // Pendiente: activos ese mes pero NO cobrados
  const ingPend = contratosActiMes
    .filter(c => !c.pagosMeses?.[mes])
    .reduce((a,c) => a + Number(c.monto), 0);

  const utilidad = ingCob - totGastos;
  const margen   = ingCob > 0 ? Math.round((utilidad / ingCob) * 100) : 0;

  const porCat={};
  gastosMes.forEach(g=>{ porCat[g.categoria]=(porCat[g.categoria]||0)+Number(g.monto); });
  const catMax=Math.max(1,...Object.values(porCat));

  return(<div>
    {/* ── CABECERA MÓVIL ── */}
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-0.5px",lineHeight:1}}>Estado de Resultados</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>Ingresos, gastos y utilidad</div>
        </div>
        <button onClick={openNew} style={{display:"flex",alignItems:"center",gap:6,background:C.accent,border:"none",borderRadius:50,padding:"10px 16px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(37,99,235,0.35)",flexShrink:0}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Gasto
        </button>
      </div>
      {/* Controles en fila */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,background:C.card,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
          {["Mensual","Histórico"].map(v=>(
            <button key={v} onClick={()=>setVistaHistorica(v==="Histórico")}
              style={{padding:"7px 14px",borderRadius:9,border:"none",background:vistaHistorica===(v==="Histórico")?C.accent:"transparent",color:vistaHistorica===(v==="Histórico")?"#fff":C.muted,fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",transition:"all .15s"}}>
              {v}
            </button>
          ))}
        </div>
        {!vistaHistorica&&<input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",cursor:"pointer",touchAction:"manipulation",minWidth:0}}/>}
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
        }} style={{background:"linear-gradient(135deg,#1E35C8,#3854EE)",border:"none",borderRadius:50,padding:"10px 16px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 16px rgba(30,53,200,0.35)",fontFamily:"inherit",flexShrink:0}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
          PDF
        </button>
      </div>
    </div>

    {/* ── VISTA HISTÓRICA — últimos 6 meses reales ── */}
    {vistaHistorica&&(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:20}}>
          {[
            [`Total Ingresos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.ing,0)),C.green],
            [`Total Gastos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.gas,0)),C.red],
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),historialMeses.reduce((a,m)=>a+m.util,0)>=0?C.green:C.red],
          ].map(([l,v,c])=>(
            <Card key={l} style={{padding:"14px 16px"}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div>
              <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
            </Card>
          ))}
        </div>
        <Card style={{marginBottom:16}}>
          <SecTit ch={`Ingresos vs Gastos — ${historialMeses.length} mes${historialMeses.length!==1?"es":""}`}/>
          <div style={{overflowX:"auto",paddingBottom:4}}><div style={{display:"flex",alignItems:"flex-end",gap:6,height:140,marginTop:8,minWidth:historialMeses.length*52}}>
            {historialMeses.map((m,i)=>{
              const maxV=Math.max(...historialMeses.map(x=>Math.max(x.ing,x.gas)),1);
              return(
                <div key={m.key} style={{flexShrink:0,width:46,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",touchAction:"manipulation"}} onClick={()=>{setMes(m.key);setVistaHistorica(false);}}>
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
                      <div onClick={()=>{setMes(m.key);setVistaHistorica(false);}} style={{fontWeight:700,color:C.white,fontSize:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:8}}>
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
                        style={{flex:1,background:"linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",border:"none",borderRadius:50,padding:"12px 22px",color:"#FFFFFF",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",minHeight:46,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",letterSpacing:"0.01em",fontFamily:"inherit"}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                        Exportar PDF
                      </button>
                      <button onClick={async()=>{
                        if(!(await confirmAsync(`Se eliminarán todos los gastos de ${m.label}. Esta acción no se puede deshacer.`, {title:"¿Eliminar todos?", danger:true, ok:"Sí, eliminar"}))) return;
                        const ids=gastosDelMes.map(g=>g.id);
                        for(const id of ids) await fb.del("gastos",id,{hardDelete:true});
                        setGastos(prev=>prev.filter(g=>!ids.includes(g.id)));
                      }}
                        style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",minHeight:40,minWidth:44}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
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
      <KPIDark label="Ingresos Cobrados" value={fmt(ingCob)} valueColor="#10B981" sub={`${contratosActiMes.filter(c=>c.pagosMeses?.[mes]===true).length} contratos pagados`} accent="#10B981" icon={ICN.check}/>
      <KPIDark label="Por Cobrar"        value={fmt(ingPend)} valueColor="#FFFFFF" sub={`${contratosActiMes.filter(c=>!c.pagosMeses?.[mes]).length} contratos pendientes`} accent="#2563EB" icon={ICN.hourglass}/>
      <KPIDark label="Total Gastos"      value={fmt(totGastos)} valueColor="#EF4444" sub={`${gastosMes.length} conceptos`} accent="#EF4444" icon={ICN.down}/>
      <KPIDark label="Utilidad Neta"     value={fmt(utilidad)} valueColor={utilidad>=0?"#10B981":"#EF4444"} sub={`Margen ${margen}%`} accent={utilidad>=0?"#10B981":"#EF4444"} icon={utilidad>=0?ICN.up:ICN.down}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14,marginBottom:16}}>
      <Card>
        <SecTit ch="Pérdidas & Ganancias"/>
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
        <SecTit ch="Gastos por Categoría"/>
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
        <span style={{fontSize:14,fontWeight:700,color:C.text}}>Detalle de Gastos — {new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"})}</span>
        <span style={{fontSize:13,color:C.muted}}>{gastosMes.length} conceptos · <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
      {loadG?<Spinner/>:
      <div>
        {gastosMes.length===0&&<div style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>+ Agregar</button></div>}
        {gastosMes.map((g,i)=>(
          <div key={g.id} style={{padding:"12px 16px",borderBottom:i<gastosMes.length-1?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <Tag color={catCol[g.categoria]||C.muted} ch={g.categoria}/>
              </div>
              <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descripcion||g.concepto||"—"}</div>
              <div style={{fontSize:14,fontWeight:800,color:C.red}}>{fmt(g.monto)}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>openEdit(g)} style={{width:34,height:34,background:"#EFF4FF",border:"1px solid #BFDBFE",borderRadius:9,color:C.accent,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
              <button onClick={()=>eliminar(g.id)} style={{width:34,height:34,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,color:C.red,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>}
      <div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
        <span>Sincronizado con Firebase</span><span>Total gastos: <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
    </Card>
    </div>)}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Gasto":"Editar Gasto"} onClose={()=>{setModal(null);onModalChange?.(false);}} onSave={guardar} saveLabel={saving?"Guardando...":"Agregar ✓"}>
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
    if(typeof Notification==="undefined") return toast.warn("Tu navegador no soporta notificaciones.\nEn iPhone necesitas iOS 16.4+ y agregar la app a Inicio primero.");
    const p=await Notification.requestPermission();
    setNotifPerm(p);
    if(p==="granted"){
      new Notification("✅ 8 Millas — Alertas activadas",{body:"Te avisaremos 30 días y 15 días antes de cada vencimiento",tag:"bienvenida"});
      try{ localStorage.removeItem("v360_notif"); }catch{}
    } else if(p==="denied"){
      toast.warn("Bloqueaste las notificaciones.\nPara activarlas: Ajustes del navegador → Notificaciones → Permitir para este sitio.");
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
            style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#2563EB,#1E40AF)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 16px rgba(245,158,11,0.35)"}}>
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
            style={{width:"100%",background:D.dark,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none"}}>
            {opts.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
          </select>
        :<input
            type={type==="number"?"text":type}
            inputMode={type==="number"?"decimal":undefined}
            value={form[keyN]||""}
            onChange={e=>setForm(f=>({...f,[keyN]:type==="number"?e.target.value.replace(/[^0-9.]/g,""):e.target.value}))}
            style={{width:"100%",background:D.dark,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
      }
    </div>
  );
}

function Gastos({gastos,setGastos,autoScan,setAutoScan,onModalChange}){
  const [mes,setMes]=useState(()=>{const h=new Date();return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`;});
  const [modal,setModal]=useState(null);
  const [vistaDetalle,setVistaDetalle]=useState(null);
  const [form,setForm]=useState({fecha:"",proveedor:"",ruc:"",concepto:"",monto:"",igv:"",subtotal:"",categoria:"Otro",notas:"",foto_texto:"",moneda:"PEN"});
  const [saving,setSaving]=useState(false);
  const [ocr,setOcr]=useState({loading:false,progress:0,fase:"",text:"",imgUrl:"",previewUrl:""});
  const fileRef=useRef(null);

  // ── Tab interno: gastos | sueldos ──
  const [tabGastos, setTabGastos] = useState("gastos");

  // ── Sueldos (Firebase) ──
  const [sueldos, setSueldos] = useState([]);
  const [loadingSueldos, setLoadingSueldos] = useState(true);
  const [modalSueldo, setModalSueldo] = useState(null);
  const [formSueldo, setFormSueldo] = useState({ nombre: "", cargo: "", monto: "" });

  useEffect(() => {
    fb.get("sueldos").then(d => { setSueldos(Array.isArray(d) ? d : []); setLoadingSueldos(false); }).catch(() => setLoadingSueldos(false));
  }, []);

  const abrirNuevoSueldo = () => { setFormSueldo({ nombre: "", cargo: "", monto: "" }); setModalSueldo("nuevo"); };
  const abrirEditarSueldo = (s) => { setFormSueldo({ nombre: s.nombre, cargo: s.cargo||"", monto: String(s.monto||"") }); setModalSueldo(s); };

  const guardarSueldo = async () => {
    if (!formSueldo.nombre.trim()) return toast.warn("Escribe el nombre");
    if (!formSueldo.monto) return toast.warn("Escribe el monto");
    const payload = { nombre: formSueldo.nombre.trim(), cargo: formSueldo.cargo.trim(), monto: Number(formSueldo.monto), pagos: modalSueldo !== "nuevo" ? (modalSueldo.pagos || {}) : {} };
    if (modalSueldo === "nuevo") {
      const [r] = await fb.post("sueldos", payload);
      if (r) setSueldos(p => [...p, r]);
    } else {
      const [r] = await fb.patch("sueldos", modalSueldo.id, payload);
      if (r) setSueldos(p => p.map(s => s.id === modalSueldo.id ? r : s));
    }
    setModalSueldo(null);
  };

  const eliminarSueldo = async (id) => {
    if (!(await confirmAsync("Esta acción no se puede deshacer.", {title:"¿Eliminar empleado?", danger:true, ok:"Sí, eliminar"}))) return;
    await fb.del("sueldos", id, { hardDelete: true });
    setSueldos(p => p.filter(s => s.id !== id));
  };

  const pagarSueldo = async (id) => {
    const sueldo = sueldos.find(s => s.id === id);
    if (!sueldo) return;
    const yaPagado = !!(sueldo.pagos || {})[mes];
    const pagos = { ...(sueldo.pagos || {}), [mes]: !yaPagado };
    const [r] = await fb.patch("sueldos", id, { pagos });
    if (r) setSueldos(p => p.map(s => s.id === id ? { ...s, pagos } : s));

    if (!yaPagado) {
      // Marcar como pagado → crear gasto automático
      const hoy = new Date();
      const fecha = `${mes}-${String(hoy.getDate()).padStart(2,"0")}`;
      const payload = {
        categoria: "Personal",
        descripcion: `Sueldo — ${sueldo.nombre}${sueldo.cargo ? ` (${sueldo.cargo})` : ""}`,
        concepto: `Sueldo — ${sueldo.nombre}`,
        proveedor: sueldo.nombre,
        monto: Number(sueldo.monto) || 0,
        fecha,
        mes,
        notas: "Generado automáticamente desde Sueldos",
        sueldo_id: id,
      };
      const [g] = await fb.post("gastos", payload);
      if (g) setGastos(prev => [g, ...prev]);
    } else {
      // Desmarcar → eliminar el gasto automático de ese mes si existe
      const gastoSueldo = gastos.find(g => g.sueldo_id === id && g.mes === mes);
      if (gastoSueldo) {
        await fb.del("gastos", gastoSueldo.id, { hardDelete: true });
        setGastos(prev => prev.filter(g => g.id !== gastoSueldo.id));
      }
    }
  };

  const totalSueldosMes = sueldos.reduce((a,s) => a + (Number(s.monto)||0), 0);
  const sueldosPagadosMes = sueldos.filter(s => (s.pagos||{})[mes]).length;

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
      toast.error("Error OCR: "+e.message);
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
    if(!form.monto) return toast.warn("El monto es obligatorio");
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
      toast.error("Error al guardar: "+e.message);
    }
  };

  const eliminar=async(id)=>{
    if(!(await confirmAsync("Esta acción no se puede deshacer.", {title:"¿Eliminar gasto?", danger:true, ok:"Sí, eliminar"}))) return;
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
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <PgTit icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>} title="Gastos" sub="OCR · Boletas · Sueldos"/>
      {tabGastos === "gastos"
        ? <button onClick={abrirNuevo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"10px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",boxShadow:"0 4px 14px rgba(37,99,235,0.4)",whiteSpace:"nowrap"}}>+ Nuevo</button>
        : <button onClick={abrirNuevoSueldo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"10px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",boxShadow:"0 4px 14px rgba(37,99,235,0.4)",whiteSpace:"nowrap"}}>+ Empleado</button>
      }
    </div>

    {/* ── TABS GASTOS / SUELDOS ── */}
    <div style={{display:"flex",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:14,padding:4,marginBottom:18,gap:4}}>
      {[{id:"gastos",label:"Gastos"},{id:"sueldos",label:"Sueldos"}].map(t=>(
        <button key={t.id} onClick={()=>setTabGastos(t.id)} style={{
          flex:1,padding:"10px 0",borderRadius:11,border:"none",fontFamily:"inherit",
          background:tabGastos===t.id?"#2563EB":"transparent",
          color:tabGastos===t.id?"#fff":"rgba(180,210,255,0.5)",
          fontWeight:tabGastos===t.id?700:500,fontSize:14,cursor:"pointer",touchAction:"manipulation",
          transition:"all .15s",
        }}>{t.label}</button>
      ))}
    </div>

    {/* ══════════════════════════════════════════════
        SECCIÓN: SUELDOS
    ══════════════════════════════════════════════ */}
    {tabGastos === "sueldos" && (<div>

      {/* Modal nuevo/editar empleado */}
      {modalSueldo && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setModalSueldo(null);}}>
          <div style={{background:C.card,borderRadius:"22px 22px 0 0",padding:"10px 20px 32px",width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 -10px 40px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><div style={{width:36,height:4,borderRadius:2,background:C.border}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:800,color:C.text}}>{modalSueldo==="nuevo"?"Nuevo empleado":"Editar empleado"}</span>
              <button onClick={()=>setModalSueldo(null)} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {[
              {label:"Nombre completo",key:"nombre",ph:"Ej: María García",type:"text"},
              {label:"Cargo / Rol",key:"cargo",ph:"Ej: Asistente, Técnico...",type:"text"},
              {label:"Sueldo mensual (S/)",key:"monto",ph:"Ej: 1200",type:"number"},
            ].map(({label,key,ph,type})=>(
              <div key={key} style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>{label}</label>
                <input type={type} value={formSueldo[key]} onChange={e=>setFormSueldo(f=>({...f,[key]:e.target.value}))}
                  placeholder={ph}
                  style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",color:C.text,fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button onClick={()=>setModalSueldo(null)} style={{flex:1,padding:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontWeight:600,cursor:"pointer",touchAction:"manipulation",fontSize:14}}>Cancelar</button>
              <button onClick={guardarSueldo} style={{flex:2,padding:14,background:C.accent,border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>Guardar</button>
            </div>
            {modalSueldo!=="nuevo"&&(
              <button onClick={()=>{eliminarSueldo(modalSueldo.id);setModalSueldo(null);}} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:12,border:"1px solid #FECACA",background:"#FEF2F2",color:C.red,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Eliminar empleado
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selector de mes */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:16,padding:"14px 18px",marginBottom:18}}>
        <button onClick={()=>cambiarMes(-1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(mes)}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{sueldosPagadosMes}/{sueldos.length} pagados · {fmt(totalSueldosMes)} total</div>
        </div>
        <button onClick={()=>cambiarMes(1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {/* Lista empleados */}
      {sueldos.length === 0 ? (
        <div style={{textAlign:"center",padding:"48px 20px",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:20}}>
          <div style={{width:54,height:54,borderRadius:16,background:"rgba(37,99,235,0.15)",border:"1px solid rgba(37,99,235,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin empleados registrados</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Agrega a tu equipo para llevar el control de sueldos</div>
          <button onClick={abrirNuevoSueldo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"11px 28px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>+ Agregar empleado</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sueldos.map(s => {
            const pagado = !!(s.pagos||{})[mes];
            return (
              <div key={s.id} style={{background:"linear-gradient(145deg,#0E1835,#0A1228)",border:`1px solid ${pagado?"rgba(16,185,129,0.3)":"rgba(79,124,255,0.14)"}`,borderRadius:18,padding:"16px 18px",boxShadow:"0 4px 16px rgba(8,12,28,0.4)"}}>
                {/* Fila principal */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  {/* Avatar */}
                  <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,#1E3A8A,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18,fontWeight:800,color:"#fff"}}>
                    {s.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nombre}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{s.cargo||"—"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-0.5px"}}>{fmt(s.monto)}</div>
                    <div style={{fontSize:9,color:C.muted,marginTop:2,textTransform:"uppercase",letterSpacing:0.5}}>mensual</div>
                  </div>
                </div>
                {/* Fila acciones */}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {/* Estado pago */}
                  <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:pagado?"#10B981":"rgba(255,255,255,0.2)",flexShrink:0}}/>
                    <span style={{fontSize:11,color:pagado?"#10B981":"rgba(255,255,255,0.35)",fontWeight:600}}>
                      {pagado?`Pagado — ${mesLabel(mes)}`:"Pendiente este mes"}
                    </span>
                  </div>
                  {/* Btn editar */}
                  <button onClick={()=>abrirEditarSueldo(s)} style={{width:34,height:34,borderRadius:10,background:"rgba(37,99,235,0.15)",border:"1px solid rgba(37,99,235,0.25)",color:"#60A5FA",cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  {/* Btn PAGAR */}
                  <button onClick={()=>pagarSueldo(s.id)} style={{
                    display:"flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:50,border:"none",
                    background: pagado ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#2563EB,#1D4ED8)",
                    color: pagado ? "#10B981" : "#fff",
                    fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",
                    boxShadow: pagado ? "none" : "0 4px 14px rgba(37,99,235,0.45)",
                    border: pagado ? "1px solid rgba(16,185,129,0.3)" : "none",
                    transition:"all .2s",
                  }}>
                    {pagado ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Pagado
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2v20M17 7H9.5C8.12 7 7 8.12 7 9.5S8.12 12 9.5 12h5C15.88 12 17 13.12 17 14.5S15.88 17 14.5 17H7"/></svg>
                        Pagar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Resumen total */}
          <div style={{background:"linear-gradient(145deg,#0E1835,#0A1228)",border:"1px solid rgba(79,124,255,0.14)",borderRadius:16,padding:"14px 18px",marginTop:4}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:600}}>Pagados este mes</span>
              <span style={{fontSize:12,fontWeight:700,color:"#10B981"}}>{sueldosPagadosMes} de {sueldos.length}</span>
            </div>
            <div style={{background:"rgba(255,255,255,0.06)",borderRadius:99,height:6,overflow:"hidden",marginBottom:12}}>
              <div style={{height:"100%",borderRadius:99,width:sueldos.length>0?`${(sueldosPagadosMes/sueldos.length)*100}%`:"0%",background:"linear-gradient(90deg,#2563EB,#10B981)",transition:"width .5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:13,color:C.muted}}>Total planilla</span>
              <span style={{fontSize:15,fontWeight:800,color:C.white}}>{fmt(totalSueldosMes)}</span>
            </div>
          </div>
        </div>
      )}
    </div>)}

    {/* ══════════════════════════════════════════════
        SECCIÓN: GASTOS (original)
    ══════════════════════════════════════════════ */}
    {tabGastos === "gastos" && (<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:16,padding:"14px 18px",marginBottom:18}}>
      <button onClick={()=>cambiarMes(-1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(mes)}</div>
        <div style={{fontSize:13,color:C.green,fontWeight:700,marginTop:2}}>{fmt(totalMes)} total · {delMes.length} gastos</div>
      </div>
      <button onClick={()=>cambiarMes(1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
    </div>

    {/* ── CHIPS POR CATEGORÍA ── */}
    {Object.keys(porCat).length>0&&(
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,tot])=>(
          <div key={cat} style={{background:(catColor[cat]||C.muted)+"18",border:`1px solid ${catColor[cat]||C.muted}33`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,color:catColor[cat]||C.muted,display:"flex",alignItems:"center",gap:5}}>
            {cat} · {fmt(tot)}
          </div>
        ))}
      </div>
    )}

    {/* ── LISTA DE GASTOS ── */}
    {delMes.length===0
      ?<div style={{textAlign:"center",padding:"54px 20px",background:"linear-gradient(135deg,#131F38,#0E1829)",border:"1px solid #1E3050",borderRadius:20}}>
        <div style={{width:60,height:60,borderRadius:18,background:"#EFF4FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg></div>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin gastos este mes</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Sube una foto de tu boleta — el OCR extrae todos los datos</div>
        <button onClick={abrirNuevo} style={{background:"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,padding:"11px 28px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>+ Agregar gasto</button>
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {delMes.map(g=>{
          const col=catColor[g.categoria]||C.muted;
          const wid=`gw-${g.id}`;
          return(
          <div key={g.id}
            onClick={()=>setVistaDetalle(g)}
            style={{position:"relative",overflow:"hidden",background:"linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",border:"1px solid rgba(79,124,255,0.14)",borderRadius:18,padding:"14px 16px",boxShadow:"0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",cursor:"pointer",touchAction:"manipulation",transition:"border-color .2s"}}>
            <svg viewBox="0 0 400 120" preserveAspectRatio="none"
              style={{position:"absolute",left:0,right:0,bottom:0,width:"100%",height:80,pointerEvents:"none",opacity:0.35}}>
              <defs>
                <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={col} stopOpacity="0"/>
                  <stop offset="0.5" stopColor={col} stopOpacity="0.55"/>
                  <stop offset="1" stopColor={col} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#${wid})`} strokeWidth="1.2" fill="none"/>
              <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#${wid})`} strokeWidth="0.8" fill="none" opacity="0.7"/>
            </svg>
            <div style={{position:"relative",zIndex:2}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                <div style={{flexShrink:0,width:44,height:52,borderRadius:8,background:"#FFFFFF",border:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.25)"}}>
                  <svg width="22" height="28" viewBox="0 0 24 28" fill="none">
                    <rect x="3" y="2" width="18" height="24" rx="1" fill="#FFFFFF" stroke="#0F1729" strokeWidth="1.2"/>
                    <text x="5" y="5.6" fontSize="2" fontWeight="900" fill={col} fontFamily="sans-serif">GASTO</text>
                    <rect x="5" y="9" width="14" height="6" rx="0.6" fill="#EFF6FF" stroke={col} strokeWidth="0.5"/>
                    <line x1="5" y1="17" x2="19" y2="17" stroke="#94A3B8" strokeWidth="0.7"/>
                    <line x1="5" y1="19.5" x2="19" y2="19.5" stroke="#94A3B8" strokeWidth="0.7"/>
                    <line x1="5" y1="22" x2="14" y2="22" stroke="#94A3B8" strokeWidth="0.7"/>
                  </svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:15,fontWeight:900,color:"#FFFFFF",letterSpacing:"-0.2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{(g.proveedor||"Sin proveedor").toUpperCase()}</span>
                    <span style={{background:col+"26",color:col,border:`1px solid ${col}55`,borderRadius:8,padding:"2px 9px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>{catIcon[g.categoria]||"📦"} {g.categoria||"Otro"}</span>
                  </div>
                  {g.ruc&&<div style={{fontSize:11,color:"rgba(160,180,220,0.6)",fontFamily:"monospace"}}>RUC {g.ruc}</div>}
                </div>
                <div style={{fontSize:20,fontWeight:900,color:C.green,letterSpacing:"-0.5px",flexShrink:0,marginLeft:4}}>
                  {g.moneda==="USD"?"$":"S/"}{Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
              </div>
              {g.concepto&&(
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 12px",marginBottom:10,fontSize:13,color:"#FFFFFF",lineHeight:1.4,border:"1px solid rgba(255,255,255,0.08)"}}>
                  <span style={{fontSize:10,color:"#5B7FCC",fontWeight:700,letterSpacing:1,textTransform:"uppercase",display:"block",marginBottom:2}}>Concepto</span>
                  {g.concepto}
                </div>
              )}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                <span style={{fontSize:11,color:"#FFFFFF",background:"rgba(255,255,255,0.05)",padding:"4px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)"}}>
                  {g.fecha?new Date(g.fecha+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}):"—"}
                </span>
                {Number(g.igv)>0&&(
                  <span style={{fontSize:11,color:"#94A3B8",background:"rgba(255,255,255,0.05)",padding:"4px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)"}}>
                    IGV S/{Number(g.igv||0).toFixed(2)}
                  </span>
                )}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>abrirEditar(g)} style={{background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.45)",borderRadius:10,padding:"7px 14px",color:"#5A9BFF",fontSize:12,fontWeight:700,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  Editar
                </button>
                <button onClick={()=>setVistaDetalle(g)} style={{background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.45)",borderRadius:10,padding:"7px 14px",color:"#10B981",fontSize:12,fontWeight:700,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Ver detalle
                </button>
                <button onClick={()=>eliminar(g.id)} style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.45)",borderRadius:10,padding:"7px 14px",color:"#EF4444",fontSize:12,fontWeight:700,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    }

    {/* ══════════════════════════════════════════════════════════
        VISTA DETALLE — Estilo Khipu: imagen izquierda + datos derecha
        ══════════════════════════════════════════════════════════ */}
    {vistaDetalle&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
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
              <button onClick={()=>setVistaDetalle(null)} style={{width:30,height:30,borderRadius:"50%",background:"#F3F4F6",border:"none",color:"#6B7280",cursor:"pointer",touchAction:"manipulation",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>

          {/* Cuerpo: dos columnas */}
          <div style={{display:"flex",gap:0,flex:1,minHeight:0}}>

            {/* ── Columna izquierda: imagen de boleta ── */}
            <div style={{width:"38%",minWidth:180,background:"#F9FAFB",borderRight:"1px solid #E5E7EB",padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,borderRadius:"0 0 0 20px"}}>
              {(ocr.previewUrl||vistaDetalle.fotoUrl||vistaDetalle.foto_url)?
                <img src={ocr.previewUrl||vistaDetalle.fotoUrl||vistaDetalle.foto_url} alt="boleta" style={{width:"100%",borderRadius:12,border:"1px solid #E5E7EB",objectFit:"contain",maxHeight:340,background:"#fff"}}/>
                :<div style={{width:"100%",aspectRatio:"3/4",background:"#E5E7EB",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",touchAction:"manipulation"}} onClick={()=>fileRef.current.click()}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <div style={{fontSize:11,color:"#6B7280",fontWeight:600,textAlign:"center"}}>Sin imagen<br/>Toca para subir</div>
                </div>
              }
              <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"9px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,color:"#1D4ED8",fontWeight:700,fontSize:12,cursor:"pointer",touchAction:"manipulation"}}>
                Reescanear boleta
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
                }} style={{width:"100%",padding:"12px 22px",background:"linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",border:"none",borderRadius:50,color:"#FFFFFF",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",letterSpacing:"0.01em",minHeight:46,fontFamily:"inherit"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                  Exportar PDF con foto
                </button>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>eliminar(vistaDetalle.id)} style={{flex:1,padding:"12px",background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:12,color:"#DC2626",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    Eliminar
                  </button>
                  <button onClick={()=>abrirEditar(vistaDetalle)} style={{flex:1,padding:"12px",background:"#D1FAE5",border:"1px solid #A7F3D0",borderRadius:12,color:"#065F46",fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    Editar
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
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:450,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
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
              {modal==="nuevo"?"➕ Nuevo Gasto":"Editar Gasto"}
            </div>
            <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{width:30,height:30,borderRadius:"50%",background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
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
                <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #2D4060",borderRadius:16,padding:"28px 20px",textAlign:"center",cursor:"pointer",touchAction:"manipulation",background:"#060E1A",marginBottom:10}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:4}}>Subir foto de la boleta</div>
                  <div style={{fontSize:11,color:C.muted}}>OCR con binarización adaptativa — extrae RUC, monto, fecha automáticamente</div>
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:"10px",background:"#1E3050",border:"1px solid #2D4060",borderRadius:10,color:C.white,fontWeight:600,fontSize:12,cursor:"pointer",touchAction:"manipulation"}}>
                  {ocr.imgUrl?"Reescanear":"Subir boleta"}
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
                  style={{width:"100%",background:D.dark,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none",boxSizing:"border-box",WebkitAppearance:"none",colorScheme:"dark"}}/>
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
              <button onClick={()=>{setModal(null);onModalChange?.(false);}} style={{padding:"13px 20px",background:"transparent",border:"1px solid #1E3050",borderRadius:12,color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation"}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{flex:1,padding:"13px",background:saving?"#1E3050":"linear-gradient(135deg,#2563EB,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":"0 4px 14px rgba(37,99,235,0.4)"}}>
                {saving?"Guardando...":modal==="nuevo"?"Guardar Gasto ✓":"Actualizar Gasto ✓"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>)}
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
    if(!form.panel_id) return toast.warn("Selecciona un panel");
    if(!form.cliente_id) return toast.warn("Selecciona un cliente");
    if(!form.inicio||!form.fin) return toast.warn("Ingresa fechas");
    if(!form.monto||Number(form.monto)<=0) return toast.warn("Ingresa un monto válido");
    setSaving(true);
    try{
      const meses=generarMeses(form.inicio,form.fin);
      const pm=form.pagosMeses||{};
      const pagado=pm[meses[0]?.key]||false;
      const payload={panel_id:form.panel_id,cliente_id:form.cliente_id,inicio:form.inicio,fin:form.fin,monto:Number(form.monto),pagado,pagosMeses:pm};
      const [r]=await fb.patch("contratos",modal.id,payload);
      if(r) setContratos(p=>p.map(x=>x.id===modal.id?{...x,...payload}:x));
      closeModal();
    }catch(e){ toast.error("Error al guardar: "+e.message); }
    setSaving(false);
  };

  const eliminar=async()=>{
    setSaving(true);
    try{
      await fb.del("contratos",modal.id,{hardDelete:true});
      setContratos(p=>p.filter(x=>x.id!==modal.id));
      closeModal();
    }catch(e){ toast.error("Error al eliminar: "+e.message); }
    setSaving(false);
  };

  const inpStyle={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const selStyle={...inpStyle,cursor:"pointer",touchAction:"manipulation"};
  const F=FieldGroup;

  return(<div>
    {/* ── MODAL EDITAR ── */}
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>{if(e.target===e.currentTarget) closeModal();}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"22px 22px 0 0",padding:"10px 20px 24px",width:"100%",maxHeight:"92vh",overflowY:"auto",overscrollBehavior:"none",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -10px 40px rgba(0,0,0,0.45)"}}
          onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><div style={{width:36,height:4,borderRadius:2,background:C.border}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <span style={{fontSize:17,fontWeight:800,color:C.text}}>Editar Contrato</span>
            <button onClick={closeModal} style={{background:C.border,border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,cursor:"pointer",touchAction:"manipulation",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          <F label="Panel *"><select value={form.panel_id} onChange={e=>setForm(f=>({...f,panel_id:e.target.value}))} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={selStyle}><option value="">— Selecciona un panel —</option>{paneles.map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.ciudad}</option>)}</select></F>
          <F label="Cliente *"><select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={selStyle}><option value="">— Selecciona un cliente —</option>{clientes.filter(c=>c.tipo==="Cliente").map(c=><option key={c.id} value={c.id}>{c.empresa} · {c.contacto}</option>)}</select></F>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="Fecha inicio *"><input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value,pagosMeses:{}}))} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={{...inpStyle,colorScheme:"light",cursor:"pointer",touchAction:"manipulation",fontSize:16}}/></F>
            <F label="Fecha fin *"><input type="date" value={form.fin} onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={{...inpStyle,colorScheme:"light",cursor:"pointer",touchAction:"manipulation",fontSize:16}}/></F>
          </div>
          <F label="Monto mensual (S/) *"><input type="text" inputMode="decimal" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value.replace(/[^0-9.]/g,"")}))} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} placeholder="Ej: 1500" style={{...inpStyle,fontSize:16}}/></F>
          {mesesForm.length>0&&(<F label={`Meses pagados (${pagosMarcados}/${mesesForm.length})`}><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{mesesForm.map(m=>{const pagado=!!(form.pagosMeses||{})[m.key];return(<button key={m.key} onClick={()=>toggleMesPago(m.key)} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${pagado?C.green:C.border}`,background:pagado?C.green+"22":"transparent",color:pagado?C.green:C.muted,fontWeight:pagado?700:500,fontSize:12,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>{m.label}</button>);})}</div></F>)}
          <div style={{display:"flex",gap:10,marginTop:20,position:"sticky",bottom:0}}>
            <button onClick={closeModal} style={{flex:1,padding:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontWeight:600,cursor:"pointer",touchAction:"manipulation",fontSize:14,minHeight:46}}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{flex:2,padding:14,background:C.accent,border:"none",borderRadius:12,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",minHeight:46,opacity:saving?.7:1}}>{saving?"Guardando...":"Guardar Cambios"}</button>
          </div>
          <div style={{marginTop:24,paddingTop:18,borderTop:`1px dashed ${C.border}`}}>
            {!confirmDelete?(<button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid #FECACA",background:"#FEF2F2",color:C.red,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Eliminar contrato</button>):(<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14,padding:16}}><div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:6,textAlign:"center"}}>¿Confirmar eliminación?</div><div style={{fontSize:12,color:C.muted,marginBottom:14,textAlign:"center"}}>Esta acción marcará el contrato como eliminado.</div><div style={{display:"flex",gap:10}}><button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation"}}>Cancelar</button><button onClick={eliminar} disabled={saving} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:C.red,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",touchAction:"manipulation",opacity:saving?.6:1}}>{saving?"Eliminando...":"Sí, eliminar"}</button></div></div>)}
          </div>
        </div>
      </div>
    )}

    {/* ── CABECERA DARK ── */}
    <div style={{ background:"linear-gradient(160deg,#080D18 0%,#0D1525 60%,#0F172A 100%)", margin:"-20px -16px 0", padding:"20px 20px 0", borderBottomLeftRadius: 28, borderBottomRightRadius: 28, boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Vista360 · Archivo</div>
      <div style={{ fontSize:26, fontWeight:800, color:"#fff", letterSpacing:"-0.5px", marginBottom:4 }}>Histórico</div>
      {/* Stats strip */}
      <div style={{ display:"flex", gap:20, paddingBottom:18, marginTop:10 }}>
        {[
          { label:"Total",      val:todos.length,     color:"#fff"    },
          { label:"Activos",    val:activos.length,   color:"#4ADE80" },
          { label:"Finalizados",val:historicos.length,color:"rgba(255,255,255,0.4)" },
        ].map(({label,val,color})=>(
          <div key={label}>
            <div style={{ fontSize:24, fontWeight:900, color, letterSpacing:"-0.5px", lineHeight:1 }}>{val}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:0.6 }}>{label}</div>
          </div>
        ))}
      </div>
      {/* Filtros pegados al borde inferior */}
      <div style={{ display:"flex", gap:0, borderTop:"1px solid rgba(255,255,255,0.07)", marginLeft:-20, marginRight:-20 }}>
        {[{id:"todos",label:"Todos",count:todos.length},{id:"activos",label:"Activos",count:activos.length},{id:"historicos",label:"Finalizados",count:historicos.length}].map(f=>{
          const active=filtro===f.id;
          return(
            <button key={f.id} onClick={()=>setFiltro(f.id)} style={{
              flex:1, padding:"12px 0", background:"none", border:"none",
              borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
              color: active ? "#60A5FA" : "rgba(255,255,255,0.35)",
              fontWeight: active?700:500, fontSize:12, cursor:"pointer", touchAction:"manipulation", fontFamily:"inherit",
              transition:"color 0.15s, border-color 0.15s",
            }}>
              {f.label} <span style={{ opacity:0.6 }}>({f.count})</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* ── TIMELINE ── */}
    <div style={{ marginTop: 16 }}>
    {lista.length===0 ? (
      <div style={{ padding:"60px 20px", textAlign:"center" }}>
        <div style={{ width:52, height:52, borderRadius:16, background:"#EFF4FF", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div style={{ fontSize:14, fontWeight:600, color:D.text, marginBottom:4 }}>No hay registros</div>
        <div style={{ fontSize:12, color:"#94A3B8" }}>Los contratos aparecerán aquí</div>
      </div>
    ) : (() => {
      // Agrupar por mes de inicio
      const grupos = {};
      lista.forEach(c => {
        const key = c.inicio ? c.inicio.slice(0,7) : "sin-fecha";
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(c);
      });
      const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const labelGrupo = k => {
        if (k === "sin-fecha") return "Sin fecha";
        const [y,m] = k.split("-");
        return `${MESES[parseInt(m,10)-1]} ${y}`;
      };

      return (
        <div style={{ padding:"20px 0 0", background:"#F8FAFC" }}>
          {Object.entries(grupos).map(([key, items]) => (
            <div key={key} style={{ marginBottom:24 }}>
              {/* Cabecera mes */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"0 16px 12px" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#2563EB", flexShrink:0, boxShadow:"0 0 0 3px #DBEAFE" }}/>
                <div style={{ height:1, flex:1, background:"#E5E7EB" }}/>
                <span style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, flexShrink:0 }}>{labelGrupo(key)}</span>
                <div style={{ height:1, flex:1, background:"#E5E7EB" }}/>
              </div>

              {/* Línea timeline + cards */}
              <div style={{ display:"flex", gap:0 }}>
                {/* Línea vertical */}
                <div style={{ width:30, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:4 }}>
                  <div style={{ width:2, flex:1, background:"linear-gradient(180deg,#DBEAFE,#E5E7EB)", borderRadius:2 }}/>
                </div>
                {/* Cards */}
                <div style={{ flex:1, paddingRight:16, display:"flex", flexDirection:"column", gap:10 }}>
                  {items.map(c => {
                    const activo = c.d > 0;
                    const statusColor = activo ? (c.d <= 30 ? "#F59E0B" : "#10B981") : "#94A3B8";
                    const statusLabel = activo ? (c.d <= 30 ? `Vence en ${c.d}d` : "Activo") : "Finalizado";
                    return (
                      <div key={c.id} style={{ background:"#fff", borderRadius:18, border:"1px solid #E5E7EB", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -6px rgba(0,0,0,0.08)" }}>
                        {/* Barra de estado arriba */}
                        <div style={{ height:3, background: activo ? (c.d<=30?"#F59E0B":"#2563EB") : "#E5E7EB" }}/>
                        <div style={{ padding:"14px 16px" }}>
                          {/* Panel + monto */}
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                                <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#1E3A8A,#2563EB)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                                </div>
                                <div style={{ fontSize:15, fontWeight:700, color:D.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.panel.nombre}</div>
                              </div>
                              <div style={{ fontSize:12, color:"#64748B", marginLeft:40 }}>{c.cliente.empresa} · {c.panel.ciudad}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontSize:17, fontWeight:800, color:"#10B981", letterSpacing:"-0.5px" }}>{fmt(c.monto)}<span style={{ fontSize:10, color:"#94A3B8", fontWeight:500 }}>/mes</span></div>
                              <span style={{ display:"inline-block", marginTop:4, padding:"3px 9px", borderRadius:99, background:`${statusColor}15`, border:`1px solid ${statusColor}40`, color:statusColor, fontSize:10, fontWeight:700 }}>{statusLabel}</span>
                            </div>
                          </div>
                          {/* Fechas */}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                            {[{l:"Inicio",v:fmtF(c.inicio)},{l:"Fin",v:fmtF(c.fin)}].map(({l,v})=>(
                              <div key={l} style={{ background:"#F8FAFC", borderRadius:10, padding:"7px 10px", border:"1px solid #E5E7EB" }}>
                                <div style={{ fontSize:9, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:2, fontWeight:700 }}>{l}</div>
                                <div style={{ fontSize:12, fontWeight:700, color:D.text }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {/* Footer */}
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <div style={{ width:7, height:7, borderRadius:"50%", background:c.pagado?"#10B981":"#E5E7EB" }}/>
                              <span style={{ fontSize:11, color:c.pagado?"#10B981":"#94A3B8", fontWeight:600 }}>{c.pagado?"Pagado":"Pendiente"}</span>
                            </div>
                            <button onClick={()=>openEdit(c)} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:50, border:"1px solid #E5E7EB", background:"#F8FAFC", color:"#64748B", fontWeight:600, fontSize:12, cursor:"pointer", touchAction:"manipulation", fontFamily:"inherit" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                              Editar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    })()}
    </div>
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
      toast.info("Este comprobante aún no tiene PDF disponible.");
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
      toast.info("Este comprobante aún no tiene PDF disponible.");
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
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "22px 22px 0 0", padding: "10px 20px 24px", width: "100%",
        maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "none",
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
          <button onClick={onClose} style={{ background: C.border, border: "none", borderRadius: 8, padding: "5px 11px", color: C.muted, cursor: "pointer", touchAction: "manipulation", fontSize: 15, flexShrink: 0 }}>✕</button>
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
                style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", touchAction: "manipulation", fontSize: 16, lineHeight: 1 }}
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
                width: "100%", padding: "13px 22px",
                background: "linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
                border: "none", borderRadius: 50,
                color: "#FFFFFF", fontWeight: 700, fontSize: 14,
                cursor: "pointer", touchAction: "manipulation",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                minHeight: 46, fontFamily: "inherit", letterSpacing: "0.01em",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
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
                cursor: "pointer", touchAction: "manipulation",
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
              cursor: "pointer", touchAction: "manipulation",
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
          <div style={{ fontSize: 26, fontWeight: 900, color: D.text, letterSpacing: "-0.7px", lineHeight: 1.1, marginBottom: 4 }}>Facturación</div>
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
        <button onClick={() => toast.info("Usa el botón emitir desde un contrato para generar facturas.")}
          style={{
            background: "#2563EB", border: "none", borderRadius: 12,
            padding: "12px 18px", color: "#FFFFFF", fontSize: 13, fontWeight: 700,
            cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
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
            style={{ width: "100%", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px 12px 38px", color: D.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
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
                style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 32px 10px 14px", color: D.text, fontSize: 12, fontWeight: 600, outline: "none", fontFamily: "inherit", appearance: "none", cursor: "pointer", touchAction: "manipulation", boxShadow: "0 1px 3px rgba(15,23,41,0.04)" }}>
                {f.options.map(opt => <option key={opt} value={opt}>{f.fmt ? f.fmt(opt) : (opt === "Todos" ? f.label : opt)}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <polyline points="6 9 12 15 18 9" stroke="#0F1729" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setVista("lista")} style={{ width: 42, height: 40, borderRadius: 10, border: vista === "lista" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB", background: vista === "lista" ? "rgba(37,99,235,0.08)" : "#FFFFFF", cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="8" y1="6" x2="20" y2="6" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="12" x2="20" y2="12" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="18" x2="20" y2="18" stroke={vista === "lista" ? "#2563EB" : "#0F1729"} strokeWidth="2" strokeLinecap="round"/>
              <circle cx="4" cy="6" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
              <circle cx="4" cy="12" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
              <circle cx="4" cy="18" r="1.2" fill={vista === "lista" ? "#2563EB" : "#0F1729"}/>
            </svg>
          </button>
          <button onClick={() => setVista("resumen")} style={{ width: 42, height: 40, borderRadius: 10, border: vista === "resumen" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB", background: vista === "resumen" ? "rgba(37,99,235,0.08)" : "#FFFFFF", cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        <div onClick={() => setModalDetalle(f)} style={{ flexShrink: 0, width: 44, height: 52, borderRadius: 8, background: "#FFFFFF", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
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
                        <div onClick={() => setModalDetalle(f)} style={{ flex: 1, minWidth: 0, cursor: "pointer", touchAction: "manipulation" }}>
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
                        <div onClick={() => setModalDetalle(f)} style={{ flexShrink: 0, textAlign: "right", cursor: "pointer", touchAction: "manipulation" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: isCobrada ? "#10B981" : isVencida ? "#EF4444" : "#FFFFFF", fontFamily: "monospace", letterSpacing: "-0.3px" }}>
                            {fmt(total)}
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      {(isEmitible || isCobrable || f.pdf_url) && (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {isEmitible && (
                            <button onClick={(e) => { e.stopPropagation(); toast.info("Integra tu API de facturación electrónica."); }}
                              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.45)", borderRadius: 10, padding: "7px 14px", color: "#5A9BFF", fontSize: 12, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5A9BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                              Emitir
                            </button>
                          )}
                          {isCobrable && (
                            <button onClick={(e) => { e.stopPropagation(); toast.info("Marca esta factura como cobrada en tu sistema."); }}
                              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.45)", borderRadius: 10, padding: "7px 14px", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
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
                                cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", gap: 7,
                                fontFamily: "inherit",
                                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                                
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
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
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
            background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",touchAction:"manipulation",
            fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{padding:"0 22px",display:"flex",flexDirection:"column",gap:16}}>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Tipo de Comprobante</div>
            <div style={{display:"flex",gap:8}}>
              {["FACTURA","BOLETA"].map(t=>(
                <button key={t} onClick={()=>{setTipo(t);setSerie(t==="FACTURA"?"F001":"B001");}}
                  style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",touchAction:"manipulation",
                    border:`1px solid ${tipo===t?C.accent+"66":C.border}`,
                    background:tipo===t?C.accent+"18":"transparent",
                    color:tipo===t?C.white:C.muted,fontWeight:700,fontSize:13,transition:"background .08s"}}>
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
              fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation"}}>Cancelar</button>
            <button onClick={descargar} style={{flex:1,padding:"13px 22px",
              background:"linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",border:"none",
              borderRadius:50,color:"#FFFFFF",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",
              boxShadow:"0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              minHeight:46,fontFamily:"inherit",letterSpacing:"0.01em"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
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

function Reportes({ contratos, paneles, clientes, gastos, initialSeccion }) {
  const [seccion, setSeccion] = useState(initialSeccion || "resumen");
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
    {id:"resumen", label:"Estado de Resultados"},
    {id:"mensual", label:"Por Mes"},
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
        <div style={{fontSize:22,fontWeight:800,color:D.text,letterSpacing:"-0.5px"}}>
          Reportes & Facturación
        </div>
        <div style={{fontSize:13,color:"#1E3A8A",marginTop:3,fontWeight:600}}>
          Análisis financiero · RUC {EMISOR.ruc} · 8 Millas Huánuco
        </div>
      </div>

      {/* Tabs — 2 botones, fondo blanco */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:22}}>
        {secciones.map(s=>{
          const active = seccion === s.id;
          const iconMap = {
            resumen: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
            mensual: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
          };
          return (
            <button key={s.id} onClick={()=>setSeccion(s.id)} style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"14px 10px",borderRadius:16,border:"none",cursor:"pointer",touchAction:"manipulation",
              background: active ? "linear-gradient(135deg,#0F1729,#1E3A8A)" : "#fff",
              color: active ? "#fff" : "#1E3A8A",
              fontWeight: active ? 700 : 600, fontSize:13,
              boxShadow: active
                ? "0 6px 20px rgba(15,23,41,0.35)"
                : "0 1px 4px rgba(15,23,41,0.08)",
              outline: active ? "none" : "1px solid #E2E8F0",
              fontFamily:"inherit", transition:"all .15s",
            }}>
              <div style={{
                width:32,height:32,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",
                background: active ? "rgba(255,255,255,0.15)" : "#EFF6FF",
                color: active ? "#fff" : "#1E40AF",
              }}>{iconMap[s.id]}</div>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ════════ RESUMEN = ESTADO DE RESULTADOS ════════ */}
      {seccion==="resumen" && (
        <div>
          <Resultados contratos={contratos} loading={false}/>
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
                background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer",touchAction:"manipulation",fontSize:16,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{fontSize:22,fontWeight:900,color:"#fff",fontFamily:"monospace",letterSpacing:"-0.5px",minWidth:60,textAlign:"center"}}>{anio}</div>
              <button onClick={()=>setAnio(a=>a+1)} style={{
                width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",
                background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer",touchAction:"manipulation",fontSize:16,fontWeight:700,
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
                  padding:"7px 4px",borderRadius:10,textDecoration:"none",cursor:"pointer",touchAction:"manipulation",
                  background:esHoy
                    ?"linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.18))"
                    :tieneData
                      ?"rgba(79,124,255,0.1)"
                      :"rgba(255,255,255,0.03)",
                  border:esHoy?"1px solid rgba(16,185,129,0.45)":tieneData?"1px solid rgba(79,124,255,0.2)":"1px solid rgba(255,255,255,0.05)",
                  transition:"background .08s",
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
            padding:"13px 24px",borderRadius:50,marginBottom:14,cursor:"pointer",touchAction:"manipulation",
            background:"linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
            border:"none",
            color:"#FFFFFF",fontWeight:700,fontSize:14,fontFamily:"inherit",
            boxShadow:"0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
            letterSpacing:"0.01em",minHeight:48,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
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
                      <div style={{fontSize:17,fontWeight:900,color:D.text,marginTop:3,letterSpacing:"-0.5px"}}>{monthShort}</div>
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
                          padding:"7px 14px",borderRadius:50,
                          border:"none",
                          background:"linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
                          color:"#FFFFFF",fontWeight:700,fontSize:12,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",
                          boxShadow:"0 3px 14px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                          letterSpacing:"0.01em",minHeight:32,
                        }} title={`Exportar PDF de ${mesLabel(m.mes)}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
            fontSize:12, fontWeight:600, cursor:"pointer",touchAction:"manipulation",
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
        <button style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 12, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" }}>Ver todas ›</button>
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
        <button onClick={() => setTab("paneles")} style={{ background: "#2563EB", border: "none", borderRadius: 50, padding: "9px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap", flexShrink: 0 }}>
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
  const items = [];
  [...contratos]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3)
    .forEach(c => {
      const cl = clientes.find(x => x.id === c.cliente_id);
      const ts = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time = diff === null ? "" : diff < 1 ? "Ahora" : diff < 24 ? `Hace ${diff}h` : `Hace ${Math.floor(diff/24)}d`;
      items.push({ icon: "contrato", title: "Contrato creado", sub: cl?.empresa || "—", time });
    });
  [...clientes]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 2)
    .forEach(cl => {
      const ts = cl.createdAt?.seconds ? new Date(cl.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time = diff === null ? "" : diff < 1 ? "Ahora" : diff < 24 ? `Hace ${diff}h` : `Hace ${Math.floor(diff/24)}d`;
      items.push({ icon: "cliente", title: "Nuevo cliente agregado", sub: cl.empresa || cl.nombre || "—", time });
    });
  const sorted = items.sort((a,b)=>0).slice(0, 5);

  const IcoContrato = (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path d="M14 2H6C5.448 2 5 2.448 5 3V21C5 21.552 5.448 22 6 22H18C18.552 22 19 21.552 19 21V7L14 2Z" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 19 8" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9" y1="13" x2="15" y2="13" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="9" y1="17" x2="15" y2="17" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  const IcoCliente = (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path d="M20 21V19C20 17.343 18.657 16 17 16H7C5.343 16 4 17.343 4 19V21" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="4" stroke="#60A5FA" strokeWidth="1.8"/>
    </svg>
  );

  return (
    <div style={{ background: "#0D1020", borderRadius: 20, padding: "18px 18px", marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA", letterSpacing: 1.5, textTransform: "uppercase" }}>Actividad reciente</span>
      <button style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 12, fontWeight: 600, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit" }} onClick={() => {
        // navegar a histórico
        const ev = new CustomEvent("vista360_nav", { detail: "historico" });
        window.dispatchEvent(ev);
      }}>Ver todas ›</button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin actividad reciente</div>
      ) : sorted.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 0",
          borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
        }}>
          {/* Icono */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "rgba(37,99,235,0.15)",
            border: "1px solid rgba(96,165,250,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {a.icon === "contrato" ? IcoContrato : IcoCliente}
          </div>
          {/* Texto */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sub}</div>
          </div>
          {/* Tiempo */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{a.time}</span>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
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
  const mesActual = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`; })();
  const ingreso = contratos
    .filter(c => {
      if (!c.inicio || !c.fin) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesActual && fin >= mesActual;
    })
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
// CAPITAL E INVERSIONES — Dashboard financiero premium
// ══════════════════════════════════════════════════════════════════

// ── Helpers de formato ──
const fmtS2 = (n) => `S/ ${Number(n||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtK  = (n) => { const v=Number(n||0); return v>=1000?`S/ ${(v/1000).toFixed(1)}k`:`S/ ${v.toLocaleString("es-PE",{minimumFractionDigits:0})}`; };

// ── Colores de sección — solo verde, rojo y blanco ──
const CAP_COLORS = {
  liquidez:  "#3B82F6",
  activos:   "#3B82F6",
  deudas:    "#EF4444",
  fondos:    "#3B82F6",
  objetivos: "#3B82F6",
};

// ── Modal genérico blanco ──
function CapModal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:700,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:540,background:"#0D1629",borderRadius:"24px 24px 0 0",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 -12px 48px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)"}}/>
        </div>
        <div style={{padding:"8px 20px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{title}</div>
          {subtitle&&<div style={{fontSize:12,color:"rgba(148,175,255,0.5)",marginTop:3}}>{subtitle}</div>}
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px",paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DarkInput({label,value,onChange,type="text",placeholder,prefix,suffix}) {
  return (
    <div style={{marginBottom:14}}>
      {label&&<div style={{fontSize:11,fontWeight:700,color:"rgba(148,175,255,0.5)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:6}}>{label}</div>}
      <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"0 14px",gap:8}}>
        {prefix&&<span style={{fontSize:14,color:"rgba(255,255,255,0.3)",flexShrink:0}}>{prefix}</span>}
        <input type={type} inputMode={type==="number"?"decimal":"text"} value={value} onChange={onChange} placeholder={placeholder||""}
          style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:15,fontWeight:600,padding:"13px 0",fontFamily:"inherit"}}/>
        {suffix&&<span style={{fontSize:12,color:"rgba(148,175,255,0.4)",flexShrink:0}}>{suffix}</span>}
      </div>
    </div>
  );
}

function DarkSelect({label,value,onChange,options}) {
  return (
    <div style={{marginBottom:14}}>
      {label&&<div style={{fontSize:11,fontWeight:700,color:"rgba(148,175,255,0.5)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:6}}>{label}</div>}
      <select value={value} onChange={onChange} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"13px 14px",color:"#fff",fontSize:14,fontFamily:"inherit",outline:"none",appearance:"none"}}>
        {options.map(o=><option key={o.value} value={o.value} style={{background:"#0D1629"}}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Tarjeta navy premium con ondas ──
function CapCard({children, accent="#3B6EFF", noWave, style={}}) {
  const wid = `cw${Math.random().toString(36).slice(2,7)}`;
  return (
    <div style={{
      position:"relative",
      background:"linear-gradient(145deg,#0E1B38 0%,#0A1428 60%,#070E1E 100%)",
      border:`1px solid rgba(255,255,255,0.07)`,
      borderRadius:22,
      boxShadow:"0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
      overflow:"hidden",
      ...style,
    }}>
      {!noWave&&(
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice"
          style={{position:"absolute",right:0,bottom:0,width:"70%",height:"100%",pointerEvents:"none",opacity:0.55}}>
          <defs>
            <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0"/>
              <stop offset="50%" stopColor={accent} stopOpacity="0.5"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0,1,2,3,4,5].map(i=>{
            const t=i/5;
            return <path key={i}
              d={`M${380-t*40} ${140} C ${310-t*30} ${100} ${230-t*20} ${60} ${130-t*15} ${30} S ${20-t*10} ${10} ${-10} ${25}`}
              fill="none" stroke={`url(#${wid})`} strokeWidth={1.2-t*0.15} opacity={0.25+t*0.5}/>;
          })}
        </svg>
      )}
      <div style={{position:"relative",zIndex:1}}>{children}</div>
    </div>
  );
}

function Sparkline({data,color="#60A5FA",height=36}) {
  if (!data||data.length<2) return null;
  const max=Math.max(...data,1), W=200, H=height;
  const pts=data.map((v,i)=>({x:(i/(data.length-1))*W, y:H-(v/max)*(H-6)-3}));
  const line=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area=`${line} L${W},${H} L0,${H} Z`;
  const gid=`sp${color.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{display:"block",overflow:"visible"}}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3.5" fill={color}/>
    </svg>
  );
}

function ProgressBar({pct,color="#60A5FA",height=8,bg="rgba(255,255,255,0.08)"}) {
  return (
    <div style={{height,borderRadius:99,background:bg,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:color,borderRadius:99,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAPITAL — componente principal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Capital({ paneles, contratos, gastos, proveedores }) {
  // ── State persistido en Firebase ──
  const [data, setData] = useState({
    cuentas: [],          // {id,nombre,banco,saldo,tipo}
    caja:    0,           // efectivo físico
    activos: [],          // {id,nombre,categoria,valor,fecha,rentabilidad}
    deudas:  [],          // {id,nombre,monto,vence}
    fondos: [             // porcentajes estratégicos
      {id:"operacion",  label:"Operación",    color:"#3B82F6", emoji:"⚙️",  pct:30},
      {id:"expansion",  label:"Expansión",    color:"#3B82F6", emoji:"📈", pct:25},
      {id:"inversion",  label:"Inversión",    color:"#818CF8", emoji:"💎", pct:25},
      {id:"personal",   label:"Personal",     color:"#94A3B8", emoji:"👤", pct:20},
    ],
    objetivos: [],        // {id,nombre,meta,actual,fecha}
  });
  const [loaded,    setLoaded]    = useState(false);
  const [section,   setSection]   = useState("patrimonio"); // tab activo

  // Modales
  const [modal,     setModal]     = useState(null); // "cuenta"|"activo"|"deuda"|"objetivo"|"fondos"
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState({});
  const [saving,    setSaving]    = useState(false);

  // ── Cargar de Firebase ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db,"configuracion","capitalv2"));
        if (snap.exists()) setData(d=>({...d,...snap.data()}));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const saveData = async (patch) => {
    const next = {...data,...patch};
    setData(next);
    try { await setDoc(doc(db,"configuracion","capitalv2"), next, {merge:true}); } catch {}
  };

  // ── Cálculos financieros ──
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
  const mesPasado = (() => { const d=new Date(hoy); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();

  const ingMes  = contratos.filter(c=>!c.deleted&&c.pagado&&c.inicio?.slice(0,7)===mesActual).reduce((s,c)=>s+Number(c.monto||0),0);
  const ingPrev = contratos.filter(c=>!c.deleted&&c.pagado&&c.inicio?.slice(0,7)===mesPasado).reduce((s,c)=>s+Number(c.monto||0),0);
  const gastosMes = gastos.filter(g=>!g.deleted&&(g.fecha||"").slice(0,7)===mesActual).reduce((s,g)=>s+Number(g.monto||0),0);
  const porCobrar = contratos.filter(c=>!c.deleted&&!c.pagado&&c.monto>0).reduce((s,c)=>s+Number(c.monto||0),0);

  const totalCuentas = data.cuentas.reduce((s,c)=>s+Number(c.saldo||0),0);
  const totalLiquidez = totalCuentas + Number(data.caja||0);
  const totalActivos  = data.activos.reduce((s,a)=>s+Number(a.valor||0),0);
  const totalDeudas   = data.deudas.reduce((s,d)=>s+Number(d.monto||0),0);
  const patrimonio    = totalLiquidez + totalActivos - totalDeudas;
  const liquidezNeta  = totalLiquidez - gastosMes;

  // Sparkline 6 meses de ingresos
  const spark6 = Array.from({length:6},(_,i)=>{
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return contratos.filter(c=>!c.deleted&&c.pagado&&c.inicio?.slice(0,7)===k).reduce((s,c)=>s+Number(c.monto||0),0);
  });

  // Variación patrimonio estimada
  const patrimonioMesAnt = patrimonio - ingMes + ingPrev;
  const patrimonioChange = patrimonioMesAnt>0?Math.round(((patrimonio-patrimonioMesAnt)/patrimonioMesAnt)*100):0;

  // Proyección: cuándo se alcanza el siguiente objetivo
  const objPendiente = data.objetivos.find(o=>Number(o.actual||0)<Number(o.meta||0));
  const nFaltan = objPendiente ? Number(objPendiente.meta)-Number(objPendiente.actual) : 0;
  const ingresoMensualNeto = ingMes - gastosMes;
  const mesesProyeccion = ingresoMensualNeto>0 ? Math.ceil(nFaltan/ingresoMensualNeto) : null;

  // Insights inteligentes
  const insights = [];
  if (patrimonioChange>0) insights.push({icon:"📈",text:`Tu patrimonio aumentó ${patrimonioChange}% este mes`,color:"#60A5FA"});
  if (totalLiquidez > gastosMes*3) insights.push({icon:"💧",text:"Liquidez saludable — más de 3 meses cubiertos",color:"#3B82F6"});
  if (mesesProyeccion) insights.push({icon:"🎯",text:`Podrías cumplir "${objPendiente.nombre}" en ~${mesesProyeccion} mes${mesesProyeccion!==1?"es":""}`,color:"#3B82F6"});
  if (totalActivos>totalDeudas*2) insights.push({icon:"🏛️",text:"Tus activos duplican tus deudas — solidez financiera",color:"#60A5FA"});
  if (ingMes>gastosMes*1.5) insights.push({icon:"✅",text:"Flujo positivo: ingresas más del doble de lo que gastas",color:"#60A5FA"});

  // ── UI helpers ──
  const TABS = [
    {id:"patrimonio",label:"Patrimonio",icon:"🏛️"},
    {id:"liquidez",  label:"Liquidez",  icon:"💧"},
    {id:"activos",   label:"Activos",   icon:"📦"},
    {id:"fondos",    label:"Fondos",    icon:"💎"},
    {id:"objetivos", label:"Objetivos", icon:"🎯"},
  ];

  // ── CRUD helpers ──
  const openAdd  = (type) => { setModal(type); setEditItem(null); setForm({}); };
  const openEdit = (type,item) => { setModal(type); setEditItem(item); setForm({...item}); };
  const closeModal = () => { setModal(null); setEditItem(null); setForm({}); };

  const saveItem = async (collection) => {
    setSaving(true);
    const id = editItem?.id || `${collection}_${Date.now()}`;
    const item = {...form, id};
    const list = [...(data[collection]||[])];
    const idx = list.findIndex(x=>x.id===id);
    if (idx>=0) list[idx]=item; else list.push(item);
    await saveData({[collection]:list});
    setSaving(false);
    closeModal();
  };

  const deleteItem = async (collection, id) => {
    const list = (data[collection]||[]).filter(x=>x.id!==id);
    await saveData({[collection]:list});
  };

  const saveFondos = async () => {
    setSaving(true);
    await saveData({fondos: data.fondos.map((f,i)=>({...f,pct:Number(form[`pct_${i}`]??f.pct)}))});
    setSaving(false);
    closeModal();
  };

  if (!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,color:"rgba(148,175,255,0.45)",fontSize:14}}>Cargando...</div>
  );

  // ━━ RENDER SECCIONES ━━

  const renderPatrimonio = () => (
    <div>
      {/* Hero patrimonio */}
      <CapCard accent="#3B82F6" style={{padding:"26px 22px 22px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(147,197,253,0.6)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:8}}>Patrimonio neto total</div>
        <div style={{fontSize:48,fontWeight:900,color:"#fff",letterSpacing:"-2px",lineHeight:1,marginBottom:8}}>{fmtS2(patrimonio)}</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <span style={{fontSize:12,fontWeight:700,color:patrimonioChange>=0?"#60A5FA":"#F87171",background:patrimonioChange>=0?"rgba(59,130,246,0.18)":"rgba(248,113,113,0.15)",borderRadius:99,padding:"3px 10px"}}>
            {patrimonioChange>=0?"+":""}{patrimonioChange}% este mes
          </span>
        </div>
        <Sparkline data={spark6} color="#60A5FA" height={44}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:16}}>
          {[
            {label:"Liquidez",value:totalLiquidez,color:"#60A5FA"},
            {label:"Activos", value:totalActivos,  color:"#fff"},
            {label:"Deudas",  value:totalDeudas,   color:"#F87171"},
          ].map(({label,value,color})=>(
            <div key={label} style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:"10px 10px"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:color,marginBottom:6}}/>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:3}}>{label}</div>
              <div style={{fontSize:13,fontWeight:800,color:"#fff"}}>{fmtK(value)}</div>
            </div>
          ))}
        </div>
      </CapCard>

      {/* Flujo mensual — dark navy glass (no white cards) */}
      <CapCard style={{padding:"18px 20px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Flujo mensual</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"Ingresos",   value:ingMes,    color:"#60A5FA", bg:"rgba(59,130,246,0.10)", border:"rgba(59,130,246,0.20)", icon:"↑"},
            {label:"Gastos",     value:gastosMes, color:"#F87171", bg:"rgba(239,68,68,0.10)",  border:"rgba(239,68,68,0.22)",  icon:"↓"},
            {label:"Por cobrar", value:porCobrar, color:"#93C5FD", bg:"rgba(59,130,246,0.08)", border:"rgba(59,130,246,0.15)", icon:"⏳"},
            {label:"Neto libre", value:Math.max(ingresoMensualNeto,0), color:"#fff", bg:"rgba(255,255,255,0.05)", border:"rgba(255,255,255,0.09)", icon:"✓"},
          ].map(({label,value,color,bg,border,icon})=>(
            <div key={label} style={{background:bg,border:`1px solid ${border}`,borderRadius:14,padding:"13px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{width:20,height:20,borderRadius:6,background:`${color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color}}>{icon}</span>
                <span style={{fontSize:9,color:"rgba(148,175,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>{label}</span>
              </div>
              <div style={{fontSize:17,fontWeight:900,color,letterSpacing:"-0.5px"}}>{fmtK(value)}</div>
            </div>
          ))}
        </div>
      </CapCard>

      {/* Insights — dark glass only (no red bg) */}
      {insights.length>0&&(
        <CapCard style={{padding:"18px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Análisis inteligente</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {insights.map((ins,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:12,
                background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.18)"}}>
                <span style={{fontSize:18,flexShrink:0}}>{ins.icon}</span>
                <span style={{fontSize:13,fontWeight:600,color:"rgba(220,235,255,0.85)",lineHeight:1.4}}>{ins.text}</span>
              </div>
            ))}
          </div>
        </CapCard>
      )}
    </div>
  );

  const renderLiquidez = () => (
    <div>
      {/* Total liquidez hero */}
      <CapCard accent={CAP_COLORS.liquidez} style={{padding:"22px 20px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(147,197,253,0.7)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>Dinero disponible</div>
        <div style={{fontSize:40,fontWeight:900,color:"#fff",letterSpacing:"-1.5px",lineHeight:1,marginBottom:4}}>{fmtS2(totalLiquidez)}</div>
        <div style={{fontSize:12,color:liquidezNeta>=0?"#60A5FA":"#F87171",fontWeight:600,marginBottom:16}}>
          {liquidezNeta>=0?"✓":"⚠"} {fmtS2(Math.abs(liquidezNeta))} {liquidezNeta>=0?"libre tras gastos del mes":"déficit este mes"}
        </div>
        {/* Caja vs bancos */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:12,padding:"11px 13px"}}>
            <div style={{fontSize:10,color:"rgba(96,165,250,0.5)",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8}}>Cuentas bancarias</div>
            <div style={{fontSize:16,fontWeight:900,color:"#3B82F6"}}>{fmtS2(totalCuentas)}</div>
          </div>
          <div style={{background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:12,padding:"11px 13px"}}>
            <div style={{fontSize:10,color:"rgba(147,197,253,0.7)",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8}}>Caja / Efectivo</div>
            <div style={{fontSize:16,fontWeight:900,color:"#60A5FA"}}>{fmtS2(data.caja)}</div>
          </div>
        </div>
      </CapCard>

      {/* Cuentas bancarias */}
      <CapCard style={{padding:"18px 20px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase"}}>Cuentas bancarias</div>
          <button onClick={()=>openAdd("cuentas")} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:99,padding:"5px 12px",color:"#3B82F6",fontSize:11,fontWeight:700,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>
            + Agregar
          </button>
        </div>
        {data.cuentas.length===0?(
          <div style={{textAlign:"center",padding:"24px 0",color:"rgba(148,175,255,0.45)",fontSize:13}}>Sin cuentas registradas</div>
        ):data.cuentas.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}> 
            <div style={{width:40,height:40,borderRadius:11,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏦</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{c.nombre}</div>
              <div style={{fontSize:11,color:"rgba(148,175,255,0.45)"}}>{c.banco||"—"} · {c.tipo||"Ahorro"}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:900,color:"#60A5FA"}}>{fmtS2(c.saldo)}</div>
            </div>
            <button onClick={()=>openEdit("cuentas",c)} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(148,175,255,0.45)",flexShrink:0}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
          </div>
        ))}
      </CapCard>

      {/* Caja efectivo */}
      <CapCard style={{padding:"18px 20px"}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Caja / Efectivo</div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{flex:1}}>
            <div style={{fontSize:28,fontWeight:900,color:"#60A5FA",letterSpacing:"-1px"}}>{fmtS2(data.caja)}</div>
            <div style={{fontSize:11,color:"rgba(148,175,255,0.45)",marginTop:4}}>Efectivo disponible en caja</div>
          </div>
          <button onClick={()=>{setModal("caja");setForm({caja:String(data.caja)});}} style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:12,padding:"10px 16px",color:"#60A5FA",fontSize:12,fontWeight:700,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            Actualizar
          </button>
        </div>
      </CapCard>
    </div>
  );

  const CAT_ACTIVOS = [
    {value:"panel",    label:"📺 Panel publicitario"},
    {value:"equipo",   label:"💻 Equipo / Maquinaria"},
    {value:"vehiculo", label:"🚗 Vehículo"},
    {value:"inmueble", label:"🏢 Inmueble"},
    {value:"herramienta",label:"🔧 Herramienta"},
    {value:"otro",     label:"📦 Otro"},
  ];
  const catIcon = {panel:"📺",equipo:"💻",vehiculo:"🚗",inmueble:"🏢",herramienta:"🔧",otro:"📦"};

  const renderActivos = () => (
    <div>
      <CapCard accent={CAP_COLORS.activos} style={{padding:"22px 20px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(147,197,253,0.7)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>Valor total de activos</div>
        <div style={{fontSize:40,fontWeight:900,color:"#fff",letterSpacing:"-1.5px",lineHeight:1,marginBottom:4}}>{fmtS2(totalActivos)}</div>
        <div style={{fontSize:12,color:"rgba(148,175,255,0.45)",marginBottom:16}}>{data.activos.length} activo{data.activos.length!==1?"s":""} registrado{data.activos.length!==1?"s":""}</div>
        {/* Distribución por categoría */}
        {data.activos.length>0&&(()=>{
          const porCat = data.activos.reduce((acc,a)=>{acc[a.categoria||"otro"]=(acc[a.categoria||"otro"]||0)+Number(a.valor||0);return acc;},{});
          return (
            <div>
              <div style={{height:8,borderRadius:99,overflow:"hidden",display:"flex",gap:2,marginBottom:8}}>
                {Object.entries(porCat).map(([cat,val],i)=>{
                  const cs=["#3B82F6","#3B82F6","#8B5CF6","#F59E0B","#EF4444","#EC4899"];
                  return <div key={cat} style={{flex:val,background:cs[i%cs.length],borderRadius:99}}/>;
                })}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {Object.entries(porCat).map(([cat,val],i)=>{
                  const cs=["#3B82F6","#3B82F6","#8B5CF6","#F59E0B","#EF4444","#EC4899"];
                  return <span key={cat} style={{fontSize:10,color:cs[i%cs.length],background:`${cs[i%cs.length]}18`,borderRadius:99,padding:"2px 8px",fontWeight:600}}>{catIcon[cat]||"📦"} {fmtK(val)}</span>;
                })}
              </div>
            </div>
          );
        })()}
      </CapCard>

      <CapCard style={{padding:"18px 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase"}}>Mis activos</div>
          <button onClick={()=>openAdd("activos")} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:99,padding:"5px 12px",color:"#60A5FA",fontSize:11,fontWeight:700,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>
            + Agregar
          </button>
        </div>
        {data.activos.length===0?(
          <div style={{textAlign:"center",padding:"24px 0",color:"rgba(148,175,255,0.45)",fontSize:13}}>Sin activos registrados</div>
        ):data.activos.map(a=>{
          const rent=Number(a.rentabilidad||0);
          return (
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}> 
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {catIcon[a.categoria||"otro"]||"📦"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.nombre}</div>
                <div style={{fontSize:11,color:"rgba(148,175,255,0.45)"}}>{a.fecha||"—"}{rent>0?` · +${rent}% rentab.`:""}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:15,fontWeight:900,color:"#60A5FA"}}>{fmtS2(a.valor)}</div>
              </div>
              <button onClick={()=>openEdit("activos",a)} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(148,175,255,0.45)",flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
            </div>
          );
        })}
      </CapCard>
    </div>
  );

  const renderFondos = () => {
    const totalPct = data.fondos.reduce((s,f)=>s+Number(f.pct||0),0);
    return (
      <div>
        <CapCard accent={CAP_COLORS.fondos} style={{padding:"22px 20px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(147,197,253,0.7)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>Fondos estratégicos</div>
          <div style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{fmtS2(liquidezNeta>0?liquidezNeta:0)}</div>
          <div style={{fontSize:12,color:"rgba(148,175,255,0.45)",marginBottom:16}}>disponible para distribuir</div>
          {/* Barra coloreada */}
          <div style={{height:10,borderRadius:99,overflow:"hidden",display:"flex",gap:2,marginBottom:8}}>
            {data.fondos.filter(f=>f.pct>0).map(f=>(
              <div key={f.id} style={{flex:f.pct,background:f.color,borderRadius:99}}/>
            ))}
            {totalPct<100&&<div style={{flex:100-totalPct,background:"rgba(255,255,255,0.06)",borderRadius:99}}/>}
          </div>
          <div style={{fontSize:10,color:"rgba(148,175,255,0.45)",textAlign:"right"}}>{totalPct}% asignado</div>
        </CapCard>

        <CapCard style={{padding:"18px 20px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase"}}>Distribución</div>
            <button onClick={()=>{setModal("fondos");const f2={};data.fondos.forEach((f,i)=>f2[`pct_${i}`]=f.pct);setForm(f2);}} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:99,padding:"5px 12px",color:"#3B82F6",fontSize:11,fontWeight:700,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>
              Ajustar %
            </button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {data.fondos.map(f=>{
              const monto=(liquidezNeta>0?liquidezNeta:0)*(f.pct/100);
              return (
                <div key={f.id} style={{padding:"13px 14px",borderRadius:14,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{fontSize:20}}>{f.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{f.label}</div>
                      <div style={{fontSize:11,color:"rgba(148,175,255,0.45)"}}>{f.pct}% del disponible</div>
                    </div>
                    <div style={{fontSize:16,fontWeight:900,color:"#3B82F6"}}>{fmtS2(monto)}</div>
                  </div>
                  <ProgressBar pct={f.pct} color={f.color} height={6}/>
                </div>
              );
            })}
          </div>
        </CapCard>
      </div>
    );
  };

  const renderObjetivos = () => (
    <div>
      <CapCard accent={CAP_COLORS.objetivos} style={{padding:"22px 20px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(147,197,253,0.7)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:8}}>Objetivos de expansión</div>
        <div style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-1px",lineHeight:1,marginBottom:6}}>
          {data.objetivos.filter(o=>Number(o.actual||0)>=Number(o.meta||0)).length} / {data.objetivos.length} completados
        </div>
        {ingresoMensualNeto>0&&objPendiente&&(
          <div style={{fontSize:12,color:"#3B82F6",fontWeight:600}}>
            🎯 "{objPendiente.nombre}" en ~{mesesProyeccion} mes{mesesProyeccion!==1?"es":""}
          </div>
        )}
      </CapCard>

      <CapCard style={{padding:"18px 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(148,175,255,0.45)",letterSpacing:2,textTransform:"uppercase"}}>Mis objetivos</div>
          <button onClick={()=>openAdd("objetivos")} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.10)",border:"1px solid rgba(16,185,129,0.22)",borderRadius:99,padding:"5px 12px",color:"#3B82F6",fontSize:11,fontWeight:700,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>
            + Nuevo
          </button>
        </div>
        {data.objetivos.length===0?(
          <div style={{textAlign:"center",padding:"24px 0",color:"rgba(148,175,255,0.45)",fontSize:13}}>Sin objetivos · agrega tu primero</div>
        ):data.objetivos.map(o=>{
          const meta=Number(o.meta||0), actual=Number(o.actual||0);
          const pct=meta>0?Math.min(Math.round((actual/meta)*100),100):0;
          const faltan=Math.max(meta-actual,0);
          const meses=ingresoMensualNeto>0?Math.ceil(faltan/ingresoMensualNeto):null;
          const done=actual>=meta;
          return (
            <div key={o.id} style={{marginBottom:14,padding:"14px 14px",borderRadius:16,background:"rgba(255,255,255,0.04)",border:`1px solid ${done?"rgba(52,211,153,0.2)":"rgba(245,158,11,0.12)"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{o.nombre}</div>
                  <div style={{fontSize:11,color:"rgba(148,175,255,0.45)",marginTop:2}}>
                    {fmtS2(actual)} de {fmtS2(meta)}
                    {!done&&meses&&` · ~${meses} mes${meses!==1?"es":""}`}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:900,color:done?"#60A5FA":"#FCD34D"}}>{pct}%</div>
                  {done&&<div style={{fontSize:10,color:"#60A5FA",fontWeight:700}}>✓ Completado</div>}
                </div>
                <button onClick={()=>openEdit("objetivos",o)} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(148,175,255,0.45)",flexShrink:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
              </div>
              <ProgressBar pct={pct} color={done?"#60A5FA":"#F59E0B"} height={8}/>
              {!done&&<div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontSize:10,color:"rgba(148,175,255,0.45)"}}>Faltan {fmtS2(faltan)}</span>
                <span style={{fontSize:10,color:"rgba(148,175,255,0.45)",fontWeight:600}}>Meta: {fmtS2(meta)}</span>
              </div>}
            </div>
          );
        })}
      </CapCard>
    </div>
  );

  // ━━ MODALES ━━

  const modalCuenta = (
    <CapModal open={modal==="cuentas"} onClose={closeModal} title={editItem?"Editar cuenta":"Nueva cuenta bancaria"} subtitle="Dinero en bancos">
      <DarkInput label="Nombre" value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: BCP Principal"/>
      <DarkInput label="Banco" value={form.banco||""} onChange={e=>setForm(f=>({...f,banco:e.target.value}))} placeholder="BCP, Interbank, BBVA..."/>
      <DarkSelect label="Tipo" value={form.tipo||"Ahorro"} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} options={[{value:"Ahorro",label:"Ahorros"},{value:"Corriente",label:"Corriente"},{value:"CTS",label:"CTS"},{value:"Otro",label:"Otro"}]}/>
      <DarkInput label="Saldo actual" value={form.saldo||""} onChange={e=>setForm(f=>({...f,saldo:e.target.value}))} type="number" prefix="S/" placeholder="0.00"/>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        {editItem&&<button onClick={()=>{deleteItem("cuentas",editItem.id);closeModal();}} style={{flex:1,padding:13,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#F87171",fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>Eliminar</button>}
        <button onClick={()=>saveItem("cuentas")} disabled={saving} style={{flex:2,padding:13,background:"#3B82F6",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",opacity:saving?0.7:1}}>{saving?"Guardando…":"Guardar"}</button>
      </div>
    </CapModal>
  );

  const modalCaja = (
    <CapModal open={modal==="caja"} onClose={closeModal} title="Actualizar caja" subtitle="Efectivo físico disponible">
      <DarkInput label="Saldo en caja" value={form.caja||""} onChange={e=>setForm(f=>({...f,caja:e.target.value}))} type="number" prefix="S/" placeholder="0.00"/>
      <button onClick={async()=>{setSaving(true);await saveData({caja:Number(form.caja||0)});setSaving(false);closeModal();}} disabled={saving} style={{width:"100%",padding:13,background:"#3B82F6",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",opacity:saving?0.7:1,marginTop:4}}>{saving?"Guardando…":"Guardar"}</button>
    </CapModal>
  );

  const modalActivo = (
    <CapModal open={modal==="activos"} onClose={closeModal} title={editItem?"Editar activo":"Nuevo activo"} subtitle="Bienes del negocio">
      <DarkInput label="Nombre" value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Panel LED avenida principal"/>
      <DarkSelect label="Categoría" value={form.categoria||"panel"} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} options={CAT_ACTIVOS}/>
      <DarkInput label="Valor estimado" value={form.valor||""} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} type="number" prefix="S/" placeholder="0.00"/>
      <DarkInput label="Fecha de compra" value={form.fecha||""} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} type="date"/>
      <DarkInput label="Rentabilidad mensual % (opcional)" value={form.rentabilidad||""} onChange={e=>setForm(f=>({...f,rentabilidad:e.target.value}))} type="number" suffix="%" placeholder="0"/>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        {editItem&&<button onClick={()=>{deleteItem("activos",editItem.id);closeModal();}} style={{flex:1,padding:13,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#F87171",fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>Eliminar</button>}
        <button onClick={()=>saveItem("activos")} disabled={saving} style={{flex:2,padding:13,background:"#3B82F6",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",opacity:saving?0.7:1}}>{saving?"Guardando…":"Guardar"}</button>
      </div>
    </CapModal>
  );

  const modalFondos = (
    <CapModal open={modal==="fondos"} onClose={closeModal} title="Ajustar fondos" subtitle="Define cómo distribuir tu dinero disponible">
      {data.fondos.map((f,i)=>(
        <div key={f.id} style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:6}}>{f.emoji} {f.label}</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setForm(prev=>({...prev,[`pct_${i}`]:Math.max(0,Number(prev[`pct_${i}`]??f.pct)-5)}))} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>−</button>
            <div style={{flex:1}}>
              <div style={{textAlign:"center",fontSize:18,fontWeight:900,color:f.color,marginBottom:4}}>{form[`pct_${i}`]??f.pct}%</div>
              <ProgressBar pct={Number(form[`pct_${i}`]??f.pct)} color={f.color} height={6}/>
              <div style={{fontSize:11,color:"rgba(148,175,255,0.45)",textAlign:"center",marginTop:4}}>{fmtS2((liquidezNeta>0?liquidezNeta:0)*((Number(form[`pct_${i}`]??f.pct))/100))}</div>
            </div>
            <button onClick={()=>setForm(prev=>({...prev,[`pct_${i}`]:Math.min(100,Number(prev[`pct_${i}`]??f.pct)+5)}))} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:18,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>+</button>
          </div>
        </div>
      ))}
      <div style={{fontSize:12,color:"rgba(148,175,255,0.45)",textAlign:"center",marginBottom:16}}>
        Total: {data.fondos.reduce((s,f,i)=>s+Number(form[`pct_${i}`]??f.pct),0)}%
      </div>
      <button onClick={saveFondos} disabled={saving} style={{width:"100%",padding:13,background:"#3B82F6",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",opacity:saving?0.7:1}}>{saving?"Guardando…":"Guardar distribución"}</button>
    </CapModal>
  );

  const modalObjetivo = (
    <CapModal open={modal==="objetivos"} onClose={closeModal} title={editItem?"Editar objetivo":"Nuevo objetivo"} subtitle="Meta de expansión del negocio">
      <DarkInput label="Nombre del objetivo" value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Nuevo panel LED"/>
      <DarkInput label="Meta (costo total)" value={form.meta||""} onChange={e=>setForm(f=>({...f,meta:e.target.value}))} type="number" prefix="S/" placeholder="0.00"/>
      <DarkInput label="Ahorrado hasta ahora" value={form.actual||""} onChange={e=>setForm(f=>({...f,actual:e.target.value}))} type="number" prefix="S/" placeholder="0.00"/>
      <DarkInput label="Fecha límite (opcional)" value={form.fecha||""} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} type="date"/>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        {editItem&&<button onClick={()=>{deleteItem("objetivos",editItem.id);closeModal();}} style={{flex:1,padding:13,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#F87171",fontWeight:600,fontSize:13,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit"}}>Eliminar</button>}
        <button onClick={()=>saveItem("objetivos")} disabled={saving} style={{flex:2,padding:13,background:"#3B82F6",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",opacity:saving?0.7:1}}>{saving?"Guardando…":"Guardar"}</button>
      </div>
    </CapModal>
  );

  // ━━ LAYOUT PRINCIPAL ━━
  return (
    <div style={{paddingBottom:"calc(90px + env(safe-area-inset-bottom))",minHeight:"100%"}}>

      {/* ── Header ── */}
      <div style={{padding:"20px 16px 0"}}>
        <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:2}}>Capital e Inversiones</div>
        <div style={{fontSize:12,color:"rgba(148,175,255,0.45)",marginBottom:16}}>Sistema financiero del negocio</div>

        {/* Tabs de sección */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16,scrollbarWidth:"none"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setSection(t.id)} style={{
              display:"inline-flex",alignItems:"center",gap:5,
              padding:"8px 14px",borderRadius:99,whiteSpace:"nowrap",flexShrink:0,
              background:section===t.id?"rgba(16,185,129,0.18)":"rgba(255,255,255,0.05)",
              border:`1px solid ${section===t.id?"rgba(16,185,129,0.45)":"rgba(255,255,255,0.08)"}`,
              color:section===t.id?"#34D399":"rgba(148,175,255,0.5)",
              fontSize:12,fontWeight:section===t.id?700:500,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",
              boxShadow:"none",
            }}>
              <span style={{fontSize:13}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido de sección ── */}
      <div style={{padding:"0 16px"}}>
        {section==="patrimonio" && renderPatrimonio()}
        {section==="liquidez"   && renderLiquidez()}
        {section==="activos"    && renderActivos()}
        {section==="fondos"     && renderFondos()}
        {section==="objetivos"  && renderObjetivos()}
      </div>

      {/* ── Modales ── */}
      {modalCuenta}
      {modalCaja}
      {modalActivo}
      {modalFondos}
      {modalObjetivo}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 🗑️ TRASH MODAL — archivos eliminados (papelera global)
// ══════════════════════════════════════════════════════════════════
function TrashModal({ open, onClose, contratos, clientes, paneles, proveedores, setContratos, setClientes, setPaneles, setProveedores }) {
  const [tab, setTabT] = useState("contratos");
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [extraDeleted, setExtraDeleted] = useState({ clientes: [], paneles: [], proveedores: [] });

  // Load deleted items from Firebase when modal opens
  useEffect(() => {
    if (!open) return;
    const loadDeleted = async () => {
      setLoadingTrash(true);
      try {
        const [allCli, allPan, allPro] = await Promise.all([
          fb.get("clientes"),
          fb.get("paneles"),
          fb.get("proveedores"),
        ]);
        setExtraDeleted({
          clientes: (allCli || []).filter(x => x.deleted),
          paneles: (allPan || []).filter(x => x.deleted),
          proveedores: (allPro || []).filter(x => x.deleted),
        });
      } catch(e) {}
      setLoadingTrash(false);
    };
    loadDeleted();
  }, [open]);

  const deletedContratos = contratos.filter(c => c.deleted);

  const restaurarItem = async (col, id, setFn) => {
    try {
      await fb.patch(col, id, { deleted: false, deletedAt: null });
      if (col === "contratos") {
        setContratos(p => p.map(x => x.id === id ? { ...x, deleted: false, deletedAt: null } : x));
      } else if (col === "clientes") {
        setExtraDeleted(prev => ({ ...prev, clientes: prev.clientes.filter(x => x.id !== id) }));
        toast.success("Cliente restaurado");
      } else if (col === "paneles") {
        setExtraDeleted(prev => ({ ...prev, paneles: prev.paneles.filter(x => x.id !== id) }));
        toast.success("Panel restaurado");
      } else if (col === "proveedores") {
        setExtraDeleted(prev => ({ ...prev, proveedores: prev.proveedores.filter(x => x.id !== id) }));
        toast.success("Proveedor restaurado");
      }
    } catch(e) { toast.error("Error al restaurar"); }
  };

  const eliminarPermanente = async (col, id) => {
    if(!(await confirmAsync("Esta acción no se puede deshacer.", { title: "¿Eliminar definitivamente?", danger: true, ok: "Sí, eliminar" }))) return;
    try {
      await fb.del(col, id, { hardDelete: true });
      if (col === "contratos") {
        setContratos(p => p.filter(x => x.id !== id));
      } else if (col === "clientes") {
        setExtraDeleted(prev => ({ ...prev, clientes: prev.clientes.filter(x => x.id !== id) }));
      } else if (col === "paneles") {
        setExtraDeleted(prev => ({ ...prev, paneles: prev.paneles.filter(x => x.id !== id) }));
      } else if (col === "proveedores") {
        setExtraDeleted(prev => ({ ...prev, proveedores: prev.proveedores.filter(x => x.id !== id) }));
      }
      toast.success("Eliminado permanentemente");
    } catch(e) { toast.error("Error al eliminar"); }
  };

  const TABS = [
    { id: "contratos", label: "Contratos", count: deletedContratos.length },
    { id: "clientes", label: "Clientes", count: extraDeleted.clientes.length },
    { id: "paneles", label: "Paneles", count: extraDeleted.paneles.length },
    { id: "proveedores", label: "Proveedores", count: extraDeleted.proveedores.length },
  ].filter(t => true);

  const currentItems = tab === "contratos"
    ? deletedContratos
    : tab === "clientes"
    ? extraDeleted.clientes
    : tab === "paneles"
    ? extraDeleted.paneles
    : extraDeleted.proveedores;

  const getItemName = (item) => {
    if (tab === "contratos") {
      const panel = paneles.find(p => p.id === item.panel_id);
      const cliente = clientes.find(c => c.id === item.cliente_id);
      return `${panel?.nombre || "Panel"} · ${cliente?.empresa || "Cliente"}`;
    }
    return item.empresa || item.nombre || item.razonSocial || "Elemento";
  };

  const getItemSub = (item) => {
    if (tab === "contratos") return `S/ ${Number(item.monto||0).toFixed(2)} · ${item.inicio||""} → ${item.fin||""}`;
    if (tab === "clientes") return item.email || item.celular || "";
    if (tab === "paneles") return item.ciudad || item.direccion || "";
    return item.categoria || "";
  };

  if (!open) return null;

  const totalDeleted = deletedContratos.length + extraDeleted.clientes.length + extraDeleted.paneles.length + extraDeleted.proveedores.length;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 540,
        background: "#fff",
        borderRadius: "22px 22px 0 0",
        maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB" }}/>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px", borderBottom: "1px solid #F1F3F8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1117" }}>Archivos Eliminados</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{totalDeleted} elemento{totalDeleted !== 1 ? "s" : ""} en la papelera</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#F1F3F8", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 16 }}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid #F1F3F8", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTabT(t.id)} style={{
              padding: "5px 13px", borderRadius: 99, whiteSpace: "nowrap",
              background: tab === t.id ? "#0D1629" : "transparent",
              border: `1px solid ${tab === t.id ? "#0D1629" : "#E5E7EB"}`,
              color: tab === t.id ? "#fff" : "#6B7280",
              fontSize: 12, fontWeight: 600, cursor: "pointer", touchAction: "manipulation",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {t.label}
              {t.count > 0 && <span style={{ background: tab === t.id ? "rgba(255,255,255,0.2)" : "#F0F1F5", color: tab === t.id ? "#fff" : "#6B7280", borderRadius: 999, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {loadingTrash ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6B7280", fontSize: 13 }}>Cargando...</div>
          ) : currentItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F1F3F8", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1117", marginBottom: 4 }}>Sin archivos eliminados</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Los elementos que elimines aparecerán aquí</div>
            </div>
          ) : currentItems.map(item => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 14, marginBottom: 8,
              background: "#F8FAFC", border: "1px solid #F1F3F8",
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1117", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getItemName(item)}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{getItemSub(item)}</div>
                {item.deletedAt && <div style={{ fontSize: 10, color: "#D1D5DB", marginTop: 2 }}>Eliminado: {new Date(item.deletedAt?.seconds ? item.deletedAt.seconds*1000 : item.deletedAt).toLocaleDateString("es-PE")}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {/* Restaurar */}
                <button onClick={() => restaurarItem(tab, item.id)} style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "#F0FDF4", border: "1px solid #BBF7D0",
                  cursor: "pointer", touchAction: "manipulation",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981"
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74"/><path d="M3 3v4h4"/></svg>
                </button>
                {/* Eliminar permanente */}
                <button onClick={() => eliminarPermanente(tab, item.id)} style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "#FEF2F2", border: "2px solid #FECACA",
                  cursor: "pointer", touchAction: "manipulation",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444"
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="4" y1="4" x2="20" y2="20" strokeWidth="2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div style={{ padding: "10px 16px 8px", borderTop: "1px solid #F1F3F8", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
            🔄 Restaurar devuelve el elemento a su sección · 🗑️ Eliminar es permanente e irreversible
          </div>
        </div>
      </div>
    </div>
  );
}

// DRAWER — menú lateral
// ══════════════════════════════════════════════════════════════════
const MENU_DRAWER = [
  { id: "capital",      label: "Inversiones"      },
  { id: "mapa",         label: "Mapa"         },
  { id: "historico",    label: "Histórico"    },
  { id: "reportes",     label: "Reportes"     },
  { id: "gastos",       label: "Gastos"       },
  { id: "proveedores",  label: "Proveedores"  },
  { id: "facturacion",  label: "Facturación"  },
];

// ── Íconos SVG del drawer (estilo trazo fino, azul Vista360) ─────
const DRAWER_ICONS = {
  capital: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"/>
      <circle cx="12" cy="12" r="4"/>
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
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 500, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "max(60px, env(safe-area-inset-top))", padding: "max(60px, env(safe-area-inset-top)) 16px 0" }}
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
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, color: D.text, background: "transparent", fontFamily: "'DM Sans',sans-serif" }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6L18 18" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          )}
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "4px 10px", color: "#64748B", fontSize: 12, cursor: "pointer", touchAction: "manipulation", flexShrink: 0, fontFamily: "'DM Sans',sans-serif" }}>Esc</button>
        </div>

        {/* Resultados */}
        {q.length >= 2 && (
          <div style={{ background: "#fff", borderRadius: 16, marginTop: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflowY: "auto" }}>
            {resultados.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#64748B", fontSize: 14 }}>
                Sin resultados para <strong style={{ color: D.text }}>"{q}"</strong>
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
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", touchAction: "manipulation", textAlign: "left", borderTop: "1px solid #F8FAFC" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {iconoPor[tipo]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.titulo}</div>
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
                { label: "Ver paneles",   svgPath: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="2"/></svg>, tab: "paneles" },
                { label: "Ver contratos", svgPath: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M14 2H6C5.448 2 5 2.448 5 3V21C5 21.552 5.448 22 6 22H18C18.552 22 19 21.552 19 21V7L14 2Z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 19 8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>, tab: "contratos" },
                { label: "Ver clientes",  svgPath: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="8" r="4" stroke="#2563EB" strokeWidth="2"/></svg>, tab: "crm" },
                { label: "Facturación",   svgPath: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#2563EB" strokeWidth="2"/><path d="M7 8H17M7 12H17M7 16H13" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>, tab: "facturacion" },
              ].map(a => (
                <button key={a.tab} onClick={() => { onNavigate(a.tab); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", touchAction: "manipulation", fontSize: 13, fontWeight: 600, color: D.text, fontFamily: "'DM Sans',sans-serif" }}>
                  <span style={{ display: "flex", alignItems: "center" }}>{a.svgPath}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerMenu({ open, onClose, activeTab, onTabClick, onTrashOpen, trashCount = 0 }) {
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
            cursor: "pointer", touchAction: "manipulation", textAlign: "left",
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
              <div style={{ fontSize: 17, fontWeight: 800, color: D.text, letterSpacing: "-0.3px" }}>
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
                    cursor: "pointer", touchAction: "manipulation",
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
          padding: "8px 14px 18px",
          marginTop: "auto",
          flexShrink: 0,
          borderTop: "1px solid #F1F3F8",
        }}>
          <button
            onClick={() => { onClose(); onTrashOpen?.(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 14,
              background: "#EFF4FF", border: "1px solid #BFDBFE",
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "#2563EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8" }}>Archivados</div>
              {trashCount > 0 && <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 1 }}>{trashCount} elemento{trashCount !== 1 ? "s" : ""} archivados</div>}
            </div>
            {trashCount > 0 && (
              <span style={{ background: "#2563EB", color: "#fff", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{trashCount}</span>
            )}
          </button>
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
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "linear-gradient(160deg, #0A0F1E 0%, #131D30 50%, #0A0F1E 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      zIndex: 998,
      paddingLeft: 24, paddingRight: 24,
      paddingTop: "max(24px, env(safe-area-inset-top))",
      paddingBottom: "max(24px, env(safe-area-inset-bottom))",
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
            color: D.text,
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            
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
        position: "absolute",
        bottom: "max(20px, calc(env(safe-area-inset-bottom) + 12px))",
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
    contrato: { svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>, bg: "#FAEEDA", ic: "#854F0B", dot: "#EF9F27" },
    factura:  { svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>, bg: "#FCEBEB", ic: "#A32D2D", dot: "#E24B4A" },
    panel:    { svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, bg: "#E6F1FB", ic: "#185FA5", dot: "#378ADD" },
    cliente:  { svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="4" y1="4" x2="20" y2="20"/></svg>, bg: "#FAEEDA", ic: "#854F0B", dot: "#EF9F27" },
    meta:     { svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 3 18 9"/><path d="M6 9h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><line x1="9" y1="22" x2="9" y2="15"/><line x1="15" y1="22" x2="15" y2="15"/></svg>, bg: "#EAF3DE", ic: "#3B6D11", dot: "#639922" },
  };

  const visibles   = filtro === "todas" ? notifs : notifs.filter(n => n.tipo === filtro);
  const noLeidas   = notifs.filter(n => !leidas[n.id]).length;
  const marcarTodas = () => { const t = {}; notifs.forEach(n => { t[n.id] = true; }); setLeidas(t); };

  if (!open) return null;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 600, background: "rgba(0,0,0,0.25)" }}>
      <div style={{
        position: "fixed",
        top: "max(64px, calc(env(safe-area-inset-top) + 12px))",
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
              <button onClick={marcarTodas} style={{ fontSize: 11, color: NL.muted, background: "none", border: "none", cursor: "pointer", touchAction: "manipulation", padding: "3px 6px" }}>
                Marcar leídas
              </button>
            )}
            <button onClick={onClose} style={{ background: NL.border, border: "none", borderRadius: 8, padding: "4px 10px", color: NL.muted, cursor: "pointer", touchAction: "manipulation", fontSize: 14 }}>✕</button>
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
              fontSize: 11, fontWeight: 600, cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap", flexShrink: 0,
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
                  cursor: "pointer", touchAction: "manipulation", opacity: isLeida ? 0.45 : 1,
                  transition: "opacity .15s",
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: cfg.ic }}>
                  {cfg.svg}
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

  // ── Color del header/status-bar según la pestaña activa ──────────
  const getHeaderColor = (t, profile) => {
    if (profile) return "#F2F4F8";
    if (t === "hoy" || t === "capital" || t === "contratos") return "#0E1A3B";
    if (t === "historico") return "#0A0F1A";
    if (t === "crm") return "#2563EB";
    if (t === "mapa") return "#070D1C";
    return "#F2F4F8";
  };
  const headerColor = getHeaderColor(tab, showProfile);
  const headerDark  = headerColor !== "#F2F4F8";
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name","theme-color"); document.head.appendChild(meta); }
    meta.setAttribute("content", headerColor);
    document.documentElement.style.background = headerColor;
    document.body.style.background = headerColor;
    document.documentElement.style.setProperty("--app-bg", headerColor);
  }, [headerColor]);
  const [clientes, setClientes]     = useState([]);
  const [paneles, setPaneles]       = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [gastos, setGastos]         = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trashOpen, setTrashOpen]   = useState(false);
  const [autoScan, setAutoScan]     = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

  const swRef = useRef(null);
  const scrollRef = useRef(null);

  // ── iOS SAFARI: FIJAR SCROLL DEL DOCUMENTO ──────────────────────
  // PROBLEMA: cuando Safari muestra/oculta su barra inferior, hace scroll
  // del documento (scrollY > 0). Los toques se reportan con offset del scroll
  // pero los elementos position:fixed están en coords del viewport → DESFASE.
  // SOLUCIÓN: forzar scrollY=0 siempre que el documento se mueva.
  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const onVVChange = () => {
      lockScroll();
    };

    // TRUCO PWA iOS: listener de touchstart en el documento hace que WKWebView
    // reconozca todos los elementos como tocables → click events funcionan
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });

    // Ejecutar de inmediato
    lockScroll();
    onVVChange();

    // Escuchar scroll del documento y cambios del viewport
    window.addEventListener("scroll",  lockScroll,  { passive: true });
    window.visualViewport?.addEventListener("resize", onVVChange, { passive: true });
    window.visualViewport?.addEventListener("scroll", onVVChange, { passive: true });
    window.addEventListener("resize",  onVVChange,  { passive: true });

    // Navegación global desde componentes internos (ej: "Ver todas" en ActividadReciente)
    const handleNav = (e) => { setTab(e.detail); };
    window.addEventListener("vista360_nav", handleNav);

    return () => {
      document.removeEventListener("touchstart", noop);
      window.removeEventListener("scroll",  lockScroll);
      window.removeEventListener("resize",  onVVChange);
      window.removeEventListener("vista360_nav", handleNav);
      window.visualViewport?.removeEventListener("resize", onVVChange);
      window.visualViewport?.removeEventListener("scroll", onVVChange);
    };
  }, []);

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

  // ── Carga de datos en TIEMPO REAL con onSnapshot ──
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const snap = (col, ord = "createdAt") => {
      try { return query(collection(db, col), orderBy(ord, "desc")); }
      catch { return collection(db, col); }
    };

    let loaded = { clientes: false, paneles: false, contratos: false, gastos: false, proveedores: false };
    const checkDone = () => {
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    };

    const unsubs = [
      onSnapshot(snap("clientes"),    s => { setClientes(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!x.deleted)); loaded.clientes=true; checkDone(); }, () => { loaded.clientes=true; checkDone(); }),
      onSnapshot(snap("paneles"),     s => { setPaneles(s.docs.map(d=>({id:d.id,...d.data()}))); loaded.paneles=true; checkDone(); },                          () => { loaded.paneles=true; checkDone(); }),
      onSnapshot(snap("contratos"),   s => { setContratos(s.docs.map(d=>({id:d.id,...d.data()}))); loaded.contratos=true; checkDone(); },                      () => { loaded.contratos=true; checkDone(); }),
      onSnapshot(snap("gastos"),      s => { setGastos(s.docs.map(d=>({id:d.id,...d.data()}))); loaded.gastos=true; checkDone(); },                            () => { loaded.gastos=true; checkDone(); }),
      onSnapshot(snap("proveedores"), s => { setProveedores(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!x.deleted)); loaded.proveedores=true; checkDone(); }, () => { loaded.proveedores=true; checkDone(); }),
    ];

    return () => unsubs.forEach(u => u());
  }, [user]);

  const activeTab = showProfile ? "perfil" : tab;

  const handleTabClick = useCallback((id) => {
    // Reset scroll to top instantly al cambiar de tab — se siente premium
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (id === "perfil") { setShowProfile(true); setTab("hoy"); }
    else { setTab(id); setShowProfile(false); }
  }, []);

  const fechaCap = useMemo(() => {
    const f = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return f.charAt(0).toUpperCase() + f.slice(1);
  }, []);

  const renderContent = useCallback(() => {
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
              fontSize: 14, fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
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
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
              <div style={{background:NL.white,borderRadius:20,padding:28,width:"100%",maxWidth:320,textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>👋</div>
                <div style={{fontSize:17,fontWeight:800,color:NL.text,marginBottom:8}}>¿Cerrar sesión?</div>
                <div style={{fontSize:13,color:NL.muted,marginBottom:24}}>Tendrás que volver a iniciar sesión con Google.</div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setConfirmLogout(false)} style={{flex:1,padding:"12px",background:"transparent",border:`1px solid ${NL.border}`,borderRadius:12,fontWeight:600,fontSize:14,cursor:"pointer",touchAction:"manipulation",color:NL.muted}}>Cancelar</button>
                  <button onClick={async()=>{ await signOut(auth); setUser(null); setShowProfile(false); setConfirmLogout(false); }} style={{flex:1,padding:"12px",background:NL.red,border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation",color:"#fff"}}>Salir</button>
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
        {tab === "capital"     && <Capital      paneles={paneles} contratos={contratos.filter(x=>!x.deleted)} gastos={gastos} proveedores={proveedores}/>}
        {tab === "mapa"        && <Mapa        paneles={paneles} clientes={clientes} contratos={contratos.filter(x=>!x.deleted)}/>}
        {tab === "paneles"     && <Paneles     paneles={paneles} setPaneles={setPaneles} contratos={contratos} loading={loading} setTab={setTab} onModalChange={setAnyModalOpen}/>}
        {tab === "contratos"   && <Contratos   contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} loading={loading} setTab={setTab} onModalChange={setAnyModalOpen}/>}
        {tab === "historico"   && <Historico   contratos={contratos.filter(x=>!x.deleted)} setContratos={setContratos} paneles={paneles} clientes={clientes} onModalChange={setAnyModalOpen}/>}
        {tab === "crm"         && <CRM         clientes={clientes} setClientes={setClientes} contratos={contratos.filter(x=>!x.deleted)} loading={loading} onModalChange={setAnyModalOpen}/>}
        {tab === "resultados"  && <Reportes    contratos={contratos.filter(x=>!x.deleted)} paneles={paneles} clientes={clientes} gastos={gastos} initialSeccion="resultados"/>}
        {tab === "reportes"    && <Reportes    contratos={contratos.filter(x=>!x.deleted)} paneles={paneles} clientes={clientes} gastos={gastos}/>}
        {tab === "gastos"      && <Gastos      gastos={gastos} setGastos={setGastos} autoScan={autoScan} setAutoScan={setAutoScan} onModalChange={setAnyModalOpen}/>}
        {tab === "proveedores" && <Proveedores proveedores={proveedores} setProveedores={setProveedores} loading={loading} onModalChange={setAnyModalOpen}/>}
        {tab === "facturacion" && <Facturacion contratos={contratos.filter(x=>!x.deleted)} paneles={paneles} clientes={clientes}/>}
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, showProfile, clientes, contratos, paneles, gastos, proveedores, loading, error, autoScan, setAutoScan, setClientes, setPaneles, setContratos, setGastos, setProveedores, setTab, setAnyModalOpen, confirmLogout]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800;900&display=swap" rel="stylesheet"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
      <meta name="theme-color" content="#F2F4F8"/>
      <meta name="apple-mobile-web-app-capable" content="yes"/>
      <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
      <meta name="apple-mobile-web-app-title" content="Vista360"/>
      <meta name="mobile-web-app-capable" content="yes"/>
      <meta name="format-detection" content="telephone=no"/>
      <style>{`
        /* ── RESET BASE ── */
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}

        /* ── LAYOUT ── */
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#F2F4F8;-webkit-text-size-adjust:100%}
        body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;background:transparent}

        /* ── ELIMINAR DELAY DE 300ms EN iOS ──
           touch-action:manipulation solo en elementos interactivos (no en *)
           porque * puede interferir con el scroll en iOS PWA / WKWebView */
        button,a,select,
        [role='button'],[role='tab'],[role='menuitem'],[role='option']{
          touch-action:manipulation;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          font-family:inherit
        }
        button:active{opacity:0.78;transform:scale(0.96)}

        /* ── INPUTS ── */
        input,select,textarea{
          -webkit-appearance:none;appearance:none;
          font-size:16px!important;
          scroll-margin-bottom:180px;
          touch-action:manipulation
        }
        input,textarea{
          -webkit-user-select:text;user-select:text;
          -webkit-touch-callout:default
        }

        /* ── SCROLL ── */
        ::-webkit-scrollbar{display:none}
        [data-scroll]{overscroll-behavior:none}

        /* ── ANIMACIONES ── */
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes skPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{from{opacity:.2}to{opacity:.6}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeTab{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <ToastProvider/>
      {splash && <Splash done={() => setSplash(false)}/>}

      {/* Pantalla de login: se muestra solo si no hay usuario y ya verificamos auth */}
      {!splash && authReady && !user && (
        <LoginScreen onLoginSuccess={(u) => setUser(u)}/>
      )}

      {/* App principal: solo se muestra cuando hay sesión activa */}
      {!splash && !!user && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: NL.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif", color: NL.text, overflow: "hidden", overscrollBehavior: "none" }}>

        {/* ── TOP NAV ── */}
        <div style={{
          flexShrink: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: 16, paddingRight: 16, paddingBottom: 12,
          background: headerColor,
          borderBottom: headerDark
            ? "none"
            : `1px solid rgba(229,231,235,0.8)`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {/* Botón menú */}
          <button onClick={() => setDrawerOpen(true)} aria-label="Menú" style={{
            width: 40, height: 40, borderRadius: 12,
            background: headerDark ? "rgba(255,255,255,0.10)" : NL.text,
            border: headerDark ? "1px solid rgba(255,255,255,0.14)" : "none",
            cursor: "pointer", touchAction: "manipulation",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: headerDark ? "none" : "0 4px 12px rgba(15,23,41,0.18)",
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
            <div style={{ fontSize: 15, fontWeight: 700, color: headerDark ? "#fff" : NL.text, lineHeight: 1.1 }}>
              {showProfile ? "Perfil" : {
                hoy:"Inicio", mapa:"Mapa",
                capital:"Capital",
                paneles:"Paneles", contratos:"Contratos", historico:"Histórico",
                crm:"Clientes", resultados:"Resultados", reportes:"Reportes",
                gastos:"Gastos", proveedores:"Proveedores", facturacion:"Facturación",
              }[tab] || "Vista360"}
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setGlobalSearch(true)} aria-label="Buscar" style={{ width: 40, height: 40, borderRadius: "50%", background: headerDark ? "rgba(255,255,255,0.10)" : NL.white, border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z" stroke={headerDark ? "#fff" : NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onClick={() => setNotifOpen(v => !v)} aria-label="Notificaciones" style={{ width: 40, height: 40, borderRadius: "50%", background: headerDark ? "rgba(255,255,255,0.10)" : NL.white, border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${NL.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", position: "relative" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path d="M15 17H9M15 17C15 18.657 13.657 20 12 20C10.343 20 9 18.657 9 17M15 17H20L18.784 15.784C18.284 15.284 18 14.612 18 13.914V10C18 7.239 15.761 5 13 5H11C8.239 5 6 7.239 6 10V13.914C6 14.612 5.716 15.284 5.216 15.784L4 17H9" stroke={headerDark ? "#fff" : NL.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button onClick={() => handleTabClick("perfil")} aria-label="Perfil" style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, border: showProfile ? `2px solid ${NL.accent}` : "2px solid transparent", cursor: "pointer", touchAction: "manipulation", boxShadow: "0 4px 12px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)", letterSpacing: "0.5px" }}>
              AM
            </button>
          </div>
        </div>

        {/* ── CONTENIDO ── */}
        <div
          ref={scrollRef}
          data-scroll
          style={{ flex: 1, minHeight: 0, overflowY: "scroll", overflowX: "hidden", overscrollBehavior: "none", touchAction: "pan-y",
            background: (activeTab === "contratos" || activeTab === "capital") ? "#0E1A3B" : activeTab === "mapa" ? "#070D1C" : "#F2F4F8",
            position:"relative" }}
        >
          <div style={{ paddingTop: (activeTab === "capital" || activeTab === "contratos" || activeTab === "mapa") ? 0 : 20, paddingLeft: (activeTab === "capital" || activeTab === "contratos" || activeTab === "mapa") ? 0 : 16, paddingRight: (activeTab === "capital" || activeTab === "contratos" || activeTab === "mapa") ? 0 : 16, paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
            {loading
              ? <div style={{ padding: "0 0", display:"flex", flexDirection:"column", gap:0 }}>
                  {[1,2,3,4].map(i => <SkDarkCard key={i}/>)}
                </div>
              : <div key={tab} style={{ animation:"fadeTab .2s ease" }}>{renderContent()}</div>
            }
          </div>
        </div>

        {/* ── BOTTOM TAB BAR (flotante) ── */}
        {!anyModalOpen && <div style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 4px)",
          left: 12,
          right: 12,
          zIndex: 100,
          pointerEvents: "none",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 6px",
            maxWidth: 480,
            margin: "0 auto",
            pointerEvents: "auto",
            background: "#FFFFFF",
            border: "1px solid rgba(229,231,235,0.9)",
            borderRadius: 28,
            boxShadow: "0 8px 28px rgba(15,23,41,0.14), 0 2px 8px rgba(15,23,41,0.06)",
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
                      cursor: "pointer", touchAction: "manipulation",
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
                  border: "none", cursor: "pointer", touchAction: "manipulation",
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
        {/* ── NOTIF PANEL — a nivel raíz para evitar z-index/stacking-context bugs ── */}
        <NotifPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          contratos={contratos}
          clientes={clientes}
          paneles={paneles}
          gastos={gastos}
        />
        <BusquedaGlobal open={globalSearch} onClose={() => setGlobalSearch(false)} paneles={paneles} clientes={clientes} contratos={contratos} onNavigate={handleTabClick}/>
        <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} onTabClick={handleTabClick} onTrashOpen={() => setTrashOpen(true)} trashCount={contratos.filter(c => c.deleted).length}/>
        <TrashModal
          open={trashOpen}
          onClose={() => setTrashOpen(false)}
          contratos={contratos}
          clientes={clientes}
          paneles={paneles}
          proveedores={proveedores}
          setContratos={setContratos}
          setClientes={setClientes}
          setPaneles={setPaneles}
          setProveedores={setProveedores}
        />
      </div>}
    </>
  );
}
