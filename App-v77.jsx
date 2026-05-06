function SideIcon({id,label,active,onClick}){
  return(
    <button onClick={onClick} title={label} style={{
      width:"calc(100% - 14px)",margin:"1px 7px",
      display:"flex",flexDirection:"row",alignItems:"center",
      gap:10,padding:"10px 13px",
      background:active
        ?"linear-gradient(135deg,rgba(79,124,255,0.18) 0%,rgba(123,95,255,0.12) 100%)"
        :"transparent",
      border:active?"1px solid rgba(79,124,255,0.22)":"1px solid transparent",
      cursor:"pointer",
      color:active?"#FFFFFF":"rgba(255,255,255,0.38)",
      borderRadius:12,
      transition:"all 0.18s ease",
      boxShadow:active
        ?"0 2px 20px rgba(79,124,255,0.15),inset 0 1px 0 rgba(255,255,255,0.06)"
        :"none",
      position:"relative",overflow:"hidden",
    }}>
      {active&&<div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2,background:"linear-gradient(180deg,transparent,#4F7CFF,transparent)",borderRadius:2,pointerEvents:"none"}}/>}
      {active&&<div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent,rgba(79,124,255,0.4),transparent)",pointerEvents:"none"}}/>}
      <span style={{flexShrink:0,display:"flex",alignItems:"center",opacity:active?1:0.55,transition:"opacity 0.18s"}}>
        {ICONS[id]||ICONS.dashboard}
      </span>
      <span style={{fontSize:13,fontWeight:active?600:400,letterSpacing:0.1,whiteSpace:"nowrap"}}>
        {label}
      </span>
    </button>
  );
}

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

// Inicializar Firebase con SDK modular
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

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
  async del(col, id) {
    await deleteDoc(doc(db, col, id));
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

const hoy   = new Date();
const mesHoy= `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
const dias  = (f) => Math.ceil((new Date(f) - hoy) / 86400000);
const fmt   = (n) => `$${Number(n||0).toLocaleString("es-EC")}`;
const fmtF  = (s) => s ? new Date(s).toLocaleDateString("es-EC",{day:"2-digit",month:"short",year:"numeric"}) : "—";

// ── PALETA ───────────────────────────────────────────────────────
const C = {
  bg:"#020510", surface:"#060D1A", card:"#0A1422", border:"#162035",
  accent:"#4F7CFF", green:"#0FBA7D", red:"#F04747", amber:"#F5A623",
  purple:"#9B6FFF", cyan:"#22D3EE", text:"#DCE4F5", muted:"#4E6080", white:"#FFFFFF",
  sidebarBg:"#030814", contentBg:"#080E1C",
};
const eCol = (e) => ({"Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,"En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red}[e]||C.muted);
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};

// ── ATOMS ────────────────────────────────────────────────────────
const Badge  = ({color,ch})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Card   = ({children,style={}})=><div style={{background:"linear-gradient(145deg,rgba(14,24,42,0.95) 0%,rgba(8,14,26,0.98) 100%)",border:`1px solid rgba(79,124,255,0.13)`,borderRadius:16,padding:22,boxShadow:"0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",...style}}>{children}</div>;
const SecTit = ({ch})=><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>{ch}</div>;
const PgTit  = ({icon,title,sub})=><div style={{marginBottom:22}}><div style={{fontSize:22,fontWeight:800,color:C.white,letterSpacing:"-0.5px"}}>{icon} {title}</div>{sub&&<div style={{fontSize:13,color:C.muted,marginTop:3}}>{sub}</div>}</div>;
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
  const base={background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>{label}</label>
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
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:26,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800,color:C.white}}>{title}</div>
          <button onClick={onClose} style={{background:C.border,border:"none",borderRadius:8,padding:"5px 11px",color:C.muted,cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
          <button onClick={onSave} style={{flex:2,padding:12,background:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer"}}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGO — PNG real con fondo transparente ──────────────────────
const LOGO_B64 = "data:image/png;base64,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4MH7plKpfaWUI2tqavbff//99/voRz+6Ty6XGxQEwT6+7+9jjOnnuq6TnABARMnrojS70gZmye92EkKi+5MxxkozPpOTCzjnWgjR4nneWsdxVr788ssrnn322ddqamoWLF68eOktt9wS4PzD72qdfCdgNQbG9aSuFHz48PuQP378eO/8888fKYT4EOf84OOOO27/D33oQ/txzvfTWo9kjA3gnDvxF49btLTrukZK6fi+70opyd6A49xUeaXUOinlu9lsdi1jbJMxZsM//vGPTY8//nhBCNFGRHnXdVuVUs39+vVrU0oVbrvtNoHzv3v548eP98aOHdv/wgsv3GvUqFHDHnjggX0uvfTSkUKIQzKZzIeMMUdqrfvZWZJ20kKia5M45zwxQaA0WcB+LxaL9jsNGDCAWlpammpra98yxix2XXfJ3Xff/dYrr7yyfr/99lt96qmnbh47dqzA+Ydfjl/txLDVqKAOHz78vuHzb3zjG7lLLrnkQ2EYnpBOp48ZMmTIQXvvvXd/xlitlLK/53k5pZSjtS61YLBtBatZGIbcdV3H930dRVGYSqU2CCFW+b7/ruM4bzHG1oRh+Pb555+/6Y033oh83w+VUmEYhiFjTCxevFhW+Rjg/H8A/fHjx3tKqbonn3zypFwud7fruoPtzFXb8uV5XrskuSwx+F9rTWEYsmw2q4UQlE6nW5RSr0opZwkhXvn5z3++YubMmS1KqfygQYPy06ZNUw888MCgc889dxMRuZxzhfMPvxyf76DZrdzZBd2JLstp9oMPH/4e4Dc0NLibNm2qC8NwgO/7/W644YZRxx9//Dil1Mme5x0ahmFtnG6Bu67rMcZMsVjUuVwuEEIUU6lUyBgLhBDF9evXF9asWbMplUq95fv+SinlW8aY1S+//PLKiy66SOL4w+/kb87ChQs/fPTRR/9Ja71fPPOViIhrrVk2m03OkuSu65IQQqfT6SatdbNSauPq1avfaG5unq21nrd169YVn//854vxur0JEybstWXLlr1OPvnkETfffPMpUspPe553sFLq7qlTp95y9tlnr2KM7WzwPs4/fCqny5L1IJLsaR8tfPjwd0N/0qRJg13XHe04zrDLLrtsvwMPPPBgz/OOiMd9DWptbWX9+vXz4szpSkrZ4rruOsdxmhljW5uamtZPnTp1A2NsXRAE76bT6XellGvuv//+5gULFkgcf/jlrHP8+PHulVdeeeKpp5768zAMP6y15ul0mtuuR9d1yfM8itObbE2lUisYY+/88Y9/XLF58+bXpZSvua675JJLLsnblTY0NKT22WefkUQ09pOf/OQBn/nMZ+qz2Ww9Y2y0UsqLa4uyVCqlieilBx544J6TTz75T6NHj96I8w9/ZwFZuWjHCJGx7mex3dG64MOHv5v5t9xyS/+6urqxjuOMzeVyoz/72c8emMvlDmKMDZNS9stmszYVgGSMbXZd923G2Bql1Nue5625+OKL13LONxcKhRbf97euW7duS4cagTj+8Cv1+fTp00/++Mc/fr0Qop4x5vi+T0op7rquNsYEjLEVxphFqVTq1csuu2x5GIbveJ73zm9+85tNHVtB7r///vHGmI985CMfOeTwww8/SCk1xnXdQUqplO/7NnksTyaSdRyHlFJbjTHTfvjDH97yk5/8ZCHOP/yu1tVV2gvWjSa4as1wgA8f/gfb90aPHu0+9thjH1JKnez7/gmjRo06OJ1O9w/DsL/neTm2LXGoUkqt9zxvsZRyse/7L3HOV1922WVNc+bMCTKZTOC6bnHOnDmCxePCcPzhV8ufM2fOh4855pi70+n0gYwxL4oik0ql1gZB8AJj7PlVq1bNPffcc7emUql8a2trfvHixaIz/6WXXjr4oIMOuiqbzX48iqIhNTU1NXGSXNeWjiIix6bIsJn72bYXAPN9n4hIt7a2vrFu3bpbvv/97z88derUEOcffnea3Hry/47Lcvjw4e9WPp8wYULNySeffMBVV101TghxERE9qpRaqZQqENHGMAxXSSkXK6WeX7ly5cPPPffc1bNmzZrwwgsvjGhsbPRw/OHvav/vf//7IcaYv+fz+emzZ8++Y8aMGRfMnz//oIaGBrc7/qOPPppasGDBpcaYGUS0kYhEFEWGiEhrTfYRl7QiKSVprSmuj1n6PQiCotb6ltNOO204zj/8Ha2wOzMEdja4rdp5PuDDh9/LfkNDg3vIIYcMLxaLYz72sY+NPP300w+TUn5YKXVIOp0OjDHrHcdZs27dunUPPfTQqn79+q1Kp9MrWlpa1l5++eUtrHtN+Tj+8Kvmf/3rXz/w4IMPdubMmfPu1KlTg2r5t9122/CTTz759EMPPfT0VCr1MWOML4RwUqkUswXQbYJZO2vTTiKw91sppTDG3PP973//hzfccMNanH/4O1uWdzPSK+fvvMyNgw8f/i7yiYg/8sgjhy9evPjiMAzvIqJnwjB8KQzD2Vrr+6SU/+/VV18986yzzvrEV7/61bHnnnvuoE5aG3D84fcJf9KkSQcJIS4xxiyMokjaljCtNeXzeVtknMIwpPgXCsOw1GoWRVFRKfXrH/3oRyNx/OF3d2WVYpWsEz58+LvO9ydMmFCzdu3aw7TW/2uM+UsYhgsLhcJTLS0tN+Xz+bNmzZp12EEHHTTyiCOOGDhq1KgMjj98+O89xo8f7/2///f/xrS2tt5MRBva2tqMEIKIiLZu3VrqxhRClLouE92aRkqZ37Jlyy/OOOOMQTj+8FmFj+7APYlE4cOHXyV/3Lhx2fHjx4+66aabjpFSfkprfdm6det+NXv27NumTZt20ezZs0+cMWNGbWNjo4PjDx9+Zf7999//cSHEi0Qk4xayUouZMaY0zqytrY201oaITLFYJKVUqLX+QUNDQxbHHz7bxSt6v3cEPvw+599yyy0DwjCcSESX5vP5q2bMmHHBT37yk/+47LLL+uH4w4dfHf+hhx46ulgs/kUIUVRKlQbyl/ovO3kUi0VDRE1r1679Ao4//EoiwZ3NEuBV2gj48OFX0Z8wYULNmWeeedgXvvCFET34JI7jDx/+jp/H77vvvoO01r+Loii0wVgYhsZ2Vdq/FYvFdl2Yra2tL06ePHkEjn+f93e6ULXrXcKHDx8+fPh7pH/00UcPeOONNx6QUirbMhbXwyw1lNmxZkREQRCQUip46qmnflTFVhyc/z3D73IB3sON5D1cFj58+PDhw//A+/fee2+mWCw+FkWRiLslSWtNWmtSSlGhULDBmLFdl8aY12644YaTcPz7vN/tDSvneRw+fPjw4cPvS/6jjz46Wik13RijhBBULBbbJYo1xpBSqtRKFgRB8I9//KMxMaMZx79v+12u+P1q0oMPHz58+PB3R9996KGHGoIgWCmEKKXESGb2T473j4OzZyZOnHgQjn/f9J2dANThe2fLUQ92lMGHDx8+fPh7oK9nzZr1d8dxpnPOlVKKMcbI1rkUQjCtNed826qklKxYLB45YsSIETj+fdavepTX2WwEDh8+fPjw4fc1f+rUqROUUmuTg/iTLWNhGJIQgoQQpLWOhBD/wxhzcfz7nu90EeX1JOMssR3XhNpRJAofPnz48OHvMf6jjz76/NatWzcIIZhSiqVSqXbPJSLyfZ8RESMih4gOHTVqlI/j32f9iqK/cv7Pq7Q++PDhw4cPf7f2ly1b9tt8Pm+CICCttYmiiJRSpLUm+7MQgsIw1ET0hyFDhtTi+Pc93ykD7CqS6yo63FnEV0lkCh8+fPjw4e/WvlLqOc/zmOelmJSaO47HiDhzHIe5rsuMMcz3feY4jhOGYf/+/fs7OP59z3e6WOHO/sZZZc1s5Tb5wYcPHz58+Huavz6dTusoipjWmnmeQ67rsCiKmOu6zHEcJqVkjuOYTCYTNjc3E45/3/O9HSy4I5ASy5SzcdTFcwk+/D7ssxtuuGEfKeVwKeXejLG9GGO1nuflOOe+67quEEJxzgvGmHyxWNxaU1Oz0XGcjUqpdY2NjQLHf7f1eWNjYz/G2GDP8/ZWSu1ljKlxXTfDOc+y93ovlDEmzzlvcV13g1JqPWNsbWNjI9vV+9/Q0JD95Cc/ecCxxx478vHHHx+STqdrjTFZIuLxKPUiETVxzjcR0bqampp3vv3tbxd28fF3Gxsbh2qt93ddd6Tv+wNOPPHEfieffHLWGMMWLVoUPvHEE0WtdQvn/F0iWj137tx3p02bFvX2+RdCUCaTYa7LGWOMS6lYOp1mjDHmOA4JIbjruuS67qra2lq5efNmvP76mO+VsYKdIeUsyzvZqHJ3AP4HzK+vr/f/9Kc/TXjppZc+4boudxyHOY5j2LbxqY7W2vE8z+WcM2PM2lNOOeX63t7/hoaG/c4777wzOef7KqWM1tqk02kSQrBMJuMHQeBkMhnKZrPrV6xY8dvzzz9/U8cV/va3vz1ln332Gec4jheGoZtKpbjjOMwYwxxn26fZZcuWPTN58uRnenL8/+d//mfw6aef/um6uroTP/7xj48hooFENMAYk2OMZTjnvuM4Ht/2MFpr4bpuRERtnPOtRJTnnG855phj3vB9/8V7773331OnTt1Uyfn/6U9/euBhhx32dc/zPDvvnnPOiGgbagwjIsPik+q6LjfGcMdxWGJ50lpzip9kjGGcc/u7ISKKl/Ps1H7GGBljSj+nUikTBIFxXdfsvffeK//whz88csstt2yt9Pw/9thjdR/96Ef/a+7cuR81xuhUKmWEEMQYo5qaGicIAkqlUry1tZUff/zx00aNGvXkrn79TZo0afAZZ5xxlFJq3AEHHHDQ2LFj99Fa18Xnvo6IUpxzPz5eDuec2fPPGCu4rtvkOE5za2vruqOOOmqp7/tzLr300tmrVq0Ke+v1P3r06PTNN9/86Ww2e/LRRx998ODBg/eRUu79oQ99qC6TyaSMMSkbkBGRIKKi4zgtnPMmx3G2jB07dinnfM4999wzc+rUqVt76/V/7bXXDj355JM/N3jw4I/V19ePjKJob875IMdxckSUNcY4xhh29NFH6zFjxohMJhMKIbYyxjatXLny7a9//esvrFu37o8XXXTRut44/+l0em9jDPc8TsYwrrVmqZTHtNZMSskymQxPpVIsiiKdSqVeXbVqlcT9p8/63X5UMr2z0gFv8D+4Pt+0adPHC4XC4mKxGBUKBRGGYaSUEkopEUVRJIQQxhghpQyeeuqpo3p5//kdd9xxcVtb22attRBCRGEYRmEYRvZ3IYTUWkdbt279Q2NjY8cPIpyI+Pz583/W1NRUVEpFUspQShkVCoUon8+H8T5FCxcu/G53jv/w4cNzCxYsOHLjxo2/bWlpWaaUahJCSBs8xg+yX1pro5Si+MtEUWTLrJhCoWD0tuySMoqipqamphXr16//8+zZs08bPnz44Pr6en9n5/+VV145iYgK8akSQgghpSz9HG17lH4ViYeU0n6pKIpEFEUiDEMRhqEMgkAEQRDF34UQQgohIrntEcn3kCiKIlEoFEQURVG4rdDf09/61rdGdef6//rXv14fhuEqpZQ0xkTx9oi2tjYZBEFERLK1tTXSWssoil4aPXp0ujdff2PHjk2NGDFiryeeeOKwTZs2fXfjxo0zWlpaVhDRlmBb3gMZpz4w9lxLKUtf8TVRSh5KREYIYaSURimli8ViQERb1q9fv3jNmjX/75ZbbjmQMeZX4/VfX1/v33rrrSM2bNhwxZYtW15ramraRESRUkoXCgUjpSwNQk9cr8kvba/pKIqE1nrr1q1bl61Zs+b2GTNmHD548OC6arwPjBgxInvWWWeNfffdd39eLBaXKqXy+XxeEZEWQphk5tUoikhKaaSUdhC9UUqZ+NgqpVQhn8+v2rBhw81XXXXV4V28hrr9/vv666/fGoahDkNBYSjsObXbZwf0k9Z6w5e+9KXxuP/A39mTd0WRTfi7iT9+/PjMsmXLfkxEeSEERVFUykBtS4LEmaf1qlWrHhg3bly2t/b/i1/84oFRFE0jIl0oFCgMw3bbIYQwSiljjNn829/+9phOP+4Qca31TVprZWc/2fXEQRAppeT8+fO/V8mBrK+v9+++++6jiOgWpdRWItLFYrGUplsIQXFQtt2btL3B2WAtzvRtbOkV+5BS2mCtqLVeqLW+8sorr6zf0U1lzpw545VSOr6hmg7fS1+JgKBdZvGON+JE8FiaPZb86rC+5MooiiJTKBQ0EdmArOLrn4gejKLItLW1lbKhJws523MZBAEJIcLZs2df0Fuvv0mTJh1BRFcR0awoilqJSNhAwD6KxWLyOJn4GBobkCVn4NlAwh4y+zrL5/P2uCpjzJu33377NxoaGvbqyQv/S1/60kgiusQY87qUUtlg0G5XHBiWSv50vF6S14PdjzjApGKxqIloKxE98Itf/OK0z3/+84O7efydr3zlK2M2btz4IyJaZ4zRYRhSx8Ld1k1mx+/4Pb4ubBZ9E4ahFkKs1lpPnjBhwshqvP/W19fn3nnnnbn5fJ6kfC9LfxTJUk6y+JjqIAj+/qUvfWkU7j992u82yrsZCXL4u79/0003HROG4QKtdcc7rbFvjK2trVoptXLKlCkTemn/vYcffvh/hBDN9gZlg4bETUwrpWQQBFPilhHeWUD21ltv3dLS0qK2vXHKdm/uURSRMUa9/PLL11Vw/Pldd911OhH9WwgR2RubfTQ3N28XwHQWENkgw5ZXsTdvY4x9Q2+3rUQUGWNe2rp169U/+tGP9u9sGxcsWPAJG4Alb6D2JmqdHdxwTccgLPE8Y5+bbPXpuG57U0xM9/9nd1rIXn755WPCMGxKBKilbbPH2wYQUkoSQtCqVav+ceqpp+5b7ddfY2OjE0XRfxtjmqMoUkopk/yA0PFcJf+WPBf2GJUu4PhnmyIhGSTHNRKNUqqlWCzedPnll2e78/o/55xzjpNSPhqGYd6eb/tBy25n4pyaZEDWsRZQ8pqy20hE1NTURIVCwRDROqXUbydNmnRQJcd/9OjR6enTp58ShuE/tNaRfW1YKxngJD8YJl432wXsyeAycTyj1atXP/if//mf9T19//3d7373aSJat+3cGZJS21aydteDlDJ49tlnv1dm6xzuf3u4z8v4uZLlKm2mg7+b+ePHj/eWL1/+/1pbW6V9I052FcSZp6lYLIoNGzbc/qlPfap/tfd/1KhRA4joeXsjllIa2xLR4cb2VmNj48k78mfNmvXzMAylfYMOw9Ak37yLxaKZN2/ej8s9/vfcc88JRPRGHCiWPoV3vDHY7p8oiiiKIhO/OZeCHvtItNiVWk/sDdLepONuGFJKCWPMFillY2NjY6rjts2bN2+8vanbG5e90SaCsXYtdp10TXX8mzEd7s7JLlgbyCWfnwxMwjD853e+8539K7z+eVNT071x4GOiKDLJ4JWIqFAoJD8kmDgP1OZf/OIXX+uN198ll1wyiIgeUEppKaW2rbRaa5JSmmRw1THYSbaSSSlL9Q9t4G33SSnVrjh1fO1opVTLhg0bvl3p6/+iiy765IYNG56NrxuKW/RMx6AxuQ1x6127QLxjK6ttpTLGGBssxR9MlNZ64dy5cwdVcPy9OXPmnG2MeUMlXhiJDw4mfg10FoybjoFsMsC012MYhsa+HrXWwerVq2dPnz79P7r7/tvQ0JBdu3btnUKI0LaCG0OkNZFSptQSH79GXvvJT37yMdx/+rbfm32qvfUc+B8Q/4EHHqghoiVhGBp7g02+UdsgQyn19uTJk09jlZeV2OFj8eLFFwVBIDp24yXKkRilVGHLli3f76LbtORPnz795iAIVBiGJKXc7kaptaaFCxf+pJxjeeutt44goheEECZ5PDreYOPfdRRFuritGaEpHgu30RizSSm1xRjTHIZhW7StyUXbwFMIsd2NOr5RGimljKLolTvuuKPTT/jz588/USml7Ri1jq1YnbSOlVq9giAoBWLJG3YikO14o+yyWzNuhdFxl+v0//u//6uoheyhhx76AhGtTARe2wUtHT8gxD+rfD7/z4svvvjwar/+Hn30UffCCy88nojmy20XZbsu53w+b+LAzGwbamkirXUxn8/npZQtUsqmtra2priVrU1rHRUKBdUxKLfHNhmACCE0Eb31m9/85vPl3gi+8Y1vfLxQKLxqjFE2OEg6tqvSjm2Lg8wgCIJmrfUGY8y6KIrWCSE2R1GUN8aI1tZWba+ZZGto/F4giWjVqaeeelQFr3938eLF/6213hKGoenY7Z9sYUx0V5owDLVSKgqCoFgoFIpKqSjuOjXxe5PtqmzXkmdf/3G3/pLNmzcf1433Un799dd/Ie4CNe+9n9hA8r0WXSIKn3zyyRtZ90sm4f63B/ge6zw52s4Sm1EXy1IF6+nsOfB3M//cc88tjBw58roTTzzxziAI6nK5HOOcsyAI2LYp3i7TWnOt9b7XX3/92f/4xz/mvPTSS5uq4Z9wwgl7Dxky5FLP8zwiYskivXF5EkZEZu3atXOvuOKKR+bMmRPsaP9d13UTs9vs8ymeRcYYYywxQ7DL419fX+8fffTR3wyC4CjGGM9ms4wxRkop7rouC4KAZbNZprVmruuGURStTKVSS2fNmvXa+vXr3+nXr99mz/PaisWi8X0/rbUeFEXRkH333XfkiSeeuD8RDfV9f2SxWByey+XcMAxZOp3mjG2bWp9KpTRjrOVXv/rVdZdddtmCzg5iv379pOu6a4UQTrybxm5/PLuTOOeOEMKk02kWRRH5vs8dx6lhjA1gjLlKKZvYkhhj3BjDXNdl6XRaFgqFplwupxMtQDo+XjpxrBzHcXgqlSJjDA/DcJMQQpfxBkaMMXbxxRcPP/PMM882xoy011t8zuz5ZEop5nmePS6ciFgYhswY49TU1Jz461//+j+feuqp5YmZij1+/TU0NJglS5bMX7p06cOHHnrogWEY1qTTadf3fYeIRE1NzSYi2sQ5b3Ecp62lpWXTtGnT1vu+v0Vr3ZZKpfJCCC2lzBpj+g8bNmzUpz71qVHGmDGu6x7M4sH7xhibUJSCIODZbJaFYehwzkedf/75X1RKPX/ppZdu2dHB/MpXvnLQrbfe+hOl1FitNbdpGNLpNJNSMsYY+b7P42A9ymazy1zXXb548eIly5cvX57P51dls9lASplKp9NDjDH7Dxs27IATTjjhAKXUAVLK0a7rpuNZrzyVShFjbPPs2bOvW7du3ZJyX//z5s37xIEHHnhTFEV7ZTKZ0nuMvf601jx+r2GMMZJStmSz2eVNTU0rZ8+e/a7ruk1KKUZEA44//vj9hgwZcoDjOGMYYzmlFPd9n2mtWTabLeUGs7OGwzA8bODAgVMmTpx46rRp094t9/33pz/96UGTJ0++MAiCEURUek9SSjPfd5njbLtWpZQ8n8+//uKLL97KGDPlXv+4/+x5vlfGBnYEOtuAznJydGc6KPzd0L/ssstmvPzyy895njcxn88zzjnPZrNMKcUYY8z3fSaldLTWE6688sqPfOUrX5lWDf+aa65pGDhw4AGO4/BkWoU4oGBCCJZKpQrPP//841OnTn1jZ/vPOXccxyHWvs4cJyJmjOGcczLG6J0d/xNOOGG/E0888VjOeTq+QTCtNY8DAxuMUaFQ2Lxx48Y77rnnnn+l0+lXGhsbW3d2rqZMmZIbNWrUftOnTx/T2Nj4YSIan06nj2GM1YVhyDKZjJFSSs75ry+77LK/drWy2trat959993Lf/3rX1N8EzCcc23TXhARj2/6lMlk6MILL+R33HEHjRs37vhPfOITF0VRNCiVSjHHcRjbNkvV7idprdffdtttjfl8viXmjDGm5NibjuM4bhRFLJPJcCklZ4xtmTVr1pYyz7/3hS984ROu654spXRramqYUoqFYUiZTIYzxlhrayvr168fC4KgFLDam3gul2PFYjGdTqf/56qrrvrLpZdeurhar78484eeP3/+X7XWp6VSqX055yvCMHzrD3/4w4pFixat9Dzv3VQqtUlKufn6669v3dnr9eqrr+7ved4Rl19++cSamppLOef90uk0IyKmlOLZbNYG+sQY41EUHX3JJZccuJOAjN94443/a4w5Np1OMyFEKcVLHOQzzjkvFAomnU4vzeVyf/jhD3/4dKFQWHr99de3dHJsSt+vueaavRzHOexHP/rRSYyxzxYKhfqampqMlLK4YMGCv3zrW9/624IFC1Q5959rrrnmQx/5yEe+wxgbZoxhWmtmjGHxBx0W768NwpuFEDOeeOKJpxYsWDB3w4YNb9x3333t0oJMmDCh5oQTTjh48uTJH89msw1CiI8IIfxcLseUei83mH39e57HGGNH3X333Vdce+211ybW1+X776RJk7xvf/vbVwZB8IlsNuvYAFprYr7vMsYYGcM4kWHpdDrYsmXLjY2NjW+X8V6N+8+e7ZfVB1pJ81x3u6Tg776+e911132JiDYkuxKS3Whxl5Ihoieq4V9wwQWjN23a9I+4JaHd7DPb5RBFkV61atXL48ePH1zO/j/77LO3SSlVYtxLqavNdr2++OKLP9jZ8b/66qs/Q0TL4u6odt14SilTLBYpDEPR2tr6P4lu1IqP//jx4zOf/vSnD37iiSe+IoR4lohkPNj/b9/5zndG9sb5nzx58mlEtNp29yS6dUt9g0EQvDZ69OghvXn9HXnkkSOMMf8oFovbjc2LZ9oaIspv3bp1YxiGUmtN+Xy+3Ri2KIo0Eammpqabe+v1t2jRoiO++MUvfuRTn/rUgfEYSt6T/Z8wYUJNGIbf1FoH8YzR0vgt231njDFSyk0//vGPP7Oj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S8trdXV1URRFpUBXa12q5ej7PtXV1bF8Pj98v/32++lJJ500pLNjJ6V0ksciHv/GE39zdnDj68n1pxljpLUu1bdM+vF14u/o/K9duzb46U9/Oum6666byravT4n7D/xy/bIevErP4/D3bP/FF188U2ttbN6q98acECllKM75s+nGG2+8sItV+ET0/4IgiGwXTXLcj9baNDc3G6XUrNNOO21MT/Z/1qxZt0VRZDP1t0s4aruN5s6d29iT43bppZcecMkll3xu3rx5lxPRb40x/25tbV1DRJFSqjTYPIoiE49fM8Vi0cht/bxGKaU7dHmajt23toulUCgYrfVL3/zmN0+o1vn/9re/fWoURe/YxJnJnHOJ7qnOBvV3y29oaNh33bp1/7STCBIp7eKs58YQkVq2bNkF5V63kyZNyhHRM21tbRTPCKTk+L44WInmz5//y6OPPnpAb73+pkyZ8n9SytZ4bJbR2x5SKSXjMXGlRML2Z611x+vT2K60eIbllnXr1v2goaGh0+M/dOjQGiL6bbFYFPb1lMyAbwfnJwawb9Za3/7EE080XHbZZUfFqTS63P/LL798ryuvvPLEmTNnfk8ptTLuTm43Ls52x8YfSNbdfPPNX+3kw0+GiF4vFAqlbvH4yySutS2PP/74h6v9/nfDDTdcHkVRa3KiQqJMmAmCgJqammbh/R/+rvD5Dn7eFbWd4O9Bfn19fU5KucCOL0mMkSUhlM1+rTZs2DB14sSJIzqaf//73/eJomiNvWHaMVR2cHF8M2275557rmKdl00pe//jgMwkb3g2MazNS/TCCy/8oBrHv76+3l+8ePFeJ5544oEnn3zyETNnzvw4EX1NSvkTrfXDxpgZWuvXjDGbiKhgjFFEpIlIhmFYulknx5slc3LZwEIpJVesWDHlox/96KBqnP+rrrrq9A4BGXUWkCXykPXo+rv11lsvCoJgszWiyI5pMmTMtsHmWutX6+vrc120anY6nvCb3/zm57aNSRPtZhkmZmwaY8yyM844Y1xvvf5uvfXW44noCiK6hoiuJqJvx79fEf/8HSnlj+PAfXoYhhuVUsIG4fb671AyzBSLxab169dfG9dJbecPHz48p7W+mYiEHZcYv65McqB+PDh/7apVqybGVTUq2v/hw4fnXn/99ROIaHM8CN5ej6UZm3Fgprdu3Xr/KaecMrDDevi7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";
const Logo360 = ({ width = 200 }) => (
  <img
    src={LOGO_B64}
    alt="Vista360"
    width={width}
    style={{ display:"block", objectFit:"contain" }}
  />
);

// ── SPLASH ───────────────────────────────────────────────────────
function Splash({done}){
  const [f,setF]=useState(0);
  useEffect(()=>{
    const ts=[setTimeout(()=>setF(1),400),setTimeout(()=>setF(2),950),setTimeout(()=>setF(3),2300),setTimeout(done,2800)];
    return()=>ts.forEach(clearTimeout);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:f===3?0:1,transition:f===3?"opacity .55s ease":"none"}}>
      {/* Anillos */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(5)].map((_,i)=>(
          <div key={i} style={{position:"absolute",borderRadius:"50%",width:220+i*110,height:220+i*110,top:"50%",left:"50%",transform:"translate(-50%,-50%)",border:`1px solid ${C.accent}${["0A","0D","10","13","16"][i]}`,animation:`pulse ${2.2+i*0.3}s ease-in-out infinite alternate`}}/>
        ))}
      </div>
      {/* Logo real */}
      <div style={{opacity:f>=1?1:0,transform:f>=1?"scale(1) translateY(0)":"scale(.8) translateY(24px)",transition:"all .75s cubic-bezier(.34,1.4,.64,1)",filter:`drop-shadow(0 0 40px ${C.accent}55)`}}>
        <Logo360 width={300}/>
      </div>
      <div style={{
        fontFamily:"'Cormorant Garamond', Georgia, serif",
        fontSize:17,
        fontWeight:600,
        color:"rgba(255,255,255,0.82)",
        letterSpacing:5,
        textTransform:"uppercase",
        marginTop:14,
        opacity:f>=1?1:0,
        transition:"opacity .6s .35s",
        textAlign:"center",
        lineHeight:1.6,
        textShadow:`0 0 30px ${C.accent}88`,
      }}>
        Gestión de Paneles Publicitarios
      </div>
      {/* Barra progreso */}
      <div style={{marginTop:52,width:240,height:3,background:C.border,borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:f>=2?"100%":"0%",background:`linear-gradient(90deg,${C.accent},${C.cyan})`,borderRadius:4,transition:f>=2?"width 1.3s cubic-bezier(.4,0,.2,1)":"none"}}/>
      </div>
      <div style={{marginTop:12,fontSize:12,color:C.muted,opacity:f>=2?1:0,transition:"opacity .35s"}}>Conectando con Firebase...</div>
      <style>{`@keyframes pulse{from{opacity:.2}to{opacity:.65}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
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

// ── DASHBOARD ────────────────────────────────────────────────────
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
  const saludoReal=hora<12?"¡Buenos días":hora<18?"¡Buenas tardes":"¡Buenas noches";

  // SVG Icons — replicados exactamente de la foto
  const IconDolar=()=>(
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect width="56" height="56" rx="16" fill="url(#gDolar)"/>
      <defs><linearGradient id="gDolar" x1="0" y1="0" x2="56" y2="56"><stop stopColor="#064E3B"/><stop offset="1" stopColor="#10B981"/></linearGradient></defs>
      <circle cx="28" cy="28" r="16" stroke="#6EE7B7" strokeWidth="2.5" fill="none"/>
      <text x="28" y="34" textAnchor="middle" fill="#6EE7B7" fontSize="20" fontWeight="900" fontFamily="Arial">$</text>
    </svg>
  );

  const IconBars=()=>(
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="url(#gBars)"/>
      <defs><linearGradient id="gBars" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#1E3A6E"/><stop offset="1" stopColor="#3B82F6"/></linearGradient></defs>
      <rect x="6" y="16" width="4" height="7" rx="1.5" fill="#93C5FD"/>
      <rect x="12" y="12" width="4" height="11" rx="1.5" fill="#60A5FA"/>
      <rect x="18" y="8" width="4" height="15" rx="1.5" fill="#3B82F6"/>
    </svg>
  );

  const IconCard=()=>(
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="url(#gCard)"/>
      <defs><linearGradient id="gCard" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#065F46"/><stop offset="1" stopColor="#10B981"/></linearGradient></defs>
      <rect x="5" y="9" width="18" height="12" rx="3" stroke="#6EE7B7" strokeWidth="1.5" fill="none"/>
      <rect x="5" y="13" width="18" height="3" fill="#6EE7B7" opacity="0.6"/>
      <rect x="7" y="17" width="5" height="2" rx="1" fill="#6EE7B7"/>
    </svg>
  );

  const IconCal=()=>(
    <svg width="68" height="72" viewBox="0 0 68 72" fill="none">
      <defs>
        <linearGradient id="calFront" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#7C3AED"/><stop offset="1" stopColor="#5B21B6"/>
        </linearGradient>
        <linearGradient id="calTop" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#A78BFA"/><stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
        <linearGradient id="calSide" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#4C1D95"/><stop offset="1" stopColor="#2E1065"/>
        </linearGradient>
        <linearGradient id="calHeader" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#6D28D9"/>
        </linearGradient>
        <linearGradient id="calHeaderSide" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#5B21B6"/><stop offset="1" stopColor="#3B0D8C"/>
        </linearGradient>
        <filter id="calShadow3d">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1E0A50" floodOpacity="0.7"/>
        </filter>
        <filter id="checkGlow3d">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── 3D Perspective calendar facing left/side ── */}
      {/* Shadow */}
      <ellipse cx="36" cy="68" rx="24" ry="5" fill="#1E0A50" opacity="0.5"/>

      {/* Side face (right depth) */}
      <polygon points="52,14 62,20 62,62 52,56" fill="url(#calSide)"/>
      {/* Side face header */}
      <polygon points="52,14 62,20 62,28 52,22" fill="url(#calHeaderSide)"/>

      {/* Top face */}
      <polygon points="10,14 52,14 62,20 20,20" fill="url(#calTop)"/>

      {/* Front face — main body */}
      <rect x="10" y="20" width="42" height="36" rx="0" fill="url(#calFront)" filter="url(#calShadow3d)"/>
      {/* Front header strip */}
      <rect x="10" y="20" width="42" height="12" fill="url(#calHeader)"/>
      {/* Header highlight line */}
      <rect x="10" y="20" width="42" height="1.5" fill="rgba(196,181,253,0.5)"/>

      {/* Ring posts on top */}
      <rect x="20" y="12" width="5" height="10" rx="2.5" fill="#C4B5FD"/>
      <rect x="37" y="12" width="5" height="10" rx="2.5" fill="#C4B5FD"/>
      {/* Ring holes */}
      <ellipse cx="22.5" cy="12" rx="2.5" ry="2" fill="#3B0D8C"/>
      <ellipse cx="39.5" cy="12" rx="2.5" ry="2" fill="#3B0D8C"/>

      {/* Month label in header */}
      <rect x="14" y="24" width="16" height="2.5" rx="1.2" fill="rgba(237,233,254,0.7)"/>
      <rect x="32" y="24" width="10" height="2.5" rx="1.2" fill="rgba(237,233,254,0.4)"/>

      {/* Calendar grid — dots */}
      <rect x="14" y="36" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.65)"/>
      <rect x="21" y="36" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.65)"/>
      <rect x="28" y="36" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.65)"/>
      <rect x="35" y="36" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.65)"/>
      <rect x="14" y="43" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.45)"/>
      <rect x="21" y="43" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.45)"/>
      <rect x="28" y="43" width="5" height="4.5" rx="1.2" fill="rgba(196,181,253,0.45)"/>

      {/* Front face bottom edge */}
      <line x1="10" y1="56" x2="52" y2="56" stroke="rgba(109,40,217,0.5)" strokeWidth="1"/>
      {/* Side bottom edge */}
      <line x1="52" y1="56" x2="62" y2="62" stroke="rgba(46,16,101,0.8)" strokeWidth="1"/>

      {/* ── Check circle — prominent, glowing ── */}
      <circle cx="44" cy="50" r="12" fill="#0F0525" opacity="0.8"/>
      <circle cx="44" cy="50" r="11" fill="#6D28D9" filter="url(#checkGlow3d)"/>
      <circle cx="44" cy="50" r="9.5" fill="url(#calFront)"/>
      <circle cx="44" cy="50" r="8" fill="#8B5CF6"/>
      {/* Check mark */}
      <path d="M39 50 L42.5 53.5 L50 46.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter:"drop-shadow(0 0 4px rgba(255,255,255,0.9))"}}/>
      {/* Outer glow ring */}
      <circle cx="44" cy="50" r="12" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" fill="none" style={{filter:"blur(1px)"}}/>
    </svg>
  );


  // Antena SVG — diseño 3D premium igual a la foto
  const AntenaImg=()=>(<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="55%" r="50%">
        <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.55"/>
        <stop offset="60%" stopColor="#0B1A3E" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#0A0F1E" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="dishFill" cx="38%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#F0F8FF"/>
        <stop offset="30%" stopColor="#D6EAFF"/>
        <stop offset="70%" stopColor="#7FB3E8"/>
        <stop offset="100%" stopColor="#3A6EA5"/>
      </radialGradient>
      <radialGradient id="dishShine" cx="30%" cy="25%" r="50%">
        <stop offset="0%" stopColor="white" stopOpacity="0.55"/>
        <stop offset="100%" stopColor="white" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id="stemG" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#90C0F8"/>
        <stop offset="1" stopColor="#1E3A6E"/>
      </linearGradient>
      <linearGradient id="baseG" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#2A4A7E"/>
        <stop offset="1" stopColor="#0E1E3A"/>
      </linearGradient>
      <filter id="dishShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1a6aff" floodOpacity="0.5"/>
      </filter>
    </defs>
    <ellipse cx="80" cy="95" rx="68" ry="52" fill="url(#bgGlow)"/>
    <circle cx="80" cy="78" r="68" stroke="#3B82F6" strokeWidth="0.7" fill="none" opacity="0.18"/>
    <circle cx="80" cy="78" r="54" stroke="#3B82F6" strokeWidth="0.7" fill="none" opacity="0.22"/>
    <circle cx="80" cy="78" r="40" stroke="#3B82F6" strokeWidth="0.8" fill="none" opacity="0.28"/>
    <circle cx="80" cy="78" r="26" stroke="#3B82F6" strokeWidth="0.8" fill="none" opacity="0.35"/>
    <rect x="72" y="112" width="16" height="6" rx="3" fill="url(#baseG)"/>
    <rect x="60" y="116" width="40" height="8" rx="4" fill="url(#baseG)"/>
    <rect x="77" y="82" width="6" height="34" rx="3" fill="url(#stemG)"/>
    <line x1="80" y1="82" x2="96" y2="58" stroke="#90C0F8" strokeWidth="2.5" strokeLinecap="round"/>
    <ellipse cx="80" cy="70" rx="52" ry="26" fill="url(#dishFill)" transform="rotate(-12 80 70)" filter="url(#dishShadow)"/>
    <ellipse cx="80" cy="70" rx="38" ry="17" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" transform="rotate(-12 80 70)"/>
    <ellipse cx="80" cy="70" rx="24" ry="10" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" fill="none" transform="rotate(-12 80 70)"/>
    <ellipse cx="80" cy="70" rx="12" ry="5" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none" transform="rotate(-12 80 70)"/>
    <ellipse cx="68" cy="62" rx="18" ry="7" fill="url(#dishShine)" transform="rotate(-12 68 62)"/>
    <ellipse cx="80" cy="70" rx="52" ry="26" stroke="rgba(147,197,253,0.65)" strokeWidth="2" fill="none" transform="rotate(-12 80 70)"/>
    <circle cx="96" cy="58" r="6" fill="#0A1E3A"/>
    <circle cx="96" cy="58" r="4" fill="#1E4080"/>
    <circle cx="96" cy="58" r="2.5" fill="#60A5FA"/>
    <circle cx="96" cy="58" r="1.2" fill="white"/>
    <circle cx="130" cy="32" r="2.5" fill="#60A5FA" opacity="0.7"/>
    <circle cx="28" cy="50" r="1.8" fill="#3B82F6" opacity="0.5"/>
    <circle cx="140" cy="80" r="1.5" fill="#93C5FD" opacity="0.4"/>
    <circle cx="22" cy="100" r="1.2" fill="#3B82F6" opacity="0.35"/>
  </svg>);

  // Portapapeles 3D SVG — réplica de la foto
  const PortapapelesSVG=()=>(
    <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
      <defs>
        <linearGradient id="clipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#7C3AED"/>
          <stop offset="1" stopColor="#5B21B6"/>
        </linearGradient>
        <linearGradient id="clipPaper" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#EDE9FE"/>
          <stop offset="1" stopColor="#C4B5FD"/>
        </linearGradient>
      </defs>
      {/* Sombra */}
      <ellipse cx="48" cy="82" rx="28" ry="6" fill="#4C1D95" opacity="0.3"/>
      {/* Cuerpo portapapeles */}
      <rect x="18" y="22" width="52" height="58" rx="8" fill="url(#clipGrad)"/>
      {/* Papel encima */}
      <rect x="22" y="26" width="46" height="50" rx="6" fill="url(#clipPaper)"/>
      {/* Clip superior */}
      <rect x="36" y="16" width="18" height="12" rx="5" fill="#6D28D9"/>
      <rect x="40" y="18" width="10" height="8" rx="3" fill="#7C3AED"/>
      {/* Líneas de texto */}
      <rect x="29" y="36" width="32" height="3" rx="1.5" fill="#8B5CF6" opacity="0.6"/>
      <rect x="29" y="43" width="26" height="3" rx="1.5" fill="#8B5CF6" opacity="0.5"/>
      <rect x="29" y="50" width="28" height="3" rx="1.5" fill="#8B5CF6" opacity="0.5"/>
      {/* Check marks */}
      <circle cx="33" cy="37.5" r="4" fill="#7C3AED"/>
      <path d="M31 37.5 L32.5 39 L35 36" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="33" cy="44.5" r="4" fill="#7C3AED"/>
      <path d="M31 44.5 L32.5 46 L35 43" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Reloj circular abajo derecha */}
      <circle cx="68" cy="68" r="14" fill="#4C1D95"/>
      <circle cx="68" cy="68" r="12" fill="#6D28D9"/>
      <circle cx="68" cy="68" r="10" stroke="#A78BFA" strokeWidth="1.5" fill="#5B21B6"/>
      <line x1="68" y1="62" x2="68" y2="68" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="68" y1="68" x2="73" y2="71" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="68" cy="68" r="1.5" fill="white"/>
    </svg>
  );

  const IconMetrica=({type})=>{
    if(type==="ing") return(
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect width="42" height="42" rx="13" fill="url(#gMIng2)"/>
        <defs>
          <linearGradient id="gMIng2" x1="0" y1="0" x2="42" y2="42"><stop stopColor="#064E3B"/><stop offset="1" stopColor="#10B981"/></linearGradient>
          <filter id="fMIng"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="21" cy="21" r="12" fill="rgba(16,185,129,0.25)" filter="url(#fMIng)"/>
        <text x="21" y="27" textAnchor="middle" fill="#6EE7B7" fontSize="17" fontWeight="900" fontFamily="Arial">$</text>
        <circle cx="21" cy="21" r="11" stroke="#34D399" strokeWidth="1.5" fill="none" opacity="0.6"/>
      </svg>
    );
    if(type==="pan") return(
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect width="42" height="42" rx="13" fill="url(#gMPan2)"/>
        <defs><linearGradient id="gMPan2" x1="0" y1="0" x2="42" y2="42"><stop stopColor="#1E3A6E"/><stop offset="1" stopColor="#3B82F6"/></linearGradient></defs>
        {/* Modern grid 3x3 with glow */}
        {[0,1,2].map(row=>[0,1,2].map(col=>(
          <rect key={row+"-"+col} x={12+col*7} y={12+row*7} width="5" height="5" rx="1.5" fill="#93C5FD" opacity={0.6+row*0.13} style={{filter:`drop-shadow(0 0 2px rgba(147,197,253,0.8))`}}/>
        )))}
      </svg>
    );
    if(type==="con") return(
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect width="42" height="42" rx="13" fill="url(#gMCon2)"/>
        <defs><linearGradient id="gMCon2" x1="0" y1="0" x2="42" y2="42"><stop stopColor="#4C1D95"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs>
        {/* People icons - more solid */}
        <circle cx="16" cy="17" r="5" fill="#C4B5FD"/>
        <path d="M8 30 Q8 24 16 24 Q24 24 24 30" fill="#C4B5FD"/>
        <circle cx="27" cy="17" r="4" fill="#A78BFA" opacity="0.75"/>
        <path d="M21 30 Q22 26 27 26 Q34 26 34 30" fill="#A78BFA" opacity="0.75"/>
        {/* subtle glow ring */}
        <circle cx="16" cy="17" r="6" stroke="#DDD6FE" strokeWidth="0.8" fill="none" opacity="0.3"/>
      </svg>
    );
    return null;
  };

  return(<div style={{paddingBottom:32,display:"flex",flexDirection:"column",gap:0}}>

    {/* Banner alertas */}
    {hayAlertas&&(
      <div style={{marginBottom:16,borderRadius:16,overflow:"hidden",border:"1px solid "+(criticos.length>0?C.red:C.amber)+"55",background:criticos.length>0?"linear-gradient(135deg,#2D0A0A,#1A0606)":"linear-gradient(135deg,#2D1F00,#1A1200)"}}>
        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{criticos.length>0?"🚨":"⚠️"}</span>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:criticos.length>0?C.red:C.amber}}>
                {criticos.length>0?(criticos.length+" contrato"+(criticos.length>1?"s":"")+" vence"+(criticos.length>1?"n":"")+" en menos de 15 días"):(enAviso.length+" contrato"+(enAviso.length>1?"s":"")+" por vencer pronto")}
              </div>
              <div style={{fontSize:11,color:C.muted}}>Requiere atención</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setTab("alertas")} style={{background:criticos.length>0?C.red:C.amber,border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>Ver →</button>
            <button onClick={()=>setBannerCerrado(true)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
        </div>
      </div>
    )}

    {/* ── HERO CARD ── */}
    <div style={{marginBottom:16,borderRadius:22,border:"1px solid rgba(109,40,217,0.35)",position:"relative",overflow:"hidden",boxShadow:"0 12px 60px rgba(4,0,20,0.8),0 0 0 1px rgba(139,92,246,0.1)",minHeight:190,background:"#060818"}}>

      {/* === BASE BACKGROUND: deep blue-to-purple gradient === */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#060C22 0%,#0A1240 25%,#130E48 50%,#1A0A50 70%,#240858 100%)"}}/>

      {/* === PURPLE BLOOM — right side light source === */}
      <div style={{position:"absolute",top:"-20%",right:"-5%",width:"55%",height:"130%",background:"radial-gradient(ellipse at center,rgba(139,92,246,0.38) 0%,rgba(109,40,217,0.18) 35%,transparent 70%)",pointerEvents:"none"}}/>

      {/* === BLUE GLOW — left/center depth === */}
      <div style={{position:"absolute",top:"10%",left:"0%",width:"45%",height:"80%",background:"radial-gradient(ellipse at center,rgba(37,99,235,0.15) 0%,transparent 65%)",pointerEvents:"none"}}/>

      {/* === STARS === */}
      {[[8,12,0.9,3],[16,7,0.6,2],[28,18,0.7,2.5],[42,5,0.5,2],[58,14,0.8,3],[72,8,0.4,2],[85,20,0.6,2.5],[92,10,0.7,2]].map(([rx,ry,op,sz],i)=>(
        <div key={i} style={{position:"absolute",top:`${ry}%`,right:`${rx}%`,width:sz,height:sz,borderRadius:"50%",background:"white",opacity:op,boxShadow:`0 0 ${sz*2.5}px rgba(200,180,255,0.9)`,pointerEvents:"none"}}/>
      ))}

      {/* === MOUNTAIN SILHOUETTES — detailed, rich === */}
      <svg style={{position:"absolute",bottom:0,left:0,width:"100%",pointerEvents:"none"}} viewBox="0 0 500 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E1255" stopOpacity="0.75"/>
            <stop offset="100%" stopColor="#0A0820" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#160E45" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#080618" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="mtn3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#100A30" stopOpacity="0.98"/>
            <stop offset="100%" stopColor="#060412" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="snowL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8D8FF" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="snowR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8B8F0" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
          </linearGradient>
          <filter id="mtnBlur"><feGaussianBlur stdDeviation="1.8"/></filter>
          <filter id="mtnBlur2"><feGaussianBlur stdDeviation="0.8"/></filter>
          <filter id="snowGlow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* ── Far range (most distant, blurred, lightest) ── */}
        <polygon points="0,140 0,95 30,72 60,88 95,52 130,78 165,40 200,65 235,30 270,62 305,45 340,70 375,35 410,60 445,42 480,58 500,50 500,140" fill="url(#mtn1)" filter="url(#mtnBlur)"/>
        {/* Snow caps on far peaks */}
        <polygon points="163,40 165,40 172,52 158,52" fill="url(#snowL)" filter="url(#snowGlow)" opacity="0.5"/>
        <polygon points="233,30 235,30 242,42 228,43" fill="url(#snowL)" filter="url(#snowGlow)" opacity="0.45"/>
        <polygon points="373,35 375,35 382,46 368,47" fill="url(#snowR)" filter="url(#snowGlow)" opacity="0.4"/>
        {/* ── Mid range ── */}
        <polygon points="0,140 0,105 25,90 55,100 80,75 115,95 148,60 185,85 215,55 250,80 280,65 315,85 348,58 385,80 415,68 450,85 480,72 500,78 500,140" fill="url(#mtn2)" filter="url(#mtnBlur2)"/>
        {/* Mid snow */}
        <polygon points="146,60 148,60 156,72 140,72" fill="url(#snowL)" filter="url(#snowGlow)" opacity="0.55"/>
        <polygon points="213,55 215,55 223,67 207,67" fill="url(#snowL)" filter="url(#snowGlow)" opacity="0.5"/>
        <polygon points="346,58 348,58 356,70 340,70" fill="url(#snowR)" filter="url(#snowGlow)" opacity="0.45"/>
        {/* ── Front range (darkest, sharpest) ── */}
        <polygon points="0,140 0,115 20,108 50,118 75,100 105,112 130,90 160,108 185,95 215,110 240,88 270,106 295,94 325,108 355,85 385,102 415,90 450,108 480,96 500,102 500,140" fill="url(#mtn3)"/>
        {/* Subtle edge highlight on front peaks */}
        <polyline points="75,100 105,112 130,90 160,108 185,95 215,110 240,88 270,106 295,94 325,108 355,85" stroke="rgba(139,92,246,0.18)" strokeWidth="1.2" fill="none"/>
      </svg>

      {/* === CONTENT === */}
      <div style={{position:"relative",zIndex:4,padding:"24px 22px 22px"}}>
        <div style={{maxWidth:"100%"}}>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",fontWeight:500,marginBottom:5}}>
            {saludoReal}, <span style={{color:"#A78BFA",fontWeight:700}}>Alan</span>! 👋
          </div>
          <div style={{fontSize:32,fontWeight:900,color:"#FFFFFF",letterSpacing:"-1px",lineHeight:1.05,marginBottom:7,textShadow:"0 2px 30px rgba(139,92,246,0.4)"}}>
            Alan Martínez
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:20}}>
            Aquí tienes el resumen de hoy.
          </div>
          <div style={{display:"inline-flex",alignItems:"center",gap:9,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:30,padding:"7px 16px",backdropFilter:"blur(6px)"}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="11" rx="2" stroke="#A78BFA" strokeWidth="1.3" fill="none"/>
              <line x1="1" y1="6" x2="13" y2="6" stroke="#A78BFA" strokeWidth="1.3"/>
              <line x1="4" y1="1" x2="4" y2="4" stroke="#A78BFA" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="10" y1="1" x2="10" y2="4" stroke="#A78BFA" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontWeight:500}}>
              {hoy.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* ── INGRESOS ── */}
    {(()=>{
      // Generar datos sparkline de los últimos 8 meses a partir de contratos reales
      const now=new Date();
      const sparkData=Array.from({length:8},(_,i)=>{
        const d=new Date(now.getFullYear(),now.getMonth()-7+i,1);
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        const val=contratos.filter(c=>c.pagado&&c.inicio&&c.inicio.startsWith(key)).reduce((a,c)=>a+Number(c.monto),0);
        return val;
      });
      // Si todo es 0, generar curva ilustrativa
      const hasData=sparkData.some(v=>v>0);
      const plotData=hasData?sparkData:[0,12,8,22,16,30,24,38];
      const maxV=Math.max(...plotData,1);
      // Generar path SVG suave con curvas bezier
      const W=160,H=44;
      const pts=plotData.map((v,i)=>({x:i*(W/(plotData.length-1)),y:H-((v/maxV)*(H-6))-3}));
      const pathD=pts.reduce((acc,pt,i)=>{
        if(i===0) return `M${pt.x},${pt.y}`;
        const prev=pts[i-1];
        const cx=(prev.x+pt.x)/2;
        return acc+` C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
      },"");
      const areaD=pathD+` L${pts[pts.length-1].x},${H} L0,${H} Z`;
      return(
        <div style={{marginBottom:16,padding:"20px 20px",background:"linear-gradient(135deg,#070E22 0%,#0A1435 40%,#0C1840 70%,#070D1E 100%)",borderRadius:22,border:"1px solid rgba(59,130,246,0.22)",boxShadow:"0 4px 36px rgba(0,0,0,0.7),inset 0 1px 0 rgba(110,231,183,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:0}}>
            {/* Lado izquierdo */}
            <div style={{display:"flex",gap:14,alignItems:"center",flex:1,minWidth:0}}>
              <IconDolar/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:10,fontWeight:800,color:"#6EE7B7",textTransform:"uppercase",letterSpacing:2.5,marginBottom:5}}>Ingresos este mes</div>
                <div style={{fontSize:42,fontWeight:900,color:"#10B981",letterSpacing:"-2px",lineHeight:1,textShadow:"0 0 30px rgba(16,185,129,0.45)"}}>{fmt(ingMes)}</div>
                <div style={{fontSize:12,color:"#6EE7B7",marginTop:6,opacity:0.85}}>{pag} de {contratos.length} contratos cobrados</div>
              </div>
            </div>
            {/* Sparkline central */}
            <div style={{flexShrink:0,margin:"0 10px 0 6px",position:"relative"}}>
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible"}}>
                <defs>
                  <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                  </linearGradient>
                  <filter id="spkGlow">
                    <feGaussianBlur stdDeviation="2.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                {/* Área rellena */}
                <path d={areaD} fill="url(#spkGrad)"/>
                {/* Línea principal con glow */}
                <path d={pathD} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:"drop-shadow(0 0 5px rgba(16,185,129,0.9))"}}/>
                {/* Punto final brillante */}
                <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="4" fill="#10B981" style={{filter:"drop-shadow(0 0 6px rgba(16,185,129,1))"}}/>
                <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="7" fill="rgba(16,185,129,0.2)"/>
              </svg>
            </div>
            {/* Lado derecho — estadística */}
            <div style={{textAlign:"center",flexShrink:0,minWidth:80,borderLeft:"1px solid rgba(16,185,129,0.2)",paddingLeft:14}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:4}}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 14 L7 8 L11 12 L18 5" stroke={crecPct>=0?"#10B981":C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 5 L18 5 L18 9" stroke={crecPct>=0?"#10B981":C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{fontSize:10,color:"#6EE7B7",marginBottom:3,opacity:0.9,lineHeight:1.2}}>vs mes anterior</div>
              <div style={{fontSize:22,fontWeight:900,color:crecPct>=0?"#10B981":C.red,lineHeight:1,textShadow:`0 0 12px ${crecPct>=0?"rgba(16,185,129,0.6)":"rgba(239,68,68,0.6)"}`}}>{crecPct===0?"0":crecPct>0?"+"+crecPct:crecPct}%</div>
              <div style={{fontSize:10,color:"#6EE7B7",marginTop:4,opacity:0.7}}>{crecPct===0?"Sin cambios":crecPct>0?"Creciendo":"Bajando"}</div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── DONUTS ── */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
      {/* Ocupación */}
      <div style={{padding:"16px 12px",background:"linear-gradient(145deg,#0D2045 0%,#0A1535 40%,#08102A 100%)",borderRadius:22,border:"1px solid rgba(99,102,241,0.32)",display:"flex",flexDirection:"column",alignItems:"center",gap:4,boxShadow:"0 4px 32px rgba(0,0,0,0.7),0 0 24px rgba(99,102,241,0.08),inset 0 1px 0 rgba(129,140,248,0.10)",position:"relative",overflow:"hidden"}}> 
        {/* subtle blue inner glow top-left */}
        <div style={{position:"absolute",top:"-30%",left:"-20%",width:"80%",height:"80%",background:"radial-gradient(ellipse,rgba(59,130,246,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,alignSelf:"flex-start"}}>
          <IconBars/>
          <span style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1.2}}>Ocupación</span>
        </div>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="gocu2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60A5FA"/>
              <stop offset="50%" stopColor="#818CF8"/>
              <stop offset="100%" stopColor="#8B5CF6"/>
            </linearGradient>
            <filter id="gocuGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="60" cy="60" r="46" fill="none" stroke="#1A2744" strokeWidth="11"/>
          {/* Progress with gradient + strong glow */}
          <circle cx="60" cy="60" r="46" fill="none" stroke="url(#gocu2)" strokeWidth="11"
            strokeDasharray={`${(ocu/100)*2*Math.PI*46} ${2*Math.PI*46}`} strokeLinecap="round" transform="rotate(-90 60 60)"
            style={{filter:"drop-shadow(0 0 14px rgba(99,102,241,1)) drop-shadow(0 0 6px rgba(139,92,246,0.8)) drop-shadow(0 0 28px rgba(99,102,241,0.5))",transition:"stroke-dasharray 0.6s ease"}}/>
          {/* Bright indicator dot */}
          {ocu>0&&<circle cx="60" cy="14" r="7" fill="#A5B4FC" transform={`rotate(${(ocu/100)*360} 60 60)`} filter="url(#dotGlow)" style={{opacity:1}}/>}
          {ocu>0&&<circle cx="60" cy="14" r="4" fill="white" transform={`rotate(${(ocu/100)*360} 60 60)`} style={{filter:"drop-shadow(0 0 8px rgba(255,255,255,1))"}}/>}
          <text x="60" y="54" textAnchor="middle" fill="white" fontSize="25" fontWeight="900" fontFamily="DM Sans,sans-serif">{ocu}%</text>
          <text x="60" y="71" textAnchor="middle" fill="#64748B" fontSize="11" fontFamily="DM Sans,sans-serif">ocupación</text>
        </svg>
        <div style={{fontSize:12,color:"#94A3B8",fontWeight:600}}>{paneles.filter(p=>p.estado==="Ocupado").length} de {paneles.length} paneles</div>
        {paneles.length===0&&<div style={{fontSize:10,color:"#64748B",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:20,padding:"3px 12px",marginTop:2}}>Sin datos aún  ⓘ</div>}
      </div>
      {/* Cobro */}
      <div style={{padding:"16px 12px",background:"linear-gradient(145deg,#0D2045 0%,#0A1535 40%,#08102A 100%)",borderRadius:22,border:"1px solid rgba(16,185,129,0.22)",display:"flex",flexDirection:"column",alignItems:"center",gap:4,boxShadow:"0 4px 32px rgba(0,0,0,0.7),0 0 20px rgba(16,185,129,0.05),inset 0 1px 0 rgba(52,211,153,0.08)",position:"relative",overflow:"hidden"}}>
        {/* subtle green inner glow bottom-right */}
        <div style={{position:"absolute",bottom:"-20%",right:"-20%",width:"70%",height:"70%",background:"radial-gradient(ellipse,rgba(16,185,129,0.09) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,alignSelf:"flex-start"}}>
          <IconCard/>
          <span style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1.2}}>Cobro</span>
        </div>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="gcob2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34D399"/>
              <stop offset="50%" stopColor="#10B981"/>
              <stop offset="100%" stopColor="#06B6D4"/>
            </linearGradient>
            <filter id="cobDotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="60" cy="60" r="46" fill="none" stroke="#0D2030" strokeWidth="11"/>
          {/* Progress with gradient + strong glow */}
          <circle cx="60" cy="60" r="46" fill="none" stroke="url(#gcob2)" strokeWidth="11"
            strokeDasharray={`${(cob/100)*2*Math.PI*46} ${2*Math.PI*46}`} strokeLinecap="round" transform="rotate(-90 60 60)"
            style={{filter:"drop-shadow(0 0 14px rgba(16,185,129,1)) drop-shadow(0 0 6px rgba(6,182,212,0.6)) drop-shadow(0 0 28px rgba(16,185,129,0.4))",transition:"stroke-dasharray 0.6s ease"}}/>
          {/* Bright indicator dot */}
          {cob>0&&<circle cx="60" cy="14" r="7" fill="#6EE7B7" transform={`rotate(${(cob/100)*360} 60 60)`} filter="url(#cobDotGlow)" style={{opacity:1}}/>}
          {cob>0&&<circle cx="60" cy="14" r="4" fill="white" transform={`rotate(${(cob/100)*360} 60 60)`} style={{filter:"drop-shadow(0 0 8px rgba(255,255,255,1))"}}/>}
          <text x="60" y="54" textAnchor="middle" fill="white" fontSize="25" fontWeight="900" fontFamily="DM Sans,sans-serif">{cob}%</text>
          <text x="60" y="71" textAnchor="middle" fill="#64748B" fontSize="11" fontFamily="DM Sans,sans-serif">cobrado</text>
        </svg>
        <div style={{fontSize:12,color:"#94A3B8",fontWeight:600}}>{pag} de {contratos.length} contratos</div>
        {contratos.length===0&&<div style={{fontSize:10,color:"#64748B",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:20,padding:"3px 12px",marginTop:2}}>Sin datos aún  ⓘ</div>}
      </div>
    </div>

    {/* ── PRÓXIMOS A VENCER ── */}
    <div style={{marginBottom:16,padding:"22px 20px",background:"linear-gradient(145deg,#1A0D4E 0%,#130A3A 35%,#0E0828 65%,#090620 100%)",borderRadius:22,border:"1px solid rgba(139,92,246,0.38)",overflow:"hidden",boxShadow:"0 6px 40px rgba(109,40,217,0.28),0 0 0 1px rgba(139,92,246,0.08),inset 0 1px 0 rgba(167,139,250,0.12)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <IconCal/>
        <span style={{fontSize:11,fontWeight:700,color:"#A78BFA",textTransform:"uppercase",letterSpacing:1.4}}>Próximos a vencer</span>
        {prox.length>0&&<span style={{marginLeft:"auto",background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{prox.length}</span>}
      </div>
      {/* Contenido: texto izquierda + portapapeles derecha en misma fila */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:8}}>
        <div style={{flex:1}}>
          {prox.length===0?(
            <>
              <div style={{fontSize:15,fontWeight:800,color:"#FFFFFF",marginBottom:6}}>No tienes contratos próximos a vencer.</div>
              <div style={{fontSize:13,color:"#A78BFA",opacity:0.8}}>Todo al día, ¡buen trabajo!</div>
            </>
          ):(
            prox.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #2A2060"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel.nombre}</div>
                  <div style={{fontSize:11,color:C.muted}}>{c.cliente?.empresa}</div>
                </div>
                <Badge color={c.d<=15?C.red:C.amber} ch={c.d+"d"}/>
              </div>
            ))
          )}
        </div>
        {/* Portapapeles — derecha del texto, no tapa el botón */}
        <div style={{flexShrink:0,marginRight:-10,marginBottom:-10}}>
          <PortapapelesSVG/>
        </div>
      </div>
      <button onClick={()=>setTab("contratos")} style={{width:"100%",padding:"16px 20px",background:"linear-gradient(105deg,#4C1D95 0%,#6D28D9 25%,#7C3AED 45%,#8B5CF6 60%,#4338CA 80%,#3730A3 100%)",border:"1px solid rgba(167,139,250,0.35)",borderRadius:16,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 8px 32px rgba(109,40,217,0.65),0 2px 8px rgba(0,0,0,0.4),0 0 60px rgba(139,92,246,0.2),inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -1px 0 rgba(0,0,0,0.25)",letterSpacing:0.6,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        {/* Inner light reflection */}
        <div style={{position:"absolute",top:0,left:"10%",width:"80%",height:"45%",background:"linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%)",borderRadius:"0 0 50% 50%",pointerEvents:"none"}}/>
        {/* Left sparkle */}
        <div style={{position:"absolute",left:"8%",top:"50%",transform:"translateY(-50%)",width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.5)",boxShadow:"0 0 10px rgba(255,255,255,0.8),0 0 20px rgba(167,139,250,0.6)",pointerEvents:"none"}}/>
        <span style={{position:"relative",zIndex:1,letterSpacing:0.8}}>Ver contratos</span>
        <span style={{position:"relative",zIndex:1,fontSize:18,lineHeight:1}}>→</span>
      </button>
    </div>

    {/* ── MÉTRICAS DEL MES ── */}
    {(()=>{
      // Mini sparklines para cada métrica
      const makePath=(data,w,h,color)=>{
        const maxV=Math.max(...data,1);
        const pts=data.map((v,i)=>({x:i*(w/(data.length-1)),y:h-((v/maxV)*(h-4))-2}));
        const d=pts.reduce((acc,pt,i)=>{
          if(i===0) return `M${pt.x},${pt.y}`;
          const prev=pts[i-1];
          const cx=(prev.x+pt.x)/2;
          return acc+` C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
        },"");
        const area=d+` L${pts[pts.length-1].x},${h} L0,${h} Z`;
        return {d,area,pts};
      };
      // Datos últimos 7 puntos por métrica
      const now2=new Date();
      const ingData=Array.from({length:7},(_,i)=>{
        const dd=new Date(now2.getFullYear(),now2.getMonth()-6+i,1);
        const key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}`;
        return contratos.filter(c=>c.pagado&&c.inicio&&c.inicio.startsWith(key)).reduce((a,c)=>a+Number(c.monto),0);
      });
      const panData=[...Array(7)].map((_,i)=>Math.max(0,paneles.filter(p=>p.estado==="Ocupado").length-Math.max(0,6-i)*0));
      const conData=[...Array(7)].map((_,i)=>Math.max(0,contratos.filter(c=>dias(c.fin)>0).length));
      const hasIngData=ingData.some(v=>v>0);
      const ingPlot=hasIngData?ingData:[2,5,3,8,6,12,9];
      const panPlot=panData.every(v=>v===0)?[1,2,2,3,2,4,3]:panData;
      const conPlot=conData.every(v=>v===0)?[1,3,2,4,3,5,4]:conData;
      const metrics=[
        {type:"ing",label:"Ingresos",value:fmt(ingMes),sub:"Este mes",color:"#10B981",gradId:"mIng",bg:"linear-gradient(145deg,#071C14 0%,#051510 50%,#030D09 100%)",border:"rgba(16,185,129,0.32)",glow:"rgba(16,185,129,0.12)",areaColor:"rgba(16,185,129,0.22)",plot:ingPlot},
        {type:"pan",label:"Paneles activos",value:paneles.filter(p=>p.estado==="Ocupado").length,sub:"Total instalados",color:"#3B82F6",gradId:"mPan",bg:"linear-gradient(145deg,#081630 0%,#060F22 50%,#040A18 100%)",border:"rgba(59,130,246,0.32)",glow:"rgba(59,130,246,0.12)",areaColor:"rgba(59,130,246,0.2)",plot:panPlot},
        {type:"con",label:"Contratos activos",value:contratos.filter(c=>dias(c.fin)>0).length,sub:"Este mes",color:"#A78BFA",gradId:"mCon",bg:"linear-gradient(145deg,#110E2C 0%,#0C0A20 50%,#07061A 100%)",border:"rgba(139,92,246,0.32)",glow:"rgba(139,92,246,0.12)",areaColor:"rgba(139,92,246,0.2)",plot:conPlot},
      ];
      return(
        <div style={{padding:"20px 20px",background:"linear-gradient(145deg,#0C1428 0%,#080E1C 100%)",borderRadius:22,border:"1px solid rgba(59,110,248,0.15)",boxShadow:"0 4px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.03)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <IconBars/>
            <span style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1.4}}>Métricas del mes</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {metrics.map(m=>{
              const {d,area,pts}=makePath(m.plot,90,28,m.color);
              return(
                <div key={m.label} style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:16,padding:"14px 8px 0 8px",textAlign:"center",boxShadow:`0 2px 24px rgba(0,0,0,0.5),0 0 16px ${m.glow},0 0 0 1px ${m.border},inset 0 1px 0 rgba(255,255,255,0.06)`,overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><IconMetrica type={m.type}/></div>
                  <div style={{fontSize:10,color:"#64748B",fontWeight:600,textTransform:"uppercase",letterSpacing:0.6,marginBottom:4,lineHeight:1.3,padding:"0 4px"}}>{m.label}</div>
                  <div style={{fontSize:20,fontWeight:900,color:m.color,letterSpacing:"-0.5px",textShadow:`0 0 14px ${m.color}66`}}>{m.value}</div>
                  <div style={{fontSize:10,color:"#64748B",marginTop:2,marginBottom:10}}>{m.sub}</div>
                  {/* Mini sparkline */}
                  <div style={{width:"100%",marginTop:"auto"}}>
                    <svg width="100%" height="28" viewBox="0 0 90 28" preserveAspectRatio="none" style={{display:"block"}}>
                      <defs>
                        <linearGradient id={m.gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={m.color} stopOpacity="0.3"/>
                          <stop offset="100%" stopColor={m.color} stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d={area} fill={`url(#${m.gradId})`}/>
                      <path d={d} fill="none" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 4px ${m.color}) drop-shadow(0 0 8px ${m.color}88)`}}/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    })()}

    {/* ── GRÁFICA CRECIMIENTO ── */}
    <div style={{marginTop:14,padding:"20px 20px",background:"linear-gradient(145deg,#0C1428 0%,#080E1C 100%)",borderRadius:22,border:"1px solid rgba(59,110,248,0.15)",boxShadow:"0 4px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.03)"}}>
      <GraficaCrecimiento contratos={contratos}/>
    </div>

    <div style={{textAlign:"center",marginTop:20,fontSize:11,color:"#2A3A5A"}}>
      Vista360 © 2026 • Tu plataforma de gestión solar
    </div>

  </div>);
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

  const empty={nombre:"",tipo:"LED",precio:0,estado:"Libre",foto:"📡",ciudad:"Lima",direccion:"",lat:"",lng:""};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ setForm(empty); setModal("nuevo"); };
  const openEdit=(p)=>{ setForm({...p}); setModal(p); };

  const guardar=async()=>{
    if(!form.nombre.trim()) return alert("Escribe el nombre del panel");
    setSaving(true);
    const payload={nombre:form.nombre,tipo:form.tipo,precio:Number(form.precio)||0,estado:form.estado,foto:form.foto||"📡",ciudad:form.ciudad,direccion:form.direccion||"",lat:form.lat?String(form.lat):null,lng:form.lng?String(form.lng):null};
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
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="🖥️" title="Gestión de Paneles" sub={`${paneles.length} paneles registrados · ${libre} libres · ${ocup} ocupados`}/>
      <button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 20px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Nuevo Panel</button>
    </div>

    {loading?<Spinner/>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
      {paneles.map(p=>(
        <Card key={p.id} style={{padding:0,overflow:"hidden"}}>
          {/* Header color */}
          <div style={{height:6,background:p.estado==="Ocupado"?C.red:C.green}}/>
          <div style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:48,height:48,borderRadius:12,background:(p.estado==="Ocupado"?C.red:C.green)+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{p.foto}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.white,lineHeight:1.3}}>{p.nombre}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{p.ciudad}</div>
                </div>
              </div>
              <Badge color={p.estado==="Ocupado"?C.red:C.green} ch={p.estado}/>
            </div>

            {p.direccion&&<div style={{fontSize:12,color:C.muted,marginBottom:12,padding:"8px 10px",background:C.surface,borderRadius:8}}>📍 {p.direccion}</div>}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              <div style={{background:C.surface,borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Tipo</div>
                <div style={{fontSize:13,fontWeight:700,color:C.white}}>{p.tipo}</div>
              </div>
              <div style={{background:`linear-gradient(135deg,${C.green}18,${C.green}08)`,border:`1px solid ${C.green}44`,borderRadius:12,padding:"10px 14px",display:"flex",flexDirection:"column",gap:2}}>
                <div style={{fontSize:10,color:C.green,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>Precio/mes</div>
                <div style={{fontSize:22,fontWeight:900,color:C.green,letterSpacing:"-0.5px",lineHeight:1}}>{fmt(p.precio)}</div>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>openEdit(p)} style={{flex:1,padding:"8px",background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:9,color:C.accent,fontWeight:600,fontSize:13,cursor:"pointer"}}>✏️ Editar</button>
              <button onClick={()=>eliminar(p.id)} style={{padding:"8px 12px",background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:9,color:C.red,fontWeight:600,fontSize:13,cursor:"pointer"}}>🗑</button>
            </div>
          </div>
        </Card>
      ))}
      {paneles.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:C.muted}}>Sin paneles registrados · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar el primero</button></div>}
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
      const color=p.estado==="Ocupado"?"#EF4444":"#10B981";
      const shadow=p.estado==="Ocupado"?"rgba(239,68,68,0.5)":"rgba(16,185,129,0.5)";
      const icon=L.divIcon({
        className:"",
        html:`<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${color}22;animation:markerPulse 2s ease-in-out infinite;"></div>
          <div style="width:40px;height:40px;border-radius:50%;background:white;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 16px ${shadow};position:relative;z-index:1;">${p.foto}</div>
        </div>`,
        iconSize:[52,52],iconAnchor:[26,26],
      });
      const marker=L.marker([lat,lng],{icon}).addTo(map);
      marker.on("click",()=>setSel(prev=>prev?.panel?.id===p.id?null:{panel:p,info:getInfo(p.id)}));
      markersRef.current.push(marker);
    });
    if(bounds.length===1) map.setView(bounds[0],14);
    else if(bounds.length>1) map.fitBounds(bounds,{padding:[60,60],maxZoom:13});
  },[paneles,leafletReady]);

  const sinCoords=paneles.filter(p=>!p.lat||!p.lng);

  return(<div>
    <PgTit icon="🗺️" title="Mapa de Paneles" sub="OpenStreetMap · Clic en un pin para ver detalles"/>

    {sinCoords.length>0&&(
      <div style={{background:C.amber+"12",border:`1px solid ${C.amber}33`,borderRadius:12,padding:"10px 16px",marginBottom:14,fontSize:13,color:C.amber,display:"flex",gap:10,alignItems:"center"}}>
        ⚠️ <span><strong>{sinCoords.length} panel(es)</strong> sin coordenadas exactas — aparecen aproximados por ciudad. Ve a <strong>Paneles → Editar → 📍 Ubicar</strong> para precisarlos.</span>
      </div>
    )}

    <Card style={{padding:0,overflow:"hidden",position:"relative",borderRadius:20}}>
      <div style={{position:"absolute",top:16,left:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",display:"flex",gap:14,backdropFilter:"blur(10px)",border:`1px solid ${C.border}`}}>
        {[[C.green,"Libre"],[C.red,"Ocupado"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
            <span style={{fontSize:12,color:C.muted,fontWeight:600}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:16,right:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",backdropFilter:"blur(10px)",border:`1px solid ${C.border}`,fontSize:12,color:C.muted,fontWeight:600}}>
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
        const color=p.estado==="Ocupado"?C.red:C.green;
        const contrato=info;
        const diasVence=contrato?Math.ceil((new Date(contrato.fin)-new Date())/86400000):null;
        return(
          <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:500,background:"rgba(7,12,24,0.97)",backdropFilter:"blur(20px)",borderTop:`2px solid ${color}`,padding:"20px 22px 24px",borderRadius:"0 0 20px 20px"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:52,height:52,borderRadius:14,background:color+"18",border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {p.foto}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white,letterSpacing:"-0.3px"}}>{p.nombre}</div>
                  {p.direccion&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>📍 {p.direccion}</div>}
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>
                      {p.estado==="Ocupado"?"🔴 Ocupado":"🟢 Libre"}
                    </span>
                    <span style={{background:C.accent+"18",color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{p.tipo}</span>
                    {p.ciudad&&<span style={{background:C.purple+"18",color:C.purple,border:`1px solid ${C.purple}33`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{p.ciudad}</span>}
                  </div>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{width:32,height:32,borderRadius:"50%",background:C.border,border:"none",color:C.muted,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
            </div>

            {/* Info según estado */}
            {p.estado==="Ocupado"&&contrato?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[
                    ["💵 Facturando",`${fmt(contrato.monto)}/mes`,C.green],
                    ["🏢 Cliente",contrato.cliente?.empresa||"—",C.white],
                    ["📅 Vence",diasVence>0?`en ${diasVence}d`:`hace ${Math.abs(diasVence)}d`,diasVence>15?C.green:diasVence>0?C.amber:C.red],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:C.card,borderRadius:12,padding:"12px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                      <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:800,color:c,lineHeight:1.2}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>📆 Período</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.white}}>{fmtF(contrato.inicio)} → {fmtF(contrato.fin)}</div>
                  </div>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>💳 Pago</div>
                    <div style={{fontSize:12,fontWeight:700,color:contrato.pagado?C.green:C.amber}}>{contrato.pagado?"✅ Cobrado":"⏳ Pendiente"}</div>
                  </div>
                </div>
              </div>
            ):(
              <div style={{background:C.green+"12",border:`1px solid ${C.green}33`,borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:32}}>✅</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.green}}>Panel disponible</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:3}}>Precio de lista: <strong style={{color:C.white}}>{fmt(p.precio)}/mes</strong></div>
                  {p.precio&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>Anual estimado: <strong style={{color:C.cyan}}>{fmt(p.precio*12)}</strong></div>}
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
      const label=cur.toLocaleDateString("es-EC",{month:"short",year:"numeric"});
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
    if(!confirm("¿Eliminar este contrato?")) return;
    await fb.del("contratos",id);
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
      <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:26,width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span style={{fontSize:17,fontWeight:800,color:C.white}}>{modal==="nuevo"?"➕ Nuevo Contrato":"✏️ Editar Contrato"}</span>
            <button onClick={()=>setModal(null)} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>✕</button>
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
                style={{...inp,colorScheme:"dark",cursor:"pointer"}}/>
            </F>
            <F label="Fecha fin *">
              <input type="date" value={form.fin}
                onChange={e=>setForm(f=>({...f,fin:e.target.value,pagosMeses:{}}))}
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

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <PgTit icon="📋" title="Contratos" sub={`${contratos.length} contratos · ${activos} activos`}/>
      <button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 20px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Nuevo Contrato</button>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      {[{label:"Activos",count:activos,icon:"✅"},{label:"Por vencer",count:porVencer,icon:"⚠️"},{label:"Históricos",count:historicos,icon:"📚"}].map(f=>(
        <button key={f.label} onClick={()=>setFiltro(f.label)}
          style={{padding:"8px 16px",borderRadius:9,border:`1px solid ${filtro===f.label?C.accent:C.border}`,background:filtro===f.label?C.accent+"22":"transparent",color:filtro===f.label?C.accent:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <span>{f.icon}</span><span>{f.label}</span>
          <span style={{background:filtro===f.label?C.accent:C.border,color:filtro===f.label?C.white:C.muted,borderRadius:12,padding:"2px 7px",fontSize:11,fontWeight:700,minWidth:20,textAlign:"center"}}>{f.count}</span>
        </button>
      ))}
    </div>

    {loading?<Spinner/>:
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {fil.map(c=>{
        const msg=encodeURIComponent(`Hola ${c.cliente.contacto}, le recordamos que su contrato para *${c.panel.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`);
        const meses=generarMeses(c.inicio,c.fin);
        const pm=c.pagosMeses||{};
        const pagados=meses.filter(m=>pm[m.key]).length;
        return(
          <Card key={c.id} style={{padding:"18px 20px"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
              <div style={{fontSize:28,flexShrink:0,marginTop:2}}>{c.panel.foto}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:C.white}}>{c.panel.nombre}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{c.cliente.empresa} · {c.cliente.contacto}</div>
                <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                  <Tag color={C.accent} ch={`${fmtF(c.inicio)} → ${fmtF(c.fin)}`}/>
                  <Tag color={pagados===meses.length&&meses.length>0?C.green:pagados>0?C.amber:C.red} ch={`💳 ${pagados}/${meses.length} meses`}/>
                  {c.d>0&&c.d<=60&&<Tag color={c.d<=15?C.red:C.amber} ch={c.d<=15?`🔴 ${c.d}d`:`⚠️ ${c.d}d`}/>}
                  {c.d<=0&&<Tag color={C.muted} ch={`📚 Venció hace ${Math.abs(c.d)}d`}/>}
                </div>
                {/* Mini pagos por mes en la tarjeta */}
                {meses.length>0&&(
                  <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                    {meses.map((m,i)=>{
                      const pag=pm[m.key]||false;
                      return(
                        <button key={m.key} onClick={()=>togglePagoRapido(c,m.key)}
                          style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${pag?C.green:C.border}`,background:pag?C.green+"22":"transparent",cursor:"pointer",fontSize:11,fontWeight:700,color:pag?C.green:C.muted,whiteSpace:"nowrap"}}>
                          {pag?"✓":"○"} {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                <div style={{fontSize:18,fontWeight:800,color:C.green}}>{fmt(c.monto)}<span style={{fontSize:11,color:C.muted}}>/mes</span></div>
                <div style={{fontSize:11,color:C.green,fontWeight:700}}>{fmt(pagados*Number(c.monto))} cobrado</div>
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  <button onClick={()=>openEdit(c)} style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 10px",color:C.accent,fontWeight:700,fontSize:12,cursor:"pointer"}}>✏️</button>
                  <button onClick={()=>eliminar(c.id)} style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 10px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer"}}>🗑</button>
                  <a href={`https://wa.me/${c.cliente.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                    style={{background:"#25D366",borderRadius:8,padding:"6px 11px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",textDecoration:"none"}}>
                    📱
                  </a>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {fil.length===0&&<Card style={{textAlign:"center",color:C.muted,padding:40}}>
        <div style={{fontSize:32,marginBottom:10}}>{filtro==="Activos"?"📋":filtro==="Por vencer"?"⏰":"📚"}</div>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin contratos {filtro.toLowerCase()}</div>
        <button onClick={openNew} style={{marginTop:10,background:C.accent,border:"none",borderRadius:10,padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Crear primer contrato</button>
      </Card>}
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
    if(!confirm("¿Eliminar este contacto?")) return;
    await fb.del("clientes",id);
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

  const SPARK_CLI=[40,52,45,60,55,70,68,80,85,90,95,clis.length||100];
  const SPARK_PRO=[8,12,10,15,18,14,20,22,19,24,22,pros.length||24];
  const SPARK_PROP=[3,5,4,7,6,8,7,10,9,11,10,propuestas.length||12];

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
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
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
      {/* Col headers */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 110px 130px 110px 90px",padding:"10px 20px",gap:8,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        {[["EMPRESA","#7C3AED"],["TIPO",null],["CIUDAD",null],["SECTOR",null],["ESTADO",null],["CONTACTO",null],["ACCIONES",null]].map(([h,col])=>(
          <div key={h} style={{fontSize:10,fontWeight:800,color:col||C.muted,textTransform:"uppercase",letterSpacing:0.8,display:"flex",alignItems:"center",gap:4}}>
            {h}
            {col&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>}
          </div>
        ))}
      </div>
      {/* Rows */}
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
              style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 110px 130px 110px 90px",
                padding:"13px 20px",gap:8,alignItems:"center",
                borderBottom:i<paginated.length-1?"1px solid rgba(255,255,255,0.04)":"none",
                cursor:"pointer",transition:"all 0.15s ease",
                animation:`fadeUp 0.4s ease both`,animationDelay:`${0.28+i*0.04}s`,
              }}>
              {/* Empresa */}
              <div style={{display:"flex",alignItems:"center",gap:11}}>
                <AvatarEmpresa name={r.empresa} size={34}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:1}}>{r.empresa}</div>
                  <div style={{fontSize:10,color:C.muted}}>{r.ruc?"RUC "+r.ruc:r.email||"—"}</div>
                </div>
              </div>
              {/* Tipo */}
              <div>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${tc}18`,border:`1px solid ${tc}44`,color:tc,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                  {r.tipo}
                </span>
              </div>
              {/* Ciudad */}
              <div style={{fontSize:12,color:C.muted}}>{r.ciudad||"—"}</div>
              {/* Sector */}
              <div style={{fontSize:12,color:C.muted}}>{r.sector||"—"}</div>
              {/* Estado */}
              <div>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${ec}18`,border:`1px solid ${ec}44`,color:ec,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                  {r.estado}
                </span>
              </div>
              {/* Contacto */}
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <AvatarContacto name={r.contacto||"?"} size={28}/>
                <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.contacto||"—"}</div>
              </div>
              {/* Acciones */}
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>wa(r)} title="WhatsApp" style={{background:"#25D36618",border:"1px solid #25D36630",borderRadius:8,padding:"6px 8px",color:"#25D366",cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </button>
                <button onClick={()=>openEdit(r)} title="Editar" style={{background:`${C.accent}18`,border:`1px solid ${C.accent}30`,borderRadius:8,padding:"6px 8px",color:C.accent,cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={()=>eliminar(r.id)} title="Eliminar" style={{background:`${C.red}18`,border:`1px solid ${C.red}30`,borderRadius:8,padding:"6px 8px",color:C.red,cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
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

    {/* ── BOTTOM ROW: Ranking + Pipeline ── */}
    <div style={{marginTop:28,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
      {/* Ranking de clientes */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",
        animation:"fadeUp 0.5s ease both",animationDelay:"0.5s",
        boxShadow:"0 8px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 18px 12px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <span style={{fontSize:13,fontWeight:700,color:C.white}}>Ranking de clientes</span>
          </div>
        </div>
        <div style={{padding:"0 0 4px"}}>
          <RankingClientes clientes={clientes} contratos={contratos}/>
        </div>
      </div>

      {/* Pipeline de ventas */}
      {(()=>{
        const pros2=clientes.filter(d=>d.tipo==="Prospecto");
        const contactados=pros2.filter(p=>p.estado==="En contacto");
        const propEnviadas=pros2.filter(p=>p.estado==="Propuesta enviada");
        const cerrados=clientes.filter(d=>d.tipo==="Cliente"&&d.estado==="Activo");
        const total=clientes.length||1;
        const PIPELINE_DATA=[
          {label:"Prospecto",  count:pros2.length,     pct:Math.round(pros2.length/total*100),       color:C.accent},
          {label:"Contactado", count:contactados.length,pct:Math.round(contactados.length/total*100), color:C.purple},
          {label:"Propuesta",  count:propEnviadas.length,pct:Math.round(propEnviadas.length/total*100),color:C.amber},
          {label:"Cerrado",    count:cerrados.length,  pct:Math.round(cerrados.length/total*100),     color:C.green},
        ];
        const PIPE_ICONS={
          Prospecto:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
          Contactado: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
          Propuesta:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
          Cerrado:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
        };
        return(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",
            animation:"fadeUp 0.5s ease both",animationDelay:"0.55s",
            boxShadow:"0 8px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"16px 18px 12px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <span style={{fontSize:13,fontWeight:700,color:C.white}}>Pipeline de ventas</span>
              </div>
            </div>
            <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
              {PIPELINE_DATA.map((stage,i)=>(
                <div key={stage.label} style={{borderRadius:14,padding:"14px 16px",
                  background:`linear-gradient(135deg,${stage.color}0F,${stage.color}06)`,
                  border:`1px solid ${stage.color}22`,
                  animation:"fadeUp 0.4s ease both",animationDelay:`${0.55+i*0.07}s`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:30,height:30,borderRadius:9,background:`${stage.color}20`,
                        border:`1px solid ${stage.color}35`,display:"flex",alignItems:"center",
                        justifyContent:"center",color:stage.color,boxShadow:`0 0 12px ${stage.color}30`}}>
                        {PIPE_ICONS[stage.label]}
                      </div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.white}}>{stage.label}</div>
                        <div style={{fontSize:10,color:C.muted}}>{stage.count} contactos</div>
                      </div>
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:stage.color,textShadow:`0 0 10px ${stage.color}66`}}>
                      {stage.pct}%
                    </span>
                  </div>
                  {/* Bar */}
                  <div style={{width:"100%",height:5,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(stage.pct*4,100)}%`,height:"100%",background:stage.color,
                      borderRadius:99,boxShadow:`0 0 8px ${stage.color}88`,
                      transition:"width 1s cubic-bezier(.34,1.56,.64,1)"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>

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
  const [mes,setMes]=useState(mesHoy);
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

  const eliminar=async(id)=>{ if(!confirm("¿Eliminar este gasto?")) return; await fb.del("gastos",id); setGastos(p=>p.filter(g=>g.id!==id)); };

  // Historial INFINITO — desde el mes más antiguo (contratos o gastos) hasta hoy
  const historialMeses=useMemo(()=>{
    const fechas=[
      ...contratos.map(c=>c.inicio?.slice(0,7)).filter(Boolean),
      ...gastos.map(g=>g.mes).filter(Boolean),
    ];
    const mesHoyKey=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
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
          const contenido=vistaHistorica
            ?`VISTA360 — Resumen Histórico ${historialMeses.length} meses\n\n${historialMeses.map(m=>`${m.label.toUpperCase()}\n  Ingresos: ${fmt(m.ing)}\n  Gastos:   ${fmt(m.gas)}\n  Utilidad: ${fmt(m.util)}`).join("\n\n")}\n\nGenerado por Vista360 · ${new Date().toLocaleDateString("es-PE")}`
            :`VISTA360 — Estado de Resultados\n${new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"}).toUpperCase()}\n\nINGRESOS COBRADOS:  ${fmt(ingCob)}\nPOR COBRAR:         ${fmt(ingPend)}\nTOTAL GASTOS:       ${fmt(totGastos)}\nUTILIDAD NETA:      ${fmt(utilidad)}\nMARGEN:             ${margen}%\n\nGASTOS POR CATEGORÍA:\n${Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${fmt(v)}`).join("\n")}\n\nGenerado por Vista360 · ${new Date().toLocaleDateString("es-PE")}`;
          const blob=new Blob([contenido],{type:"text/plain;charset=utf-8"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=url;a.download=`Vista360-Resultados-${vistaHistorica?"Historico":mes}.txt`;a.click();
          URL.revokeObjectURL(url);
        }} style={{background:C.purple,border:"none",borderRadius:11,padding:"10px 16px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          📄 Exportar
        </button>
        {!vistaHistorica&&<button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 18px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Gasto</button>}
      </div>
    </div>

    {/* ── VISTA HISTÓRICA — últimos 6 meses reales ── */}
    {vistaHistorica&&(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          {[
            [`💵 Total Ingresos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.ing,0)),C.green],
            [`📉 Total Gastos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.gas,0)),C.red],
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),C.cyan],
          ].map(([l,v,c])=>(
            <Card key={l} style={{padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
              <div style={{fontSize:26,fontWeight:800,color:c}}>{v}</div>
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
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Mes","Ingresos","Gastos","Utilidad","Margen","PDF",""].map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {historialMeses.map(m=>{
                const mg=m.ing>0?Math.round((m.util/m.ing)*100):0;
                const gastosDelMes=gastos.filter(g=>g.mes===m.key);
                const exportarPDF=(mes,label,ing,gas,util,margen,gastosList)=>{
                  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vista360 - ${label}</title><style>
                    *{box-sizing:border-box}
                    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:50px;color:#0D1421;max-width:900px;margin:0 auto;background:#fff;line-height:1.6}
                    .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #2563EB;margin-bottom:32px;background:linear-gradient(135deg,#f8f9ff 0%,#fff 100%);padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(37,99,235,0.1)}
                    .header-left{display:flex;align-items:center;gap:16px}
                    .header-logo{height:65px;width:auto;filter:drop-shadow(0 2px 4px rgba(37,99,235,0.2))}
                    .header-info h1{margin:0;font-size:26px;color:#0D1421;font-weight:900;letter-spacing:-0.5px}
                    .header-info p{margin:4px 0 0;font-size:14px;color:#2563EB;font-weight:600}
                    .header-fecha{text-align:right;font-size:12px;color:#888;line-height:1.6}
                    .metricas{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0 0 24px}
                    .metrica{background:linear-gradient(135deg,#f8f9ff,#eef2ff);border:2px solid #dde5ff;border-radius:14px;padding:20px;box-shadow:0 2px 6px rgba(37,99,235,0.08);transition:all 0.3s ease}
                    .metrica-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#666;margin-bottom:8px;font-weight:700}
                    .metrica-val{font-size:24px;font-weight:800}
                    .verde{color:#10B981} .rojo{color:#EF4444} .azul{color:#2563EB}
                    .seccion{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2563EB;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #dde5ff}
                    table{width:100%;border-collapse:collapse;margin-top:4px}
                    th{background:#f0f4ff;padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;border-bottom:2px solid #dde5ff}
                    td{padding:10px 14px;border-bottom:1px solid #f0f4ff;font-size:13px}
                    tr:last-child td{border-bottom:none}
                    .total-row td{font-weight:800;background:#f0f4ff;font-size:14px}
                    .estado{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:16px 0;border:1px solid #dde5ff;border-radius:10px;overflow:hidden}
                    .estado-row{display:contents}
                    .estado-row div{padding:9px 14px;font-size:13px;border-bottom:1px solid #f0f4ff}
                    .estado-row div:first-child{background:#f8f9ff;color:#555;font-weight:600}
                    .footer{margin-top:36px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:14px;display:flex;justify-content:space-between;align-items:center}
                    .footer-logo{height:20px;opacity:0.4}
                    @media print{body{padding:20px}.header{break-inside:avoid}}
                  </style></head><body>
                    <div class="header">
                      <div class="header-left">
                        <img class="header-logo" src="${LOGO_B64}" alt="Vista360"/>
                        <div class="header-info">
                          <h1>Estado de Resultados</h1>
                          <p>${label}</p>
                        </div>
                      </div>
                      <div class="header-fecha">
                        <div><strong>Generado:</strong> ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</div>
                        <div><strong>Hora:</strong> ${new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    </div>
                    <div class="metricas">
                      <div class="metrica"><div class="metrica-label">💵 Ingresos cobrados</div><div class="metrica-val verde">${ing}</div></div>
                      <div class="metrica"><div class="metrica-label">📉 Total gastos</div><div class="metrica-val rojo">${gas}</div></div>
                      <div class="metrica"><div class="metrica-label">✅ Utilidad neta</div><div class="metrica-val ${margen>=0?"verde":"rojo"}">${util} <span style="font-size:14px">(${margen}%)</span></div></div>
                    </div>
                    <table>
                      <thead><tr><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead>
                      <tbody>
                        ${gastosList.map(g=>`<tr><td>${g.categoria}</td><td>${g.descripcion}</td><td class="rojo">$${Number(g.monto).toLocaleString("es-EC")}</td></tr>`).join("")}
                        ${gastosList.length===0?`<tr><td colspan="3" style="color:#999;text-align:center">Sin gastos registrados este mes</td></tr>`:""}
                        <tr class="total-row"><td colspan="2">TOTAL GASTOS</td><td class="rojo">${gas}</td></tr>
                      </tbody>
                    </table>
                    <div class="footer"><img class="footer-logo" src="${LOGO_B64}" alt="Vista360"/><span>Vista360 · Gestión de Paneles Publicitarios · ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</span></div>
                  </body></html>`;
                  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement("a");
                  a.href=url;
                  a.download=`Vista360-Resultados-${mes}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                };
                return(
                  <tr key={m.key}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,fontWeight:700,color:C.white,cursor:"pointer"}} onClick={()=>{setMes(m.key);setVistaHistorica(false);}}>{m.label} {m.key===mesHoy&&<Tag color={C.accent} ch="este mes"/>}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:C.green,fontWeight:700}}>{fmt(m.ing)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:C.red,fontWeight:700}}>{fmt(m.gas)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:m.util>=0?C.green:C.red,fontWeight:700}}>{fmt(m.util)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`}}><Tag color={mg>=0?C.green:C.red} ch={`${mg}%`}/></td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`}}>
                      <button onClick={()=>exportarPDF(m.key,m.label,fmt(m.ing),fmt(m.gas),fmt(m.util),mg,gastosDelMes)}
                        style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 12px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                        📄 PDF
                      </button>
                    </td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`}}>
                      <button onClick={async()=>{
                        if(!confirm(`¿Eliminar todos los gastos de ${m.label}? Esta acción no se puede deshacer.`)) return;
                        const ids=gastosDelMes.map(g=>g.id);
                        for(const id of ids) await fb.del("gastos",id);
                        setGastos(prev=>prev.filter(g=>!ids.includes(g.id)));
                      }}
                        style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    )}

    {!vistaHistorica&&(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      {[["💵 Ingresos Cobrados",fmt(ingCob),C.green,"contratos pagados"],["⏳ Por Cobrar",fmt(ingPend),C.amber,"contratos pendientes"],["📉 Total Gastos",fmt(totGastos),C.red,`${gastosMes.length} conceptos`],["✅ Utilidad Neta",fmt(utilidad),utilidad>=0?C.green:C.red,`Margen ${margen}%`]].map(([l,v,c,s])=>(
        <Card key={l} style={{padding:"18px 20px"}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
          <div style={{fontSize:28,fontWeight:800,color:c,letterSpacing:"-1px"}}>{v}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>{s}</div>
        </Card>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr",gap:16,marginBottom:16}}>
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
        <span style={{fontSize:14,fontWeight:700,color:C.white}}>📝 Detalle de Gastos — {new Date(mes+"-02").toLocaleDateString("es-EC",{month:"long",year:"numeric"})}</span>
        <span style={{fontSize:13,color:C.muted}}>{gastosMes.length} conceptos · <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
      {loadG?<Spinner/>:
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:C.surface}}>
          <tr>{["Categoría","Descripción","Monto","Acciones"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {gastosMes.length===0&&<tr><td colSpan={4} style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></td></tr>}
          {gastosMes.map(g=>(
            <tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{transition:"background .15s"}}>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}><Tag color={catCol[g.categoria]||C.muted} ch={g.categoria}/></td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,color:C.text,fontSize:13}}>{g.descripcion}</td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.red}}>{fmt(g.monto)}</td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}><div style={{display:"flex",gap:6}}>
                <button onClick={()=>openEdit(g)} style={{background:C.accent+"22",border:"none",borderRadius:7,padding:"6px 8px",color:C.accent,cursor:"pointer"}}>✏️</button>
                <button onClick={()=>eliminar(g.id)} style={{background:C.red+"22",border:"none",borderRadius:7,padding:"6px 8px",color:C.red,cursor:"pointer"}}>🗑</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>}
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
      new Notification("✅ Vista360 — Alertas activadas",{body:"Te avisaremos 30 días y 15 días antes de cada vencimiento",tag:"bienvenida"});
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
function Gastos({gastos,setGastos}){
  const [mes,setMes]=useState(()=>{const h=new Date();return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`;});
  const [modal,setModal]=useState(null);       // null | "nuevo" | objeto gasto
  const [vistaDetalle,setVistaDetalle]=useState(null); // gasto para vista Khipu
  const [form,setForm]=useState({fecha:"",proveedor:"",ruc:"",concepto:"",monto:"",igv:"",subtotal:"",categoria:"Otro",notas:"",foto_texto:"",moneda:"PEN"});
  const [saving,setSaving]=useState(false);
  const [ocr,setOcr]=useState({loading:false,progress:0,fase:"",text:"",imgUrl:"",previewUrl:""});
  const fileRef=useRef(null);

  const cambiarMes=(delta)=>{
    const [y,m]=mes.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    setMes(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  };
  const mesLabel=(m)=>new Date(m+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase());
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
    await fb.del("gastos",id);
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

  // ── FIELD HELPER ─────────────────────────────────────────────
  const KInp=({label,keyN,type="text",opts=[]})=>(
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
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",backdropFilter:"blur(10px)"}}
        onClick={e=>e.target===e.currentTarget&&setVistaDetalle(null)}>
        <div style={{background:"#FFFFFF",borderRadius:20,width:"100%",maxWidth:860,maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}>

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
                  const fotoSrc=g.fotoUrl||ocr.previewUrl||"";
                  const fotoHtml=fotoSrc?`<div style="text-align:center;margin:20px 0"><img src="${fotoSrc}" style="max-width:100%;max-height:400px;border-radius:10px;border:1px solid #ddd" alt="Boleta"/></div>`:"";
                  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vista360 - Boleta ${g.proveedor||""}</title>
                  <style>*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto;background:#fff}
                  h1{font-size:22px;font-weight:900;margin:0}p{margin:4px 0;color:#2563EB;font-size:14px}
                  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
                  .label{color:#666;font-weight:600}.val{font-weight:700;color:#111}
                  .monto{font-size:32px;font-weight:900;color:#10B981;margin:20px 0}
                  .footer{margin-top:30px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px;text-align:center}
                  @media print{body{padding:20px}}</style></head><body>
                  <h1>Vista360 — Comprobante de Gasto</h1>
                  <p>Generado: ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</p>
                  ${fotoHtml}
                  <div class="monto">${g.moneda==="USD"?"$":"S/"} ${Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</div>
                  <div class="row"><span class="label">Proveedor</span><span class="val">${g.proveedor||"—"}</span></div>
                  <div class="row"><span class="label">RUC</span><span class="val">${g.ruc||"—"}</span></div>
                  <div class="row"><span class="label">Fecha</span><span class="val">${g.fecha||"—"}</span></div>
                  <div class="row"><span class="label">Concepto</span><span class="val">${g.concepto||g.descripcion||"—"}</span></div>
                  <div class="row"><span class="label">Categoría</span><span class="val">${g.categoria||"—"}</span></div>
                  <div class="row"><span class="label">Subtotal</span><span class="val">${g.moneda==="USD"?"$":"S/"} ${Number(g.subtotal||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
                  <div class="row"><span class="label">IGV</span><span class="val">${g.moneda==="USD"?"$":"S/"} ${Number(g.igv||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
                  <div class="row"><span class="label">Moneda</span><span class="val">${g.moneda||"PEN"}</span></div>
                  ${g.notas?`<div class="row"><span class="label">Notas</span><span class="val">${g.notas}</span></div>`:""}
                  <div class="footer">Vista360 · Gestión de Paneles Publicitarios · Firebase</div>
                  </body></html>`;
                  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement("a");
                  a.href=url; a.download=`Boleta-${g.proveedor||g.id}-${g.fecha||"sin-fecha"}.html`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                }} style={{width:"100%",padding:"12px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:12,color:"#1D4ED8",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  📄 Exportar PDF con foto
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
                <KInp label="Monto Total *" keyN="monto" type="number"/>
                <KInp label="Moneda" keyN="moneda" type="select" opts={["PEN","USD","EUR"]}/>
                <KInp label="IGV (18%)" keyN="igv" type="number"/>
                <KInp label="Subtotal / Base" keyN="subtotal" type="number"/>
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
              <KInp label="Categoría *" keyN="categoria" type="select" opts={["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"]}/>
              <KInp label="Concepto / Descripción" keyN="concepto"/>
              <KInp label="Notas internas" keyN="notas"/>
            </div>

            {/* ── SECCIÓN: PROVEEDOR ── */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>Proveedor</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
              <KInp label="Razón Social / Empresa" keyN="proveedor"/>
              <KInp label="RUC (11 dígitos)" keyN="ruc"/>
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

const ICONS={
  dashboard: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  mapa:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  paneles:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  contratos: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  crm:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  resultados:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gastos:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  perfil:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  hoy:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ranking:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  historico: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><polyline points="3 16 3 11 8 11"/></svg>,
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
          <span style={{fontSize:13,color:"#C4B5FD",fontWeight:700}}>Alan</span>
          <span style={{fontSize:15}}>👋</span>
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
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
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
        <button onClick={()=>setTab("ranking")} style={{background:"none",border:"none",color:"rgba(167,139,250,0.7)",fontSize:12,cursor:"pointer",fontWeight:600,padding:0}}>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
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
// 🏆 RANKING DE PANELES
// ══════════════════════════════════════════════════════════════════
function RankingPaneles({paneles,contratos,gastos,setTab}){
  const [vista,setVista]=useState("rentables");

  const stats = useMemo(()=>{
    const hoyD=new Date();
    return paneles.map(p=>{
      const ctrs=contratos.filter(c=>c.panel_id===p.id);
      const ingreso=ctrs.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto),0);
      const gastosP=gastos.filter(g=>g.descripcion?.includes(p.nombre)||g.panel_id===p.id).reduce((a,g)=>a+Number(g.monto),0);
      const utilidad=ingreso-gastosP;

      // días activo / días vacío
      const diasActivo=ctrs.reduce((a,c)=>{
        if(!c.inicio||!c.fin) return a;
        const ini=new Date(c.inicio); const fin=new Date(c.fin);
        return a+Math.max(0,Math.ceil((Math.min(fin,hoyD)-ini)/86400000));
      },0);

      // días vacío = desde primer contrato hasta hoy - días activo
      let diasVacio=0;
      if(ctrs.length>0){
        const primeraFecha=ctrs.filter(c=>c.inicio).reduce((a,c)=>new Date(c.inicio)<a?new Date(c.inicio):a,hoyD);
        const totalDias=Math.ceil((hoyD-primeraFecha)/86400000);
        diasVacio=Math.max(0,totalDias-diasActivo);
      }

      const numContratos=ctrs.length;
      const ocupacionPct=diasActivo+diasVacio>0?Math.round((diasActivo/(diasActivo+diasVacio))*100):0;

      // promedio días por contrato
      const promedDias=numContratos>0?Math.round(diasActivo/numContratos):0;

      // recomendación
      let recomendacion, recoColor, recoIco;
      if(p.estado==="Libre"&&diasVacio>60){
        recomendacion="Bajar precio para atraer clientes";recoColor=C.amber;recoIco="📉";
      } else if(ingreso>0&&ocupacionPct>80&&numContratos>1){
        recomendacion="Subir precio — alta demanda";recoColor=C.green;recoIco="📈";
      } else if(numContratos===0){
        recomendacion="Promocionar — sin contratos aún";recoColor=C.purple;recoIco="📣";
      } else if(diasVacio>30&&p.estado==="Libre"){
        recomendacion="Promocionar en redes sociales";recoColor=C.purple;recoIco="📣";
      } else {
        recomendacion="Mantener precio actual";recoColor=C.cyan;recoIco="✅";
      }

      return {
        ...p,
        ingreso,gastosP,utilidad,
        diasActivo,diasVacio,numContratos,
        ocupacionPct,promedDias,
        recomendacion,recoColor,recoIco,
      };
    });
  },[paneles,contratos,gastos]);

  const ranked = useMemo(()=>{
    if(vista==="rentables") return [...stats].sort((a,b)=>b.utilidad-a.utilidad);
    if(vista==="lentos") return [...stats].sort((a,b)=>b.diasVacio-a.diasVacio);
    if(vista==="rapidos") return [...stats].sort((a,b)=>a.promedDias-b.promedDias||b.numContratos-a.numContratos);
    return stats;
  },[stats,vista]);

  const medals=["🥇","🥈","🥉"];

  return(<div>
    <PgTit icon="🏆" title="Ranking de Paneles" sub="Análisis de rentabilidad, velocidad y recomendaciones"/>

    {/* Selector */}
    <div style={{display:"flex",gap:8,marginBottom:22,background:C.surface,borderRadius:12,padding:6,width:"fit-content"}}>
      {[
        {id:"rentables",label:"💰 Más Rentables"},
        {id:"lentos",label:"🐢 Más Lentos"},
        {id:"rapidos",label:"⚡ Más Rápidos"},
      ].map(v=>(
        <button key={v.id} onClick={()=>setVista(v.id)}
          style={{padding:"8px 18px",borderRadius:9,border:"none",
            background:vista===v.id?"linear-gradient(135deg,rgba(79,124,255,0.3),rgba(155,111,255,0.2))":"transparent",
            color:vista===v.id?C.white:C.muted,
            fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.15s",
            boxShadow:vista===v.id?"0 2px 12px rgba(79,124,255,0.2)":"none",
          }}>
          {v.label}
        </button>
      ))}
    </div>

    {/* Descripción de vista */}
    <div style={{marginBottom:16,padding:"10px 14px",background:C.accent+"0D",border:`1px solid ${C.accent}22`,borderRadius:10,fontSize:13,color:C.muted}}>
      {vista==="rentables"&&"💰 Paneles ordenados por ingreso neto (ingresos cobrados menos gastos asociados)"}
      {vista==="lentos"&&"🐢 Paneles con más días sin contrato — requieren atención o ajuste de precio"}
      {vista==="rapidos"&&"⚡ Paneles con menor tiempo promedio vacío entre contratos — los favoritos del mercado"}
    </div>

    {paneles.length===0?(
      <Card style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:10}}>📡</div>
        <div style={{color:C.muted,fontSize:14}}>Sin paneles registrados</div>
      </Card>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {ranked.map((p,i)=>(
          <Card key={p.id} style={{padding:0,overflow:"hidden"}}>
            <div style={{height:3,background:i===0?`linear-gradient(90deg,${C.amber},${C.green})`:i===1?`linear-gradient(90deg,${C.muted},${C.accent})`:i===2?`linear-gradient(90deg,${C.accent+"88"},${C.purple+"88"})`:C.border}}/>
            <div style={{padding:"18px 20px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
                {/* Rank + emoji */}
                <div style={{width:44,height:44,borderRadius:12,background:i<3?C.amber+"18":C.surface,border:`1px solid ${i<3?C.amber+"44":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:i<3?20:14,fontWeight:800,color:i<3?C.amber:C.muted}}>
                  {i<3?medals[i]:`#${i+1}`}
                </div>
                {/* Nombre + estado */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:20}}>{p.foto}</span>
                    <span style={{fontSize:14,fontWeight:800,color:C.white}}>{p.nombre}</span>
                    <Badge color={p.estado==="Ocupado"?C.red:C.green} ch={p.estado}/>
                    <Tag color={C.muted} ch={p.ciudad}/>
                  </div>
                  {/* Métricas */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
                    {[
                      {label:"Ingresos",val:fmt(p.ingreso),color:C.green},
                      {label:"Utilidad",val:fmt(p.utilidad),color:p.utilidad>=0?C.cyan:C.red},
                      {label:"Ocupación",val:`${p.ocupacionPct}%`,color:p.ocupacionPct>70?C.green:p.ocupacionPct>40?C.amber:C.red},
                      {label:"Días vacío",val:p.diasVacio>900?"N/A":`${p.diasVacio}d`,color:p.diasVacio>60?C.red:p.diasVacio>20?C.amber:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:800,color:m.color}}>{m.val}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2,textTransform:"uppercase",letterSpacing:0.5}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Recomendación */}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${p.recoColor}0D`,border:`1px solid ${p.recoColor}30`,borderRadius:10,marginTop:4}}>
                <span style={{fontSize:18}}>{p.recoIco}</span>
                <div>
                  <div style={{fontSize:11,color:p.recoColor,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Recomendación</div>
                  <div style={{fontSize:13,color:C.text}}>{p.recomendacion}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// 👥 RANKING DE CLIENTES
// ══════════════════════════════════════════════════════════════════
function RankingClientes({clientes,contratos}){
  const [vista,setVista]=useState("ingresos");

  const stats = useMemo(()=>{
    return clientes.filter(c=>c.tipo==="Cliente").map(cl=>{
      const ctrs=contratos.filter(c=>c.cliente_id===cl.id);
      const ingreso=ctrs.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto),0);
      const totalCtrs=ctrs.length;
      // renovaciones = contratos con inicio posterior al primero
      const renovaciones=Math.max(0,totalCtrs-1);
      // pagos tardíos simulados = contratos no pagados / total
      const noPagados=ctrs.filter(c=>!c.pagado).length;
      const tasaPago=totalCtrs>0?Math.round(((totalCtrs-noPagados)/totalCtrs)*100):100;
      // riesgo: inactivo, o baja tasa de pago, o sin renovaciones
      let riesgo="bajo";
      if(cl.estado==="Inactivo"||tasaPago<50) riesgo="alto";
      else if(cl.estado==="Por vencer"||renovaciones===0&&totalCtrs>0) riesgo="medio";
      const promedMensual=totalCtrs>0?Math.round(ctrs.reduce((a,c)=>a+Number(c.monto),0)/totalCtrs):0;
      return {...cl,ingreso,totalCtrs,renovaciones,noPagados,tasaPago,riesgo,promedMensual};
    });
  },[clientes,contratos]);

  const ranked = useMemo(()=>{
    if(vista==="ingresos") return [...stats].sort((a,b)=>b.ingreso-a.ingreso);
    if(vista==="estables") return [...stats].sort((a,b)=>b.renovaciones-a.renovaciones||b.tasaPago-a.tasaPago);
    if(vista==="riesgo") return [...stats].filter(c=>c.riesgo!=="bajo").sort((a,b)=>a.riesgo==="alto"&&b.riesgo!=="alto"?-1:1);
    return stats;
  },[stats,vista]);

  const medals=["🥇","🥈","🥉"];
  const riskColor={alto:C.red,medio:C.amber,bajo:C.green};

  return(<div>
    <SecTit ch="👥 Ranking de Clientes"/>

    {/* Selector */}
    <div style={{display:"flex",gap:8,marginBottom:18,background:C.surface,borderRadius:12,padding:6,width:"fit-content"}}>
      {[
        {id:"ingresos",label:"💰 Por Ingresos"},
        {id:"estables",label:"🔄 Más Estables"},
        {id:"riesgo",label:"⚠️ En Riesgo"},
      ].map(v=>(
        <button key={v.id} onClick={()=>setVista(v.id)}
          style={{padding:"7px 14px",borderRadius:9,border:"none",
            background:vista===v.id?C.accent+"33":"transparent",
            color:vista===v.id?C.white:C.muted,
            fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s",
          }}>
          {v.label}
        </button>
      ))}
    </div>

    {ranked.length===0?(
      <div style={{textAlign:"center",padding:"30px 20px",color:C.muted,fontSize:14}}>
        {vista==="riesgo"?"✅ No hay clientes en riesgo actualmente":"Sin clientes registrados"}
      </div>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {ranked.map((cl,i)=>{
          const ini=cl.empresa.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
          const rankPalette=[
            {from:"#F59E0B",to:"#FCD34D",glow:"rgba(251,191,36,0.6)"},
            {from:"#9CA3AF",to:"#D1D5DB",glow:"rgba(209,213,219,0.4)"},
            {from:"#B45309",to:"#D97706",glow:"rgba(217,119,6,0.5)"},
          ];
          const genericPalette=[
            {from:"#7C3AED",to:"#A855F7",glow:"rgba(124,58,237,0.5)"},
            {from:"#059669",to:"#10B981",glow:"rgba(16,185,129,0.5)"},
            {from:"#2563EB",to:"#60A5FA",glow:"rgba(96,165,250,0.5)"},
            {from:"#DC2626",to:"#F87171",glow:"rgba(248,113,113,0.5)"},
            {from:"#0891B2",to:"#22D3EE",glow:"rgba(34,211,238,0.5)"},
          ];
          const pal=(vista!=="riesgo"&&i<3)?rankPalette[i]:genericPalette[cl.empresa.charCodeAt(0)%genericPalette.length];
          return(
            <div key={cl.id} style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"14px 16px",
              background:C.surface,
              border:`1px solid ${C.border}`,
              borderRadius:12,
              transition:"all 0.15s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"44";e.currentTarget.style.background=C.card;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}
            >
              <div style={{
                width:38,height:38,borderRadius:"50%",flexShrink:0,position:"relative",
                background:`linear-gradient(145deg,${pal.from},${pal.to})`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:vista!=="riesgo"&&i<3?17:12,fontWeight:800,color:"#fff",
                boxShadow:`0 0 0 2px ${pal.from}55, 0 0 16px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                textShadow:"0 1px 3px rgba(0,0,0,0.35)",
              }}>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"linear-gradient(160deg,rgba(255,255,255,0.25) 0%,transparent 55%)",pointerEvents:"none"}}/>
                {vista!=="riesgo"&&i<3?medals[i]:ini}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.white}}>{cl.empresa}</span>
                  <Badge color={eCol(cl.estado)} ch={cl.estado}/>
                  {cl.sector&&<Tag color={C.muted} ch={cl.sector}/>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {[
                    {label:"Ingresos",val:fmt(cl.ingreso),color:C.green},
                    {label:"Contratos",val:cl.totalCtrs,color:C.accent},
                    {label:"Renovaciones",val:cl.renovaciones,color:C.cyan},
                    {label:"Tasa pago",val:`${cl.tasaPago}%`,color:cl.tasaPago>=80?C.green:cl.tasaPago>=50?C.amber:C.red},
                  ].map(m=>(
                    <div key={m.label} style={{background:C.card,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontSize:12,fontWeight:800,color:m.color}}>{m.val}</div>
                      <div style={{fontSize:9,color:C.muted,marginTop:1,textTransform:"uppercase",letterSpacing:0.4}}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Indicador riesgo */}
              <div style={{flexShrink:0,textAlign:"center",minWidth:60}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Riesgo</div>
                <span style={{
                  display:"block",
                  background:riskColor[cl.riesgo]+"22",
                  color:riskColor[cl.riesgo],
                  border:`1px solid ${riskColor[cl.riesgo]}44`,
                  borderRadius:20,padding:"4px 10px",
                  fontSize:11,fontWeight:700,textTransform:"uppercase",
                }}>
                  {cl.riesgo==="alto"?"⚠️ Alto":cl.riesgo==="medio"?"🟡 Medio":"✅ Bajo"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>);
}

// ── Sidebar icon button ──

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════
export default function App(){
  const [splash,setSplash]=useState(true);
  const [showConfig,setShowConfig]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [tab,setTab]=useState("hoy");
  const [clientes,setClientes]=useState([]);
  const [paneles,setPaneles]=useState([]);
  const [contratos,setContratos]=useState([]);
  const [gastos,setGastos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  const noConf = false; // credenciales ya configuradas

  // ── 🔔 PUSH NOTIFICATIONS — Compatible con Chrome, Safari iOS 16.4+, Edge ──
  // Estrategia: Notification API nativa (sin servidor externo).
  // Funciona en celular cuando la app está instalada como PWA (Agregar a inicio).
  // El Service Worker se registra como blob para no necesitar archivo extra.

  const swRef = useRef(null);

  // 1️⃣ Registrar Service Worker una sola vez al montar
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

  // 2️⃣ Revisar contratos y disparar notificaciones cuando hay datos
  useEffect(() => {
    if (!contratos.length || !paneles.length || !clientes.length) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const hoyD  = new Date();
    // Leer qué notificaciones ya enviamos (guardado en localStorage)
    let enviadas = {};
    try { enviadas = JSON.parse(localStorage.getItem("v360_notif") || "{}"); } catch {}

    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin) - hoyD) / 86400000);
      // Disparar a los 30 días y a los 15 días
      [30, 15].forEach(umbral => {
        if (d > 0 && d <= umbral) {
          const key = `${c.id}_${umbral}`;
          if (enviadas[key]) return; // ya enviada

          const panel   = paneles.find(p => p.id === c.panel_id);
          const cliente = clientes.find(cl => cl.id === c.cliente_id);
          if (!panel || !cliente) return;

          // Mostrar notificación nativa
          const titulo = d <= 5
            ? `🚨 Vence en ${d} día${d===1?"":"s"} — ${panel.nombre}`
            : `⚠️ Vence en ${d} días — ${panel.nombre}`;
          const cuerpo = `Cliente: ${cliente.empresa} · ${fmt(c.monto)}/mes`;

          try {
            if (swRef.current && swRef.current.showNotification) {
              // Via Service Worker (mejor soporte en móvil)
              swRef.current.showNotification(titulo, {
                body: cuerpo, tag: key, icon: "/favicon.ico",
                badge: "/favicon.ico", vibrate: [200, 100, 200],
                requireInteraction: d <= 5,
              });
            } else {
              // Fallback: Notification API directa
              new Notification(titulo, { body: cuerpo, tag: key });
            }
            enviadas[key] = true;
          } catch {}
        }
      });
    });

    try { localStorage.setItem("v360_notif", JSON.stringify(enviadas)); } catch {}
  }, [contratos, paneles, clientes]);


  useEffect(()=>{
    Promise.all([
      fb.get("clientes"),
      fb.get("paneles"),
      fb.get("contratos"),
      fb.get("gastos"),
    ]).then(([c,p,ct,g])=>{
      setClientes(Array.isArray(c)?c:[]);
      setPaneles(Array.isArray(p)?p:[]);
      setContratos(Array.isArray(ct)?ct:[]);
      setGastos(Array.isArray(g)?g:[]);
      setLoading(false);
    }).catch(()=>{ setError(true); setLoading(false); });
  },[]);

  const tabs=[
    {id:"hoy",       label:"Menú"},
    {id:"dashboard", label:"Dashboard"},
    {id:"mapa",      label:"Mapa"},
    {id:"paneles",   label:"Paneles"},
    {id:"contratos", label:"Contratos"},
    {id:"historico", label:"Histórico"},
    {id:"crm",       label:"Clientes"},
    {id:"ranking",   label:"Ranking"},
    {id:"resultados",label:"Resultados"},
    {id:"gastos",    label:"Gastos"},
  ];

  const activeTab = showProfile ? "perfil" : tab;

  return(<>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <meta name="theme-color" content="#0A0F1E"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;padding:0;background:#03070F;overflow:hidden;height:100%;-webkit-text-size-adjust:100%}::-webkit-scrollbar{display:none}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{from{opacity:.2}to{opacity:.6}}@keyframes starTwinkle{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}@keyframes dishPulse{0%,100%{opacity:0.35}50%{opacity:0.55}}`}</style>

    {splash&&<Splash done={()=>setSplash(false)}/>}
    {showConfig&&<ModalConfig onClose={()=>setShowConfig(false)}/>}

    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#020510",height:"100dvh",color:C.text,overflow:"hidden",position:"relative"}}>

      {/* ── DEEP SPACE BACKGROUND ── */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 60% 110%,rgba(79,124,255,0.06) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% -10%,rgba(155,111,255,0.08) 0%,transparent 55%)"}}/>
        <div style={{position:"absolute",right:"-8%",top:"5%",width:"52vw",height:"52vw",maxWidth:640,maxHeight:640,borderRadius:"50%",background:"radial-gradient(ellipse at 35% 35%,rgba(79,124,255,0.06) 0%,rgba(155,111,255,0.04) 30%,transparent 70%)",border:"1px solid rgba(79,124,255,0.05)"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(79,124,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(79,124,255,0.02) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
      </div>

      {/* ── LAYOUT: top nav + content ── */}
      {/* paddingTop usa safe-area-inset-top para NO cruzarse con la hora del sistema */}
      <div style={{display:"flex",flexDirection:"column",height:"100dvh",paddingTop:"max(10px, calc(env(safe-area-inset-top) + 6px))",paddingBottom:"max(10px, calc(env(safe-area-inset-bottom) + 6px))",paddingLeft:"10px",paddingRight:"10px",gap:"10px",position:"relative",zIndex:1,boxSizing:"border-box"}}>

      {/* ── TOP NAV BAR ── */}
      <div style={{
        flexShrink:0,
        background:"linear-gradient(175deg,rgba(5,9,22,0.97) 0%,rgba(3,5,14,0.99) 100%)",
        border:"1px solid rgba(79,124,255,0.1)",
        borderRadius:16,
        display:"flex",flexDirection:"row",alignItems:"center",
        zIndex:100,
        position:"relative",
        boxSizing:"border-box",
        boxShadow:"0 4px 24px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
        padding:"6px 8px",
        gap:4,
        overflowX:"auto",
        scrollbarWidth:"none",
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(79,124,255,0.25),rgba(155,111,255,0.15),transparent)",pointerEvents:"none",borderRadius:"16px 16px 0 0"}}/>

        {/* Logo compacto */}
        <div style={{flexShrink:0,paddingRight:8,borderRight:"1px solid rgba(79,124,255,0.12)",marginRight:4,display:"flex",alignItems:"center"}}>
          <Logo360 width={72}/>
        </div>

        {/* Nav items — scrollable horizontal */}
        <div style={{display:"flex",flexDirection:"row",alignItems:"center",gap:2,flex:1,overflowX:"auto",scrollbarWidth:"none"}}>
          {tabs.map(t=>{
            const active=activeTab===t.id;
            return(
              <button key={t.id} onClick={()=>{setTab(t.id);setShowProfile(false);}} title={t.label} style={{
                flexShrink:0,
                display:"flex",flexDirection:"row",alignItems:"center",
                gap:6,padding:"7px 12px",
                background:active
                  ?"linear-gradient(135deg,rgba(79,124,255,0.18) 0%,rgba(123,95,255,0.12) 100%)"
                  :"transparent",
                border:active?"1px solid rgba(79,124,255,0.22)":"1px solid transparent",
                cursor:"pointer",
                color:active?"#FFFFFF":"rgba(255,255,255,0.38)",
                borderRadius:10,
                transition:"all 0.18s ease",
                boxShadow:active?"0 2px 12px rgba(79,124,255,0.15)":"none",
                position:"relative",whiteSpace:"nowrap",
              }}>
                {active&&<div style={{position:"absolute",bottom:0,left:"20%",right:"20%",height:2,background:"linear-gradient(90deg,transparent,#4F7CFF,transparent)",borderRadius:2,pointerEvents:"none"}}/>}
                <span style={{flexShrink:0,display:"flex",alignItems:"center",opacity:active?1:0.55}}>
                  {(()=>{
                    const ic=ICONS[t.id]||ICONS.dashboard;
                    // Scale icons to 16px for top nav
                    return <span style={{display:"flex",transform:"scale(0.72)",transformOrigin:"center"}}>{ic}</span>;
                  })()}
                </span>
                <span style={{fontSize:12,fontWeight:active?700:400,letterSpacing:0.1}}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side: Notif + Profile */}
        <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,paddingLeft:8,borderLeft:"1px solid rgba(79,124,255,0.12)",marginLeft:4}}>
          <button style={{
            display:"flex",alignItems:"center",gap:6,padding:"7px 10px",
            background:"none",border:"none",cursor:"pointer",
            color:"rgba(255,255,255,0.38)",borderRadius:10,position:"relative",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{position:"absolute",top:4,right:6,background:"linear-gradient(135deg,#6B4FFF,#4F7CFF)",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 8px rgba(79,124,255,0.6)"}}>3</span>
          </button>

          <button onClick={()=>setShowProfile(v=>!v)} style={{
            display:"flex",alignItems:"center",gap:8,padding:"5px 10px",
            background:showProfile?"rgba(79,124,255,0.1)":"none",
            border:showProfile?"1px solid rgba(79,124,255,0.18)":"1px solid transparent",
            cursor:"pointer",borderRadius:10,transition:"all 0.15s",
          }}>
            <div style={{
              width:28,height:28,borderRadius:"50%",
              background:"linear-gradient(135deg,#4F46E5,#6B5FFF)",
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,fontSize:10,fontWeight:800,color:"#fff",
              boxShadow:"0 2px 10px rgba(79,70,229,0.35)",
            }}>AM</div>
            <div style={{display:"flex",flexDirection:"column",textAlign:"left",minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.82)",whiteSpace:"nowrap"}}>Alan Mart.</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.28)"}}>Admin ↓</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── CONTENT MODULE ── */}
      <div style={{
        flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",
        background:"linear-gradient(160deg,rgba(7,12,24,0.97) 0%,rgba(4,8,17,0.99) 100%)",
        border:"1px solid rgba(79,124,255,0.09)",
        borderRadius:18,
        boxShadow:"0 8px 48px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.025)",
        backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
        position:"relative",
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(79,124,255,0.18) 30%,rgba(155,111,255,0.12) 60%,transparent 100%)",pointerEvents:"none",borderRadius:"18px 18px 0 0"}}/>
        <main style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"20px 20px 24px",WebkitOverflowScrolling:"touch",scrollBehavior:"smooth"}}>

          {/* ── PERFIL / SISTEMA PAGE ── */}
          {showProfile&&(
            <div>
              {/* Header perfil */}
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,padding:"20px",background:"linear-gradient(135deg,#0E1835,#0A1228)",borderRadius:20,border:"1px solid rgba(59,110,248,0.2)",boxShadow:"0 4px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
                <img src="https://ui-avatars.com/api/?name=Alan+Martinez&background=3B82F6&color=fff&size=64&bold=true" style={{width:64,height:64,borderRadius:"50%",border:"3px solid #3B82F6"}} alt="perfil"/>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>Alan Martínez</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:2}}>Administrador · Vista360</div>
                </div>
              </div>
              {/* Sistema info completa */}
              <Firebase contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos} fbConnected={!error&&!loading} fbLoading={loading} fbError={!!error}/>
            </div>
          )}

          {/* ── TABS NORMALES ── */}
          {!showProfile&&(
            <>
              {error&&(
                <div style={{background:"#1E293B",border:`1px solid ${C.amber}55`,borderRadius:14,padding:20,marginBottom:24,display:"flex",gap:16,alignItems:"flex-start"}}>
                  <div style={{fontSize:28,flexShrink:0}}>⚠️</div>
                  <div>
                    <div style={{fontWeight:700,color:C.amber,fontSize:15,marginBottom:4}}>Sin conexión a Firebase</div>
                    <div style={{fontSize:13,color:C.muted}}>Despliega en Vercel para conectar.</div>
                  </div>
                </div>
              )}
              {tab==="hoy"        &&<Hoy         clientes={clientes} contratos={contratos} paneles={paneles} gastos={gastos} setTab={setTab}/>}
              {tab==="dashboard"  &&<Dashboard  clientes={clientes} contratos={contratos} paneles={paneles} setTab={setTab}/>}
              {tab==="mapa"       &&<Mapa       paneles={paneles} clientes={clientes} contratos={contratos}/>}
              {tab==="paneles"    &&<Paneles    paneles={paneles} setPaneles={setPaneles} loading={loading} setTab={setTab}/>}
              {tab==="contratos"  &&<Contratos  contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} loading={loading} setTab={setTab}/>}
              {tab==="historico"  &&<Historico  contratos={contratos} paneles={paneles} clientes={clientes}/>}
              {tab==="crm"        &&<CRM        clientes={clientes} setClientes={setClientes} contratos={contratos} loading={loading}/>}
              {tab==="ranking"    &&<div><RankingPaneles paneles={paneles} contratos={contratos} gastos={gastos} setTab={setTab}/><div style={{marginTop:28}}><Card><RankingClientes clientes={clientes} contratos={contratos}/></Card></div></div>}
              {tab==="resultados" &&<Resultados contratos={contratos} loading={loading}/>}
              {tab==="gastos"     &&<Gastos     gastos={gastos} setGastos={setGastos}/>}
            </>
          )}
        </main>
      </div>
      </div>{/* end layout wrapper */}
    </div>
  </>);
}
