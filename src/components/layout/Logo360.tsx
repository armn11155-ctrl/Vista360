// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React from "react";
// Base64 en assets/logos.ts — importar o reemplazar por archivo PNG
export function Logo360({ width = 200 }: { width?: number }) {
  return (
    <div style={{ width, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg viewBox="0 0 220 60" width={width} fill="none">
        <text x="10" y="46" fontFamily="'Barlow Condensed',sans-serif"
          fontWeight="900" fontSize="52" fill="white" letterSpacing="-2">
          VISTA
        </text>
        <text x="135" y="46" fontFamily="'Barlow Condensed',sans-serif"
          fontWeight="900" fontSize="52" fill="#2563EB" letterSpacing="-2">
          360
        </text>
      </svg>
    </div>
  );
}
