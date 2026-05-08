
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// 🔥 FIREBASE — Vite + npm (firebase package instalado)
import { initializeApp }    from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCklWQStUPElsRfKH3icUZht-R321zgZY8",
  authDomain:        "base-de-datos-vista360.firebaseapp.com",
  projectId:         "base-de-datos-vista360",
  storageBucket:     "base-de-datos-vista360.firebasestorage.app",
  messagingSenderId: "421479773461",
  appId:             "1:421479773461:web:e38de4bfda177e232be51c"};

// Inicializar Firebase con SDK modular
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

const LOGO_B64 = ""; // logo removido — reemplaza con tu base64 si necesitas logo en PDFs

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
      body: fd});
    if (!resp.ok) throw new Error(`Cloudinary error: ${resp.status}`);
    const data = await resp.json();
    return data.secure_url;
  }};

const ESTADOS_CLI = ["Activo", "Por vencer", "Inactivo"];
const ESTADOS_PRO = ["En contacto", "Propuesta enviada", "Frío", "Perdido"];
const SECTORES    = ["Alimentación","Finanzas","Retail","Telecomunicaciones","Alimentos","Automotriz","Salud","Educación","Otro"];
const CIUDADES    = ["Lima","Arequipa","Trujillo","Chiclayo","Piura","Cusco","Iquitos","Huancayo","Tacna","Pucallpa","Huánuco","Otra"];
const CAT_GASTOS  = ["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"];
const EMOJIS      = ["📡","🏙️","🌆","🛣️","🏬","🔄","🏪","🏢","🌉","🏟️"];

const EMISOR = {
  razonSocial: "VISTA360",
  ruc:         "20615629431",
  direccion:   "Jr. 28 de Julio Nro. 1279, Huánuco, Huánuco",
  ciudad:      "Huánuco",
  actividad:   "Publicidad (CIIU 7310)"};

const hoy   = new Date();
const mesHoy= `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
const dias  = (f) => Math.ceil((new Date(f) - hoy) / 86400000);
const fmt   = (n) => `S/ ${Number(n||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtF  = (s) => s ? new Date(s).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const mesLabel = (m) => new Date(m+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase());

const C = {
  bg:"#0A0F1E", surface:"#0F1628", card:"#131D30", border:"#1C2840",
  accent:"#4F7CFF", green:"#0FBA7D", red:"#F04747", amber:"#F5A623",
  purple:"#9B6FFF", cyan:"#22D3EE", text:"#DCE4F5", muted:"#4E6080", white:"#FFFFFF",
  sidebarBg:"#030814", contentBg:"#080E1C"};
const eCol = (e) => ({"Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,"En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red}[e]||C.muted);
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};

const Badge  = ({color,ch})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ch}</span>;
const Card   = ({children,style={}})=><div style={{background:C.card,border:`1px solid rgba(79,124,255,0.13)`,borderRadius:16,padding:22,...style}}>{children}</div>;
const SecTit = ({ch})=><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:14}}>{ch}</div>;
const PgTit  = ({icon,title,sub})=><div style={{marginBottom:22}}><div style={{fontSize:22,fontWeight:800,color:C.white}}>{icon} {title}</div>{sub&&<div style={{fontSize:13,color:C.muted,marginTop:3}}>{sub}</div>}</div>;
const Spinner= ()=><div style={{textAlign:"center",padding:40,color:C.muted}}>Cargando...</div>;

function ModalConfig({onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
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

const inp = (label,key,form,setForm,opts={})=>{
  const set=(v)=>setForm(f=>({...f,[key]:v}));
  const base={background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:C.muted}}>{label}</label>
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

function Modal({title,onClose,onSave,saveLabel="Guardar ✓",children}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
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
      </div>`});
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
    "Puerto Maldonado":[-12.5931,-69.1893],"Bagua":[-5.6519,-78.5267],"Chepen":[-7.2268,-79.4278]};

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
          lng:f.geometry.coordinates[0]}));
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
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Tipo</div>
                <div style={{fontSize:13,fontWeight:700,color:C.white}}>{p.tipo}</div>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.green}44`,borderRadius:12,padding:"10px 14px",display:"flex",flexDirection:"column",gap:2}}>
                <div style={{fontSize:10,color:C.green,fontWeight:700}}>Precio/mes</div>
                <div style={{fontSize:22,fontWeight:900,color:C.green,lineHeight:1}}>{fmt(p.precio)}</div>
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
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:8}}>Ícono</label>
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
        <div style={{marginTop:12}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:5}}>Dirección</label>
          <div style={{position:"relative"}}>
            <div style={{display:"flex",gap:8}}>
              <input
                value={form.direccion||""}
                onChange={e=>onDireccionChange(e.target.value)}
                placeholder="Av. Javier Prado Este 123, San Isidro…"
                autoComplete="off"
                style={{flex:1,background:C.surface,border:`1px solid ${showSug&&sugerencias.length>0?C.accent:C.border}`,borderRadius:showSug&&sugerencias.length>0?"10px 10px 0 0":"10px",padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit"}}
                onKeyDown={e=>{if(e.key==="Enter"){geocodificar();}if(e.key==="Escape"){setSugerencias([]);setShowSug(false);}}}
                onBlur={()=>setTimeout(()=>setShowSug(false),200)}
                onFocus={()=>sugerencias.length>0&&setShowSug(true)}
              />
              <button onClick={geocodificar} disabled={geocoding}
                style={{padding:"10px 16px",background:geocoding?C.border:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}}>
                {geocoding?"⏳":"📍 Ubicar"}
              </button>
            </div>
            {showSug&&sugerencias.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:56,background:C.card,border:`1px solid ${C.accent}`,borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:999,overflow:"hidden"}}>
                {sugerencias.map((s,i)=>(
                  <div key={i} onMouseDown={()=>elegirSugerencia(s)}
                    style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<sugerencias.length-1?`1px solid ${C.border}`:"none",fontSize:13,color:C.text,display:"flex",alignItems:"center",gap:8}}
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
        {(form.lat||form.lng)&&(
          <div style={{marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:C.muted}}>📌 Ajusta el pin en el mapa</span>
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
    "Otra":     [-9.19,-75.02]};

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
      maxZoom:19}).addTo(map);
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
        iconSize:[52,52],iconAnchor:[26,26]});
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
      <div style={{position:"absolute",top:16,left:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",display:"flex",gap:14,border:`1px solid ${C.border}`}}>
        {[[C.green,"Libre"],[C.red,"Ocupado"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:c}}/>
            <span style={{fontSize:12,color:C.muted,fontWeight:600}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:16,right:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",border:`1px solid ${C.border}`,fontSize:12,color:C.muted,fontWeight:600}}>
        {paneles.length} panel{paneles.length!==1?"es":""}
      </div>

      {!leafletReady&&(
        <div style={{height:560,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,gap:10,background:"#070C18"}}>
          <div style={{width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%"}}/>
          Cargando mapa...
        </div>
      )}
      <div ref={mapRef} style={{height:560,width:"100%",display:leafletReady?"block":"none"}}/>

      {sel&&(()=>{
        const p=sel.panel;
        const info=sel.info;
        const color=p.estado==="Ocupado"?C.red:C.green;
        const contrato=info;
        const diasVence=contrato?Math.ceil((new Date(contrato.fin)-new Date())/86400000):null;
        return(
          <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:500,background:"rgba(7,12,24,0.97)",borderTop:`2px solid ${color}`,padding:"20px 22px 24px",borderRadius:"0 0 20px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:52,height:52,borderRadius:14,background:color+"18",border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {p.foto}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white}}>{p.nombre}</div>
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
            {p.estado==="Ocupado"&&contrato?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[
                    ["💵 Facturando",`${fmt(contrato.monto)}/mes`,C.green],
                    ["🏢 Cliente",contrato.cliente?.empresa||"—",C.white],
                    ["📅 Vence",diasVence>0?`en ${diasVence}d`:`hace ${Math.abs(diasVence)}d`,diasVence>15?C.green:diasVence>0?C.amber:C.red],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:C.card,borderRadius:12,padding:"12px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                      <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:5}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:800,color:c,lineHeight:1.2}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3}}>📆 Período</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.white}}>{fmtF(contrato.inicio)} → {fmtF(contrato.fin)}</div>
                  </div>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3}}>💳 Pago</div>
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
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>{label}</label>
      {children}
    </div>
  );
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const sel={...inp,cursor:"pointer"};

  const pagosMarcados=Object.values(form.pagosMeses||{}).filter(Boolean).length;

  return(<div>
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
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
                          cursor:"pointer",textAlign:"center"
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
                {meses.length>0&&(
                  <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                    {meses.map((m,i)=>{
                      const pag=pm[m.key]||false;
                      return(
                        <button key={m.key} onClick={()=>togglePagoRapido(c,m.key)}
                          style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${pag?C.green:C.border}`,background:pag?C.green+"22":"transparent",cursor:"pointer",fontSize:11,fontWeight:700,color:pag?C.green:C.muted}}>
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
        background:C.accent,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:size*0.42,fontWeight:800,color:"#fff"}}>
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
        background:pal,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:size*0.36,fontWeight:800,color:"#fff"}}>
                {initials}
      </div>
    );
  };

  // Mantener AvatarCRM como alias de AvatarContacto para compatibilidad
  const AvatarCRM=({name,size=32})=><AvatarContacto name={name} size={size}/>;

  const estadoColorCRM=(e)=>({
    "Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,
    "En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red}[e]||C.muted);

  return(<div>
    <style>{`
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      @keyframes drawLine{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      .crm-row-hover:hover{background:rgba(124,58,237,0.05)!important;border-color:rgba(124,58,237,0.2)!important;}
      .crm-chip:hover{background:rgba(255,255,255,0.06)!important;border-color:rgba(255,255,255,0.15)!important;}
      .crm-btn:hover{opacity:0.88;transform:translateY(-1px);}
    `}</style>

    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:26}}>
      <div>
        <h1 style={{fontSize:26,fontWeight:900,color:C.white,marginBottom:4}}>Clientes & Prospectos</h1>
        <p style={{fontSize:13,color:C.muted,fontWeight:500}}>CRM · {clientes.length} contactos</p>
      </div>
      <button className="crm-btn" onClick={openNew} style={{
        display:"flex",alignItems:"center",gap:8,
        background:C.card,
        border:"none",borderRadius:12,padding:"10px 18px",cursor:"pointer",
        color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo contacto
      </button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
      <div style={{background:C.card,border:"1px solid rgba(16,185,129,0.25)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animationDelay:"0.05s"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(16,185,129,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(16,185,129,0.2)",border:"1px solid rgba(16,185,129,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:C.green}}>Clientes</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,lineHeight:1}}>{clis.length}</div>
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
      <div style={{background:C.card,border:"1px solid rgba(124,58,237,0.28)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animationDelay:"0.1s"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(124,58,237,0.15) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.38)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:"#A78BFA"}}>Prospectos</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,lineHeight:1}}>{pros.length}</div>
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
      <div style={{background:C.card,border:"1px solid rgba(245,158,11,0.25)",borderRadius:16,padding:"20px 20px 16px",position:"relative",overflow:"hidden",animationDelay:"0.15s"}}>
        <div style={{position:"absolute",top:"-30%",right:"-10%",width:"60%",height:"120%",background:"radial-gradient(ellipse,rgba(245,158,11,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(245,158,11,0.2)",border:"1px solid rgba(245,158,11,0.38)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:800,color:C.amber}}>Propuestas</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:38,fontWeight:900,color:C.white,lineHeight:1}}>{propuestas.length}</div>
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

    <div style={{display:"flex",gap:12,marginBottom:14,animationDelay:"0.18s"}}>
      <div style={{flex:1,position:"relative"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPage(1);}}
          placeholder="Buscar empresa, contacto, ciudad..."
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px 10px 40px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor="rgba(124,58,237,0.5)"}
          onBlur={e=>e.target.style.borderColor=C.border}/>
      </div>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center",animationDelay:"0.22s"}}>
      {filters.map(f=>{
        const active=activeFilter===f;
        const dot=f==="Activos"?C.green:f==="En riesgo"?C.amber:null;
        return(
          <button key={f} onClick={()=>{setActiveFilter(f);setPage(1);}} className={active?"":"crm-chip"}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,
              border:`1px solid ${active?"rgba(124,58,237,0.5)":C.border}`,
              background:active?C.accent+"22":"rgba(255,255,255,0.03)",
              color:active?C.white:C.muted,fontWeight:active?700:500,
              fontSize:12,cursor:"pointer",fontFamily:"inherit",
            }}
            {dot&&<div style={{width:7,height:7,borderRadius:"50%",background:dot}}/>}
            {f}
          </button>
        );
      })}
      <span style={{marginLeft:"auto",fontSize:12,color:C.muted}}>{filtrado.length} resultado{filtrado.length!==1?"s":""}</span>
    </div>

    {loading?<Spinner/>:
    <div style={{background:"#0E1228",border:`1px solid rgba(255,255,255,0.07)`,borderRadius:16,marginBottom:18,overflow:"hidden",animationDelay:"0.26s"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:700,color:C.white}}>Contactos ({filtrado.length})</span>
        <span style={{fontSize:11,color:C.muted}}>Página {page} de {totalPages}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 110px 130px 110px 90px",padding:"10px 20px",gap:8,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        {[["EMPRESA","#7C3AED"],["TIPO",null],["CIUDAD",null],["SECTOR",null],["ESTADO",null],["CONTACTO",null],["ACCIONES",null]].map(([h,col])=>(
          <div key={h} style={{fontSize:10,fontWeight:800,color:col||C.muted,display:"flex",alignItems:"center",gap:4}}>
            {h}
            {col&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>}
          </div>
        ))}
      </div>
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
                cursor:"pointer",
              <div style={{display:"flex",alignItems:"center",gap:11}}>
                <AvatarEmpresa name={r.empresa} size={34}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:1}}>{r.empresa}</div>
                  <div style={{fontSize:10,color:C.muted}}>{r.ruc?"RUC "+r.ruc:r.email||"—"}</div>
                </div>
              </div>
              <div>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${tc}18`,border:`1px solid ${tc}44`,color:tc,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                  {r.tipo}
                </span>
              </div>
              <div style={{fontSize:12,color:C.muted}}>{r.ciudad||"—"}</div>
              <div style={{fontSize:12,color:C.muted}}>{r.sector||"—"}</div>
              <div>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${ec}18`,border:`1px solid ${ec}44`,color:ec,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                  {r.estado}
                </span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <AvatarContacto name={r.contacto||"?"} size={28}/>
                <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis"}}>{r.contacto||"—"}</div>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>wa(r)} title="WhatsApp" style={{background:"#25D36618",border:"1px solid #25D36630",borderRadius:8,padding:"6px 8px",color:"#25D366",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </button>
                <button onClick={()=>openEdit(r)} title="Editar" style={{background:`${C.accent}18`,border:`1px solid ${C.accent}30`,borderRadius:8,padding:"6px 8px",color:C.accent,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={()=>eliminar(r.id)} title="Eliminar" style={{background:`${C.red}18`,border:`1px solid ${C.red}30`,borderRadius:8,padding:"6px 8px",color:C.red,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          );
        })}
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
                  background:page===n?C.accent:"rgba(255,255,255,0.05)",
                  color:page===n?"#fff":C.muted,fontSize:12,fontWeight:page===n?700:400,fontFamily:"inherit",
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

    <div style={{marginTop:28,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",animationDelay:"0.5s"}}>
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
                        style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 12px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer"}}>
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
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8}}>{l}</div>
          <div style={{fontSize:28,fontWeight:800,color:c}}>{v}</div>
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
          <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(Math.abs(margen),100)}%`,background:margen>=0?C.green:C.red,borderRadius:4}}/></div>
        </div>
      </Card>

      <Card>
        <SecTit ch="🗂 Gastos por Categoría"/>
        {Object.keys(porCat).length===0&&<div style={{color:C.muted,fontSize:13,padding:"16px 0"}}>Sin gastos para este mes</div>}
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
          <div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:C.text,fontWeight:600}}>{cat}</span><span style={{color:catCol[cat]||C.muted,fontWeight:700}}>{fmt(val)}</span></div>
            <div style={{height:6,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(val/catMax)*100}%`,background:catCol[cat]||C.muted,borderRadius:4}}/></div>
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
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:C.surface}}>
          <tr>{["Categoría","Descripción","Monto","Acciones"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {gastosMes.length===0&&<tr><td colSpan={4} style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></td></tr>}
          {gastosMes.map(g=>(
            <tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"} >
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
          <div style={{fontSize:13,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel?.nombre}</div>
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

    <Card style={{marginBottom:16}}>
      <SecTit ch="🔥 Uso de Base de Datos — Firebase Firestore"/>
      {dbStats.loading
        ?<div style={{color:C.muted,fontSize:13}}>Calculando...</div>
        :<div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:C.white}}>Total usado</span>
              <span style={{fontSize:13,fontWeight:800,color:dbPct>80?C.red:dbPct>50?C.amber:C.green}}>{fmtBytes(dbStats.total)} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>de 1 GB</span></span>
            </div>
            <div style={{background:C.border,borderRadius:8,height:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${dbPct}%`,background:dbPct>80?C.red:dbPct>50?C.amber:C.green,borderRadius:8,minWidth:dbPct>0?"6px":"0"}}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{dbPct.toFixed(3)}% del límite gratuito</div>
          </div>
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
          <div style={{marginTop:14,padding:"10px 14px",background:"#0EA5E918",border:"1px solid #0EA5E944",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16}}>ℹ️</span>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              <strong style={{color:C.white}}>Firebase Firestore (Plan Spark gratuito):</strong> 1 GiB almacenamiento · 50,000 lecturas/día · 20,000 escrituras/día · Sin límite de filas.
            </div>
          </div>
        </div>
      }
    </Card>

    <Card style={{marginBottom:16}}>
      <SecTit ch="📸 Cloudinary — Fotos de Boletas"/>
      {storageStats.loading
        ?<div style={{color:C.muted,fontSize:13,display:"flex",gap:8,alignItems:"center"}}><div style={{width:14,height:14,border:`2px solid ${C.border}`,borderTopColor:C.cyan,borderRadius:"50%"}}/>Calculando espacio real...</div>
        :<div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:C.white}}>Storage de imágenes</span>
              <span style={{fontSize:13,fontWeight:800,color:storagePct>80?C.red:storagePct>50?C.amber:C.cyan}}>
                {fmtBytes(storageStats.bytes)} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>de 25 GB</span>
              </span>
            </div>
            <div style={{background:C.border,borderRadius:8,height:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.max(storagePct,storageStats.bytes>0?0.3:0)}%`,background:C.accent,borderRadius:8}}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>
              {storagePct.toFixed(4)}% usado · {storageStats.count} {storageStats.count===1?"foto":"fotos"} de boletas
            </div>
          </div>
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
            <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8}}>🚨 Vencidos — {vencidos.length}</div>
            {vencidos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`Venció hace ${Math.abs(c.d)}d`}/>)}
          </div>}
          {criticos.length>0&&<div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8}}>🔴 Críticos ≤15 días — {criticos.length}</div>
            {criticos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`⚠️ ${c.d}d`}/>)}
          </div>}
          {proximos.length>0&&<div>
            <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:8}}>🟡 Próximos 16-30 días — {proximos.length}</div>
            {proximos.map(c=><AlertRow key={c.id} c={c} color={C.amber} label={`📅 ${c.d}d`}/>)}
          </div>}
        </div>
      }
    </Card>

    <Card>
      <SecTit ch="📲 Notificaciones Push"/>
      <div style={{marginBottom:14,fontSize:13,color:C.muted,lineHeight:1.6}}>
        Recibe alertas automáticas en tu celular <strong style={{color:C.white}}>30 días y 15 días antes</strong> de que venza cada contrato.
      </div>
      {notifPerm==="granted"
        ?<div style={{display:"flex",alignItems:"center",gap:10,background:C.green+"15",border:`1px solid ${C.green}44`,borderRadius:12,padding:"13px 16px"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:C.green,flexShrink:0}}/>
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
            style={{width:"100%",padding:"14px",background:C.accent,border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
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

// GASTOS v47 — OCR Tesseract + Diseño profesional estilo Khipu
// ── FIELD HELPER para Gastos — FUERA del componente para evitar
//    que React destruya el input en cada keystroke (bug teclado iOS)
function GastosKInp({label,keyN,type="text",opts=[],form,setForm}){
  return(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:10,fontWeight:700,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
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

  const delMes=gastos.filter(g=>g.fecha&&g.fecha.startsWith(mes));
  const totalMes=delMes.reduce((a,g)=>a+Number(g.monto||0),0);
  const porCat={};
  delMes.forEach(g=>{const c=g.categoria||"Otro";porCat[c]=(porCat[c]||0)+Number(g.monto||0);});
  const catColor={"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};
  const catIcon={"Mantenimiento":"🔧","Personal":"👤","Transporte":"🚗","Administrativo":"📁","Servicios":"⚡","Marketing":"📢","Otro":"📦"};

    // 1. PRE-PROCESAMIENTO AVANZADO DE IMAGEN (Canvas)
  //    Binarización adaptativa + aumento de contraste + escala de grises
  //    Optimizado para boletas peruanas con fondo grisáceo y sellos
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

    // 2. GOOGLE CLOUD VISION — OCR de alta precisión
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
            imageContext: { languageHints: ["es", "es-PE"] }}]})}
    );

    if (!response.ok) throw new Error(`Google Vision error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const texto = data.responses?.[0]?.fullTextAnnotation?.text || "";
    if (!texto.trim()) throw new Error("No se detectó texto en la imagen.");
    return texto;
  };

    // 3. PIPELINE PRINCIPAL DE ESCANEO
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
        foto_texto:textoRaw}));

    }catch(e){
      setOcr(o=>({...o,loading:false,progress:0,fase:""}));
      alert("Error OCR: "+e.message);
    }
  };

    // 4. EXTRACCIÓN INTELIGENTE CON REGEX — El núcleo del sistema
  //    Reglas ancladas a palabras clave para evitar falsos positivos
    const extraerDatosInteligente=(text)=>{
    // Normalizar: eliminar caracteres basura OCR comunes, unificar espacios
    const t=text
      .replace(/[|¦\[\]{}]/g,"")           // barras y brackets → vacío
      .replace(/[,;](\d{3})/g,".$1")       // coma miles → punto (1,500 → 1.500)
      .replace(/\r/g,"")
      .replace(/[ \t]{2}/g," ");
    const lineas=t.split("\n").map(l=>l.trim()).filter(l=>l.length>0);

        // Busca primero junto a la etiqueta RUC, luego suelta
    const rucConEtiq=t.match(/R\.?U\.?C\.?\s*[:\-]?\s*\b((?:10|15|20)\d{9})\b/i);
    const rucSuelto=t.match(/\b((?:10|15|20)\d{9})\b/);
    const ruc=(rucConEtiq?.[1]||rucSuelto?.[1]||"").trim();

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

        const igvM=t.match(/I\.?G\.?V\.?\s*(?:18%?)?\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i);
    let igv=igvM?parseFloat(igvM[1].replace(",",".")):
              monto?Math.round(Number(monto)/1.18*0.18*100)/100:"";

        const subM=t.match(/(?:SUBTOTAL|BASE\s*IMPONIBLE|V\.?\s*VENTA|VALOR\s*VENTA)\s*[:\-=]?\s*(?:S\/\.?\s*)?([\d]+[.,]\d{1,2})/i);
    let subtotal=subM?parseFloat(subM[1].replace(",",".")):
                 monto&&igv?Math.round((Number(monto)-Number(igv))*100)/100:"";

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

        const skipProv=/^(factura|boleta|ticket|nota|comprobante|ruc|r\.u\.c|fecha|total|subtotal|igv|tax|item|cantidad|precio|descripcion|detalle|cod|nro|n°|serie|copia|gracias|direccion|telefono|email|www|http|nombre\s*de\s*cliente|nombre\s*cl|dni|cliente|ahorraste|tienes|monedero|central|tienda|caja\/turno|cajero)/i;
    const skipCorta=/^[\d\s\.\-\/\*#]{0,5}$/;
    // 1. Razón social explícita (tiene S.A.C, S.A., S.R.L, E.I.R.L)
    const razonSocial=lineas.find(l=>
      /\b(S\.?A\.?C\.?|S\.?A\.?\b|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?)\b/i.test(l)&&l.length>=4
    );
    // 2. Línea en mayúsculas que no sea nombre de persona
    const lineaMayus=!razonSocial&&lineas.find(l=>
      /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s&.]{5}$/.test(l)&&
      !skipProv.test(l)&&!skipCorta.test(l)&&
      !/NOMBRE|CLIENTE|CAJERO|CAJA|BOLETA|TICKET|BLANCO|MARTINEZ|GARCIA|LOPEZ|GONZALEZ/.test(l)
    );
    // 3. Fallback primera línea válida
    const provFallback=lineas.find(l=>
      l.length>=4&&/[a-zA-ZÀ-ÿ]{3}/.test(l)&&
      !skipProv.test(l)&&!skipCorta.test(l)&&!/^\d/.test(l)
    )||"";
    const proveedor=(razonSocial||lineaMayus||provFallback).trim();

        const skipConc=new RegExp(skipProv.source+"|^"+proveedor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
    const concLineas=lineas.filter(l=>
      l.length>=6&&
      /[a-zA-ZÀ-ÿ]{4}/.test(l)&&
      !skipConc.test(l)&&
      !skipCorta.test(l)
    );
    const concepto=concLineas.slice(0,2).join(" — ").substring(0,140);

        const esDolares=/\$|USD|DOLLAR/i.test(t)&&!/S\/|SOLES|PEN/i.test(t);
    const moneda=esDolares?"USD":"PEN";

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

    // 5. GUARDAR / ACTUALIZAR EN SUPABASE
    const guardar=async()=>{
    if(!form.monto) return alert("El monto es obligatorio");
    setSaving(true);
    const descripcion=([form.concepto,form.proveedor].filter(Boolean).join(" — ")||"Sin descripción").substring(0,255);

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
      moneda:     form.moneda||"PEN"};
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

    const Campo=({label,value,mono=false})=>value?(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:3}}>{label}</div>
      <div style={{fontSize:13,color:C.white,fontWeight:mono?600:400,fontFamily:mono?"monospace":"inherit"}}>{value}</div>
    </div>
  ):null;

    // RENDER
    return(<div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){escanear(e.target.files[0]);e.target.value="";}}}/>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <PgTit icon="🧾" title="Gastos" sub="Google Vision OCR · Extracción automática de boletas"/>
      <button onClick={abrirNuevo} style={{background:C.accent,border:"none",borderRadius:12,padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Nuevo</button>
    </div>

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.card,border:"1px solid #1E3050",borderRadius:16,padding:"14px 18px",marginBottom:18}}>
      <button onClick={()=>cambiarMes(-1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(mes)}</div>
        <div style={{fontSize:13,color:C.green,fontWeight:700,marginTop:2}}>{fmt(totalMes)} total · {delMes.length} gastos</div>
      </div>
      <button onClick={()=>cambiarMes(1)} style={{background:"#1E3050",border:"none",borderRadius:8,width:34,height:34,color:C.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
    </div>

    {Object.keys(porCat).length>0&&(
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,tot])=>(
          <div key={cat} style={{background:(catColor[cat]||C.muted)+"18",border:`1px solid ${catColor[cat]||C.muted}33`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,color:catColor[cat]||C.muted,display:"flex",alignItems:"center",gap:5}}>
            {catIcon[cat]||"📦"} {cat} · {fmt(tot)}
          </div>
        ))}
      </div>
    )}

    {delMes.length===0
      ?<div style={{textAlign:"center",padding:"54px 20px",background:C.card,border:"1px solid #1E3050",borderRadius:20}}>
        <div style={{fontSize:48,marginBottom:12}}>🧾</div>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin gastos este mes</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Sube una foto de tu boleta — el OCR extrae todos los datos</div>
        <button onClick={abrirNuevo} style={{background:C.accent,border:"none",borderRadius:12,padding:"11px 28px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Agregar gasto</button>
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {delMes.map(g=>(
          <div key={g.id}
            onClick={()=>setVistaDetalle(g)}
            style={{background:C.card,border:"1px solid #1E3050",borderRadius:16,overflow:"hidden",cursor:"pointer"}}>
            <div style={{height:3,background:catColor[g.categoria]||C.muted}}/>
            <div style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.white,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis"}}>
                    {(g.proveedor||"Sin proveedor").toUpperCase()}
                  </div>
                  {g.ruc&&<div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>RUC {g.ruc}</div>}
                </div>
                <div style={{fontSize:20,fontWeight:900,color:C.green,marginLeft:12,flexShrink:0}}>
                  {g.moneda==="USD"?"$":"S/"}{Number(g.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
              </div>
              {g.concepto&&(
                <div style={{fontSize:12,color:"#94A3B8",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis"}}>{g.concepto}</div>
              )}
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
    {vistaDetalle&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}
        onClick={e=>e.target===e.currentTarget&&setVistaDetalle(null)}>
        <div style={{background:"#FFFFFF",borderRadius:20,width:"100%",maxWidth:860,maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:"1px solid #E5E7EB"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>Gasto</div>
              <div style={{fontSize:17,fontWeight:800,color:"#111827"}}>{vistaDetalle.proveedor||"Sin proveedor"}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{background:"#D1FAE5",color:"#065F46",borderRadius:20,padding:"4px 14px",fontSize:11,fontWeight:700}}>Registrado</span>
              <button onClick={()=>setVistaDetalle(null)} style={{width:30,height:30,borderRadius:"50%",background:"#F3F4F6",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>
          <div style={{display:"flex",gap:0,flex:1,minHeight:0}}>

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
                    <div style={{height:"100%",width:`${ocr.progress}%`,background:C.accent,borderRadius:2}}/>
                  </div>
                </div>
              )}
            </div>

            <div style={{flex:1,padding:"20px 24px",overflowY:"auto"}}>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:"#111827",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #E5E7EB"}}>Datos del Gasto</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>Fecha de Emisión</div>
                    <div style={{fontSize:13,color:"#111827"}}>{vistaDetalle.fecha?new Date(vistaDetalle.fecha+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"}):"—"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>Categoría</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{background:(catColor[vistaDetalle.categoria]||C.muted)+"22",color:catColor[vistaDetalle.categoria]||C.muted,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{catIcon[vistaDetalle.categoria]||"📦"} {vistaDetalle.categoria||"Otro"}</span>
                    </div>
                  </div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>Concepto</div>
                    <div style={{fontSize:13,color:"#111827"}}>{vistaDetalle.concepto||"—"}</div>
                  </div>
                  {vistaDetalle.notas&&(
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>Notas</div>
                      <div style={{fontSize:13,color:"#374151"}}>{vistaDetalle.notas}</div>
                    </div>
                  )}
                </div>
              </div>
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
                      <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>{k}</div>
                      <div style={{fontSize:12,color:"#374151",fontFamily:"monospace"}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,color:"#6B7280",fontWeight:600}}>{vistaDetalle.moneda==="USD"?"USD":"S/"}.</span>
                  <span style={{fontSize:28,fontWeight:900,color:"#111827"}}>
                    {Number(vistaDetalle.monto||0).toLocaleString("es-PE",{minimumFractionDigits:3,maximumFractionDigits:3})}
                  </span>
                </div>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:"#111827",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #E5E7EB"}}>Proveedor</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>Razón Social</div>
                    <div style={{fontSize:13,color:"#111827",fontWeight:600}}>{vistaDetalle.proveedor||"—"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:2}}>RUC</div>
                    <div style={{fontSize:13,color:"#111827",fontFamily:"monospace"}}>{vistaDetalle.ruc||"—"}</div>
                  </div>
                </div>
              </div>
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
    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:450,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>e.target===e.currentTarget&&setModal(null)}>
        <div style={{background:"#0B1324",border:"1px solid #1E3050",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:540,maxHeight:"93vh",overflowY:"auto",paddingBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:6}}>
            <div style={{width:36,height:4,borderRadius:2,background:"#2D4060"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 22px 16px"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.white}}>
              {modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"}
            </div>
            <button onClick={()=>setModal(null)} style={{width:30,height:30,borderRadius:"50%",background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <div style={{padding:"0 22px"}}>
            <div style={{marginBottom:18}}>
              {ocr.imgUrl?(
                <div style={{position:"relative",borderRadius:14,overflow:"hidden",border:"1px solid #1E3050",marginBottom:10}}>
                  <img src={ocr.previewUrl||ocr.imgUrl} alt="boleta" style={{width:"100%",maxHeight:200,objectFit:"contain",background:"#060E1A",display:"block"}}/>
                  {ocr.loading&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(6,14,26,0.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
                      <div style={{width:38,height:38,border:"3px solid #1E3050",borderTopColor:"#3B82F6",borderRadius:"50%"}}/>
                      <div style={{fontSize:12,color:C.white,fontWeight:600,textAlign:"center",padding:"0 20px"}}>{ocr.fase}</div>
                      <div style={{width:160,height:3,background:"#1E3050",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${ocr.progress}%`,background:C.accent,borderRadius:2}}/>
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
            {ocr.text&&!ocr.loading&&(
              <div style={{background:"#10B98112",border:"1px solid #10B98140",borderRadius:10,padding:"9px 13px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
                <span>✅</span>
                <span style={{fontSize:11,color:"#6EE7B7",fontWeight:600}}>Datos extraídos — revisa y corrige si es necesario</span>
              </div>
            )}

            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:10}}>Importes</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <GastosKInp label="Monto Total *" keyN="monto" type="number" form={form} setForm={setForm}/>
                <GastosKInp label="Moneda" keyN="moneda" type="select" opts={["PEN","USD","EUR"]} form={form} setForm={setForm}/>
                <GastosKInp label="IGV (18%)" keyN="igv" type="number" form={form} setForm={setForm}/>
                <GastosKInp label="Subtotal / Base" keyN="subtotal" type="number" form={form} setForm={setForm}/>
              </div>
            </div>

            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:10}}>Datos del Gasto</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:10,fontWeight:700,color:C.muted,display:"block",marginBottom:4}}>Fecha de Emisión *</label>
                <input type="date" value={form.fecha||""} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
                  style={{width:"100%",background:"#0A1020",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:14,outline:"none",boxSizing:"border-box",WebkitAppearance:"none",colorScheme:"dark"}}/>
              </div>
              <GastosKInp label="Categoría *" keyN="categoria" type="select" opts={["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"]} form={form} setForm={setForm}/>
              <GastosKInp label="Concepto / Descripción" keyN="concepto" form={form} setForm={setForm}/>
              <GastosKInp label="Notas internas" keyN="notas" form={form} setForm={setForm}/>
            </div>

            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:10}}>Proveedor</div>
            <div style={{background:"#060E1A",border:"1px solid #1E3050",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
              <GastosKInp label="Razón Social / Empresa" keyN="proveedor" form={form} setForm={setForm}/>
              <GastosKInp label="RUC (11 dígitos)" keyN="ruc" form={form} setForm={setForm}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)} style={{padding:"13px 20px",background:"transparent",border:"1px solid #1E3050",borderRadius:12,color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{flex:1,padding:"13px",background:saving?"#1E3050":C.accent,border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":"0 4px 14px rgba(37,99,235,0.4)"}}>
                {saving?"Guardando...":modal==="nuevo"?"Guardar Gasto ✓":"Actualizar Gasto ✓"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>);
}

// 📚 HISTÓRICO — Registro de paneles alquilados y contratos
function Historico({contratos,paneles,clientes}){
  const [filtro,setFiltro]=useState("todos");
  const hoyD=new Date();

  // Enriquecer contratos con datos de panel y cliente
  const todos=contratos
    .map(c=>({
      ...c,
      d:Math.ceil((new Date(c.fin)-hoyD)/86400000),
      panel:paneles.find(p=>p.id===c.panel_id),
      cliente:clientes.find(cl=>cl.id===c.cliente_id)}))
    .filter(c=>c.panel&&c.cliente)
    .sort((a,b)=>new Date(b.inicio||0)-new Date(a.inicio||0));

  const activos=todos.filter(c=>c.d>0);
  const historicos=todos.filter(c=>c.d<=0);
  const lista=filtro==="activos"?activos:filtro==="historicos"?historicos:todos;

  return(<div>
    <PgTit icon="📚" title="Histórico" sub={`${todos.length} registros · ${activos.length} activos · ${historicos.length} finalizados`}/>
    <div style={{display:"flex",gap:8,marginBottom:20,background:C.surface,borderRadius:12,padding:5,width:"fit-content"}}>
      {[
        {id:"todos",label:`Todos (${todos.length})`},
        {id:"activos",label:`Activos (${activos.length})`},
        {id:"historicos",label:`Finalizados (${historicos.length})`},
      ].map(f=>(
        <button key={f.id} onClick={()=>setFiltro(f.id)}
          style={{padding:"8px 14px",borderRadius:9,border:"none",
            background:filtro===f.id?C.accent+"22":"transparent",
            color:filtro===f.id?C.white:C.muted,
            fontWeight:700,fontSize:12,cursor:"pointer"}}>
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
                    <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Inicio</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{fmtF(c.inicio)}</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:8,padding:"7px 10px"}}>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Fin</div>
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

// 🧾 FACTURACIÓN — Vista360
// Gestión completa de facturas, boletas y cobros

// Utilidades de facturación
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
const EST_FAC = ["Borrador", "Emitida", "Cobrada", "Vencida", "Anulada"];
const EST_FAC_COL = { Borrador: "#4E6080", Emitida: "#4F7CFF", Cobrada: "#0FBA7D", Vencida: "#F04747", Anulada: "#9B6FFF" };

function ModalFactura({ factura, contratos, paneles, clientes, onClose, onSave }) {
  const esNueva = !factura?.id;
  const hoyStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(() => ({
    tipo: "FACTURA",
    serie: "F001",
    numero: "…",   // se reemplaza por auto-incremento
    contrato_id: "",
    cliente_id: "",
    panel_id: "",
    monto: "",
    concepto: "Arrendamiento de Panel Publicitario",
    periodo_inicio: "",
    periodo_fin: "",
    fecha_emision: hoyStr,
    fecha_vencimiento: "",
    estado: "Borrador",
    notas: "",
    ...factura}));

  const s = f => setForm(p => ({ ...p, ...f }));

  // 🔢 Auto-incremento: obtiene el máximo número guardado en Firestore
  useEffect(() => {
    if (!esNueva) return;
    fb.get("facturas").then(todas => {
      const serie = form.tipo === "FACTURA" ? "F001" : "B001";
      const maxNum = todas
        .filter(f => f.serie === serie)
        .reduce((max, f) => Math.max(max, parseInt(f.numero, 10) || 0), 0);
      s({ numero: String(maxNum + 1) });
    }).catch(() => s({ numero: "1" }));
  }, [form.tipo, esNueva]);

  // Auto-complete cuando selecciona contrato
  useEffect(() => {
    if (!form.contrato_id) return;
    const ctr = contratos.find(c => c.id === form.contrato_id);
    if (!ctr) return;
    s({
      cliente_id: ctr.cliente_id || "",
      panel_id: ctr.panel_id || "",
      monto: ctr.monto || "",
      periodo_inicio: ctr.inicio || "",
      periodo_fin: ctr.fin || ""});
  }, [form.contrato_id]);

  // serie siempre sincronizada con tipo
  useEffect(() => {
    if (!esNueva) return;
    s({ serie: form.tipo === "FACTURA" ? "F001" : "B001" });
  }, [form.tipo]);

  const cli = clientes.find(c => c.id === form.cliente_id);
  const pan = paneles.find(p => p.id === form.panel_id);
  const igvRate = isExoneradoIGV(pan?.ciudad || EMISOR.ciudad);
  const { subtotal, igv, exonerado } = calcIGV(Number(form.monto) || 0, igvRate ? 0 : IGV_RATE);

  const inpS = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000096", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.white }}>🧾 {esNueva ? "Nueva Factura" : "Editar Factura"}</div>
          <button onClick={onClose} style={{ background: C.border, border: "none", borderRadius: 8, padding: "5px 11px", color: C.muted, cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["FACTURA", "BOLETA"].map(t => (
            <button key={t} onClick={() => s({ tipo: t })} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${form.tipo === t ? C.accent + "88" : C.border}`, background: form.tipo === t ? C.accent + "22" : C.surface, color: form.tipo === t ? C.accent : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t === "FACTURA" ? "🧾 Factura" : "📄 Boleta"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Serie</label>
              <input value={form.serie} onChange={e => s({ serie: e.target.value })} style={inpS} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>
                Número {esNueva && <span style={{color:C.green,fontSize:10,fontWeight:600,marginLeft:4}}>⚡ auto</span>}
              </label>
              <input value={form.numero} onChange={e => s({ numero: e.target.value })} style={{...inpS, color: esNueva ? C.green : C.text}} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Estado</label>
              <select value={form.estado} onChange={e => s({ estado: e.target.value })} style={inpS}>
                {EST_FAC.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Contrato vinculado (opcional)</label>
            <select value={form.contrato_id} onChange={e => s({ contrato_id: e.target.value })} style={inpS}>
              <option value="">— Sin contrato específico —</option>
              {contratos.map(c => {
                const cli = clientes.find(cl => cl.id === c.cliente_id);
                const pan = paneles.find(p => p.id === c.panel_id);
                return <option key={c.id} value={c.id}>{cli?.empresa || "Cliente"} · {pan?.nombre || "Panel"} · {fmt(c.monto)}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Cliente</label>
            <select value={form.cliente_id} onChange={e => s({ cliente_id: e.target.value })} style={inpS}>
              <option value="">— Selecciona cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Panel publicitario</label>
            <select value={form.panel_id} onChange={e => s({ panel_id: e.target.value })} style={inpS}>
              <option value="">— Selecciona panel —</option>
              {paneles.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.ciudad}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Concepto</label>
            <input value={form.concepto} onChange={e => s({ concepto: e.target.value })} style={inpS} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Período desde</label>
              <input type="date" value={form.periodo_inicio} onChange={e => s({ periodo_inicio: e.target.value })} style={inpS} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Período hasta</label>
              <input type="date" value={form.periodo_fin} onChange={e => s({ periodo_fin: e.target.value })} style={inpS} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Fecha emisión</label>
              <input type="date" value={form.fecha_emision} onChange={e => s({ fecha_emision: e.target.value })} style={inpS} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Fecha vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => s({ fecha_vencimiento: e.target.value })} style={inpS} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Monto total (con IGV) — S/</label>
            <input type="number" value={form.monto} onChange={e => s({ monto: e.target.value })} placeholder="0.00" style={{ ...inpS, fontSize: 18, fontWeight: 800, color: C.green }} />
          </div>
          {Number(form.monto) > 0 && (
            <div style={{ background: C.surface, borderRadius: 12, padding: "12px 16px", border: `1px solid ${exonerado ? C.green : C.border}` }}>
              {exonerado && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 10px", background: C.green + "18", borderRadius: 8, border: `1px solid ${C.green}44` }}>
                  <span style={{ fontSize: 14 }}>🌿</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Exonerado de IGV — Ley Amazonía N° 27037 (Huánuco)</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 6 }}>
                <span>{exonerado ? "Op. Inafecta (sin IGV)" : "Op. Gravada (sin IGV)"}</span>
                <span style={{ fontFamily: "monospace", color: C.text }}>S/ {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: exonerado ? C.green : C.muted, marginBottom: 8 }}>
                <span>IGV ({exonerado ? "0% — Exonerado" : "18%"})</span>
                <span style={{ fontFamily: "monospace", color: exonerado ? C.green : C.text }}>S/ {igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: C.green, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <span>TOTAL</span><span style={{ fontFamily: "monospace" }}>S/ {Number(form.monto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>Notas internas</label>
            <textarea value={form.notas} onChange={e => s({ notas: e.target.value })} rows={2} style={{ ...inpS, resize: "vertical" }} placeholder="Observaciones, referencias de pago..." />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, padding: 12, background: `linear-gradient(135deg,${C.accent},#7B5FFF)`, border: "none", borderRadius: 10, color: C.white, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {esNueva ? "✓ Crear Factura" : "✓ Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDetalleFactura({ factura, contratos, paneles, clientes, onClose, onEdit, onDelete, onCambiarEstado }) {
  const cli = clientes.find(c => c.id === factura.cliente_id);
  const pan = paneles.find(p => p.id === factura.panel_id);
  const ctr = contratos.find(c => c.id === factura.contrato_id);
  const igvRate = isExoneradoIGV(pan?.ciudad || EMISOR.ciudad);
  const { subtotal, igv, exonerado } = calcIGV(Number(factura.monto) || 0, igvRate ? 0 : IGV_RATE);
  const estadoColor = EST_FAC_COL[factura.estado] || C.muted;

    const [enviandoEmail, setEnviandoEmail]   = useState(false);
  const [emailEnviado, setEmailEnviado]     = useState(false);
  const [emailError, setEmailError]         = useState("");
  const [destinatario, setDestinatario]     = useState(cli?.email || "");
  const [showEmailModal, setShowEmailModal] = useState(false);

    const [showPagoModal, setShowPagoModal]   = useState(false);
  const [metodoPago, setMetodoPago]         = useState(factura.metodo_pago || "");
  const [nroOperacion, setNroOperacion]     = useState(factura.nro_operacion || "");
  const [fechaPago, setFechaPago]           = useState(factura.fecha_pago || new Date().toISOString().slice(0,10));
  const [guardandoPago, setGuardandoPago]   = useState(false);

  const METODOS_PAGO = ["Transferencia bancaria","Efectivo","Yape / Plin","Depósito bancario","Cheque","Otro"];

    // Requiere cuenta EmailJS gratuita: https://www.emailjs.com
  // Crear servicio Gmail + template con variables: to_email, to_name,
  // doc_tipo, doc_serie, monto_total, fecha_emision, concepto, emisor_nombre
  const EMAILJS_SERVICE_ID  = "service_vista360";   // ← reemplaza con tu service ID
  const EMAILJS_TEMPLATE_ID = "template_factura";   // ← reemplaza con tu template ID
  const EMAILJS_PUBLIC_KEY  = "TU_PUBLIC_KEY";      // ← reemplaza con tu public key

  const enviarEmail = async () => {
    if (!destinatario.includes("@")) { setEmailError("Email inválido"); return; }
    setEnviandoEmail(true); setEmailError("");
    try {
      // Carga EmailJS dinámicamente (sin npm, gratis)
      if (!window.emailjs) {
        await new Promise((res, rej) => {
          const sc = document.createElement("script");
          sc.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
          sc.onload = res; sc.onerror = rej;
          document.head.appendChild(sc);
        });
        window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      }
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:     destinatario,
        to_name:      cli?.contacto || cli?.empresa || "Cliente",
        doc_tipo:     factura.tipo,
        doc_serie:    `${factura.serie}-${numSerie(factura.numero)}`,
        monto_total:  `S/ ${Number(factura.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}`,
        fecha_emision: factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString("es-PE") : "—",
        fecha_venc:   factura.fecha_vencimiento ? new Date(factura.fecha_vencimiento).toLocaleDateString("es-PE") : "—",
        concepto:     factura.concepto || "Arrendamiento de Panel Publicitario",
        emisor_nombre: EMISOR.razonSocial,
        emisor_ruc:   EMISOR.ruc,
        emisor_dir:   EMISOR.direccion});
      setEmailEnviado(true);
      setShowEmailModal(false);
      // Guardar en Firebase que se envió
      await fb.patch("facturas", factura.id, { email_enviado: true, email_destinatario: destinatario, email_fecha: new Date().toISOString() });
    } catch(e) {
      setEmailError("Error al enviar: " + (e?.text || e?.message || "revisa tu configuración EmailJS"));
    } finally {
      setEnviandoEmail(false);
    }
  };

    const confirmarCobro = async () => {
    if (!metodoPago) { alert("Selecciona el método de pago"); return; }
    setGuardandoPago(true);
    try {
      const payload = {
        estado: "Cobrada",
        metodo_pago: metodoPago,
        nro_operacion: nroOperacion,
        fecha_pago: fechaPago};
      await fb.patch("facturas", factura.id, payload);
      onCambiarEstado("Cobrada");          // actualiza estado padre
      setShowPagoModal(false);
    } catch(e) {
      alert("Error: " + e.message);
    } finally {
      setGuardandoPago(false);
    }
  };

  const generarPDF = () => {
    const s = `${factura.serie}-${numSerie(factura.numero)}`;
    const titulo = `${factura.tipo}-${s}-${(cli?.empresa||"cliente").replace(/\s+/g,"-")}`;
    const igvLabel = exonerado ? "IGV 0% (Exonerado — Ley Amazonía N° 27037)" : "IGV 18%";
    const opLabel  = exonerado ? "Op. Inafecta" : "Valor Venta (sin IGV)";
    const hoyStr   = new Date().toISOString().slice(0,10);

        const DARK_BLUE   = "#0D1B3E";  // cabecera principal
    const MID_BLUE    = "#1A3066";  // degradado secundario
    const ACCENT_BLUE = "#1E4D9B";  // bordes, totales
    const LIGHT_BLUE  = "#D6E4F7";  // fondo secciones claras

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${titulo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:13mm 13mm 13mm 13mm}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px;line-height:1.55}
  .doc{background:#fff;max-width:100%;margin:0 auto}

  .header{
    background:linear-gradient(135deg,${DARK_BLUE} 0%,${MID_BLUE} 60%,${ACCENT_BLUE} 100%);
    color:#fff;padding:22px 28px;
    display:flex;justify-content:space-between;align-items:flex-start;
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
  .header-left{display:flex;flex-direction:column;gap:10px}
  .logo-img{width:140px;height:auto;object-fit:contain;filter:brightness(0) invert(1)}
  .logo-sub{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;opacity:.78;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
  .emisor-data{font-size:10.5px;opacity:.88;margin-top:6px;line-height:1.75;font-style:italic}
  .emisor-data strong{font-style:normal;font-size:11.5px;opacity:1}

  .tipo-doc{text-align:right;min-width:180px}
  .tipo-doc .tipo{font-size:17px;font-weight:900;letter-spacing:.8px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;text-transform:uppercase}
  .tipo-doc .serie{font-size:15px;font-family:'Courier New',monospace;margin-top:4px;opacity:.92;letter-spacing:1px}
  .tipo-doc .fecha{font-size:10.5px;opacity:.78;margin-top:8px;font-style:italic;line-height:1.6}
  .estado-badge{
    display:inline-block;padding:4px 13px;border-radius:4px;font-size:10.5px;font-weight:700;
    margin-top:8px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:.5px;text-transform:uppercase;
    background:${factura.estado==="Cobrada"?"#D1FAE5":factura.estado==="Emitida"?"#DBEAFE":factura.estado==="Vencida"?"#FEE2E2":"#F1F5F9"};
    color:${factura.estado==="Cobrada"?"#065F46":factura.estado==="Emitida"?"#1E40AF":factura.estado==="Vencida"?"#991B1B":"#334155"};
    border:1px solid ${factura.estado==="Cobrada"?"#6EE7B7":factura.estado==="Emitida"?"#93C5FD":factura.estado==="Vencida"?"#FCA5A5":"#CBD5E1"};
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }

  .divider{height:4px;background:linear-gradient(90deg,${ACCENT_BLUE},${DARK_BLUE},${ACCENT_BLUE});-webkit-print-color-adjust:exact;print-color-adjust:exact}

  .body{padding:18px 28px}
  .section{margin-bottom:18px}
  .section-title{
    font-size:9.5px;font-weight:700;color:${ACCENT_BLUE};text-transform:uppercase;
    letter-spacing:1.8px;margin-bottom:8px;padding-bottom:5px;
    border-bottom:2px solid ${ACCENT_BLUE};font-family:'Segoe UI',Helvetica,Arial,sans-serif
  }
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{padding:6px 8px;background:${LIGHT_BLUE};border-radius:3px;border-left:3px solid ${ACCENT_BLUE}}
  .field label{font-size:8.5px;font-weight:700;color:${ACCENT_BLUE};text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:2px;font-family:'Segoe UI',Helvetica,Arial,sans-serif}
  .field .value{font-size:12px;font-weight:600;color:#0f172a;font-family:'Segoe UI',Helvetica,Arial,sans-serif}
  .field .value.mono{font-family:'Courier New',monospace;font-size:11.5px}

  table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1}
  thead th{
    background:${DARK_BLUE};color:#fff;padding:9px 11px;
    font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:left;
    font-family:'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:.6px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
  tbody tr:nth-child(even){background:#F8FAFC}
  tbody td{padding:10px 11px;font-size:12px;color:#1e293b;border-bottom:1px solid #E2E8F0;font-family:'Segoe UI',Helvetica,Arial,sans-serif}

  .totales{display:flex;flex-direction:column;align-items:flex-end;gap:5px;margin-top:14px}
  .tot-row{display:flex;gap:28px;font-size:12px;color:#475569}
  .tot-row .lbl{min-width:200px;text-align:right;font-style:italic}
  .tot-row .val{font-weight:700;color:#1e293b;min-width:110px;text-align:right;font-family:'Courier New',monospace;font-size:12px}
  .total-final{
    display:flex;gap:14px;
    background:linear-gradient(135deg,${DARK_BLUE},${ACCENT_BLUE});
    color:#fff;border-radius:5px;padding:13px 18px;margin-top:10px;align-items:center;
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
  .total-final .lbl{font-size:13px;font-weight:700;flex:1;letter-spacing:.5px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;text-transform:uppercase}
  .total-final .val{font-size:22px;font-weight:900;font-family:'Courier New',monospace;letter-spacing:1px}

  .footer{
    border-top:3px solid ${DARK_BLUE};padding:10px 28px;
    display:flex;justify-content:space-between;align-items:center;
    font-size:9.5px;color:#64748B;margin-top:14px;font-style:italic;
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
  .footer strong{color:${DARK_BLUE};font-style:normal}
  .footer-logo{font-weight:900;color:${DARK_BLUE};font-size:11px;font-style:normal;letter-spacing:-.3px}

  .nota-amazonia{
    display:inline-flex;align-items:center;gap:5px;margin-top:7px;
    background:#ECFDF5;color:#065F46;border-radius:4px;padding:3px 10px;
    font-size:9.5px;font-weight:700;border:1px solid #6EE7B7;
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
</style>
</head>
<body>
<div class="doc">
  <!-- CABECERA -->
  <div class="header">
    <div class="header-left">
      <img class="logo-img" src="${LOGO_B64}" alt="VISTA360"/>
      <div class="logo-sub">Gestión de Paneles Publicitarios</div>
      <div class="emisor-data">
        <strong>RUC: ${EMISOR.ruc}</strong><br/>
        ${EMISOR.razonSocial}<br/>
        ${EMISOR.direccion}<br/>
        Actividad: ${EMISOR.actividad}
        ${exonerado ? `<br/><span class="nota-amazonia">🌿 EXONERADO IGV — LEY AMAZONÍA N° 27037</span>` : ""}
      </div>
    </div>
    <div class="tipo-doc">
      <div class="tipo">${factura.tipo} ELECTRÓNICA</div>
      <div class="serie">${s}</div>
      <div class="fecha">
        Emisión: ${factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"}) : hoyStr}
        ${factura.fecha_vencimiento ? `<br/>Vence: ${new Date(factura.fecha_vencimiento).toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}` : ""}
      </div>
      <div style="margin-top:10px;text-align:right">
        <span class="estado-badge">${factura.estado}</span>
      </div>
    </div>
  </div>
  <div class="divider"></div>

  <!-- CUERPO -->
  <div class="body">
    <!-- Datos del receptor -->
    <div class="section">
      <div class="section-title">Datos del Adquirente / Receptor</div>
      <div class="grid2">
        <div class="field">
          <label>${factura.tipo==="FACTURA"?"Razón Social":"Apellidos y Nombres"}</label>
          <div class="value">${cli?.empresa||"—"}</div>
        </div>
        <div class="field">
          <label>${factura.tipo==="FACTURA"?"RUC":"DNI / CE"}</label>
          <div class="value mono">${cli?.ruc||cli?.dni||"Sin documento"}</div>
        </div>
        <div class="field">
          <label>Contacto</label>
          <div class="value">${cli?.contacto||"—"}</div>
        </div>
        <div class="field">
          <label>Teléfono</label>
          <div class="value mono">${cli?.celular||"—"}</div>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Dirección</label>
          <div class="value">${cli?.direccion||"—"}</div>
        </div>
      </div>
    </div>

    <!-- Detalle del servicio -->
    <div class="section">
      <div class="section-title">Detalle del Servicio</div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center">Cant.</th>
            <th>Descripción</th>
            <th style="width:110px">Período</th>
            <th style="text-align:right;width:115px">V. Unit. S/ IGV</th>
            <th style="text-align:right;width:115px">Total S/ IGV</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;font-weight:700">1</td>
            <td>
              <strong>${factura.concepto||"Arrendamiento de Panel Publicitario"}</strong>
              ${pan?`<br/><span style="font-size:11px;color:#475569;font-style:italic">${pan.nombre}${pan.tipo?" · "+pan.tipo:""}${pan.ciudad?" · "+pan.ciudad:""}</span>`:""}
              ${pan?.direccion?`<br/><span style="font-size:10px;color:#64748B">📍 ${pan.direccion}</span>`:""}
            </td>
            <td style="font-size:11px;color:#475569;white-space:nowrap;font-style:italic">
              ${factura.periodo_inicio?new Date(factura.periodo_inicio).toLocaleDateString("es-PE"):"—"}<br/>
              al ${factura.periodo_fin?new Date(factura.periodo_fin).toLocaleDateString("es-PE"):"—"}
            </td>
            <td style="text-align:right;font-family:'Courier New',monospace;font-weight:600">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</td>
            <td style="text-align:right;font-family:'Courier New',monospace;font-weight:700">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>
      <div class="totales">
        <div class="tot-row"><span class="lbl">${opLabel}</span><span class="val">S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
        <div class="tot-row"><span class="lbl">${igvLabel}</span><span class="val">S/ ${igv.toLocaleString("es-PE",{minimumFractionDigits:2})}</span></div>
        ${exonerado ? `<div class="tot-row" style="font-size:9.5px;color:#059669;margin-top:2px"><span class="lbl" style="color:#059669;font-style:italic">Base legal</span><span style="font-size:10px;color:#059669;min-width:220px;text-align:right;font-family:'Segoe UI',Helvetica,Arial,sans-serif">Art. 13° Ley N° 27037 — Zona Amazónica Huánuco</span></div>` : ""}
        <div class="total-final">
          <span class="lbl">Importe Total a Pagar</span>
          <span class="val">S/ ${Number(factura.monto).toLocaleString("es-PE",{minimumFractionDigits:2})}</span>
        </div>
      </div>
    </div>

    ${factura.notas?`<div class="section"><div class="section-title">Observaciones</div><p style="font-size:12px;color:#475569;line-height:1.7;margin-top:4px;font-style:italic">${factura.notas}</p></div>`:""}
  </div>

  <!-- PIE -->
  <div class="footer">
    <div><span class="footer-logo">VISTA360</span> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
    <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
  </div>
</div>
<script>
  window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };
</script>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      // Fallback: descarga el HTML si el navegador bloqueó el popup
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (<>
    <div style={{ position: "fixed", inset: 0, background: "#00000096", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{factura.tipo}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.white, fontFamily: "monospace" }}>{factura.serie}-{numSerie(factura.numero)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ background: estadoColor + "22", color: estadoColor, border: `1px solid ${estadoColor}44`, borderRadius: 10, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{factura.estado}</span>
            <button onClick={onClose} style={{ background: C.border, border: "none", borderRadius: 8, padding: "5px 11px", color: C.muted, cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        </div>
        <div style={{ background: `linear-gradient(135deg,${C.green}18,${C.green}08)`, border: `1px solid ${C.green}33`, borderRadius: 16, padding: "20px 24px", marginBottom: 20, textAlign: "center" }}>
          {exonerado && (
            <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6}}>
              🌿 EXONERADO IGV — LEY AMAZONÍA N° 27037
            </div>
          )}
          <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>Importe Total</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.green, fontFamily: "monospace"}}>S/ {Number(factura.monto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
            {exonerado
              ? `Op. Inafecta: S/ ${subtotal.toLocaleString("es-PE",{minimumFractionDigits:2})} + IGV S/ 0.00 (exonerado)`
              : `Sub: S/ ${subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })} + IGV S/ ${igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Cliente", val: cli?.empresa || "—" },
            { label: "Panel", val: pan?.nombre || "—" },
            { label: "Emisión", val: factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString("es-PE") : "—" },
            { label: "Vencimiento", val: factura.fecha_vencimiento ? new Date(factura.fecha_vencimiento).toLocaleDateString("es-PE") : "—" },
            { label: "Período", val: factura.periodo_inicio ? `${new Date(factura.periodo_inicio).toLocaleDateString("es-PE")} → ${new Date(factura.periodo_fin || factura.periodo_inicio).toLocaleDateString("es-PE")}` : "—", span: true },
            { label: "Concepto", val: factura.concepto || "—", span: true },
          ].map((f, i) => (
            <div key={i} style={{ gridColumn: f.span ? "1/-1" : undefined, background: C.surface, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.val}</div>
            </div>
          ))}
        </div>

        {factura.notas && (
          <div style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Notas</div>
            <div style={{ fontSize: 13, color: C.muted }}>{factura.notas}</div>
          </div>
        )}

        {factura.metodo_pago && (
          <div style={{ background: C.green+"12", border:`1px solid ${C.green}33`, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.green, marginBottom: 4, fontWeight:700 }}>💳 Pago registrado</div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              <div><span style={{fontSize:11,color:C.muted}}>Método: </span><span style={{fontSize:13,fontWeight:700,color:C.text}}>{factura.metodo_pago}</span></div>
              {factura.nro_operacion && <div><span style={{fontSize:11,color:C.muted}}>N° Op: </span><span style={{fontSize:13,fontWeight:700,color:C.text}}>{factura.nro_operacion}</span></div>}
              {factura.fecha_pago && <div><span style={{fontSize:11,color:C.muted}}>Fecha: </span><span style={{fontSize:13,fontWeight:700,color:C.text}}>{new Date(factura.fecha_pago).toLocaleDateString("es-PE")}</span></div>}
            </div>
          </div>
        )}

        {(factura.email_enviado || emailEnviado) && (
          <div style={{ background: C.accent+"12", border:`1px solid ${C.accent}33`, borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize:12, color:C.accent, fontWeight:700 }}>
            ✉️ Factura enviada por email a {factura.email_destinatario || destinatario}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Cambiar estado</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EST_FAC.filter(e => e !== factura.estado).map(e => (
              <button key={e}
                onClick={() => e === "Cobrada" ? setShowPagoModal(true) : onCambiarEstado(e)}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${EST_FAC_COL[e]}55`, background: EST_FAC_COL[e] + "18", color: EST_FAC_COL[e], fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {e === "Cobrada" ? "💳 Registrar cobro" : `→ ${e}`}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={generarPDF} style={{ flex: 1, padding: 11, background: C.accent + "22", border: `1px solid ${C.accent}44`, borderRadius: 10, color: C.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📥 PDF
          </button>
          <button onClick={() => setShowEmailModal(true)} style={{ flex: 1, padding: 11, background: C.purple+"22", border: `1px solid ${C.purple}44`, borderRadius: 10, color: C.purple, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            ✉️ Enviar email
          </button>
          <button onClick={() => window.open("https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm", "_blank")} style={{ flex: 1, padding: 11, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, color: "#3730A3", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🇵🇪 SUNAT SOL
          </button>
          <button onClick={onEdit} style={{ padding: "11px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            ✏️
          </button>
          <button onClick={onDelete} style={{ padding: "11px 14px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🗑️
          </button>
        </div>
      </div>
    </div>
    {showEmailModal && (
      <div style={{position:"fixed",inset:0,background:"#000000BB",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
        onClick={e=>e.target===e.currentTarget&&setShowEmailModal(false)}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:26,width:"100%",maxWidth:460}}>
          <div style={{fontSize:16,fontWeight:800,color:C.white,marginBottom:16}}>✉️ Enviar factura por email</div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:6}}>Destinatario</label>
            <input type="email" value={destinatario} onChange={e=>setDestinatario(e.target.value)}
              placeholder="correo@cliente.com"
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div style={{background:C.surface,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.muted,lineHeight:1.6}}>
            Se enviará: <strong style={{color:C.text}}>{factura.tipo} {factura.serie}-{numSerie(factura.numero)}</strong> por <strong style={{color:C.text}}>S/ {Number(factura.monto||0).toLocaleString("es-PE",{minimumFractionDigits:2})}</strong>
          </div>
          <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#92400E",lineHeight:1.6}}>
            ⚙️ <strong>Configuración requerida:</strong> edita las constantes <code>EMAILJS_SERVICE_ID</code>, <code>EMAILJS_TEMPLATE_ID</code> y <code>EMAILJS_PUBLIC_KEY</code> en el código. Cuenta EmailJS gratuita: <strong>200 emails/mes</strong>.
          </div>
          {emailError && <div style={{color:C.red,fontSize:12,marginBottom:12,padding:"8px 12px",background:C.red+"15",borderRadius:8}}>{emailError}</div>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowEmailModal(false)} style={{flex:1,padding:12,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
            <button onClick={enviarEmail} disabled={enviandoEmail} style={{flex:2,padding:12,background:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:14,cursor:enviandoEmail?"wait":"pointer",opacity:enviandoEmail?0.7:1}}>
              {enviandoEmail ? "⏳ Enviando…" : "✉️ Enviar ahora"}
            </button>
          </div>
        </div>
      </div>
    )}
    {showPagoModal && (
      <div style={{position:"fixed",inset:0,background:"#000000BB",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
        onClick={e=>e.target===e.currentTarget&&setShowPagoModal(false)}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:26,width:"100%",maxWidth:460}}>
          <div style={{fontSize:16,fontWeight:800,color:C.white,marginBottom:4}}>💳 Registrar cobro</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Factura {factura.serie}-{numSerie(factura.numero)} · {fmt(factura.monto)}</div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:8}}>Método de pago *</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {METODOS_PAGO.map(m=>(
                <button key={m} onClick={()=>setMetodoPago(m)}
                  style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${metodoPago===m?C.green+"88":C.border}`,background:metodoPago===m?C.green+"22":C.surface,color:metodoPago===m?C.green:C.muted,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:6}}>N° operación bancaria (opcional)</label>
            <input value={nroOperacion} onChange={e=>setNroOperacion(e.target.value)} placeholder="Ej: 123456789"
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:6}}>Fecha de pago</label>
            <input type="date" value={fechaPago} onChange={e=>setFechaPago(e.target.value)}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowPagoModal(false)} style={{flex:1,padding:12,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
            <button onClick={confirmarCobro} disabled={guardandoPago} style={{flex:2,padding:12,background:C.accent,border:"none",borderRadius:10,color:"#000",fontWeight:800,fontSize:14,cursor:guardandoPago?"wait":"pointer",opacity:guardandoPago?0.7:1}}>
              {guardandoPago ? "⏳ Guardando…" : "✅ Confirmar cobro"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

function Facturacion({ contratos, paneles, clientes }) {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("lista"); // lista | resumen

  // Cargar facturas desde Firebase
  useEffect(() => {
    fb.get("facturas").then(data => {
      setFacturas(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
        const cli = clientes.find(c => c.id === f.cliente_id);
        const pan = paneles.find(p => p.id === f.panel_id);
        const q = busqueda.toLowerCase();
        if (!(`${f.serie}-${f.numero} ${cli?.empresa || ""} ${pan?.nombre || ""} ${f.concepto || ""}`).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [facturas, filtroEstado, filtroMes, filtroCliente, busqueda]);

  // KPIs
  const kpis = useMemo(() => {
    const all = facturas.filter(f => f.estado !== "Anulada");
    const total = all.reduce((a, f) => a + Number(f.monto || 0), 0);
    const cobradas = all.filter(f => f.estado === "Cobrada").reduce((a, f) => a + Number(f.monto || 0), 0);
    const pendientes = all.filter(f => f.estado === "Emitida").reduce((a, f) => a + Number(f.monto || 0), 0);
    const vencidas = all.filter(f => f.estado === "Vencida").reduce((a, f) => a + Number(f.monto || 0), 0);
    const borradores = all.filter(f => f.estado === "Borrador").length;
    return { total, cobradas, pendientes, vencidas, borradores, count: all.length };
  }, [facturas]);

  // Guardar nueva factura
  const handleSave = async (form) => {
    try {
      const res = await fb.post("facturas", form);
      if (res?.[0]) setFacturas(p => [res[0], ...p]);
      setModalNueva(false);
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  // Actualizar factura
  const handleUpdate = async (form) => {
    try {
      await fb.patch("facturas", form.id, form);
      setFacturas(p => p.map(f => f.id === form.id ? { ...f, ...form } : f));
      setModalEditar(null);
      if (modalDetalle?.id === form.id) setModalDetalle({ ...modalDetalle, ...form });
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
  };

  // Eliminar
  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta factura?")) return;
    try {
      await fb.del("facturas", id);
      setFacturas(p => p.filter(f => f.id !== id));
      setModalDetalle(null);
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // Cambiar estado rápido
  const handleCambiarEstado = async (factura, nuevoEstado) => {
    try {
      await fb.patch("facturas", factura.id, { estado: nuevoEstado });
      const updated = { ...factura, estado: nuevoEstado };
      setFacturas(p => p.map(f => f.id === factura.id ? updated : f));
      if (modalDetalle?.id === factura.id) setModalDetalle(updated);
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // Generar facturas sugeridas desde contratos sin factura
  const contratosSinFactura = useMemo(() => {
    const facturados = new Set(facturas.map(f => f.contrato_id).filter(Boolean));
    return contratos.filter(c => !facturados.has(c.id));
  }, [contratos, facturas]);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PgTit icon="🧾" title="Facturación" sub={`${facturas.length} comprobantes registrados · ${contratosSinFactura.length} contratos pendientes de facturar`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total facturado", val: fmt(kpis.total), color: C.accent, icon: "💳", sub: `${kpis.count} comprobantes` },
          { label: "Cobrado", val: fmt(kpis.cobradas), color: C.green, icon: "✅", sub: `${facturas.filter(f => f.estado === "Cobrada").length} cobradas` },
          { label: "Pendiente cobro", val: fmt(kpis.pendientes), color: C.amber, icon: "⏳", sub: `${facturas.filter(f => f.estado === "Emitida").length} emitidas` },
          { label: "Vencidas", val: fmt(kpis.vencidas), color: C.red, icon: "🚨", sub: `${facturas.filter(f => f.estado === "Vencida").length} sin cobrar` },
        ].map((k, i) => (
          <div key={i} style={{ background: `linear-gradient(135deg,${k.color}12,${k.color}06)`, border: `1px solid ${k.color}30`, borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: k.color, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: k.color, fontFamily: "monospace"}}>{k.val}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.sub}</div>
              </div>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {contratosSinFactura.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.amber}44`, borderRadius: 16, padding: "14px 18px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>
              {contratosSinFactura.length} contrato{contratosSinFactura.length > 1 ? "s" : ""} sin facturar
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {contratosSinFactura.slice(0, 3).map(c => {
              const cli = clientes.find(cl => cl.id === c.cliente_id);
              const pan = paneles.find(p => p.id === c.panel_id);
              return (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{cli?.empresa || "—"}</span>
                    <span style={{ fontSize: 11, color: C.muted }}> · {pan?.nombre || "—"} · {fmt(c.monto)}</span>
                  </div>
                  <button onClick={() => setModalNueva({ tipo: "FACTURA", serie: "F001", numero: "1", contrato_id: c.id, cliente_id: c.cliente_id, panel_id: c.panel_id, monto: c.monto, concepto: "Arrendamiento de Panel Publicitario", periodo_inicio: c.inicio, periodo_fin: c.fin, fecha_emision: new Date().toISOString().slice(0, 10), estado: "Borrador" })}
                    style={{ padding: "5px 12px", background: C.amber + "22", border: `1px solid ${C.amber}44`, borderRadius: 8, color: C.amber, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Facturar →
                  </button>
                </div>
              );
            })}
            {contratosSinFactura.length > 3 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", paddingTop: 4 }}>+{contratosSinFactura.length - 3} más</div>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setModalNueva(true)} style={{ padding: "10px 18px", background: `linear-gradient(135deg,${C.accent},#7B5FFF)`, border: "none", borderRadius: 11, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 16px ${C.accent}44` }}>
          + Nueva Factura
        </button>
        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar por cliente, panel, serie..." style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 12px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
          <option value="Todos">Todos los estados</option>
          {EST_FAC.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 12px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
          {meses.map(m => <option key={m} value={m}>{m === "Todos" ? "Todos los meses" : fmtMes(m)}</option>)}
        </select>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 12px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
          <option value="Todos">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[{ id: "lista", icon: "☰" }, { id: "resumen", icon: "📊" }].map(v => (
            <button key={v.id} onClick={() => setVista(v.id)} style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid ${vista === v.id ? C.accent + "66" : C.border}`, background: vista === v.id ? C.accent + "22" : C.surface, color: vista === v.id ? C.accent : C.muted, fontSize: 14, cursor: "pointer" }}>{v.icon}</button>
          ))}
        </div>
      </div>

      {vista === "resumen" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <Card>
            <SecTit ch="Pipeline de Cobros" />
            {EST_FAC.filter(e => e !== "Anulada").map(est => {
              const facs = facturas.filter(f => f.estado === est);
              const total = facs.reduce((a, f) => a + Number(f.monto || 0), 0);
              const maxT = Math.max(...EST_FAC.filter(e => e !== "Anulada").map(e => facturas.filter(f => f.estado === e).reduce((a, f) => a + Number(f.monto || 0), 0)), 1);
              const col = EST_FAC_COL[est];
              return (
                <div key={est} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{est}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{facs.length} facturas</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: "monospace" }}>{fmt(total)}</span>
                  </div>
                  <div style={{ background: C.border, borderRadius: 6, height: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(total / maxT) * 100}%`, background: col, borderRadius: 6 }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <SecTit ch="Top Clientes" />
            {clientes.map(cli => {
              const facs = facturas.filter(f => f.cliente_id === cli.id && f.estado !== "Anulada");
              if (!facs.length) return null;
              const total = facs.reduce((a, f) => a + Number(f.monto || 0), 0);
              const cobrado = facs.filter(f => f.estado === "Cobrada").reduce((a, f) => a + Number(f.monto || 0), 0);
              const pct = total > 0 ? Math.round((cobrado / total) * 100) : 0;
              return (
                <div key={cli.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 3 }}>{cli.empresa}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ background: C.border, borderRadius: 4, height: 4, flex: 1, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: C.green, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{pct}% cobrado</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{fmt(total)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{facs.length} comp.</div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </Card>
        </div>
      )}

      {vista === "lista" && (
        <>
          {loading ? <Spinner /> : facsFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>
                {facturas.length === 0 ? "No hay facturas aún" : "Sin resultados"}
              </div>
              <div style={{ fontSize: 13 }}>
                {facturas.length === 0 ? "Crea tu primera factura con el botón de arriba" : "Prueba ajustando los filtros"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {facsFiltradas.map(f => {
                const cli = clientes.find(c => c.id === f.cliente_id);
                const pan = paneles.find(p => p.id === f.panel_id);
                const estadoCol = EST_FAC_COL[f.estado] || C.muted;
                const isVencida = f.estado === "Vencida";
                return (
                  <div key={f.id} onClick={() => setModalDetalle(f)}
                    style={{ background: `linear-gradient(135deg,${C.card},${C.surface})`, border: `1px solid ${isVencida ? C.red + "44" : C.border}`, borderRadius: 16, padding: "14px 18px", cursor: "pointer", display: "flex", gap: 14, alignItems: "center" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = estadoCol + "55"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isVencida ? C.red + "44" : C.border; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${C.accent}33,${C.accent}11)`, border: `1px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18 }}>{f.tipo === "FACTURA" ? "🧾" : "📄"}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: C.white }}>{f.serie}-{numSerie(f.numero)}</span>
                        <span style={{ background: estadoCol + "22", color: estadoCol, border: `1px solid ${estadoCol}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{f.estado}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{f.tipo}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{cli?.empresa || "—"}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {pan?.nombre || "—"}
                        {f.fecha_emision ? ` · ${new Date(f.fecha_emision).toLocaleDateString("es-PE")}` : ""}
                        {f.fecha_vencimiento && f.estado !== "Cobrada" ? ` · Vence: ${new Date(f.fecha_vencimiento).toLocaleDateString("es-PE")}` : ""}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: f.estado === "Cobrada" ? C.green : f.estado === "Vencida" ? C.red : C.text, fontFamily: "monospace" }}>
                        {fmt(f.monto)}
                      </div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 6 }}>
                        {EST_FAC.filter(e => e !== f.estado && e !== "Anulada").slice(0, 2).map(e => (
                          <button key={e} onClick={ev => { ev.stopPropagation(); handleCambiarEstado(f, e); }}
                            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${EST_FAC_COL[e]}44`, background: EST_FAC_COL[e] + "18", color: EST_FAC_COL[e], fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                            {e === "Cobrada" ? "✓ Cobrar" : e === "Emitida" ? "Emitir" : e === "Vencida" ? "Vencer" : e}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {facsFiltradas.length > 0 && (
            <div style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>{facsFiltradas.length} comprobante{facsFiltradas.length > 1 ? "s" : ""} mostrados</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.accent, fontFamily: "monospace" }}>
                Total: {fmt(facsFiltradas.reduce((a, f) => a + Number(f.monto || 0), 0))}
              </span>
            </div>
          )}
        </>
      )}
      {(modalNueva === true || typeof modalNueva === "object") && (
        <ModalFactura
          factura={typeof modalNueva === "object" ? modalNueva : null}
          contratos={contratos} paneles={paneles} clientes={clientes}
          onClose={() => setModalNueva(false)}
          onSave={handleSave}
        />
      )}
      {modalEditar && (
        <ModalFactura
          factura={modalEditar}
          contratos={contratos} paneles={paneles} clientes={clientes}
          onClose={() => setModalEditar(null)}
          onSave={handleUpdate}
        />
      )}
      {modalDetalle && (
        <ModalDetalleFactura
          factura={modalDetalle}
          contratos={contratos} paneles={paneles} clientes={clientes}
          onClose={() => setModalDetalle(null)}
          onEdit={() => { setModalEditar(modalDetalle); setModalDetalle(null); }}
          onDelete={() => handleDelete(modalDetalle.id)}
          onCambiarEstado={(e) => handleCambiarEstado(modalDetalle, e)}
        />
      )}
    </div>
  );
}

const ICONS={
  dashboard:"🏠",hoy:"🏠",mapa:"📍",paneles:"📡",contratos:"📋",
  historico:"📊",crm:"👥",ranking:"🏆",resultados:"💰",reportes:"📄",
  gastos:"💸",facturacion:"🧾",perfil:"👤"
};

// 🏆 RANKING DE PANELES
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
    <div style={{marginBottom:16,padding:"18px 20px",background:C.surface,borderRadius:16,border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
        <span style={{fontSize:13,color:C.muted}}>{saludo},</span>
        <span style={{fontSize:13,color:C.accent,fontWeight:700}}>Alan</span>
        <span>👋</span>
      </div>
      <div style={{fontSize:22,fontWeight:900,color:C.white,marginBottom:8}}>Resumen de hoy</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{fechaCap}</div>
      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:C.accent+"18",border:`1px solid ${C.accent}33`,borderRadius:10,padding:"7px 12px"}}>
        <span style={{fontSize:13,fontWeight:700,color:C.accent}}>{insightBadge.txt}</span>
        <span style={{fontSize:11,color:C.muted}}>{insightBadge.sub}</span>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(16,185,129,0.2)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
      }}>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:4,fontWeight:700}}>Ingreso del mes</div>
        <div style={{fontSize:20,fontWeight:900,color:"#10B981",textShadow:"0 0 20px rgba(16,185,129,0.4)"}}>{fmt(ingMes)}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4}}>{contratos.filter(c=>c.pagado).length} de {contratos.length} contratos</div>
      </div>
      <div style={{
        background:"linear-gradient(145deg,rgba(109,40,217,0.28),rgba(79,60,200,0.18))",
        border:"1px solid rgba(139,92,246,0.45)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"80%",height:"80%",background:"radial-gradient(ellipse,rgba(139,92,246,0.2) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(139,92,246,0.25)",border:"1px solid rgba(139,92,246,0.5)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(196,167,255,0.7)",marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Paneles libres</div>
        <div style={{fontSize:28,fontWeight:900,color:"#C4B5FD",textShadow:"0 0 24px rgba(139,92,246,0.7)",position:"relative",zIndex:1}}>{panelLibres}</div>
        <div style={{fontSize:10,color:"rgba(196,167,255,0.55)",marginTop:4,position:"relative",zIndex:1}}>Listos para asignar</div>
      </div>
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(245,166,35,0.28)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"70%",height:"70%",background:"radial-gradient(ellipse,rgba(245,166,35,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(245,166,35,0.18)",border:"1px solid rgba(245,166,35,0.45)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Por cobrar</div>
        <div style={{fontSize:20,fontWeight:900,color:"#F5A623",textShadow:"0 0 20px rgba(245,166,35,0.55)",position:"relative",zIndex:1}}>{fmt(cobPendiente)}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4,position:"relative",zIndex:1}}>{contratos.filter(c=>!c.pagado&&c.inicio?.slice(0,7)<=mesKey&&c.fin?.slice(0,7)>=mesKey).length} de {contratos.length} contratos</div>
      </div>
      <div style={{
        background:"linear-gradient(145deg,rgba(14,24,42,0.95),rgba(8,14,26,0.98))",
        border:"1px solid rgba(240,71,71,0.28)",
        borderRadius:16,padding:"16px 12px",textAlign:"center",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"70%",height:"70%",background:"radial-gradient(ellipse,rgba(240,71,71,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(240,71,71,0.18)",border:"1px solid rgba(240,71,71,0.45)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",position:"relative",zIndex:1}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F04747" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:4,fontWeight:700,position:"relative",zIndex:1}}>Vencen pronto</div>
        <div style={{fontSize:28,fontWeight:900,color:"#F04747",textShadow:"0 0 22px rgba(240,71,71,0.6)",position:"relative",zIndex:1}}>{vence7}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4,position:"relative",zIndex:1}}>Próximos 30 días</div>
      </div>
    </div>
    <div style={{
      background:"linear-gradient(145deg,rgba(10,18,34,0.97),rgba(6,10,20,0.99))",
      border:"1px solid rgba(79,124,255,0.14)",
      borderRadius:18,padding:"18px 18px",marginBottom:16,
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{fontSize:15,fontWeight:800,color:"#FFFFFF"}}>Acciones recomendadas para hoy</span>
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
                borderRadius:14,cursor:"pointer",
              }}
                onClick={()=>setTab(a.tab)}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${a.color}44`;e.currentTarget.style.background=`linear-gradient(135deg,${a.color}0A,rgba(10,18,32,0.95))`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(79,124,255,0.12)";e.currentTarget.style.background="linear-gradient(135deg,rgba(14,24,42,0.9),rgba(10,18,32,0.95))";}}
              >
                <div style={{
                  width:40,height:40,borderRadius:12,flexShrink:0,
                  background:`linear-gradient(135deg,${a.color}28,${a.color}18)`,
                  border:`1px solid ${a.color}40`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:a.color,
                }}>
                  {iconSvg}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#FFFFFF",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis"}}>{a.titulo}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.42)",overflow:"hidden",textOverflow:"ellipsis"}}>{a.desc}</div>
                </div>
                <span style={{
                  flexShrink:0,fontSize:10,fontWeight:800,
                  background:a.prioridad==="alta"?"rgba(240,71,71,0.2)":a.prioridad==="media"?"rgba(245,166,35,0.15)":"rgba(79,124,255,0.15)",
                  color:a.prioridad==="alta"?"#F04747":a.prioridad==="media"?"#F5A623":"#7B9FFF",
                  border:`1px solid ${a.prioridad==="alta"?"rgba(240,71,71,0.4)":a.prioridad==="media"?"rgba(245,166,35,0.3)":"rgba(79,124,255,0.3)"}`,
                  borderRadius:20,padding:"3px 9px",
                  marginRight:6,
                }}>{a.prioridad}</span>
                <button
                  onClick={e=>{e.stopPropagation();setTab(a.tab);}}
                  style={{
                    flexShrink:0,
                    background:"linear-gradient(135deg,rgba(79,124,255,0.25),rgba(124,58,237,0.2))",
                    border:"1px solid rgba(139,92,246,0.35)",
                    borderRadius:10,padding:"7px 13px",
                    color:"#C4B5FD",fontWeight:700,fontSize:12,
                    cursor:"pointer",
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
          display:"flex",alignItems:"center",gap:20,
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,124,255,0.3))",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <span style={{fontSize:15,fontWeight:800,color:"#FFFFFF"}}>Resumen inteligente</span>
              {ocupPct===100&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:"auto"}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(196,167,255,0.8)",marginBottom:6}}>{titulo}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.62)",lineHeight:1.7,marginBottom:10}}>{mensaje}</div>
            <div style={{fontSize:26,fontWeight:900,color:C.green,textShadow:`0 0 24px ${C.green}55`,marginBottom:14}}>
              {subtitulo}
            </div>
            <button
              onClick={()=>setTab("resultados")}
              style={{
                background:"none",border:"1px solid rgba(139,92,246,0.35)",
                borderRadius:10,padding:"8px 16px",
                color:"rgba(167,139,250,0.8)",fontWeight:600,fontSize:12,
                cursor:"pointer",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(124,58,237,0.18)";e.currentTarget.style.color="#C4B5FD";}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="rgba(167,139,250,0.8)";}}
            >
              Ver proyección completa →
            </button>
          </div>
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
    <div>
      <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:12}}>Accesos rápidos</div>
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
            cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
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

    {vistaHistorica&&(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          {[
            [`💵 Total Ingresos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.ing,0)),C.green],
            [`📉 Total Gastos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.gas,0)),C.red],
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),C.cyan],
          ].map(([l,v,c])=>(
            <Card key={l} style={{padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8}}>{l}</div>
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
            <thead><tr>{["Mes","Ingresos","Gastos","Utilidad","Margen","PDF",""].map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
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
                        ${gastosList.map(g=>`<tr><td>${g.categoria}</td><td>${g.descripcion}</td><td class="rojo">$${Number(g.monto).toLocaleString("es-PE")}</td></tr>`).join("")}
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
                        style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 12px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer"}}>
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
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8}}>{l}</div>
          <div style={{fontSize:28,fontWeight:800,color:c}}>{v}</div>
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
          <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(Math.abs(margen),100)}%`,background:margen>=0?C.green:C.red,borderRadius:4}}/></div>
        </div>
      </Card>

      <Card>
        <SecTit ch="🗂 Gastos por Categoría"/>
        {Object.keys(porCat).length===0&&<div style={{color:C.muted,fontSize:13,padding:"16px 0"}}>Sin gastos para este mes</div>}
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
          <div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:C.text,fontWeight:600}}>{cat}</span><span style={{color:catCol[cat]||C.muted,fontWeight:700}}>{fmt(val)}</span></div>
            <div style={{height:6,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(val/catMax)*100}%`,background:catCol[cat]||C.muted,borderRadius:4}}/></div>
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
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:C.surface}}>
          <tr>{["Categoría","Descripción","Monto","Acciones"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {gastosMes.length===0&&<tr><td colSpan={4} style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></td></tr>}
          {gastosMes.map(g=>(
            <tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{}}>
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
        recomendacion,recoColor,recoIco};
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
    <div style={{display:"flex",gap:8,marginBottom:22,background:C.surface,borderRadius:12,padding:6,width:"fit-content"}}>
      {[
        {id:"rentables",label:"💰 Más Rentables"},
        {id:"lentos",label:"🐢 Más Lentos"},
        {id:"rapidos",label:"⚡ Más Rápidos"},
      ].map(v=>(
        <button key={v.id} onClick={()=>setVista(v.id)}
          style={{padding:"8px 18px",borderRadius:9,border:"none",
            background:vista===v.id?C.accent+"22":"transparent",
            color:vista===v.id?C.white:C.muted,
            fontWeight:700,fontSize:13,cursor:"pointer",
          {v.label}
        </button>
      ))}
    </div>
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
                <div style={{width:44,height:44,borderRadius:12,background:i<3?C.amber+"18":C.surface,border:`1px solid ${i<3?C.amber+"44":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:i<3?20:14,fontWeight:800,color:i<3?C.amber:C.muted}}>
                  {i<3?medals[i]:`#${i+1}`}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:20}}>{p.foto}</span>
                    <span style={{fontSize:14,fontWeight:800,color:C.white}}>{p.nombre}</span>
                    <Badge color={p.estado==="Ocupado"?C.red:C.green} ch={p.estado}/>
                    <Tag color={C.muted} ch={p.ciudad}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
                    {[
                      {label:"Ingresos",val:fmt(p.ingreso),color:C.green},
                      {label:"Utilidad",val:fmt(p.utilidad),color:p.utilidad>=0?C.cyan:C.red},
                      {label:"Ocupación",val:`${p.ocupacionPct}%`,color:p.ocupacionPct>70?C.green:p.ocupacionPct>40?C.amber:C.red},
                      {label:"Días vacío",val:p.diasVacio>900?"N/A":`${p.diasVacio}d`,color:p.diasVacio>60?C.red:p.diasVacio>20?C.amber:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:800,color:m.color}}>{m.val}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${p.recoColor}0D`,border:`1px solid ${p.recoColor}30`,borderRadius:10,marginTop:4}}>
                <span style={{fontSize:18}}>{p.recoIco}</span>
                <div>
                  <div style={{fontSize:11,color:p.recoColor,fontWeight:700,marginBottom:2}}>Recomendación</div>
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

// 👥 RANKING DE CLIENTES
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
            fontWeight:700,fontSize:12,cursor:"pointer"}}>
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
              borderRadius:12}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"44";e.currentTarget.style.background=C.card;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}
            >
              <div style={{
                width:38,height:38,borderRadius:"50%",flexShrink:0,position:"relative",
                background:C.card,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:vista!=="riesgo"&&i<3?17:12,fontWeight:800,color:"#fff",
                textShadow:"0 1px 3px rgba(0,0,0,0.35)"}}>
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
                      <div style={{fontSize:9,color:C.muted,marginTop:1}}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flexShrink:0,textAlign:"center",minWidth:60}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4}}>Riesgo</div>
                <span style={{
                  display:"block",
                  background:riskColor[cl.riesgo]+"22",
                  color:riskColor[cl.riesgo],
                  border:`1px solid ${riskColor[cl.riesgo]}44`,
                  borderRadius:20,padding:"4px 10px",
                  fontSize:11,fontWeight:700}}>
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

// 📊 REPORTES — Vista360
const Bar = ({val,max,color=C.accent}) => (
  <div style={{background:C.border,borderRadius:6,height:6,overflow:"hidden",marginTop:4}}>
    <div style={{height:"100%",width:`${max>0?Math.min(100,(val/max)*100):0}%`,background:color,borderRadius:6}}/>
  </div>
);

// 🧾 GENERADOR DE COMPROBANTE PDF — Vista360 Perú
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
<title>${tipo} ${s}-${numPad} — Vista360</title>
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
      <div class="logo-sub">Gestión de Paneles Publicitarios</div>
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
    <div><strong>Vista360</strong> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
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
    width:"100%", boxSizing:"border-box", fontFamily:"inherit"};

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
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>RUC {EMISOR.ruc} · Vista360 · Huánuco</div>
          </div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",
            background:"#1E3050",border:"none",color:C.muted,cursor:"pointer",
            fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{padding:"0 22px",display:"flex",flexDirection:"column",gap:16}}>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8}}>Tipo de Comprobante</div>
            <div style={{display:"flex",gap:8}}>
              {["FACTURA","BOLETA"].map(t=>(
                <button key={t} onClick={()=>{setTipo(t);setSerie(t==="FACTURA"?"F001":"B001");}}
                  style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",
                    border:`1px solid ${tipo===t?C.accent+"66":C.border}`,
                    background:tipo===t?C.accent+"18":"transparent",
                    color:tipo===t?C.white:C.muted,fontWeight:700,fontSize:13}}>
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
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>Serie</div>
              <input value={serie} onChange={e=>setSerie(e.target.value.toUpperCase())} style={inpStyle} placeholder="F001"/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>Número</div>
              <input value={numero} onChange={e=>setNumero(e.target.value.replace(/\D/g,""))} style={inpStyle} placeholder="1"/>
            </div>
          </div>

          <div style={{background:C.surface,border:`1px solid ${exonerado ? C.green : C.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:10}}>Resumen del Comprobante</div>
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
              background:C.accent,border:"none",
              borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>
              📄 Descargar PDF
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// 📊 MÓDULO PRINCIPAL — REPORTES
function Reportes({ contratos, paneles, clientes, gastos }) {
  const [seccion, setSeccion] = useState("resumen");
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [modalFactura, setModalFactura] = useState(null); // {contrato, panel, cliente}

    const meses = useMemo(() => {
    const set = new Set();
    contratos.forEach(c => {
      if (c.inicio) set.add(c.inicio.slice(0,7));
      if (c.fin)    set.add(c.fin.slice(0,7));
    });
    gastos.forEach(g => { if (g.fecha) set.add(g.fecha.slice(0,7)); });
    return [...set].sort().reverse();
  }, [contratos, gastos]);

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
    const panelesMes      = paneles.length > 0 ? Math.round(mesesAnio.reduce((a,m)=>a+m.contrActivos,0)/12) : 0;
    return { totalIngPagado, totalIngTotal, totalGastos, totalUtilidad, pendiente, mesTop, panelesMes };
  }, [mesesAnio, paneles]);

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
      .map(c => ({
        ...c,
        panel:  paneles.find(p=>p.id===c.panel_id),
        cliente:clientes.find(cl=>cl.id===c.cliente_id)}))
      .filter(c=>c.panel&&c.cliente)
      .sort((a,b)=>new Date(b.inicio||0)-new Date(a.inicio||0));
  }, [contratos, paneles, clientes]);

    const secciones = [
    {id:"resumen",   label:"📊 Resumen"},
    {id:"mensual",   label:"📅 Por Mes"},
    {id:"paneles",   label:"🖥️ Paneles"},
    {id:"prefactura",label:"🧾 Comprobantes"},
  ];

  const inpStyle = {
    background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
    padding:"7px 12px", color:C.text, fontSize:13, outline:"none"};

  return (
    <div>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:22,fontWeight:800,color:C.white}}>
          📊 Reportes & Facturación
        </div>
        <div style={{fontSize:13,color:C.muted,marginTop:3}}>
          Análisis financiero · RUC {EMISOR.ruc} · Vista360 Huánuco
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:22,background:C.surface,
        borderRadius:12,padding:5,overflowX:"auto",scrollbarWidth:"none"}}>
        {secciones.map(s=>(
          <button key={s.id} onClick={()=>setSeccion(s.id)} style={{
            flexShrink:0,padding:"8px 14px",borderRadius:9,border:"none",cursor:"pointer",
            background:seccion===s.id?C.accent+"22":"transparent",
            color:seccion===s.id?C.white:C.muted,
            fontWeight:700,fontSize:12,
            {s.label}
          </button>
        ))}
      </div>

      {seccion==="resumen" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <button onClick={()=>setAnio(a=>a-1)} style={{...inpStyle,cursor:"pointer",padding:"7px 14px",width:"auto"}}>◀</button>
            <div style={{fontSize:18,fontWeight:800,color:C.white}}>{anio}</div>
            <button onClick={()=>setAnio(a=>a+1)} style={{...inpStyle,cursor:"pointer",padding:"7px 14px",width:"auto"}}>▶</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
            {[
              {label:"Ingresos cobrados",val:fmt(kpis.totalIngPagado),color:C.green,icon:"💰",sub:"Contratos pagados"},
              {label:"Por cobrar",val:fmt(kpis.pendiente),color:C.amber,icon:"⏳",sub:"Contratos pendientes"},
              {label:"Gastos totales",val:fmt(kpis.totalGastos),color:C.red,icon:"💸",sub:"Todos los gastos"},
              {label:"Utilidad neta",val:fmt(kpis.totalUtilidad),color:kpis.totalUtilidad>=0?C.green:C.red,icon:"📈",sub:"Cobrado − Gastos"},
            ].map(({label,val,color,icon,sub})=>(
              <Card key={label} style={{padding:"16px 18px"}}>
                <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:4}}>{label}</div>
                <div style={{fontSize:19,fontWeight:900,color}}>{val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>
              </Card>
            ))}
          </div>
          <Card style={{marginBottom:16}}>
            <SecTit ch="📊 Ingresos mensuales — barras"/>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,padding:"8px 0"}}>
              {mesesAnio.map(m => {
                const hIngPag  = maxIngreso > 0 ? Math.max(4, (m.ingPagado / maxIngreso) * 100) : 4;
                const hIngTot  = maxIngreso > 0 ? Math.max(4, (m.ingTotal  / maxIngreso) * 100) : 4;
                return (
                  <div key={m.mes} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:100,gap:2,position:"relative"}}>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,
                        height:`${hIngTot}%`,background:C.accent+"22",borderRadius:"4px 4px 0 0"}}/>
                      <div style={{position:"absolute",bottom:0,left:"15%",right:"15%",
                        height:`${hIngPag}%`,
                        background:m.ingPagado>0?`linear-gradient(180deg,${C.green},${C.green}99)`:C.border,
                        borderRadius:"4px 4px 0 0",
                    </div>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700}}>{m.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:C.green}}/>
                <span style={{fontSize:11,color:C.muted}}>Cobrado</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:C.accent+"44"}}/>
                <span style={{fontSize:11,color:C.muted}}>Facturado (total)</span>
              </div>
            </div>
          </Card>
          {kpis.mesTop && kpis.mesTop.ingPagado > 0 && (
            <Card>
              <SecTit ch="🏆 Mejor mes del año"/>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:12,background:C.amber+"18",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🏆</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white}}>{mesLabel(kpis.mesTop.mes)}</div>
                  <div style={{fontSize:22,fontWeight:900,color:C.amber}}>{fmt(kpis.mesTop.ingPagado)}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{kpis.mesTop.contrActivos} contrato(s) activos</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {seccion==="mensual" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <button onClick={()=>setAnio(a=>a-1)} style={{...inpStyle,cursor:"pointer",padding:"7px 14px",width:"auto"}}>◀</button>
            <div style={{fontSize:18,fontWeight:800,color:C.white}}>{anio}</div>
            <button onClick={()=>setAnio(a=>a+1)} style={{...inpStyle,cursor:"pointer",padding:"7px 14px",width:"auto"}}>▶</button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...mesesAnio].reverse().map(m => (
              <Card key={m.mes} style={{padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.white}}>{mesLabel(m.mes)}</div>
                  <div style={{display:"flex",gap:6}}>
                    {m.ingTotal>0&&<span style={{background:C.green+"18",color:C.green,border:`1px solid ${C.green}33`,
                      borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>
                      {m.contrActivos} contrato{m.contrActivos!==1?"s":""}
                    </span>}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[
                    {l:"Cobrado",v:fmt(m.ingPagado),c:C.green},
                    {l:"Gastos",v:fmt(m.gastosMes),c:C.red},
                    {l:"Utilidad",v:fmt(m.utilidad),c:m.utilidad>=0?C.green:C.red},
                  ].map(({l,v,c})=>(
                    <div key={l} style={{background:C.surface,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
                {m.ingTotal > 0 && (
                  <div style={{marginTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:C.muted}}>Cobrado / Total facturado</span>
                      <span style={{fontSize:10,color:C.muted,fontWeight:700}}>
                        {m.ingTotal>0?Math.round((m.ingPagado/m.ingTotal)*100):0}%
                      </span>
                    </div>
                    <Bar val={m.ingPagado} max={m.ingTotal} color={C.green}/>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {seccion==="paneles" && (
        <div>
          <div style={{marginBottom:16,fontSize:13,color:C.muted}}>
            Rentabilidad acumulada por panel — todos los tiempos
          </div>
          {rentPaneles.length===0 ? (
            <Card style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:32,marginBottom:10}}>🖥️</div>
              <div style={{color:C.muted}}>No hay paneles registrados</div>
            </Card>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {rentPaneles.map((p,i)=>(
                <Card key={p.id} style={{padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{width:42,height:42,borderRadius:11,
                      background:(p.estado==="Ocupado"?C.red:C.green)+"18",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                      {p.foto||"📡"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:C.white}}>{p.nombre}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:1}}>{p.ciudad} · {p.tipo} · {p.numCtrs} contrato{p.numCtrs!==1?"s":""}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>Ocupación</div>
                      <div style={{fontSize:16,fontWeight:800,color:p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}}>
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
                      <div key={l} style={{background:C.surface,borderRadius:8,padding:"9px 10px",textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:800,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:C.muted}}>% ocupación histórica</span>
                      <span style={{fontSize:10,fontWeight:700,color:p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}}>{p.ocupPct}%</span>
                    </div>
                    <Bar val={p.ocupPct} max={100} color={p.ocupPct>60?C.green:p.ocupPct>30?C.amber:C.red}/>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {seccion==="prefactura" && (
        <div>
          <Card style={{marginBottom:16,background:C.card}}>
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
                    <span key={t} style={{background:C.green+"18",color:C.green,border:`1px solid ${C.green}33`,
                      borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✓ {t}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div style={{marginBottom:14,fontSize:11,fontWeight:700,color:C.muted}}>
            Selecciona un contrato para generar el comprobante
          </div>

          {contratosFact.length===0 ? (
            <Card style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:32,marginBottom:10}}>📋</div>
              <div style={{color:C.muted}}>No hay contratos registrados</div>
            </Card>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {contratosFact.map(c=>(
                <Card key={c.id} style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:22,flexShrink:0}}>{c.panel.foto||"📡"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:C.white,marginBottom:2}}>{c.cliente.empresa}</div>
                      <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{c.panel.nombre} · {c.panel.ciudad}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        <span style={{background:C.accent+"18",color:C.accent,border:`1px solid ${C.accent}33`,
                          borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                          {fmt(c.monto)}/mes
                        </span>
                        <span style={{background:(c.pagado?C.green:C.amber)+"18",
                          color:c.pagado?C.green:C.amber,
                          border:`1px solid ${c.pagado?C.green:C.amber}33`,
                          borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                          {c.pagado?"✅ Pagado":"⏳ Pendiente"}
                        </span>
                        {!c.cliente.ruc && (
                          <span style={{background:C.red+"18",color:C.red,border:`1px solid ${C.red}33`,
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
                        background:C.card,
                        border:`1px solid ${C.accent}44`,borderRadius:10,
                        color:C.white,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                      🧾 Generar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
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

// APP ROOT
export default function App(){
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
                requireInteraction: d <= 5});
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
    {id:"mapa",      label:"Mapa"},
    {id:"paneles",   label:"Paneles"},
    {id:"contratos", label:"Contratos"},
    {id:"historico", label:"Histórico"},
    {id:"crm",       label:"Clientes"},
    {id:"ranking",   label:"Ranking"},
    {id:"resultados",label:"Resultados"},
    {id:"gastos",    label:"Gastos"},
    {id:"facturacion",label:"Facturación"},
    {id:"perfil",    label:"Perfil"},
  ];

  const activeTab = showProfile ? "perfil" : tab;

  // Handle tab click including perfil
  const handleTabClick = (id) => {
    if(id==="perfil"){ setShowProfile(true); }
    else { setTab(id); setShowProfile(false); }
  };

  return(<>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <meta name="theme-color" content="#0A0F1E"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <style>{`*{box-sizing:border-box;padding:0;background:#0A0F1E;height:100%;overscroll-behavior-y:none;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}50%{opacity:0.55}}`}</style>

    <div style={{width:"100%",height:"100dvh",backgroundColor:C.bg,display:"flex",flexDirection:"column",margin:0,padding:0,fontFamily:"'DM Sans',sans-serif",color:C.text,overflow:"hidden",position:"relative"}}>
      <div style={{
        flexShrink:0,
        paddingTop:"max(44px, env(safe-area-inset-top))",
        paddingLeft:10,paddingRight:10,paddingBottom:6,
        background:"rgba(8,12,24,0.96)",
        borderBottom:"1px solid rgba(79,124,255,0.13)",
        position:"relative",zIndex:10}}>

        <div style={{
          display:"flex",alignItems:"center",gap:8,
          height:44}}>
          <div style={{flexShrink:0}}>
            <div style={{fontWeight:900,fontSize:16,color:"#fff"}}>VISTA360</div>
          </div>

          <div style={{
            flex:1,minWidth:0,
            display:"flex",alignItems:"center",
            overflowX:"auto",overflowY:"hidden",
            scrollbarWidth:"none",
            gap:3,
            padding:"3px 0"}}>
            {tabs.filter(t=>t.id!=="perfil").map(t=>{
              const active=activeTab===t.id;
              return(
                <button key={t.id} onClick={()=>handleTabClick(t.id)} style={{
                  flexShrink:0,
                  display:"flex",flexDirection:"row",alignItems:"center",
                  gap:5,
                  padding:active?"7px 13px":"7px 10px",
                  background:active
                    ?C.accent+"22"
                    :"transparent",
                  border:active?"1px solid rgba(79,124,255,0.35)":"1px solid transparent",
                  borderRadius:11,cursor:"pointer",
                  color:active?"#FFFFFF":"rgba(255,255,255,0.38)",
                  {active&&<div style={{position:"absolute",bottom:0,left:"25%",right:"25%",height:"2px",background:C.card,borderRadius:2,pointerEvents:"none"}}/>}
                  <span style={{flexShrink:0,display:"flex",alignItems:"center",opacity:active?1:0.45,transform:"scale(0.76)"}}>
                    {ICONS[t.id]||ICONS.dashboard}
                  </span>
                  <span style={{fontSize:12,fontWeight:active?700:500,color:active?"#fff":"rgba(255,255,255,0.4)"}}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={()=>handleTabClick("perfil")} style={{
            flexShrink:0,width:34,height:34,borderRadius:"50%",
            background:C.card,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:800,color:"#fff",
            border:activeTab==="perfil"?"2px solid #4F7CFF":"2px solid rgba(255,255,255,0.12)",
            cursor:"pointer"}}>AM</button>
        </div>
      </div>

      <div style={{
        flex:1,minHeight:0,
        position:"relative",zIndex:1,
        overflow:"hidden",
        backgroundColor:C.bg}}>
        <main style={{height:"100%",overflowY:"auto",overflowX:"hidden",padding:"20px",paddingBottom:"calc(env(safe-area-inset-bottom) + 6px)",backgroundColor:C.bg}}>

          {showProfile&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,padding:"20px",background:C.card,borderRadius:20,border:"1px solid rgba(59,110,248,0.2)"}}>
                <img src="https://ui-avatars.com/api/?name=Alan+Martinez&background=3B82F6&color=fff&size=64&bold=true" style={{width:64,height:64,borderRadius:"50%",border:"3px solid #3B82F6"}} alt="perfil"/>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>Alan Martínez</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:2}}>Administrador · Vista360</div>
                </div>
              </div>
              <Firebase contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos} fbConnected={!error&&!loading} fbLoading={loading} fbError={!!error}/>
            </div>
          )}

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
              {tab==="mapa"       &&<Mapa       paneles={paneles} clientes={clientes} contratos={contratos}/>}
              {tab==="paneles"    &&<Paneles    paneles={paneles} setPaneles={setPaneles} loading={loading} setTab={setTab}/>}
              {tab==="contratos"  &&<Contratos  contratos={contratos} setContratos={setContratos} paneles={paneles} clientes={clientes} loading={loading} setTab={setTab}/>}
              {tab==="historico"  &&<Historico  contratos={contratos} paneles={paneles} clientes={clientes}/>}
              {tab==="crm"        &&<CRM        clientes={clientes} setClientes={setClientes} contratos={contratos} loading={loading}/>}
              {tab==="ranking"    &&<div><RankingPaneles paneles={paneles} contratos={contratos} gastos={gastos} setTab={setTab}/><div style={{marginTop:28}}><Card><RankingClientes clientes={clientes} contratos={contratos}/></Card></div></div>}
              {tab==="resultados" &&<Resultados contratos={contratos} loading={loading}/>}
              {tab==="reportes"   &&<Reportes   contratos={contratos} paneles={paneles} clientes={clientes} gastos={gastos}/>}
              {tab==="gastos"     &&<Gastos     gastos={gastos} setGastos={setGastos}/>}
              {tab==="facturacion"&&<Facturacion contratos={contratos} paneles={paneles} clientes={clientes}/>}
            </>
          )}
        </main>
      </div>
    </div>
  </>);
}
