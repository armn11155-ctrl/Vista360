// MiniMapaPanel — App-15.tsx líneas 1835-1927
// Mini mapa embebido en el formulario de edición de paneles
import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../config/theme";
import { toNumber } from "../../../lib/converters";
import type { Coord } from "../../../types";

interface MiniMapaPanelProps {
  lat: Coord; lng: Coord; nombre: string; foto?: string;
  onMove?: (lat: number, lng: number) => void;
}

export default function MiniMapaPanel({ lat, lng, nombre }: MiniMapaPanelProps) {
  const latN = toNumber(lat); const lngN = toNumber(lng);
  if (!latN || !lngN) return (
    <div style={{ background:T.accentLt, borderRadius:12, padding:12, fontSize:13, color:T.muted }}>
      📍 Sin coordenadas — agrega lat/lng para ver el mapa
    </div>
  );
  const src = `https://www.google.com/maps/embed/v1/place?key=&q=${latN},${lngN}`;
  return (
    <div style={{ borderRadius:12, overflow:"hidden", height:180 }}>
      <div style={{ background:T.accentLt, height:"100%", display:"flex", alignItems:"center",
        justifyContent:"center", flexDirection:"column", gap:8, color:T.accent }}>
        <div style={{ fontSize:28 }}>📍</div>
        <div style={{ fontSize:13, fontWeight:600 }}>{nombre}</div>
        <div style={{ fontSize:12, color:T.muted }}>{latN.toFixed(5)}, {lngN.toFixed(5)}</div>
        <a href={`https://maps.google.com/?q=${latN},${lngN}`} target="_blank" rel="noreferrer"
          style={{ fontSize:12, color:T.accent, textDecoration:"underline" }}>Ver en Maps</a>
      </div>
    </div>
  );
}
