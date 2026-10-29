// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Bandeja } from "./Bandeja";
import { FichaRevision } from "./FichaRevision";
import { Subir } from "./Subir";
import { Historial } from "./Historial";
import { pendientesDeInterfaz, pendienteDePrueba } from "@/test/ux-fixtures";

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({ matches: false })),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recorrido de revisión", () => {
  it("muestra la nota de crédito con el signo que tiene su registro contable", () => {
    const i = pendienteDePrueba();
    render(
      <Historial
        items={[
          {
            ...i,
            estado: "aprobada",
            lectura: {
              ...i.lectura!,
              factura: {
                ...i.lectura!.factura,
                tipo_comprobante: "nota_credito",
                total: 1210,
              },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText("$ -1.210,00")).toBeTruthy();
  });

  it("marca la fecha inválida y bloquea la aprobación hasta corregirla", () => {
    render(<FichaRevision item={pendienteDePrueba()} onResuelto={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Fecha", { exact: true }), {
      target: { value: "" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Aprobar y cargar",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Fecha");
    fireEvent.change(screen.getByLabelText("Fecha", { exact: true }), {
      target: { value: "2026-10-28" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Aprobar y cargar",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("respeta el máximo de dos cargas simultáneas entre lotes distintos", async () => {
    const resolver: (() => void)[] = [];
    let enCurso = 0,
      maximo = 0;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          ++enCurso;
          maximo = Math.max(maximo, enCurso);
          resolver.push(() => {
            --enCurso;
            resolve(json({ item: pendienteDePrueba() }));
          });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <Subir onSubida={vi.fn()} onActividad={vi.fn()} onIrARevisar={vi.fn()} />,
    );
    const archivo = (n: number) =>
      new File(["%PDF-prueba"], `${n}.pdf`, { type: "application/pdf" });
    const input = screen.getByLabelText("Archivos de facturas");
    fireEvent.change(input, {
      target: { files: [archivo(1), archivo(2), archivo(3)] },
    });
    fireEvent.change(input, { target: { files: [archivo(4), archivo(5)] } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    resolver[0]();
    resolver[1]();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    resolver[2]();
    resolver[3]();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    resolver[4]();
    await waitFor(() =>
      expect(screen.getAllByText("Lista para revisar")).toHaveLength(5),
    );
    expect(maximo).toBe(2);
  });

  it("conserva los cambios al alternar de comprobante y de sección", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ pendientes: pendientesDeInterfaz, historial: [] }),
      ),
    );
    render(<Bandeja />);
    const concepto = await screen.findByRole("textbox", { name: /^Concepto/ });
    fireEvent.change(concepto, {
      target: { value: "Materiales revisados por el equipo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PEREZ ANA/ }));
    expect(
      (screen.getByRole("textbox", { name: /^Concepto/ }) as HTMLInputElement)
        .value,
    ).toBe("Honorarios de administración");
    fireEvent.click(screen.getByRole("button", { name: /Corralón Ejemplo/ }));
    expect(
      (screen.getByRole("textbox", { name: /^Concepto/ }) as HTMLInputElement)
        .value,
    ).toBe("Materiales revisados por el equipo");
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bandeja/ }));
    expect(
      (screen.getByRole("textbox", { name: /^Concepto/ }) as HTMLInputElement)
        .value,
    ).toBe("Materiales revisados por el equipo");
  });

  it("bloquea duplicados conocidos y vuelve a habilitar si se corrige la identidad", () => {
    render(
      <FichaRevision
        item={pendienteDePrueba({ cargada: { tipo: "duplicada", fila: 8 } })}
        onResuelto={vi.fn()}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Duplicado detectado",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Número" }), {
      target: { value: "99990001" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Aprobar y cargar",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("la búsqueda tolera tildes y muestra un vacío recuperable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ pendientes: pendientesDeInterfaz, historial: [] }),
      ),
    );
    render(<Bandeja />);
    const buscador = await screen.findByRole("textbox", {
      name: "Buscar comprobantes",
    });
    fireEvent.change(buscador, { target: { value: "corralon" } });
    expect(
      screen.getByRole("button", { name: /Corralón Ejemplo/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PEREZ ANA/ })).toBeNull();
    fireEvent.change(buscador, { target: { value: "no-existe" } });
    expect(
      screen.getByRole("heading", { name: "No encontramos coincidencias" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByRole("button", { name: /PEREZ ANA/ })).toBeTruthy();
  });

  it("una subida termina y conserva su resultado aunque se cambie de sección", async () => {
    let terminar!: (r: Response) => void;
    const post = new Promise<Response>((resolve) => {
      terminar = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, opciones?: RequestInit) => {
        if (opciones?.method === "POST") return post;
        if (url === "/api/telegram")
          return Promise.resolve(json({ configurado: false }));
        return Promise.resolve(json({ pendientes: [], historial: [] }));
      }),
    );
    render(<Bandeja />);
    await screen.findByRole("heading", { name: "Todo al día" });
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
        "button",
        { name: "Subir facturas" },
      ),
    );
    fireEvent.change(screen.getByLabelText("Archivos de facturas"), {
      target: {
        files: [
          new File(["%PDF-prueba"], "factura.pdf", { type: "application/pdf" }),
        ],
      },
    });
    await screen.findByText("Leyendo con IA");
    fireEvent.click(screen.getByRole("button", { name: /^Bandeja/ }));
    expect(await screen.findByText(/archivo sigue procesándose/)).toBeTruthy();
    terminar(json({ item: pendienteDePrueba() }));
    await waitFor(() =>
      expect(screen.queryByText(/archivo sigue procesándose/)).toBeNull(),
    );
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
        "button",
        { name: "Subir facturas" },
      ),
    );
    expect(screen.getByText("Lista para revisar")).toBeTruthy();
    expect(screen.getByText("factura.pdf")).toBeTruthy();
  });
});
