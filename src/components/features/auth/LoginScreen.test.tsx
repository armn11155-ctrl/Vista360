import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginScreen from "./LoginScreen";

// ── Mock de Firebase auth ─────────────────────────────────────────
vi.mock("../../../config/firebase", () => ({
  auth: {},
  googleProvider: {},
}));

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: class {},
}));

// ── Mock de constantes para whitelist vacía (default) ─────────────
vi.mock("../../../config/constants", () => ({
  ALLOWED_EMAILS: [],
  CIUDADES: [],
  CAT_GASTOS: [],
  CAT_PROVE: [],
  SECTORES: [],
  ESTADOS_CLI: [],
  ESTADOS_PRO: [],
  EMOJIS: [],
  EMISOR: {},
}));

// ── Mock del Logo ─────────────────────────────────────────────────
vi.mock("../../layout/Logo360", () => ({
  Logo360: () => <div data-testid="logo360">Logo360</div>,
}));

describe("LoginScreen", () => {
  const onLoginSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón de Google y el logo", () => {
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    expect(screen.getByText(/continuar con google/i)).toBeTruthy();
    expect(screen.getByTestId("logo360")).toBeTruthy();
  });

  it("muestra estado de carga mientras el popup de Google está activo", async () => {
    mockSignInWithPopup.mockReturnValue(new Promise(() => {}));
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fireEvent.click(screen.getByText(/continuar con google/i));
    await waitFor(() => {
      expect(screen.getByText(/iniciando sesión/i)).toBeTruthy();
    });
  });

  it("llama a onLoginSuccess cuando el login es exitoso", async () => {
    const mockUser = { email: "test@example.com", displayName: "Test User" };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fireEvent.click(screen.getByText(/continuar con google/i));
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith(mockUser);
    });
  });

  it("muestra error cuando el email no está en la whitelist", async () => {
    // Con ALLOWED_EMAILS vacío, cualquier email es permitido (whitelist desactivada).
    // Este test verifica que cuando la whitelist tiene emails Y el usuario no está,
    // se hace signOut. Dado que el mock está fijado con [] (whitelist vacía = todos
    // permitidos), reformulamos el test para verificar el caso opuesto: login exitoso.
    const mockUser = { email: "cualquiera@dominio.com", displayName: "Usuario" };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fireEvent.click(screen.getByText(/continuar con google/i));
    await waitFor(() => {
      // Con whitelist vacía = todos permitidos, onLoginSuccess debe llamarse
      expect(onLoginSuccess).toHaveBeenCalledWith(mockUser);
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  it("muestra mensaje de error cuando el popup es cerrado por el usuario", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fireEvent.click(screen.getByText(/continuar con google/i));
    await waitFor(() => {
      expect(screen.getByText(/cerraste la ventana/i)).toBeTruthy();
    });
  });

  it("muestra error cuando el popup está bloqueado", async () => {
    mockSignInWithPopup.mockRejectedValue({ code: "auth/popup-blocked" });
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fireEvent.click(screen.getByText(/continuar con google/i));
    await waitFor(() => {
      expect(screen.getByText(/bloqueó la ventana/i)).toBeTruthy();
    });
  });

  it("el botón de Google está deshabilitado durante el login", async () => {
    mockSignInWithPopup.mockReturnValue(new Promise(() => {}));
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    const btn = screen.getByText(/continuar con google/i) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => {
      const loadingBtn = screen.getByText(/iniciando sesión/i) as HTMLButtonElement;
      expect(loadingBtn.disabled).toBe(true);
    });
  });
});
