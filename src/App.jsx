import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE — Vite + npm (firebase package instalado)
// ══════════════════════════════════════════════════════════════════
import { initializeApp }    from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCklWQStUPElsRfKH3icUZht-R321zgZY8",
  authDomain:        "base-de-datos-vista360.firebaseapp.com",
  projectId:         "base-de-datos-vista360",
  storageBucket:     "base-de-datos-vista360.firebasestorage.app",
  messagingSenderId: "421479773461",
  appId:             "1:421479773461:web:e38de4bfda177e232be51c",
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

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
  async del(col, id) {
    await deleteDoc(doc(db, col, id));
  },
  async uploadImagen(path, file) {
    const CLOUD_NAME = "djwhrurww";
    const PRESET     = "vista360_gastos";
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
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
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

const hoy   = new Date();
const mesHoy= `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
const dias  = (f) => Math.ceil((new Date(f) - hoy) / 86400000);
const fmt   = (n) => `$${Number(n||0).toLocaleString("es-EC")}`;
const fmtF  = (s) => s ? new Date(s).toLocaleDateString("es-EC",{day:"2-digit",month:"short",year:"numeric"}) : "—";

// ── PALETA PREMIUM ───────────────────────────────────────────────
// Profunda, elegante, sin neón agresivo
const C = {
  bg:       "#060A14",       // Fondo ultra profundo
  surface:  "#0B1120",       // Surface 1
  card:     "#0F172A",       // Cards
  cardHov:  "#131E35",       // Cards hover
  border:   "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.13)",
  
  purple:   "#7C6AF7",       // Morado principal (sidebar activo, logo)
  purpleSoft:"rgba(124,106,247,0.15)",
  blue:     "#4A7FE8",       // Azul profundo
  blueSoft: "rgba(74,127,232,0.12)",
  green:    "#34D399",       // Verde elegante
  greenSoft:"rgba(52,211,153,0.1)",
  amber:    "#FBBF24",
  red:      "#F87171",
  
  text:     "#F1F5F9",       // Texto principal
  textMid:  "#94A3B8",       // Texto secundario
  textDim:  "#475569",       // Texto terciario
  white:    "#FFFFFF",
};

const eCol = (e) => ({"Activo":C.green,"Por vencer":C.amber,"Inactivo":C.textDim,"En contacto":C.blue,"Propuesta enviada":C.purple,"Frío":C.textDim,"Perdido":C.red}[e]||C.textDim);
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.blue,"Transporte":C.blue,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.textDim};

// ── ATOMS ────────────────────────────────────────────────────────
const Badge  = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}30`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",letterSpacing:0.3}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"12",color,border:`1px solid ${color}30`,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{ch}</span>;

const Card = ({children,style={}}) => <div style={{
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  padding: 20,
  ...style
}}>{children}</div>;

const SecTit = ({ch}) => <div style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.8,marginBottom:14}}>{ch}</div>;

const PgTit = ({icon,title,sub}) => <div style={{marginBottom:22}}>
  <div style={{fontSize:22,fontWeight:800,color:C.white,letterSpacing:"-0.5px"}}>{icon} {title}</div>
  {sub&&<div style={{fontSize:13,color:C.textMid,marginTop:3}}>{sub}</div>}
</div>;

const Spinner = () => <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:C.textDim,fontSize:14,gap:10}}>
  <div style={{width:18,height:18,border:`2px solid ${C.border}`,borderTopColor:C.purple,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
  Cargando...
</div>;

// ── MODAL DE CONFIGURACIÓN ──────────────────────────────────────
function ModalConfig({onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(12px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0F172A",border:`1px solid ${C.borderHi}`,borderRadius:24,padding:28,width:"100%",maxWidth:480,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:C.white}}>Firebase — Vista360</div>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"5px 11px",color:C.textMid,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{fontSize:13,color:C.textMid,lineHeight:1.8,marginBottom:16}}>
          La app usa <strong style={{color:C.amber}}>Firebase Firestore</strong> como base de datos y <strong style={{color:C.amber}}>Cloudinary</strong> para fotos de boletas.<br/>
          El proyecto conectado es: <strong style={{color:C.white}}>base-de-datos-vista360</strong>
        </div>
        <div style={{background:C.surface,borderRadius:14,padding:"14px 16px",fontSize:12,color:C.green,fontFamily:"monospace",marginBottom:18,lineHeight:1.8,border:`1px solid ${C.border}`}}>
          projectId: base-de-datos-vista360<br/>
          storageBucket: base-de-datos-vista360.firebasestorage.app<br/>
          OCR: Google Cloud Vision API ✓
        </div>
        <button onClick={onClose} style={{width:"100%",padding:13,background:C.purple,border:"none",borderRadius:12,color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── INPUT FIELDS ─────────────────────────────────────────────────
const inp = (label,key,form,setForm,opts={})=>{
  const set=(v)=>setForm(f=>({...f,[key]:v}));
  const base={background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2}}>{label}</label>
      {opts.type==="select"
        ?<select value={form[key]||""} onChange={e=>set(e.target.value)} style={base}>
          {opts.options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        :opts.type==="textarea"
        ?<textarea value={form[key]||""} onChange={e=>set(e.target.value)} rows={3} placeholder={opts.ph||""} style={{...base,resize:"vertical"}}/>
        :<input type={opts.type||"text"} value={form[key]||""} placeholder={opts.ph||""} onChange={e=>set(e.target.value)} style={base}/>
      }
    </div>
  );
};

// ── MODAL BASE ───────────────────────────────────────────────────
function Modal({title,onClose,onSave,saveLabel="Guardar ✓",children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(12px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:24,padding:26,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800,color:C.white}}>{title}</div>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"5px 11px",color:C.textMid,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.textMid,fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
          <button onClick={onSave} style={{flex:2,padding:12,background:C.purple,border:"none",borderRadius:12,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer"}}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGO ──────────────────────────────────────────────────────────
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmQAAAGYCAYAAADsqf5DAACOl0lEQVR42u3deZgU1bk/8HNq6W1mWAREEBQVRYNrJkbxqiEbCdHoNblzjTEarxo0UXPjEryaX5KJWTUuiUYTNK5RYySb0YiahEWJiCwqCqIgiyI7zNbdVXW29/cHddqaYQa6Z3pQmG8/zzyzVdentu56+yzvy9j2Dx5/dfb3HT129v9yl4cPHz58+PDhw+9rfo+exCtcF4cPHz58+PDhw4ffvZXzLn7nZS4HHz58+PDhw4cPvwvDrcLGlfM/XuFGwocPHz58+PDh9zW/7JVVilWyTvjw4cOHDx8+fPi9APckEoUPHz58+PDhw+/rfq+s6P3eEfjw4cOHDx8+/N3C5zv4uaf9p+VsBHz48OHDhw8ffl/zd7pQ1ZrV4MOHDx8+fPjw4Zdv7GzQGe8NFD58+PDhw4cPvw/73d6wcp7H4cOHDx8+fPjw4fd8g96vJj348OHDhw8fPvy+5lcE8F4y4MOHDx8+fPjw+5pf9Sivs9kIHD58+PDhw4cPH37PAjTewx3prOmPw4cPHz58+PDhw+9e9FcpXM3IFD58+PDhw4cPf4/3q1njqTsbAR8+fPjw4cOHD38XRJa8l3cKPnz48OHDhw9/j/ArybXRG0nS4MOHDx8+fPjw4fc1v9cfHD58+PDhw4cPH/6ugcrpH+Xw4cOHDx8+fPjly4d6rQQAfPjw4cOHDx9+eRFfd5bvSbkB+PDhw4cPHz58+H3aL3cmQCUzBipppoMPHz58+PDhw++z/v8H5o3Oy6PGwVsAAAAASUVORK5CYII=";

const Logo360 = ({ width = 200 }) => (
  <img src={LOGO_B64} alt="Vista360" width={width} style={{ display:"block", objectFit:"contain" }} />
);

// ── SPLASH PREMIUM ────────────────────────────────────────────────
function Splash({done}){
  const [f,setF]=useState(0);
  useEffect(()=>{
    const ts=[setTimeout(()=>setF(1),400),setTimeout(()=>setF(2),950),setTimeout(()=>setF(3),2300),setTimeout(done,2800)];
    return()=>ts.forEach(clearTimeout);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:f===3?0:1,transition:f===3?"opacity .55s ease":"none"}}>
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(4)].map((_,i)=>(
          <div key={i} style={{position:"absolute",borderRadius:"50%",width:200+i*120,height:200+i*120,top:"50%",left:"50%",transform:"translate(-50%,-50%)",border:`1px solid rgba(124,106,247,${0.06+i*0.02})`,animation:`pulse ${2.5+i*0.4}s ease-in-out infinite alternate`}}/>
        ))}
      </div>
      <div style={{opacity:f>=1?1:0,transform:f>=1?"scale(1) translateY(0)":"scale(.85) translateY(20px)",transition:"all .75s cubic-bezier(.34,1.4,.64,1)",filter:`drop-shadow(0 0 50px rgba(124,106,247,0.4))`}}>
        <Logo360 width={280}/>
      </div>
      <div style={{fontFamily:"'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif",fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.4)",letterSpacing:5,textTransform:"uppercase",marginTop:16,opacity:f>=1?1:0,transition:"opacity .6s .35s",textAlign:"center"}}>
        Gestión de Paneles
      </div>
      <div style={{marginTop:48,width:200,height:2,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:f>=2?"100%":"0%",background:`linear-gradient(90deg,${C.purple},${C.blue})`,borderRadius:4,transition:f>=2?"width 1.3s cubic-bezier(.4,0,.2,1)":"none"}}/>
      </div>
      <style>{`@keyframes pulse{from{opacity:.3}to{opacity:.7}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── DONUT PREMIUM ─────────────────────────────────────────────────
function DonutPremium({pct,color,label,sub,size=110,stroke=9}){
  const r=(size/2)-stroke;
  const c2=2*Math.PI*r;
  const d=(pct/100)*c2;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${d} ${c2}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{filter:`drop-shadow(0 0 6px ${color}60)`}}/>
        <text x={size/2} y={size/2-5} textAnchor="middle" fill={C.white} fontSize={size*0.2} fontWeight="800">{pct}%</text>
        <text x={size/2} y={size/2+11} textAnchor="middle" fill={C.textDim} fontSize={size*0.09}>{label}</text>
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD PREMIUM
// ══════════════════════════════════════════════════════════════════
function Dashboard({clientes,contratos,paneles,setTab}){
  const ocu=paneles.length?Math.round((paneles.filter(p=>p.estado==="Ocupado").length/paneles.length)*100):0;
  const pag=contratos.filter(c=>c.pagado).length;
  const cob=contratos.length?Math.round((pag/contratos.length)*100):0;
  const ingMes=contratos.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto),0);
  const ingMesAnt=contratos.filter(c=>{
    const d=new Date(c.inicio); const now=new Date();
    return c.pagado&&d.getMonth()===now.getMonth()-1&&d.getFullYear()===now.getFullYear();
  }).reduce((a,c)=>a+Number(c.monto),0);
  const crecPct=ingMesAnt>0?Math.round(((ingMes-ingMesAnt)/ingMesAnt)*100):0;
  const prox=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>0&&c.d<=30&&c.panel&&c.cliente).sort((a,b)=>a.d-b.d).slice(0,3);
  const criticos=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>0&&c.d<=15&&c.panel&&c.cliente);
  const enAviso=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>15&&c.d<=30&&c.panel&&c.cliente);
  const [bannerCerrado,setBannerCerrado]=useState(false);
  const hayAlertas=(criticos.length>0||enAviso.length>0)&&!bannerCerrado;
  const hora=hoy.getHours();
  const saludoReal=hora<12?"Buenos días":hora<18?"Buenas tardes":"Buenas noches";

  // Micro sparkline para la tarjeta de ingresos
  const datosMeses = useMemo(()=>{
    const mapa={};
    contratos.filter(c=>c.pagado).forEach(c=>{
      const d=new Date(c.inicio||c.created_at||Date.now());
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      mapa[key]=(mapa[key]||0)+Number(c.monto||0);
    });
    const res=[];
    for(let i=5;i>=0;i--){
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      res.push({key,v:mapa[key]||0});
    }
    return res;
  },[contratos]);

  const maxV=Math.max(...datosMeses.map(d=>d.v),1);
  const sparklPts = datosMeses.map((d,i)=>({
    x: 4 + (i/(datosMeses.length-1||1))*92,
    y: 26 - 4 - (d.v/maxV)*18,
  }));
  const sparklPath = sparklPts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");

  return(
    <div style={{paddingBottom:24}}>

      {/* ── ALERT BANNER ── */}
      {hayAlertas&&(
        <div style={{marginBottom:14,borderRadius:18,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:criticos.length>0?"rgba(248,113,113,0.08)":"rgba(251,191,36,0.08)",border:`1px solid ${(criticos.length>0?C.red:C.amber)}25`,backdropFilter:"blur(8px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:criticos.length>0?C.red:C.amber,boxShadow:`0 0 8px ${criticos.length>0?C.red:C.amber}`}}/>
            <span style={{fontSize:13,fontWeight:600,color:criticos.length>0?C.red:C.amber}}>
              {criticos.length>0?`${criticos.length} contrato${criticos.length>1?"s":""} vence${criticos.length>1?"n":""} pronto`:`${enAviso.length} contrato${enAviso.length>1?"s":""} por vencer`}
            </span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setTab("contratos")} style={{background:"transparent",border:`1px solid ${criticos.length>0?C.red:C.amber}50`,borderRadius:8,padding:"5px 12px",color:criticos.length>0?C.red:C.amber,fontWeight:600,fontSize:12,cursor:"pointer"}}>Ver</button>
            <button onClick={()=>setBannerCerrado(true)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          HERO CARD — Saludo + fecha + ilustración
      ═══════════════════════════════════════════════ */}
      <div style={{
        marginBottom:14,
        padding:"24px 22px",
        borderRadius:24,
        position:"relative",
        overflow:"hidden",
        background:"linear-gradient(140deg, #0F1835 0%, #131A40 40%, #0E1530 100%)",
        border:"1px solid rgba(124,106,247,0.18)",
        boxShadow:"0 2px 40px rgba(0,0,0,0.4)",
      }}>
        {/* Fondo gradiente sutil */}
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 80% at 85% 50%, rgba(124,106,247,0.08) 0%, transparent 70%)",pointerEvents:"none"}}/>
        {/* Puntos decorativos sutiles */}
        {[[12,18,3,0.4],[22,55,2,0.3],[8,75,4,0.25],[18,42,2.5,0.3]].map(([top,left,r,op],i)=>(
          <div key={i} style={{position:"absolute",top:`${top}%`,left:`${left}%`,width:r*2,height:r*2,borderRadius:"50%",background:`rgba(124,106,247,${op})`,pointerEvents:"none"}}/>
        ))}

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
          <div style={{flex:1}}>
            {/* Saludo */}
            <div style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.5)",marginBottom:3}}>
              {saludoReal}, <span style={{color:C.purple,fontWeight:700}}>Alan</span> 👋
            </div>
            {/* Nombre */}
            <div style={{fontSize:28,fontWeight:800,color:C.white,letterSpacing:"-0.7px",lineHeight:1.15,marginBottom:6}}>
              Alan Martínez
            </div>
            {/* Subtexto */}
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:16,fontWeight:400}}>
              Aquí tienes el resumen de hoy.
            </div>
            {/* Fecha pill */}
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:30,padding:"6px 14px"}}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="11" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" fill="none"/>
                <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
                <line x1="4.5" y1="1" x2="4.5" y2="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9.5" y1="1" x2="9.5" y2="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:500}}>
                {hoy.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </span>
            </div>
          </div>

          {/* Ilustración — órbita abstracta 3D */}
          <div style={{flexShrink:0,marginLeft:12,position:"relative",width:130,height:120,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="130" height="120" viewBox="0 0 130 120" fill="none">
              <defs>
                <radialGradient id="hGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7C6AF7" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#7C6AF7" stopOpacity="0"/>
                </radialGradient>
                <radialGradient id="sphereG" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#9580FF"/>
                  <stop offset="40%" stopColor="#6B56E8"/>
                  <stop offset="100%" stopColor="#2D1F7A"/>
                </radialGradient>
                <radialGradient id="sphereShine" cx="30%" cy="25%" r="55%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </radialGradient>
              </defs>
              {/* Glow background */}
              <ellipse cx="65" cy="60" rx="55" ry="50" fill="url(#hGlow)"/>
              {/* Anillos orbitales */}
              <ellipse cx="65" cy="60" rx="50" ry="18" stroke="rgba(124,106,247,0.2)" strokeWidth="1" fill="none"/>
              <ellipse cx="65" cy="60" rx="50" ry="18" stroke="rgba(124,106,247,0.1)" strokeWidth="1" fill="none" transform="rotate(60 65 60)"/>
              <ellipse cx="65" cy="60" rx="50" ry="18" stroke="rgba(124,106,247,0.1)" strokeWidth="1" fill="none" transform="rotate(120 65 60)"/>
              {/* Esfera central */}
              <circle cx="65" cy="58" r="26" fill="url(#sphereG)" style={{filter:"drop-shadow(0 4px 20px rgba(124,106,247,0.5))"}}/>
              <circle cx="65" cy="58" r="26" fill="url(#sphereShine)"/>
              {/* Detalles de líneas en la esfera */}
              <ellipse cx="65" cy="58" rx="26" ry="10" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none"/>
              <ellipse cx="65" cy="58" rx="10" ry="26" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none"/>
              {/* Punto satélite 1 */}
              <circle cx="113" cy="50" r="5" fill="#4A7FE8" style={{filter:"drop-shadow(0 0 6px rgba(74,127,232,0.8))"}}/>
              <circle cx="113" cy="50" r="3" fill="#7AABFF"/>
              {/* Punto satélite 2 */}
              <circle cx="16" cy="72" r="4" fill="#7C6AF7" opacity="0.8" style={{filter:"drop-shadow(0 0 5px rgba(124,106,247,0.7))"}}/>
              {/* Partículas */}
              <circle cx="95" cy="22" r="2" fill="rgba(255,255,255,0.3)"/>
              <circle cx="30" cy="30" r="1.5" fill="rgba(255,255,255,0.2)"/>
              <circle cx="108" cy="90" r="1.5" fill="rgba(124,106,247,0.5)"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CARD INGRESOS — Principal
      ═══════════════════════════════════════════════ */}
      <div style={{
        marginBottom:14,
        padding:"20px 20px",
        borderRadius:22,
        background:"linear-gradient(145deg, #081A12 0%, #061410 100%)",
        border:"1px solid rgba(52,211,153,0.12)",
        boxShadow:"0 4px 30px rgba(52,211,153,0.06)",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Glow verde sutil */}
        <div style={{position:"absolute",top:-30,right:-20,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%)",pointerEvents:"none"}}/>
        
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {/* Icono */}
          <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg, #064E3B, #10B981)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(16,185,129,0.25)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#6EE7B7" strokeWidth="1.8" fill="none"/>
              <text x="12" y="17" textAnchor="middle" fill="#6EE7B7" fontSize="13" fontWeight="900" fontFamily="system-ui">$</text>
            </svg>
          </div>

          {/* Datos principales */}
          <div style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(52,211,153,0.7)",textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>Ingresos este mes</div>
            <div style={{fontSize:38,fontWeight:900,color:C.green,letterSpacing:"-1.5px",lineHeight:1,textShadow:"0 0 20px rgba(52,211,153,0.3)"}}>{fmt(ingMes)}</div>
            <div style={{fontSize:11,color:"rgba(52,211,153,0.6)",marginTop:5}}>{pag} de {contratos.length} contratos cobrados</div>
          </div>

          {/* Separador + comparativa */}
          <div style={{width:1,height:60,background:"rgba(52,211,153,0.12)",flexShrink:0}}/>
          <div style={{textAlign:"center",flexShrink:0,minWidth:80}}>
            <div style={{marginBottom:4}}>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <path d={crecPct>=0?"M1 11 L5 7 L9 9 L19 2":"M1 2 L5 6 L9 4 L19 11"} stroke={crecPct>=0?C.green:C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{fontSize:10,color:"rgba(52,211,153,0.55)",marginBottom:3}}>vs mes ant.</div>
            <div style={{fontSize:20,fontWeight:crecPct===0?700:800,color:crecPct>=0?C.green:C.red,lineHeight:1}}>{crecPct===0?"0%":crecPct>0?`+${crecPct}%`:`${crecPct}%`}</div>
            <div style={{fontSize:10,color:"rgba(52,211,153,0.45)",marginTop:3}}>{crecPct===0?"Sin cambios":crecPct>0?"Creciendo":"Bajando"}</div>
          </div>
        </div>

        {/* Micro sparkline */}
        {datosMeses.some(d=>d.v>0)&&(
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(52,211,153,0.08)"}}>
            <svg width="100%" viewBox="0 0 100 30" preserveAspectRatio="none" style={{display:"block",height:32}}>
              <defs>
                <linearGradient id="sparkG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {sparklPts.length>1&&(
                <>
                  <path d={`${sparklPath} L${sparklPts[sparklPts.length-1].x},26 L${sparklPts[0].x},26 Z`} fill="url(#sparkG)"/>
                  <path d={sparklPath} stroke="#34D399" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx={sparklPts[sparklPts.length-1].x} cy={sparklPts[sparklPts.length-1].y} r="2.5" fill="#34D399" style={{filter:"drop-shadow(0 0 4px rgba(52,211,153,0.8))"}}/>
                </>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          DONUTS — Ocupación y Cobro (lado a lado)
      ═══════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        {/* Ocupación */}
        <div style={{padding:"18px 14px",background:"linear-gradient(145deg, #0A1428, #08102A)",borderRadius:22,border:"1px solid rgba(74,127,232,0.12)",display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14,alignSelf:"flex-start"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>
            <span style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.5}}>Ocupación</span>
          </div>
          <DonutPremium pct={ocu} color={C.blue} label="ocup." size={110} stroke={8}/>
          <div style={{marginTop:12,fontSize:11,color:C.textDim,textAlign:"center"}}>
            {paneles.filter(p=>p.estado==="Ocupado").length} de {paneles.length} paneles
          </div>
          {paneles.length===0&&<div style={{fontSize:10,color:C.textDim,background:"rgba(255,255,255,0.04)",borderRadius:20,padding:"2px 10px",marginTop:6}}>Sin datos aún</div>}
        </div>

        {/* Cobro */}
        <div style={{padding:"18px 14px",background:"linear-gradient(145deg, #081812, #060F0A)",borderRadius:22,border:"1px solid rgba(52,211,153,0.10)",display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14,alignSelf:"flex-start"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
            <span style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.5}}>Cobro</span>
          </div>
          <DonutPremium pct={cob} color={C.green} label="cobr." size={110} stroke={8}/>
          <div style={{marginTop:12,fontSize:11,color:C.textDim,textAlign:"center"}}>
            {pag} de {contratos.length} contratos
          </div>
          {contratos.length===0&&<div style={{fontSize:10,color:C.textDim,background:"rgba(255,255,255,0.04)",borderRadius:20,padding:"2px 10px",marginTop:6}}>Sin datos aún</div>}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PRÓXIMOS A VENCER
      ═══════════════════════════════════════════════ */}
      <div style={{
        marginBottom:14,
        borderRadius:22,
        overflow:"hidden",
        border:"1px solid rgba(124,106,247,0.14)",
        background:"linear-gradient(145deg, #110E2E, #0D0B22)",
        position:"relative",
      }}>
        {/* Glow decorativo */}
        <div style={{position:"absolute",top:-40,right:-30,width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 70%)",pointerEvents:"none"}}/>
        
        <div style={{padding:"20px 20px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            {/* Icono calendario */}
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(124,106,247,0.15)",border:"1px solid rgba(124,106,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="14" height="13" rx="2.5" stroke={C.purple} strokeWidth="1.3" fill="none"/>
                <line x1="1" y1="6.5" x2="15" y2="6.5" stroke={C.purple} strokeWidth="1.3" opacity="0.7"/>
                <line x1="5" y1="1" x2="5" y2="4" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="11" y1="1" x2="11" y2="4" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="3.5" y="8.5" width="2.5" height="2.5" rx="0.5" fill={C.purple} opacity="0.7"/>
                <rect x="6.8" y="8.5" width="2.5" height="2.5" rx="0.5" fill={C.purple} opacity="0.5"/>
                <rect x="10" y="8.5" width="2.5" height="2.5" rx="0.5" fill={C.purple} opacity="0.5"/>
              </svg>
            </div>
            <span style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:1.8,opacity:0.9}}>Próximos a vencer</span>
            {prox.length>0&&<span style={{marginLeft:"auto",background:"rgba(248,113,113,0.1)",color:C.red,border:"1px solid rgba(248,113,113,0.25)",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{prox.length}</span>}
          </div>

          {/* Contenido */}
          <div style={{marginBottom:16,minHeight:60}}>
            {prox.length===0?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:5,lineHeight:1.3}}>No tienes contratos<br/>próximos a vencer.</div>
                  <div style={{fontSize:13,color:C.purple,opacity:0.75}}>¡Todo al día, buen trabajo!</div>
                </div>
                {/* Ilustración check sutil */}
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                  <circle cx="36" cy="36" r="32" fill="rgba(124,106,247,0.07)" stroke="rgba(124,106,247,0.15)" strokeWidth="1.5"/>
                  <circle cx="36" cy="36" r="22" fill="rgba(124,106,247,0.08)"/>
                  <path d="M24 36 L32 44 L48 28" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ):(
              prox.map((c,i)=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,paddingTop:i>0?10:0,paddingBottom:10,borderBottom:i<prox.length-1?"1px solid rgba(124,106,247,0.08)":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel.nombre}</div>
                    <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{c.cliente?.empresa}</div>
                  </div>
                  <div style={{background:c.d<=15?"rgba(248,113,113,0.1)":"rgba(251,191,36,0.1)",color:c.d<=15?C.red:C.amber,border:`1px solid ${c.d<=15?C.red:C.amber}30`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>{c.d}d</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Botón CTA — Apple style */}
        <button onClick={()=>setTab("contratos")} style={{
          display:"block",
          width:"100%",
          padding:"16px",
          background:"linear-gradient(135deg, rgba(124,106,247,0.9), rgba(100,82,225,0.95))",
          border:"none",
          color:C.white,
          fontWeight:700,
          fontSize:14,
          cursor:"pointer",
          letterSpacing:0.3,
          position:"relative",
          overflow:"hidden",
        }}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",pointerEvents:"none"}}/>
          Ver contratos →
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          MÉTRICAS DEL MES — 3 cards compactas
      ═══════════════════════════════════════════════ */}
      <div style={{borderRadius:22,background:"linear-gradient(145deg, #0C1525, #09101E)",border:"1px solid rgba(255,255,255,0.06)",padding:"18px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <line x1="7" y1="13" x2="7" y2="7" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="4" y1="13" x2="4" y2="10" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="10" y1="13" x2="10" y2="4" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.8}}>Métricas del mes</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {icon:"$",iconBg:"linear-gradient(135deg,#064E3B,#059669)",iconColor:"#6EE7B7",label:"Ingresos",value:fmt(ingMes),sub:"Este mes",accent:C.green},
            {icon:"⊞",iconBg:"linear-gradient(135deg,#1E3A6E,#3B82F6)",iconColor:"#93C5FD",label:"Paneles",value:paneles.filter(p=>p.estado==="Ocupado").length,sub:"Activos",accent:C.blue},
            {icon:"◎",iconBg:"linear-gradient(135deg,#4C1D95,#7C6AF7)",iconColor:"#C4B5FD",label:"Contratos",value:contratos.filter(c=>dias(c.fin)>0).length,sub:"Vigentes",accent:C.purple},
          ].map(m=>(
            <div key={m.label} style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,padding:"14px 8px",textAlign:"center",position:"relative",overflow:"hidden"}}>
              {/* Micro glow */}
              <div style={{position:"absolute",top:-20,left:"50%",transform:"translateX(-50%)",width:60,height:40,borderRadius:"50%",background:`radial-gradient(circle, ${m.accent}15 0%, transparent 70%)`,pointerEvents:"none"}}/>
              <div style={{width:36,height:36,borderRadius:12,background:m.iconBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontSize:13,color:m.iconColor,fontWeight:900,boxShadow:`0 4px 12px ${m.accent}25`}}>
                {m.icon}
              </div>
              <div style={{fontSize:10,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6,marginBottom:4,lineHeight:1.3}}>{m.label}</div>
              <div style={{fontSize:18,fontWeight:900,color:m.accent,letterSpacing:"-0.5px",lineHeight:1}}>{m.value}</div>
              <div style={{fontSize:10,color:C.textDim,marginTop:3,opacity:0.7}}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

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

  const W=500,H=130,PAD=12;
  const pts=data.map((d,i)=>({
    x:PAD+(i/(data.length-1||1))*(W-PAD*2),
    y:H-PAD-(d.v/maxV)*(H-PAD*2),
    v:d.v, label:d.label,
  }));
  const pathD=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const areaD=pts.length>1?`${pathD} L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`:"";

  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:1.8,marginBottom:6}}>Crecimiento del negocio</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:26,fontWeight:800,color:C.white}}>{fmt(mesActual)}</span>
          <div style={{display:"flex",alignItems:"center",gap:5,background:(crecPct>=0?C.green:C.red)+"12",border:`1px solid ${(crecPct>=0?C.green:C.red)}25`,borderRadius:20,padding:"3px 10px"}}>
            <span style={{fontSize:11,fontWeight:700,color:crecPct>=0?C.green:C.red}}>{crecPct>=0?"▲":"▼"} {Math.abs(crecPct)}%</span>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:2,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:3,border:`1px solid ${C.border}`}}>
        {["meses","años"].map(v=>(
          <button key={v} onClick={()=>setVista(v)}
            style={{padding:"5px 12px",borderRadius:9,border:"none",background:vista===v?C.purple:"transparent",color:vista===v?C.white:C.textDim,fontWeight:700,fontSize:10,cursor:"pointer",textTransform:"uppercase",letterSpacing:0.5,transition:"all 0.2s"}}>
            {v==="meses"?"Mensual":"Anual"}
          </button>
        ))}
      </div>
    </div>

    <div style={{background:"rgba(0,0,0,0.2)",borderRadius:16,padding:"14px 8px 8px",border:`1px solid ${C.border}`,marginBottom:6}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible",display:"block"}}>
        <defs>
          <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.purple} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={C.purple} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75].map(p=>(
          <line key={p} x1={PAD} y1={H-PAD-(p*(H-PAD*2))} x2={W-PAD} y2={H-PAD-(p*(H-PAD*2))}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        ))}
        {pts.length>1&&<path d={areaD} fill="url(#gr1)"/>}
        {pts.length>1&&<path d={pathD} stroke={C.purple} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{filter:"drop-shadow(0 0 4px rgba(124,106,247,0.5))"}}/>}
        {pts.map((p,i)=>(
          <g key={i} style={{cursor:"pointer"}}
            onMouseEnter={()=>setTooltip(p)} onMouseLeave={()=>setTooltip(null)}
            onTouchStart={()=>setTooltip(p)} onTouchEnd={()=>setTimeout(()=>setTooltip(null),1500)}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent"/>
            <circle cx={p.x} cy={p.y} r={p.v>0?3.5:2} fill={p.v>0?C.purple:"rgba(255,255,255,0.1)"} stroke={C.bg} strokeWidth="1.5"/>
          </g>
        ))}
        {tooltip&&(
          <g>
            <rect x={Math.min(Math.max(tooltip.x-40,4),W-84)} y={tooltip.y-40} width={80} height={30} rx={8} fill={C.card} stroke={C.border} strokeWidth="1"/>
            <text x={Math.min(Math.max(tooltip.x-40,4),W-84)+40} y={tooltip.y-22} textAnchor="middle" fill={C.white} fontSize={11} fontWeight="800">{fmt(tooltip.v)}</text>
            <text x={Math.min(Math.max(tooltip.x-40,4),W-84)+40} y={tooltip.y-11} textAnchor="middle" fill={C.textDim} fontSize={9}>{tooltip.label}</text>
          </g>
        )}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",paddingLeft:PAD,paddingRight:PAD,marginTop:4}}>
        {data.filter((_,i)=>i===0||i===Math.floor(data.length/2)||i===data.length-1).map(d=>(
          <span key={d.key} style={{fontSize:9,color:C.textDim,fontWeight:600,textTransform:"uppercase"}}>{d.label}</span>
        ))}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:12}}>
      {[["💵","Total",fmt(totalHist),C.white],["🏆","Mejor mes",fmt(mejorMes),C.green],["📊","Promedio",fmt(promMes),C.blue]].map(([ic,l,v,c])=>(
        <div key={l} style={{textAlign:"center",background:"rgba(0,0,0,0.2)",borderRadius:14,padding:"11px 6px",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:14,marginBottom:4}}>{ic}</div>
          <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:9,color:C.textDim,marginTop:2,textTransform:"uppercase",letterSpacing:0.5}}>{l}</div>
        </div>
      ))}
    </div>
  </div>);
}

// ── SVG Icons ────────────────────────────────────────────────────
const ICONS={
  dashboard:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  mapa:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  paneles:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  contratos:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  crm:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  resultados:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gastos:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  perfil:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ── SIDEBAR ICON BUTTON — PREMIUM ────────────────────────────────
function SideIcon({id,label,active,onClick,badge}){
  return(
    <button onClick={onClick} title={label} style={{
      width:"100%",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      justifyContent:"center",
      gap:5,
      padding:"13px 0",
      background:"none",
      border:"none",
      cursor:"pointer",
      position:"relative",
      color:active?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.28)",
      transition:"color 0.2s",
    }}>
      {/* Indicador activo — pill izquierda */}
      {active&&(
        <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:3,height:24,background:C.purple,borderRadius:"0 3px 3px 0",boxShadow:`0 0 8px ${C.purple}`}}/>
      )}
      {/* Fondo activo suave */}
      {active&&(
        <div style={{position:"absolute",inset:"6px 6px",borderRadius:12,background:"rgba(124,106,247,0.1)",border:"1px solid rgba(124,106,247,0.12)"}}/>
      )}
      {/* Icono */}
      <div style={{position:"relative",zIndex:1}}>
        {ICONS[id]||ICONS.dashboard}
        {badge>0&&(
          <span style={{position:"absolute",top:-4,right:-4,width:14,height:14,borderRadius:"50%",background:C.red,fontSize:8,color:"#fff",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:`1.5px solid ${C.bg}`}}>{badge>9?"9+":badge}</span>
        )}
      </div>
      {/* Label */}
      <span style={{fontSize:9,fontWeight:active?700:500,letterSpacing:0.3,position:"relative",zIndex:1,opacity:active?1:0.8}}>{label}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════
export default function App(){
  const [splash,setSplash]=useState(true);
  const [showConfig,setShowConfig]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [tab,setTab]=useState("dashboard");
  const [clientes,setClientes]=useState([]);
  const [paneles,setPaneles]=useState([]);
  const [contratos,setContratos]=useState([]);
  const [gastos,setGastos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  const swRef = useRef(null);

  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    const SW=`self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(clients.claim()));self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window"}).then(list=>{if(list.length)return list[0].focus();return clients.openWindow("/");}));});`;
    const blob=new Blob([SW],{type:"application/javascript"});
    const url=URL.createObjectURL(blob);
    navigator.serviceWorker.register(url).then(reg=>{swRef.current=reg;URL.revokeObjectURL(url);}).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!contratos.length||!paneles.length||!clientes.length) return;
    if(typeof Notification==="undefined") return;
    if(Notification.permission!=="granted") return;
    const hoyD=new Date();
    let enviadas={};
    try{enviadas=JSON.parse(localStorage.getItem("v360_notif")||"{}");}catch{}
    contratos.forEach(c=>{
      const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);
      [30,15].forEach(umbral=>{
        if(d>0&&d<=umbral){
          const key=`${c.id}_${umbral}`;
          if(enviadas[key]) return;
          const panel=paneles.find(p=>p.id===c.panel_id);
          const cliente=clientes.find(cl=>cl.id===c.cliente_id);
          if(!panel||!cliente) return;
          const titulo=d<=5?`🚨 Vence en ${d} día${d===1?"":"s"} — ${panel.nombre}`:`⚠️ Vence en ${d} días — ${panel.nombre}`;
          const cuerpo=`Cliente: ${cliente.empresa} · ${fmt(c.monto)}/mes`;
          try{
            if(swRef.current&&swRef.current.showNotification){
              swRef.current.showNotification(titulo,{body:cuerpo,tag:key,icon:"/favicon.ico",badge:"/favicon.ico",vibrate:[200,100,200],requireInteraction:d<=5});
            }else{new Notification(titulo,{body:cuerpo,tag:key});}
            enviadas[key]=true;
          }catch{}
        }
      });
    });
    try{localStorage.setItem("v360_notif",JSON.stringify(enviadas));}catch{}
  },[contratos,paneles,clientes]);

  useEffect(()=>{
    Promise.all([fb.get("clientes"),fb.get("paneles"),fb.get("contratos"),fb.get("gastos")])
      .then(([c,p,ct,g])=>{
        setClientes(Array.isArray(c)?c:[]);
        setPaneles(Array.isArray(p)?p:[]);
        setContratos(Array.isArray(ct)?ct:[]);
        setGastos(Array.isArray(g)?g:[]);
        setLoading(false);
      }).catch(()=>{setError(true);setLoading(false);});
  },[]);

  const tabs=[
    {id:"dashboard",label:"Inicio"},
    {id:"mapa",     label:"Mapa"},
    {id:"paneles",  label:"Paneles"},
    {id:"contratos",label:"Contratos"},
    {id:"crm",      label:"Clientes"},
    {id:"resultados",label:"Resultados"},
    {id:"gastos",   label:"Gastos"},
  ];

  // Calcular contratos próximos para badge
  const proxCount = contratos.filter(c=>{
    const d=Math.ceil((new Date(c.fin)-hoy)/86400000);
    return d>0&&d<=15;
  }).length;

  const activeTab = showProfile ? "perfil" : tab;

  return(<>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
    <meta name="theme-color" content="#060A14"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <style>{`
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%;-webkit-text-size-adjust:100%}
      ::-webkit-scrollbar{display:none}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{from{opacity:.2}to{opacity:.65}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      button:active{opacity:0.8;transform:scale(0.98)}
      button{transition:opacity 0.15s,transform 0.15s}
    `}</style>

    {splash&&<Splash done={()=>setSplash(false)}/>}
    {showConfig&&<ModalConfig onClose={()=>setShowConfig(false)}/>}

    <div style={{
      fontFamily:"'Inter',-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",
      background:C.bg,
      height:"100dvh",
      color:C.text,
      display:"flex",
      overflow:"hidden",
    }}>

      {/* ═══════════════════════════════════════════
          SIDEBAR PREMIUM — Más ancho, más elegante
      ════════════════════════════════════════════ */}
      <aside style={{
        width:76,
        flexShrink:0,
        background:"#080D1A",
        borderRight:"1px solid rgba(255,255,255,0.05)",
        display:"flex",
        flexDirection:"column",
        alignItems:"center",
        paddingTop:"env(safe-area-inset-top)",
        zIndex:100,
        position:"relative",
      }}>
        {/* Gradiente sutil en el sidebar */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(124,106,247,0.03) 0%, transparent 40%)",pointerEvents:"none"}}/>
        
        {/* LOGO — más grande y prominente */}
        <div style={{
          padding:"16px 0 14px",
          width:"100%",
          display:"flex",
          justifyContent:"center",
          borderBottom:"1px solid rgba(255,255,255,0.04)",
          marginBottom:4,
          position:"relative",
        }}>
          <Logo360 width={52}/>
        </div>

        {/* Nav items */}
        <div style={{flex:1,width:"100%",overflowY:"auto",scrollbarWidth:"none",position:"relative",zIndex:1}}>
          {tabs.map(t=>(
            <SideIcon key={t.id} id={t.id} label={t.label}
              active={activeTab===t.id}
              badge={t.id==="contratos"?proxCount:0}
              onClick={()=>{setTab(t.id);setShowProfile(false);}}/>
          ))}
        </div>

        {/* Separador */}
        <div style={{width:"60%",height:1,background:"rgba(255,255,255,0.05)",marginBottom:4,position:"relative",zIndex:1}}/>

        {/* Perfil + notificaciones en bottom */}
        <div style={{width:"100%",paddingBottom:"calc(env(safe-area-inset-bottom) + 6px)",position:"relative",zIndex:1}}>
          {/* Notificaciones */}
          <SideIcon id="perfil" label="Alan" active={showProfile} badge={proxCount} onClick={()=>setShowProfile(v=>!v)}/>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════ */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}}>
        <main style={{
          flex:1,
          overflowY:"auto",
          overflowX:"hidden",
          padding:"16px 16px",
          paddingBottom:"calc(16px + env(safe-area-inset-bottom))",
          WebkitOverflowScrolling:"touch",
        }}>

          {/* Perfil */}
          {showProfile&&(
            <div style={{animation:"fadeUp 0.3s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22,padding:"20px",background:"linear-gradient(135deg,#0F172A,#0B1020)",borderRadius:22,border:`1px solid ${C.border}`}}>
                <img src="https://ui-avatars.com/api/?name=Alan+M&background=7C6AF7&color=fff&size=64&bold=true" style={{width:60,height:60,borderRadius:"50%",border:`2.5px solid ${C.purple}`}} alt="perfil"/>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:C.white}}>Alan Martínez</div>
                  <div style={{fontSize:12,color:C.textMid,marginTop:2}}>Administrador · Vista360</div>
                </div>
              </div>
            </div>
          )}

          {!showProfile&&(
            <>
              {error&&(
                <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:16,padding:"16px 18px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:20,flexShrink:0}}>⚠️</div>
                  <div>
                    <div style={{fontWeight:700,color:C.amber,fontSize:13,marginBottom:3}}>Sin conexión a Firebase</div>
                    <div style={{fontSize:12,color:C.textMid}}>Despliega en Vercel para conectar la base de datos.</div>
                  </div>
                </div>
              )}
              {tab==="dashboard"&&<Dashboard clientes={clientes} contratos={contratos} paneles={paneles} setTab={setTab}/>}
              {/* Aquí van las demás pantallas sin cambios */}
            </>
          )}
        </main>
      </div>
    </div>
  </>);
}
