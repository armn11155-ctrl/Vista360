/** Design tokens — usar T.* en todo el código */
export const T = {
  bg: "#F2F4F8",
  dark: "#0D1629",
  darker: "#07101F",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  white: "#FFFFFF",
  sidebarBg: "#FFFFFF",
  contentBg: "#F2F4F8",
  text: "#0D1629",
  muted: "#64748B",
  accent: "#2563EB",
  accentLt: "#EFF4FF",
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#7C3AED",
  cyan: "#0891B2",
  border: "#E5E7EB",
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
