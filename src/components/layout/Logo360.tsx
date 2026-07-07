// Logo se sirve vía URL para reutilizar la imagen ya decodificada en caché.
// IMPORTANTE: NO cambiar a base64.
// #pre-splash (index.html) usa /logo.png. Si Logo360 usara base64, el browser
// trataría los dos como recursos distintos y debería decodificar la imagen dos
// veces: cuando monta React (#pre-splash todavía en DOM) y cuando useLayoutEffect
// elimina #pre-splash. La decodificación de una imagen 612×408 toma ~1 frame
// en iPhone → flash blanco perceptible justo antes de que comience la animación.
// Con la URL, el browser reutiliza la imagen ya decodificada → transición perfecta.
export function Logo360({ width = 200 }: { width?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Vista360"
      width={width}
      decoding="sync"
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
