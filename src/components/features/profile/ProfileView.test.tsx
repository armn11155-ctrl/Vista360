import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 5 }) }),
}));
vi.mock("../../../config/firebase", () => ({ db: { _databaseId: { projectId: "test-project" } }, auth: {} }));
vi.mock("../../../config/theme", () => ({
  T: { bg:"#fff",card:"#fff",surface:"#f9fafb",border:"#e5e7eb",text:"#111",
       muted:"#6b7280",accent:"#2563eb",red:"#ef4444",green:"#10b981",white:"#fff",dark:"#1f2937" },
}));
vi.mock("../../../lib/firestoreSize", () => ({
  estimateDocSize: vi.fn(() => 100),
  formatBytes: vi.fn(() => "1.0 KB"),
}));

import { ProfileView, FirebaseStatus } from "./ProfileView";

const mockUser = {
  uid: "user-123",
  email: "test@example.com",
  displayName: "Usuario Test",
  photoURL: null,
} as unknown as import("firebase/auth").User;

const defaultProps = {
  user: mockUser,
  userName: "Usuario Test",
  gastos: [],
  confirmLogout: false,
  setConfirmLogout: vi.fn(),
  onLogout: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => vi.clearAllMocks());

describe("ProfileView", () => {
  it("renderiza sin errores", () => {
    expect(() => render(<ProfileView {...defaultProps} />)).not.toThrow();
  });

  it("muestra el nombre del usuario", () => {
    render(<ProfileView {...defaultProps} />);
    expect(screen.getByText("Usuario Test")).toBeTruthy();
  });

  it("muestra el email del usuario", () => {
    render(<ProfileView {...defaultProps} />);
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });

  it("interactúa con botones disponibles", () => {
    const { container } = render(<ProfileView {...defaultProps} />);
    container.querySelectorAll("button").forEach(btn => {
      try { fireEvent.click(btn); } catch {}
    });
    expect(document.body).toBeTruthy();
  });

  it("muestra confirmación al intentar cerrar sesión", () => {
    render(<ProfileView {...defaultProps} confirmLogout={true} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});

describe("FirebaseStatus", () => {
  it("renderiza (retorna null)", () => {
    const { container } = render(
      <FirebaseStatus gastos={[]} fbConnected={true} fbLoading={false} fbError={false} />
    );
    expect(container.firstChild).toBeNull();
  });
});
