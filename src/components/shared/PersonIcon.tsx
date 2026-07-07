interface Props {
  size?: number;
  color?: string;
}

/**
 * Silueta genérica de persona (cabeza + hombros), en blanco por defecto.
 * Va SIEMPRE dentro de los avatares de cliente/contacto — lo único que
 * cambia entre uno y otro es el color de fondo detrás (avatarPalette),
 * nunca el ícono en sí. Mismo criterio que en Vista360 Player.
 */
export function PersonIcon({ size = 20, color = "#fff" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="36" r="18" fill={color} />
      <path
        d="M50 58c-20.5 0-37 14.5-37 36.5V100h74v-5.5C87 72.5 70.5 58 50 58z"
        fill={color}
      />
    </svg>
  );
}
