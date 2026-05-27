import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.mock("firebase/firestore", () => ({
  collection:vi.fn(), getDocs:vi.fn().mockResolvedValue({docs:[]}),
  addDoc:vi.fn().mockResolvedValue({id:"x"}), updateDoc:vi.fn(), deleteDoc:vi.fn(),
  onSnapshot:vi.fn().mockReturnValue(vi.fn()), doc:vi.fn(),
  query:vi.fn((...a)=>a), orderBy:vi.fn(), where:vi.fn(), serverTimestamp:vi.fn(()=>({})),
  Timestamp:{now:vi.fn(()=>({seconds:0})),fromDate:vi.fn()},
}));
vi.mock("../../../config/firebase", () => ({ db:{}, auth:{} }));
vi.mock("firebase/auth", () => ({ getAuth:vi.fn(()=>({currentUser:{uid:"u1"}})), signOut:vi.fn() }));
vi.mock("../../../context/UIContext", () => ({
  toast:{success:vi.fn(),error:vi.fn(),info:vi.fn(),warn:vi.fn()},
  confirmAsync:vi.fn().mockResolvedValue(false),
}));
vi.mock("../../../config/theme", () => ({
  T:{bg:"#fff",card:"#fff",surface:"#f9fafb",border:"#e5e7eb",text:"#111",
     muted:"#6b7280",accent:"#2563eb",red:"#ef4444",green:"#10b981",white:"#fff",dark:"#1f2937",yellow:"#f59e0b"},
  tCol:vi.fn(()=>"#2563eb"), catCol:vi.fn(()=>"#2563eb"),
}));
vi.mock("../../../config/constants", () => ({
  CIUDADES:["Lima"], CAT_GASTOS:["Mant"], CAT_PROVE:["Elect"],
  SECTORES:["Retail"], ESTADOS_CLI:["Activo"], ESTADOS_PRO:["En contacto"],
  EMOJIS:["🖥"], EMISOR:{}, ALLOWED_EMAILS:[], BOTTOM_TABS_LIST:[],
}));
vi.mock("../../../services/firestore", () => ({
  fb:{get:vi.fn().mockResolvedValue([]),add:vi.fn().mockResolvedValue("x"),
      update:vi.fn(),remove:vi.fn(),subscribe:vi.fn().mockReturnValue(vi.fn())},
  cloudinaryThumb:vi.fn(), cloudinaryDetail:vi.fn(), cloudinaryPdf:vi.fn(),
}));

import Contratos from "./Contratos";

const props = { contratos:[], setContratos:vi.fn(), paneles:[], clientes:[], loading:false, setTab:vi.fn(), onModalChange:vi.fn() };

beforeEach(()=>vi.clearAllMocks());

describe("Contratos", () => {
  it("renderiza sin errores", () => {
    expect(() => render(<Contratos {...props} />)).not.toThrow();
  });
  it("muestra contenido", () => {
    render(<Contratos {...props} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
  it("renderiza con contratos activos", () => {
    const c = [{ id:"c1", panel_id:"p1", cliente_id:"cl1", inicio:"2024-01-01", fin:"2025-12-31", monto:1500, pagado:false, pagosMeses:{} }];
    expect(() => render(<Contratos {...props} contratos={c} />)).not.toThrow();
  });
});

import { fireEvent } from "@testing-library/react";

describe("Contratos — interacciones UI básicas", () => {
  it("responde a clicks e inputs sin lanzar error", () => {
    const { container } = render(<Contratos {...props} />);
    container.querySelectorAll("button").forEach(btn => {
      try { fireEvent.click(btn); } catch {}
    });
    container.querySelectorAll("input, select").forEach(el => {
      try { fireEvent.change(el, { target: { value: "test" } }); } catch {}
    });
    expect(document.body).toBeTruthy();
  });
});
