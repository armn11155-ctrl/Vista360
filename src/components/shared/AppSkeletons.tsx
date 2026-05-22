/** Skeleton card oscuro — usado durante la carga inicial de datos */
export function SkDarkCard() {
  return (
    <div
      style={{
        background: "#1A2744",
        borderRadius: 16,
        padding: "18px 16px",
        marginBottom: 12,
        animation: "skPulse 1.6s ease-in-out infinite",
        backgroundSize: "200% 100%",
        backgroundImage: "linear-gradient(90deg,#1A2744 25%,#243059 50%,#1A2744 75%)",
      }}
    >
      <div
        style={{
          height: 12,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 6,
          width: "60%",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          height: 28,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
          width: "40%",
          marginBottom: 8,
        }}
      />
      <div
        style={{ height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 6, width: "80%" }}
      />
    </div>
  );
}

/** Fallback de Suspense mientras carga el chunk lazy de cada ruta */
export function TabSuspense() {
  return (
    <div style={{ padding: "20px 16px" }}>
      {[1, 2, 3].map(i => (
        <SkDarkCard key={i} />
      ))}
    </div>
  );
}
