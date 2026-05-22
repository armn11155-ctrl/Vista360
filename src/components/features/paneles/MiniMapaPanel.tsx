// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../config/theme";
import { toNumber } from "../../../lib/converters";
import type { Coord } from "../../../types";

function MiniMapaPanel({ lat, lng, nombre, foto, onMove }: MiniMapaPanelProps){
  // Normalizar Coord → number en el límite del componente
  const latN = toNumber(lat);
  const lngN = toNumber(lng);
  const containerRef=useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef=useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef=useRef<any>(null);
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
  const reverseGeocode=async(la: number, ln: number)=>{
    setGeocodingReverse(true);
    const controller = new AbortController();
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json&accept-language=es`, { signal: controller.signal });
      const d=await r.json();
      const addr=(d&&typeof d==="object"&&d.address)?d.address:{};
      const road=addr.road||addr.pedestrian||addr.suburb||"";
      const city=addr.city||addr.town||addr.county||addr.state||"";
      const short=road&&city?`${road}, ${city}`:(d&&d.display_name?d.display_name.split(",").slice(0,3).join(", "):`${la.toFixed(5)}, ${ln.toFixed(5)}`);
      onMove(la,ln,short);
    }catch(e){
      if ((e as {name?:string}).name === "AbortError") return;
      console.warn("[Geocoding] Reverse geocoding falló, usando coords brutas:", e);
      onMove(la,ln,`${la.toFixed(5)}, ${ln.toFixed(5)}`);
    }finally{
      setGeocodingReverse(false);
    }
  };

  // Inicializar mapa
  useEffect(()=>{
    if(!ready||!containerRef.current||mapRef.current) return;
    const map=window.L.map(containerRef.current,{center:[latN,lngN],zoom:16,zoomControl:true,scrollWheelZoom:true});
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
    const marker=window.L.marker([latN,lngN],{icon,draggable:true}).addTo(map);
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
    markerRef.current.setLatLng([latN,lngN]);
    mapRef.current.setView([latN,lngN],16);
  },[latN,lngN]);

  return(
    <div style={{borderRadius:14,overflow:"hidden",border:`1px solid ${T.border}`,height:230,position:"relative"}}>
      {!ready&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:T.surface,color:T.muted,fontSize:13,zIndex:10}}>Cargando mapa…</div>}
      {geocodingReverse&&<div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",background:T.surface+"EE",borderRadius:8,padding:"5px 12px",fontSize:12,color:T.accent,zIndex:1000,fontWeight:600}}>📍 Obteniendo dirección…</div>}
      <div ref={containerRef} style={{height:"100%",width:"100%"}}/>
    </div>
  );
}

// ── GESTIÓN DE PANELES ───────────────────────────────────────────

export default MiniMapaPanel;
