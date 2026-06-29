/**
 * Design tokens — usar T.* en todo el código.
 *
 * Paleta híbrida: fondo de página claro + tarjetas/acentos "premium
 * dark" (navy casi negro con glow azul) flotando encima.
 *
 * IMPORTANTE: accent, green, red, amber, purple, cyan, surface, card y
 * border se usan en muchos sitios como `${T.token}XX` (sufijo hex de
 * alpha, ej. `T.accent + "18"`), así que deben permanecer en formato
 * hex de 6 dígitos — nunca rgba()/hsla() ni shorthand de 3 dígitos.
 *
 * text/muted son CLAROS a propósito: están pensados para texto DENTRO
 * de las tarjetas oscuras (T.card/T.surface/T.dark). Para texto que
 * queda directamente sobre el fondo de página (T.bg, ahora claro) hay
 * que usar un color oscuro explícito en ese punto, no T.text/T.muted.
 */
export const T = {
  bg: "#F2F4F8",
  dark: "#0D1629",
  darker: "#07101F",
  surface: "#121D33",
  card: "#15213B",
  white: "#FFFFFF",
  sidebarBg: "#0B1424",
  contentBg: "#F2F4F8",
  text: "#F1F5F9",
  muted: "#8B96AC",
  accent: "#3B82F6",
  accentLt: "rgba(59,130,246,0.16)",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  cyan: "#22D3EE",
  border: "#1F2C42",
} as const;

export const tCol = (t: string) => (t === "Cliente" ? T.green : T.purple);
export const catCol: Record<string, string> = {
  Mantenimiento: T.white,
  Personal: T.accent,
  Transporte: T.cyan,
  Administrativo: T.purple,
  Servicios: T.green,
  Marketing: T.red,
  Otro: T.muted,
};
