import { describe, expect, it } from "vitest";
import { facturaDePrueba } from "../test/fixtures";
import type { ItemCola } from "./cola/item";
import { resumirPanel, ultimosMeses } from "./panel";
import { fechaDeCelda, leerRegistros, type Movimiento } from "./sheets/registros";

const ahora = new Date("2026-10-29T15:00:00Z");

const mov = (m: Partial<Movimiento>): Movimiento => ({
  pestania: "egresos",
  fila: 2,
  fecha: "2026-10-05",
  contraparte: "Corralón Ejemplo S.A.",
  cuit: "33693450239",
  moneda: "Pesos",
  total: 1000,
  ...m,
});

function item(i: Partial<ItemCola>): ItemCola {
  return {
    id: crypto.randomUUID(),
    recibida: "2026-10-28T12:00:00Z",
    origen: "web",
    enviadaPor: "a",
    archivo: { nombre: "f.pdf", mediaType: "application/pdf", driveId: "d", url: "u" },
    estado: "pendiente",
    lectura: { factura: facturaDePrueba(), desde: null, fallback: false },
    error: null,
    resuelta: null,
    resueltaPor: null,
    resultado: null,
    telegram: null,
    huella: "h",
    notas: [],
    ...i,
  };
}

describe("resumirPanel", () => {
  it("suma el mes por grupo: compras, honorarios de los socios y ventas, solo en pesos", () => {
    const r = resumirPanel(
      [
        mov({ total: 1000 }),
        mov({ total: -200 }), // nota de crédito
        mov({ cuit: "20398016328", contraparte: "Mindlin Matías", total: 500 }),
        mov({ pestania: "ingresos", contraparte: "Martín Miranda", total: 9000 }),
        mov({ moneda: "Dólares", total: 50 }),
        mov({ fecha: "2026-09-30", total: 7000 }),
        mov({ fecha: null, total: 1 }),
      ],
      [],
      ahora,
    );
    expect(r.mes).toBe("2026-10");
    expect(r.mesActual).toEqual({
      compras: { total: 800, cantidad: 2 },
      honorarios: { total: 500, cantidad: 1 },
      ventas: { total: 9000, cantidad: 1 },
    });
    expect(r.meses).toHaveLength(12);
    expect(r.meses.at(-1)).toEqual({ mes: "2026-10", egresos: { total: 1300, cantidad: 3 }, ingresos: { total: 9000, cantidad: 1 } });
    expect(r.meses.at(-2)?.egresos.total).toBe(7000);
    expect(r.enOtraMoneda).toBe(1);
    expect(r.fechasARevisar).toEqual({ cantidad: 1, filas: [{ pestania: "egresos", fila: 2, motivo: "sin_fecha" }] });
  });

  it("señala las fechas imposibles, como un error de tipeo en el año", () => {
    const r = resumirPanel([mov({ fila: 164, fecha: "2062-08-03" }), mov({ fila: 165 })], [], ahora);
    expect(r.fechasARevisar).toEqual({ cantidad: 1, filas: [{ pestania: "egresos", fila: 164, motivo: "futura" }] });
    expect(r.mesActual.compras.cantidad).toBe(1);
  });

  it("agrupa los proveedores por CUIT y junta el resto en Otros", () => {
    const movimientos = [
      mov({ cuit: "1", contraparte: "Corralon SA", total: 100 }),
      mov({ cuit: "1", contraparte: "Corralón S.A.", total: 100 }),
      ...Array.from({ length: 7 }, (_, i) => mov({ cuit: `p${i}`, contraparte: `Proveedor ${i}`, total: 10 + i })),
    ];
    const { proveedores } = resumirPanel(movimientos, [], ahora);
    expect(proveedores.lista[0]).toEqual({ nombre: "Corralón S.A.", total: 200, cantidad: 2 });
    expect(proveedores.lista).toHaveLength(6);
    expect(proveedores.otros).toEqual({ total: 10 + 11, cantidad: 2 });
  });

  it("cuenta la cola y lo que cargó la app en el mes", () => {
    const items = [
      item({ estado: "pendiente" }),
      item({ estado: "aprobando" }),
      item({ estado: "error" }),
      item({ estado: "aprobada", origen: "telegram", recibida: "2026-10-28T12:00:00Z", resuelta: "2026-10-28T14:00:00Z", resultado: { pestania: "Compras", fila: 230, link: "l" } }),
      item({ estado: "aprobada", recibida: "2026-10-27T12:00:00Z", resuelta: "2026-10-28T16:00:00Z" }),
      item({ estado: "aprobada", recibida: "2026-09-01T12:00:00Z", resuelta: "2026-09-02T12:00:00Z" }),
    ];
    const r = resumirPanel(null, items, ahora, "Falta SHEET_ID");
    expect(r.cola).toEqual({ paraRevisar: 2, conError: 1, leyendo: 0 });
    expect(r.app).toEqual({ cargadas: 2, porTelegram: 1, horasHastaCarga: (2 + 28) / 2 });
    expect(r.recientes[0]).toMatchObject({ estado: "aprobada", fila: null });
    expect(r.recientes.find((x) => x.fila === 230)).toMatchObject({ pestania: "egresos", contraparte: "Corralón Ejemplo S.A." });
    expect(r.sinPlanilla).toBe("Falta SHEET_ID");
  });

  it("los últimos meses cruzan el año", () => {
    expect(ultimosMeses("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("movimientos de la planilla", () => {
  it("lee fechas como número de serie o texto", () => {
    expect(fechaDeCelda(46293)).toBe("2026-09-28");
    expect(fechaDeCelda("03/10/2026")).toBe("2026-10-03");
    expect(fechaDeCelda("2026-10-3")).toBe("2026-10-03");
    expect(fechaDeCelda("")).toBeNull();
  });

  it("toma importe con signo, moneda y fecha de cada fila", () => {
    const egreso = ["Nota de Crédito A", "00005-00000001", "Corralón", "Materiales", "33-69345023-9", "", "", "", "", "Pesos", ...Array(7).fill(""), -1210];
    const ingreso = ["Factura A", "00002-00000006", "Martín Miranda", "Amortización", "20-12345678-6", "1 A", "Pesos", 100, "", 21, "1.234,50"];
    const { movimientos } = leerRegistros([egreso], [ingreso], { egresos: [[46293]], ingresos: [["03/10/2026"]] });
    expect(movimientos).toEqual([
      { pestania: "egresos", fila: 2, fecha: "2026-09-28", contraparte: "Corralón", cuit: "33693450239", moneda: "Pesos", total: -1210 },
      { pestania: "ingresos", fila: 2, fecha: "2026-10-03", contraparte: "Martín Miranda", cuit: "20123456786", moneda: "Pesos", total: 1234.5 },
    ]);
  });
});
